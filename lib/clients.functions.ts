import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext } from "./authz";
import { clientRpc, sharedClientRows, sharedIntake, ownsClientDetails } from "./shared-clients";

export const searchClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const rows = await sharedClientRows(context.supabase);
    const term = data.query?.trim().toLowerCase() ?? "";
    return rows.filter((r) => [r.first_name, r.last_name, r.preferred_name, r.client_identifier].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name)).slice(0, data.limit ?? 25)
      .map(({ id, client_identifier, first_name, last_name, preferred_name, status, department_id }) => ({ id, client_identifier, first_name, last_name, preferred_name, status, department_id }));
  });

type FamilyRow = {
  id: string;
  client_identifier: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  status: string;
  department_id: string | null;
  parent_client_id: string | null;
  family_relationship: string | null;
  date_of_birth: string | null;
};

/**
 * Client list grouped by family: heads of family at the top level, children nested beneath.
 * A search that matches a child returns that child's head of family with the child underneath.
 */
export const listClientFamilies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const all = await sharedClientRows(context.supabase);
    const term = data.query?.trim().toLowerCase() ?? "";
    const matched = all.filter((r) => [r.first_name, r.last_name, r.preferred_name, r.client_identifier].some((v) => v?.toLowerCase().includes(term)));
    const byId = new Map(all.map((r) => [r.id, r]));
    const headIds = new Set(matched.map((r) => r.parent_client_id && byId.has(r.parent_client_id) ? r.parent_client_id : r.id));
    const heads = all.filter((r) => headIds.has(r.id));
    const kidList = all.filter((r) => r.parent_client_id && headIds.has(r.parent_client_id));
    return heads
      .map((h) => ({
        ...h,
        children: kidList
          .filter((k) => k.parent_client_id === h.id)
          .sort((a, b) => a.first_name.localeCompare(b.first_name)),
      }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const shared = (await sharedClientRows(context.supabase)).find((r) => r.id === data.id);
    if (!shared) return null;
    let client = shared;
    if (ownsClientDetails(ctx, shared.department_id)) {
      const result = await context.supabase.from("clients").select("*").eq("id", data.id).eq("organization_id", ctx.organizationId).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      client = result.data ?? shared;
    }
    if (client) await audit(context.supabase, ctx, "client.viewed", "client", client.id);
    return client;
  });

const IntakeSchema = z.record(z.string(), z.unknown()).optional();

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dateOfBirth: z.string().max(20).nullable().optional(),
        clientIdentifier: z.string().max(60).optional(),
        firstName: z.string().min(1).max(80),
        lastName: z.string().min(1).max(80),
        preferredName: z.string().max(80).optional(),
        departmentId: z.string().uuid().nullable().optional(),
        contact: IntakeSchema,
        intake: IntakeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const row = await clientRpc<{ id: string; duplicate: boolean }>(context.supabase, "register_shared_client", { _data: {
      department_id: data.departmentId ?? ctx.departmentId, client_identifier: data.clientIdentifier?.trim() ?? "",
      first_name: data.firstName, last_name: data.lastName, preferred_name: data.preferredName ?? null,
      date_of_birth: data.dateOfBirth || null, phone: data.contact?.["phone"] ?? null, email: data.contact?.["email"] ?? null,
      contact_information: data.contact ?? {}, intake_data: data.intake ?? {},
    } });
    if (!row.duplicate) await audit(context.supabase, ctx, "client.created", "client", row.id);
    return row;
  });

export const updateClientIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), intake: z.record(z.string(), z.unknown()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("clients")
      .update({ intake_data: data.intake as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "client.intake_updated", "client", data.id);
    return { ok: true };
  });

const JsonRecord = z.record(z.string(), z.unknown());

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        firstName: z.string().min(1).max(80),
        lastName: z.string().min(1).max(80),
        preferredName: z.string().max(80).nullable().optional(),
        clientIdentifier: z.string().min(1).max(60),
        status: z.string().max(30),
        dateOfBirth: z.string().max(20).nullable().optional(),
        arrivalDate: z.string().max(20).nullable().optional(),
        preferredLanguage: z.string().max(60),
        phone: z.string().max(40).nullable().optional(),
        email: z.string().max(120).nullable().optional(),
        address: z.string().max(240).nullable().optional(),
        immigrationStatus: z.string().max(80).nullable().optional(),
        accessibilityNeeds: z.string().max(500).nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        household: JsonRecord.optional(),
        emergencyContact: JsonRecord.optional(),
        communicationPreferences: JsonRecord.optional(),
        intake: JsonRecord.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const client = (await sharedClientRows(context.supabase)).find((r) => r.id === data.id);
    if (!client) throw new Error("Client not found.");
    const shared = !ownsClientDetails(ctx, client.department_id);
    const patch = {
      first_name: data.firstName, last_name: data.lastName, preferred_name: data.preferredName ?? null,
      client_identifier: data.clientIdentifier, status: data.status, date_of_birth: data.dateOfBirth || null,
      arrival_date: data.arrivalDate || null, preferred_language: data.preferredLanguage, phone: data.phone ?? null,
      email: data.email ?? null, address: data.address ?? null, immigration_status: data.immigrationStatus ?? null,
      ...(!shared ? { accessibility_needs: data.accessibilityNeeds ?? null, ...(ctx.isAdmin && data.departmentId ? { department_id: data.departmentId } : {}) } : {}),
      ...(data.household ? { household: data.household as never } : {}),
      ...(data.emergencyContact ? { emergency_contact: data.emergencyContact as never } : {}),
      ...(data.communicationPreferences ? { communication_preferences: data.communicationPreferences as never } : {}),
      ...(data.intake ? { intake_data: (shared ? sharedIntake(data.intake) : data.intake) as never } : {}),
    };
    if (shared) await clientRpc(context.supabase, "shared_client_update", { _id: data.id, _patch: patch });
    else {
      const { error } = await context.supabase.from("clients").update(patch).eq("id", data.id).eq("organization_id", ctx.organizationId);
      if (error) throw new Error(error.message);
    }
    await audit(context.supabase, ctx, "client.updated", "client", data.id);
    return { ok: true };
  });

export const listClientNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    let q = context.supabase
      .from("case_notes")
      .select("id, interaction_type, interaction_date, status, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("client_id", data.clientId)
      .is("deleted_at", null)
      .order("interaction_date", { ascending: false })
      .limit(20);
    if (!ctx.isAdmin) q = q.eq("department_id", ctx.departmentId ?? "00000000-0000-0000-0000-000000000000");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
