import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sharedClientRows } from "./shared-clients";
import { audit, loadContext } from "./authz";

const ATT = z.enum(["registered", "attended", "absent", "cancelled"]);

export const listGroupSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("group_sessions")
      .select("id, title, topic, session_type, session_date, start_time, location, delivery_mode, status, facilitator_id, group_session_attendees(attendance)")
      .eq("organization_id", ctx.organizationId)
      .order("session_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map(({ group_session_attendees: a, ...s }) => ({
      ...s,
      registered: a.length,
      attended: a.filter((x) => x.attendance === "attended").length,
    }));
  });

const sessionInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  topic: z.string().max(500).nullable(),
  sessionType: z.string().max(80),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().max(10).nullable(),
  durationMinutes: z.number().int().min(0).max(1440).nullable(),
  location: z.string().max(200).nullable(),
  deliveryMode: z.string().max(40),
  language: z.string().max(60).nullable(),
  coFacilitators: z.string().max(300).nullable(),
  facilitatorName: z.string().trim().max(200).nullable().optional(),
  partnerOrganization: z.string().max(200).nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  sessionNote: z.string().max(20000).nullable(),
});

export const saveGroupSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => sessionInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const row = {
      facilitator_name: data.facilitatorName || null,
      title: data.title, topic: data.topic, session_type: data.sessionType, session_date: data.sessionDate,
      start_time: data.startTime, duration_minutes: data.durationMinutes, location: data.location,
      delivery_mode: data.deliveryMode, language: data.language, co_facilitators: data.coFacilitators,
      partner_organization: data.partnerOrganization, status: data.status, session_note: data.sessionNote,
    };
    if (data.id) {
      const { error } = await context.supabase.from("group_sessions").update(row).eq("id", data.id).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
      await audit(context.supabase, ctx, "group_session.updated", "group_session", data.id);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("group_sessions")
      .insert({ ...row, organization_id: ctx.organizationId, department_id: ctx.departmentId, facilitator_id: ctx.userId, created_by: ctx.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "group_session.created", "group_session", ins.id);
    return { id: ins.id };
  });

export const getGroupSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: s, error } = await context.supabase
      .from("group_sessions").select("*").eq("id", data.id).eq("organization_id", ctx.organizationId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Group session not found.");
    const { data: att } = await context.supabase
      .from("group_session_attendees")
      .select("id, client_id, attendance, note, bus_tokens, emergency_food, meal_provided, childminding_count, pr_info, date_of_birth, child_client_ids, client_language, interpretation_needed, clients(first_name, last_name, client_identifier, date_of_birth)")
      .eq("session_id", data.id);
    const parentIds = (att ?? []).map((a) => a.client_id);
    const sharedClients = await sharedClientRows(context.supabase);
    const byId = new Map(sharedClients.map((r) => [r.id, r]));
    const kids = sharedClients.filter((r) => r.parent_client_id && parentIds.includes(r.parent_client_id));
    let facilitator: string | null = s.facilitator_name ?? null;
    if (!facilitator && s.facilitator_id) {
      const { data: p } = await context.supabase.from("profiles").select("full_name").eq("id", s.facilitator_id).maybeSingle();
      facilitator = p?.full_name ?? null;
    }
    return {
      session: s,
      facilitator,
      attendees: (att ?? []).map((a) => ({ ...a, clients: byId.get(a.client_id) ?? null, children: (kids ?? []).filter((k) => k.parent_client_id === a.client_id) })),
    };
  });

export const addGroupAttendees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sessionId: z.string().uuid(), clientIds: z.array(z.string().uuid()).min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase.from("group_session_attendees").upsert(
      data.clientIds.map((c) => ({ organization_id: ctx.organizationId, session_id: data.sessionId, client_id: c })),
      { onConflict: "session_id,client_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "group_session.attendees_added", "group_session", data.sessionId, { count: data.clientIds.length });
    return { ok: true };
  });

export const updateAttendee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), attendance: ATT.optional(), note: z.string().max(2000).nullable().optional(), remove: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const q = context.supabase.from("group_session_attendees");
    const { error } = data.remove
      ? await q.delete().eq("id", data.id).eq("organization_id", ctx.organizationId)
      : await q.update({ ...(data.attendance ? { attendance: data.attendance } : {}), ...(data.note !== undefined ? { note: data.note } : {}) })
          .eq("id", data.id).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAttendeeServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      busTokens: z.number().int().min(0).max(50).nullable(),
      emergencyFood: z.boolean().nullable(),
      mealProvided: z.boolean().nullable(),
      childmindingCount: z.number().int().min(0).max(50).nullable(),
      prInfo: z.string().max(200).nullable(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      clientLanguage: z.string().max(80).nullable(),
      interpretationNeeded: z.boolean().nullable(),
      note: z.string().max(2000).nullable(),
      childClientIds: z.array(z.string().uuid()).max(30),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: attendee, error: attendeeError } = await context.supabase
      .from("group_session_attendees")
      .select("id, client_id")
      .eq("id", data.id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (attendeeError || !attendee) throw new Error("Group participant not found.");
    if (data.childClientIds.length > 0) {
      const familyChildren = (await sharedClientRows(context.supabase)).filter((r) => r.parent_client_id === attendee.client_id && data.childClientIds.includes(r.id));
      if ((familyChildren ?? []).length !== data.childClientIds.length) {
        throw new Error("One or more selected children are not linked to this client's family record.");
      }
    }
    const { error } = await context.supabase
      .from("group_session_attendees")
      .update({
        bus_tokens: data.busTokens, emergency_food: data.emergencyFood, meal_provided: data.mealProvided,
        childminding_count: data.childmindingCount, pr_info: data.prInfo, date_of_birth: data.dateOfBirth,
        client_language: data.clientLanguage, interpretation_needed: data.interpretationNeeded,
        note: data.note, child_client_ids: data.childClientIds,
      })
      .eq("id", data.id).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "group_session.attendee_services_updated", "group_session_attendee", data.id);
    return { ok: true };
  });

export const markAllAttended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase.from("group_session_attendees").update({ attendance: "attended" })
      .eq("session_id", data.sessionId).eq("organization_id", ctx.organizationId).eq("attendance", "registered");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClientGroupSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("group_session_attendees")
      .select("id, attendance, group_sessions(id, title, session_type, session_date, status)")
      .eq("client_id", data.clientId).eq("organization_id", ctx.organizationId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

