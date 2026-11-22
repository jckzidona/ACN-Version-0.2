import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { audit, loadContext, requireManager, scopedDepartment } from "./authz";
import { csvDocument } from "./csv-export";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const getWorkerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const day = todayISO();

    const [{ data: todayNotes }, { data: drafts }, { data: recent }] = await Promise.all([
      context.supabase
        .from("case_notes")
        .select("id, status")
        .eq("author_id", ctx.userId)
        .is("deleted_at", null)
        .gte("created_at", `${day}T00:00:00Z`),
      context.supabase
        .from("drafts")
        .select("id, draft_data, last_saved_at, clients(first_name, last_name)")
        .eq("author_id", ctx.userId)
        .eq("status", "open")
        .order("last_saved_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("case_notes")
        .select("id, interaction_type, interaction_date, updated_at, final_note, clients(first_name, last_name)")
        .eq("author_id", ctx.userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    return {
      notesToday: (todayNotes ?? []).length,
      openDrafts: (drafts ?? []).length,
      completedToday: (todayNotes ?? []).filter((n) => n.status === "final").length,
      drafts: drafts ?? [],
      recent: recent ?? [],
      isManager: ctx.isManager,
      isAdmin: ctx.isAdmin,
    };
  });

export const getManagerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ from: z.string().max(20).optional(), to: z.string().max(20).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);

    const from = data.from || todayISO();
    const to = data.to || todayISO();
    const dept = scopedDepartment(ctx, null);

    let notesQ = context.supabase
      .from("case_notes")
      .select("id, author_id, department_id, status, deleted_at, created_at, interaction_type")
      .eq("organization_id", ctx.organizationId)
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);
    let draftsQ = context.supabase
      .from("drafts")
      .select("id, author_id, department_id")
      .eq("organization_id", ctx.organizationId)
      .eq("status", "open");
    let deptQ = context.supabase.from("departments").select("id, name").eq("organization_id", ctx.organizationId);
    let staffQ = context.supabase
      .from("profiles")
      .select("id, full_name, department_id, job_title, status")
      .eq("organization_id", ctx.organizationId);
    if (dept) {
      notesQ = notesQ.eq("department_id", dept);
      draftsQ = draftsQ.eq("department_id", dept);
      deptQ = deptQ.eq("id", dept);
      staffQ = staffQ.eq("department_id", dept);
    }
    const [{ data: notes }, { data: drafts }, { data: departments }, { data: staff }] = await Promise.all([
      notesQ,
      draftsQ,
      deptQ,
      staffQ,
    ]);

    const noteRows = notes ?? [];
    const staffRows = staff ?? [];

    const byDepartment = (departments ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      notes: noteRows.filter((n) => n.department_id === d.id && !n.deleted_at).length,
      drafts: (drafts ?? []).filter((x) => x.department_id === d.id).length,
      staff: staffRows.filter((s) => s.department_id === d.id).length,
    }));

    const byWorker = staffRows.map((s) => {
      const mine = noteRows.filter((n) => n.author_id === s.id && !n.deleted_at);
      return {
        id: s.id,
        name: s.full_name || "Unnamed staff member",
        jobTitle: s.job_title,
        department: (departments ?? []).find((d) => d.id === s.department_id)?.name ?? "—",
        notes: mine.length,
        completed: mine.filter((n) => n.status === "final").length,
        drafts: (drafts ?? []).filter((x) => x.author_id === s.id).length,
      };
    });

    return {
      range: { from, to },
      totals: {
        notes: noteRows.filter((n) => !n.deleted_at).length,
        completed: noteRows.filter((n) => n.status === "final" && !n.deleted_at).length,
        drafts: (drafts ?? []).length,
        activeStaff: new Set(noteRows.map((n) => n.author_id)).size,
      },
      byDepartment,
      byWorker: byWorker.sort((a, b) => b.notes - a.notes),
    };
  });

export const getActivityTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ date: z.string().max(20).optional(), limit: z.number().int().min(1).max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const day = data.date || todayISO();
    const dept = scopedDepartment(ctx, null);

    let auditQ = context.supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at, user_id, metadata")
      .eq("organization_id", ctx.organizationId)
      .gte("created_at", `${day}T00:00:00Z`)
      .lte("created_at", `${day}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (dept) auditQ = auditQ.eq("department_id", dept);
    const { data: rows, error } = await auditQ;
    if (error) throw new Error(error.message);

    const { data: people } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", ctx.organizationId);
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((r) => ({
      ...r,
      actor: names.get(r.user_id ?? "") ?? "Unknown user",
    }));
  });

export const exportCaseNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ from: z.string().max(20).optional(), to: z.string().max(20).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);

    let q = context.supabase
      .from("case_notes")
      .select(
        "id, interaction_type, interaction_date, status, created_at, author_id, department_id, clients(client_identifier)",
      )
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("interaction_date", { ascending: false })
      .limit(2000);
    const dept = scopedDepartment(ctx, null);
    if (dept) q = q.eq("department_id", dept);
    if (data.from) q = q.gte("interaction_date", data.from);
    if (data.to) q = q.lte("interaction_date", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: people } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", ctx.organizationId);
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

    const header = ["case_note_id", "client_identifier", "interaction_type", "interaction_date", "status", "worker", "created_at"];
    const csv = csvDocument(header,
      (rows ?? []).map((r) =>
        [
          r.id,
          (r.clients as { client_identifier?: string } | null)?.client_identifier ?? "",
          r.interaction_type,
          r.interaction_date,
          r.status,
          names.get(r.author_id) ?? "",
          r.created_at,
        ],
      ),
    );

    await audit(context.supabase, ctx, "report.exported", "organization", ctx.organizationId, {
      rows: (rows ?? []).length,
    });
    return { csv, rows: (rows ?? []).length };
  });
