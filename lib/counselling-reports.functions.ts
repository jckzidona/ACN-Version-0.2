import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadContext, requireManager, scopedDepartment } from "@/lib/authz";
import { sharedClientRows } from "./shared-clients";
import { counsellingReportWindow, counsellingReportPeriods } from "@/lib/counselling-monthly-report";
import type { CrAnswers } from "@/lib/counselling-report-schema";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type CounsellingSubmission = {
  id: string; date: string; submittedAt: string; workerId: string; worker: string; clientId: string | null; client: string; clientFile: string; answers: CrAnswers;
};

/** Counselling Monthly Report submissions for the manager's department (or chosen department for admins). */
export const listCounsellingReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: ymd, to: ymd, departmentId: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const dept = scopedDepartment(ctx, data.departmentId);
    const sb = context.supabase;
    // Include custom periods before April 1 as well as the fiscal-year rows needed for YTD.
    const { queryFrom, ytdFrom } = counsellingReportWindow(data.from, data.to);
    let q = sb
      .from("counselling_reports")
      .select("id, interaction_date, created_at, author_id, client_id, answers")
      .eq("organization_id", ctx.organizationId)
      .gte("interaction_date", queryFrom)
      .lte("interaction_date", data.to)
      .limit(5000);
    if (dept) q = q.eq("department_id", dept);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    (rows ?? []).sort((a, b) =>
      b.interaction_date.localeCompare(a.interaction_date) || b.created_at.localeCompare(a.created_at));
    const authorIds = [...new Set((rows ?? []).map((r) => r.author_id))];
    const clientIds = [...new Set((rows ?? []).map((r) => r.client_id).filter(Boolean) as string[])];
    const [profiles, clients, deptRow, org] = await Promise.all([
      authorIds.length ? sb.from("profiles").select("id, full_name, email").in("id", authorIds) : Promise.resolve({ data: [] }),
      clientIds.length ? sharedClientRows(sb).then((data) => ({ data: data.filter((r) => clientIds.includes(r.id)) })) : Promise.resolve({ data: [] }),
      dept ? sb.from("departments").select("name").eq("id", dept).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle(),
    ]);
    const pMap = new Map(((profiles.data ?? []) as { id: string; full_name: string; email: string | null }[]).map((p) => [p.id, p.full_name || p.email || "Staff"]));
    const cMap = new Map(((clients.data ?? []) as { id: string; first_name: string; last_name: string; client_identifier: string }[]).map((c) => [c.id, c]));
    const submissions: CounsellingSubmission[] = (rows ?? []).map((r) => {
      const c = r.client_id ? cMap.get(r.client_id) : undefined;
      return {
        id: r.id, date: r.interaction_date, submittedAt: r.created_at, workerId: r.author_id,
        worker: pMap.get(r.author_id) ?? "Staff",
        clientId: r.client_id,
        client: c ? `${c.first_name} ${c.last_name}` : "(No client linked)",
        clientFile: c?.client_identifier ?? "",
        answers: (r.answers ?? {}) as CrAnswers,
      };
    });
    const me = pMap.get(ctx.userId);
    return {
      ...counsellingReportPeriods(submissions, data.from, data.to),
      ytdFrom,
      department: (deptRow.data as { name?: string } | null)?.name ?? "All departments",
      orgName: (org.data as { name?: string } | null)?.name ?? "ACN",
      generatedBy: me ?? "Manager",
    };
  });

/** A Counselling worker submits one standalone Monthly Report entry (not tied to a case note). */
export const submitCounsellingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      interactionDate: ymd,
      clientId: z.string().uuid().nullable(),
      answers: z.record(z.string(), z.union([z.string().max(2000), z.number().int().min(0).max(999), z.array(z.string().max(200)).max(40), z.null()])),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    if (!ctx.departmentId) throw new Error("Your account has no department yet. Ask your organization admin to assign one.");
    const { data: dept } = await context.supabase.from("departments").select("name").eq("id", ctx.departmentId).maybeSingle();
    if (!dept || !/counsel/i.test(dept.name)) throw new Error("The Counselling Monthly Report is only for the Counselling department.");
    const { cleanAnswers, missingRequired } = await import("./counselling-report-schema");
    const missing = missingRequired(data.answers);
    if (missing.length) throw new Error(`Please answer "${missing[0]}"${missing.length > 1 ? ` and ${missing.length - 1} more` : ""}.`);
    const { error } = await context.supabase.from("counselling_reports").insert({
      organization_id: ctx.organizationId,
      department_id: ctx.departmentId,
      author_id: ctx.userId,
      client_id: data.clientId,
      interaction_date: data.interactionDate,
      answers: cleanAnswers(data.answers) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
