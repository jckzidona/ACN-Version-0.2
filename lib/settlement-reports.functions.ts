import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, loadContext, scopedDepartment } from "./authz";
import { calculateActivityReport } from "./funder-reports.functions";
import { settlementMonth, settlementNarrativeSchema } from "./settlement-submission";
import type { SettlementReportData } from "./settlement-monthly-report";
import type { Narrative } from "./funder-reports-export";

export type SettlementSubmission = {
  id: string; authorId: string; staffName: string; from: string; to: string; submittedAt: string;
  narrative: Narrative; report: SettlementReportData;
};

export const listSettlementSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: z.string(), to: z.string(), departmentId: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const dept = scopedDepartment(ctx, data.departmentId);
    if (!ctx.isAdmin) {
      const { data: department } = await context.supabase.from("departments").select("name").eq("id", dept ?? "").maybeSingle();
      if (!/settlement/i.test(department?.name ?? "")) throw new Error("Settlement reports are only available to the Settlement department.");
    }
    let q = context.supabase.from("settlement_monthly_reports").select("*")
      .eq("organization_id", ctx.organizationId).gte("period_to", data.from).lte("period_from", data.to)
      .order("submitted_at", { ascending: false });
    if (dept) q = q.eq("department_id", dept);
    if (!ctx.isManager) q = q.eq("author_id", ctx.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r): SettlementSubmission => ({
      id: r.id, authorId: r.author_id, staffName: r.staff_name, from: r.period_from, to: r.period_to,
      submittedAt: r.submitted_at, narrative: r.narrative as unknown as Narrative, report: r.report_data as unknown as SettlementReportData,
    }));
  });

export const submitSettlementReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ month: z.string(), narrative: settlementNarrativeSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    if (!ctx.departmentId) throw new Error("Your account has no department yet.");
    const { data: dept } = await context.supabase.from("departments").select("name").eq("id", ctx.departmentId).maybeSingle();
    if (!/settlement/i.test(dept?.name ?? "")) throw new Error("Only Settlement staff can submit this report.");
    const period = settlementMonth(data.month);
    // Recompute on the server: never accept worker-supplied figures or identity.
    const report = await calculateActivityReport({ data: { ...period, departmentId: ctx.departmentId, workerId: ctx.userId }, context });
    const narrative = { ...data.narrative, submitted: new Date().toISOString().slice(0, 10) };
    const { data: saved, error } = await context.supabase.from("settlement_monthly_reports").upsert({
      organization_id: ctx.organizationId, department_id: ctx.departmentId, author_id: ctx.userId,
      staff_name: ctx.fullName, period_from: period.from, period_to: period.to,
      narrative: narrative as never, report_data: report as never,
    }, { onConflict: "organization_id,author_id,period_from,period_to" }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, ctx, "report.settlement_monthly_submitted", "settlement_monthly_report", saved.id, period);
    return { id: saved.id };
  });