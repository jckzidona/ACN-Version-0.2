import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sharedClientRows } from "./shared-clients";
import { audit, loadContext } from "./authz";

const DraftData = z.object({
  clientId: z.string().uuid().nullable().optional(),
  interactionType: z.string().max(80).optional(),
  interactionDate: z.string().max(20).optional(),
  rawInput: z.string().max(20000).optional(),
  transcription: z.string().max(20000).nullable().optional(),
  generatedNote: z.string().max(40000).nullable().optional(),
});

export type DraftPayload = z.infer<typeof DraftData>;

async function attachSharedClientLabels<T extends { client_id: string | null; clients: unknown }>(sb: Parameters<typeof sharedClientRows>[0], rows: T[]) {
  const clients = await sharedClientRows(sb);
  const byId = new Map(clients.map((c) => [c.id, { first_name: c.first_name, last_name: c.last_name, client_identifier: c.client_identifier }]));
  return rows.map((r) => ({ ...r, clients: r.client_id ? byId.get(r.client_id) ?? null : null }));
}

/* ------------------------------- drafts -------------------------------- */

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().nullable().optional(), data: DraftData }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const payload = {
      organization_id: ctx.organizationId,
      author_id: ctx.userId,
      department_id: ctx.departmentId,
      client_id: data.data.clientId ?? null,
      draft_data: data.data as never,
      last_saved_at: new Date().toISOString(),
      status: "open",
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("drafts")
        .update(payload)
        .eq("id", data.id)
        .eq("author_id", ctx.userId)
        .select("id, last_saved_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (row) return row;
    }

    const { data: row, error } = await context.supabase
      .from("drafts")
      .insert(payload)
      .select("id, last_saved_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("drafts")
      .select("id, client_id, draft_data, last_saved_at, clients(first_name, last_name, client_identifier)")
      .eq("author_id", ctx.userId)
      .eq("status", "open")
      .order("last_saved_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return attachSharedClientLabels(context.supabase, data ?? []);
  });

export const getDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("drafts")
      .select("id, draft_data, last_saved_at")
      .eq("id", data.id)
      .eq("author_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const discardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drafts")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ case notes ------------------------------ */

export const saveCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        draftId: z.string().uuid().nullable().optional(),
        clientId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        interactionType: z.string().min(1).max(80),
        interactionDate: z.string().min(4).max(20),
        rawInput: z.string().max(20000),
        transcription: z.string().max(20000).nullable().optional(),
        generatedNote: z.string().max(40000).nullable().optional(),
        finalNote: z.string().min(1).max(40000),
        reviewed: z.boolean(),
        changeType: z.string().max(40).optional(),
        appearance: z.string().max(40).nullable().optional(),
        appearanceNote: z.string().max(500).nullable().optional(),
        timeSpentSeconds: z.number().int().min(0).max(86400).nullable().optional(),
        services: z
          .object({
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
          })
          .optional(),
        followUps: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              dueDate: z.string().min(8).max(20),
              recurrence: z.enum(["none", "weekly", "monthly"]),
            }),
          )
          .max(20)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const sv = data.services;
    if (sv && sv.childClientIds.length > 0) {
      if (!data.clientId) throw new Error("Select a client before linking children.");
      const fam = (await sharedClientRows(context.supabase)).filter((r) => r.parent_client_id === data.clientId && sv.childClientIds.includes(r.id));
      if ((fam ?? []).length !== sv.childClientIds.length) {
        throw new Error("One or more selected children are not linked to this client's family record.");
      }
    }
    const extra = {
      ...(sv
        ? {
            bus_tokens: sv.busTokens, emergency_food: sv.emergencyFood, meal_provided: sv.mealProvided,
            childminding_count: sv.childmindingCount, pr_info: sv.prInfo, client_date_of_birth: sv.dateOfBirth,
            client_language: sv.clientLanguage, interpretation_needed: sv.interpretationNeeded,
            services_note: sv.note, child_client_ids: sv.childClientIds,
          }
        : {}),
      ...(data.appearance !== undefined ? { client_appearance: data.appearance } : {}),
      ...(data.appearanceNote !== undefined ? { appearance_note: data.appearanceNote } : {}),
    };

    let noteId = data.id ?? null;
    let versionNumber = 1;

    if (noteId) {
      const { data: existing, error: readError } = await context.supabase
        .from("case_notes")
        .select("version_number, author_id")
        .eq("id", noteId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!existing) throw new Error("That case note could not be found.");
      versionNumber = existing.version_number + 1;

      const { error } = await context.supabase
        .from("case_notes")
        .update({
          client_id: data.clientId ?? null,
          interaction_type: data.interactionType,
          interaction_date: data.interactionDate,
          raw_input: data.rawInput,
          transcription: data.transcription ?? null,
          generated_note: data.generatedNote ?? null,
          final_note: data.finalNote,
          reviewed: data.reviewed,
          status: "final",
          version_number: versionNumber,
          ...extra,
        })
        .eq("id", noteId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("case_notes")
        .insert({
          organization_id: ctx.organizationId,
          client_id: data.clientId ?? null,
          author_id: ctx.userId,
          department_id: ctx.isAdmin ? (data.departmentId ?? ctx.departmentId) : ctx.departmentId,
          interaction_type: data.interactionType,
          interaction_date: data.interactionDate,
          raw_input: data.rawInput,
          transcription: data.transcription ?? null,
          generated_note: data.generatedNote ?? null,
          final_note: data.finalNote,
          reviewed: data.reviewed,
          status: "final",
          version_number: 1,
          ...extra,
          time_spent_seconds: data.timeSpentSeconds ?? null,
          note_format: /##\s*Subjective/i.test(data.finalNote) ? "soap" : "standard",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      noteId = row.id;
    }

    await context.supabase.from("case_note_versions").insert({
      case_note_id: noteId,
      organization_id: ctx.organizationId,
      version_number: versionNumber,
      content: data.finalNote,
      changed_by: ctx.userId,
      change_type: data.changeType ?? (versionNumber === 1 ? "created" : "edited"),
    });

    if (data.followUps?.length) {
      const { error: fuError } = await context.supabase.from("follow_up_tasks").insert(
        data.followUps.map((f) => ({
          organization_id: ctx.organizationId,
          case_note_id: noteId,
          client_id: data.clientId ?? null,
          assigned_to: ctx.userId,
          created_by: ctx.userId,
          title: f.title,
          due_date: f.dueDate,
          recurrence: f.recurrence,
        })),
      );
      if (fuError) throw new Error(fuError.message);
    }

    if (data.draftId) {
      await context.supabase
        .from("drafts")
        .delete()
        .eq("id", data.draftId)
        .eq("author_id", ctx.userId);
    }

    await audit(context.supabase, ctx, versionNumber === 1 ? "case_note.saved" : "case_note.edited", "case_note", noteId, {
      version: versionNumber,
    });

    return { id: noteId as string, versionNumber };
  });

export const listCaseNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120).optional(),
        interactionType: z.string().max(80).optional(),
        scope: z.enum(["mine", "team"]).optional(),
        deleted: z.boolean().optional(),
        from: z.string().max(20).optional(),
        to: z.string().max(20).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    let q = context.supabase
      .from("case_notes")
      .select(
        "id, client_id, interaction_type, interaction_date, status, final_note, created_at, updated_at, deleted_at, author_id, version_number, clients(first_name, last_name, client_identifier)",
      )
      .eq("organization_id", ctx.organizationId)
      .order("updated_at", { ascending: false })
      .limit(data.limit ?? 50);

    q = data.deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    if (data.scope !== "team" || !ctx.isManager) q = q.eq("author_id", ctx.userId);
    if (data.interactionType) q = q.eq("interaction_type", data.interactionType);
    if (data.from) q = q.gte("interaction_date", data.from);
    if (data.to) q = q.lte("interaction_date", data.to);
    if (data.query?.trim()) q = q.ilike("final_note", `%${data.query.trim()}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return attachSharedClientLabels(context.supabase, rows ?? []);
  });

export const getCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { data: note, error } = await context.supabase
      .from("case_notes")
      .select("*, clients(first_name, last_name, client_identifier)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!note) return null;

    const { data: versions } = await context.supabase
      .from("case_note_versions")
      .select("id, version_number, content, change_type, created_at, changed_by")
      .eq("case_note_id", data.id)
      .order("version_number", { ascending: false });

    await audit(context.supabase, ctx, "case_note.viewed", "case_note", note.id);
    const [labeled] = await attachSharedClientLabels(context.supabase, [note]);
    return { note: labeled ?? note, versions: versions ?? [] };
  });

export const deleteCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("case_notes")
      .update({ deleted_at: new Date().toISOString(), status: "deleted" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "case_note.deleted", "case_note", data.id);
    return { ok: true };
  });

export const restoreCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("case_notes")
      .update({ deleted_at: null, status: "final" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "case_note.restored", "case_note", data.id);
    return { ok: true };
  });

export const purgeCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const { error } = await context.supabase.from("case_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "case_note.permanently_deleted", "case_note", data.id);
    return { ok: true };
  });

export const logCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    await audit(context.supabase, ctx, "case_note.copied", "case_note", data.id ?? null);
    return { ok: true };
  });

/* ------------------------------ printing -------------------------------- */

export const getPrintableNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        noteIds: z.array(z.string().uuid()).max(500).optional(),
        workerId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);

    const targetWorker = data.workerId ?? null;
    if (targetWorker && targetWorker !== ctx.userId && !ctx.isManager) {
      throw new Error("Only managers can print another worker's case notes.");
    }

    let q = context.supabase
      .from("case_notes")
      .select(
        "id, client_id, interaction_type, interaction_date, final_note, generated_note, created_at, updated_at, version_number, author_id, clients(first_name, last_name, client_identifier)",
      )
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("interaction_date", { ascending: false });

    if (data.noteIds?.length) q = q.in("id", data.noteIds);
    if (targetWorker) q = q.eq("author_id", targetWorker);
    if (!targetWorker && !data.noteIds?.length) q = q.eq("author_id", ctx.userId);
    if (!ctx.isManager) q = q.eq("author_id", ctx.userId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const notes = await attachSharedClientLabels(context.supabase, rows ?? []);

    const authorIds = Array.from(new Set(notes.map((n) => n.author_id).filter(Boolean)));
    const authors: Record<string, string> = {};
    if (authorIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds as string[]);
      for (const p of profiles ?? []) authors[p.id] = p.full_name;
    }

    const { data: org } = await context.supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();

    await audit(context.supabase, ctx, "case_note.printed", "case_note", null, {
      count: notes.length,
      workerId: targetWorker,
    });

    return {
      organizationName: org?.name ?? "",
      workerName: targetWorker ? (authors[targetWorker] ?? "") : "",
      notes: notes.map((n) => ({
        id: n.id,
        interactionType: n.interaction_type,
        interactionDate: n.interaction_date,
        versionNumber: n.version_number,
        updatedAt: n.updated_at,
        authorName: authors[n.author_id ?? ""] ?? "Unknown",
        clientName: n.clients
          ? `${n.clients.first_name} ${n.clients.last_name}`
          : "No client linked",
        clientIdentifier: n.clients?.client_identifier ?? null,
        content: n.final_note ?? n.generated_note ?? "",
      })),
    };
  });

/** Children already recorded under a client's Family section, plus the client's DOB. */
export const getClientFamilyForServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const all = await sharedClientRows(context.supabase);
    const client = all.find((r) => r.id === data.clientId);
    if (!client) throw new Error("Client not found.");
    const kids = all.filter((r) => r.parent_client_id === data.clientId).map(({ id, first_name, last_name, date_of_birth }) => ({ id, first_name, last_name, date_of_birth }));
    return { dateOfBirth: client.date_of_birth ?? null, children: kids };
  });
