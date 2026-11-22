import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext } from "./authz";
import { sharedClientRows } from "./shared-clients";
import { resolveProvider } from "./ai-provider";

export const APPOINTMENT_STATUSES = ["scheduled", "attended", "missed", "cancelled"] as const;
type UiStatus = (typeof APPOINTMENT_STATUSES)[number];
const TO_DB: Record<UiStatus, string> = { scheduled: "booked", attended: "completed", missed: "no_show", cancelled: "cancelled" };
const FROM_DB: Record<string, UiStatus> = { booked: "scheduled", reschedule_requested: "scheduled", completed: "attended", no_show: "missed", cancelled: "cancelled" };

export const listClientAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("appointments")
      .select("id, appointment_type, starts_at, ends_at, location, status, worker_id, worker_note, outlook_event_id, outlook_sync_error")
      .eq("organization_id", ctx.organizationId)
      .eq("client_id", data.clientId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ ...r, status: FROM_DB[r.status] ?? r.status }));
  });

export const saveAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        clientId: z.string().uuid(),
        appointmentType: z.string().min(1).max(80),
        startsAt: z.string().min(10).max(40),
        endsAt: z.string().min(10).max(40),
        location: z.string().max(200).nullable().optional(),
        status: z.enum(APPOINTMENT_STATUSES),
        workerNote: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    if (new Date(data.endsAt) <= new Date(data.startsAt)) throw new Error("End time must be after start time.");

    const client = (await sharedClientRows(context.supabase)).find((r) => r.id === data.clientId);
    if (!client) throw new Error("Client not found.");

    const row = {
      organization_id: ctx.organizationId,
      department_id: ctx.departmentId ?? (ctx.isAdmin ? client.department_id : null),
      client_id: data.clientId,
      appointment_type: data.appointmentType,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: new Date(data.endsAt).toISOString(),
      location: data.location ?? null,
      status: TO_DB[data.status],
      worker_note: data.workerNote ?? null,
    };

    let saved: { id: string; outlook_event_id: string | null; worker_id: string | null };
    if (data.id) {
      const { data: u, error } = await context.supabase
        .from("appointments")
        .update(row)
        .eq("id", data.id)
        .eq("organization_id", ctx.organizationId)
        .select("id, outlook_event_id, worker_id")
        .single();
      if (error) throw new Error(error.message);
      saved = u;
    } else {
      const { data: c, error } = await context.supabase
        .from("appointments")
        .insert({ ...row, worker_id: ctx.userId })
        .select("id, outlook_event_id, worker_id")
        .single();
      if (error) throw new Error(error.message);
      saved = c;
    }

    // Outlook calendar sync is paused until each organization can connect its own calendar.
    await audit(context.supabase, ctx, data.id ? "appointment.updated" : "appointment.created", "appointment", saved.id, {
      status: data.status,
    });
    return { id: saved.id };
  });

export const draftFollowUpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ noteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: note } = await context.supabase
      .from("case_notes")
      .select("id, interaction_type, interaction_date, final_note, generated_note, client_id")
      .eq("id", data.noteId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!note) throw new Error("Case note not found.");
    const client = note.client_id ? (await sharedClientRows(context.supabase)).find((r) => r.id === note.client_id) : null;
    const { data: org } = await context.supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this deployment.");
    const provider = resolveProvider({ apiKey });
    const result = await provider.generate({
      systemPrompt: `You write short, warm follow-up emails from a settlement or counselling worker to a client after a meeting.
Rules:
- Use ONLY next steps, appointments and tasks stated in the case note. Never invent anything.
- Never include sensitive details: no clinical content, assessments, mental health details, immigration status details, family conflicts, or names of other people.
- Plain, friendly English, under 150 words. Greeting with the client's first name, a thank-you, a bullet list of next steps, and a sign-off with the worker's name and organization.
- Output format: first line "Subject: <subject>", then a blank line, then the email body.`,
      userPrompt: [
        `Client first name: ${client?.preferred_name || client?.first_name || "there"}`,
        `Worker: ${ctx.fullName}`,
        `Organization: ${org?.name ?? ""}`,
        `Meeting: ${note.interaction_type} on ${note.interaction_date}`,
        "",
        "Case note:",
        note.final_note ?? note.generated_note ?? "",
      ].join("\n"),
    });
    const text = result.text.trim();
    const m = text.match(/^Subject:\s*(.+)\n+/i);
    await audit(context.supabase, ctx, "ai.follow_up_email_drafted", "case_note", note.id, {});
    return {
      to: client?.email ?? "",
      subject: m?.[1] ? m[1].trim() : `Follow-up from ${org?.name ?? "our meeting"}`,
      body: m ? text.slice(m[0].length).trim() : text,
    };
  });
