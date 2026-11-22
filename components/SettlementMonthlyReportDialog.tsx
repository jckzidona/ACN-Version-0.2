import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, FileSpreadsheet, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettlementReportSheet } from "./SettlementReportSheet";
import { useSession } from "@/hooks/useSession";
import { getActivityReport, listReportWorkers } from "@/lib/funder-reports.functions";
import { listSettlementSubmissions, submitSettlementReport } from "@/lib/settlement-reports.functions";
import { blankSettlementNarrative, settlementMonth } from "@/lib/settlement-submission";
import type { Narrative } from "@/lib/funder-reports-export";

const previousMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
};

export function SettlementMonthlyReportDialog({ open, onOpenChange, from = "", to = "", departmentId = null }: {
  open: boolean; onOpenChange: (v: boolean) => void; from?: string; to?: string; departmentId?: string | null;
}) {
  const { data: session } = useSession();
  const manager = session?.roles.some((r) => r === "manager" || r === "org_admin") ?? false;
  const [month, setMonth] = useState(previousMonth);
  const [worker, setWorker] = useState("__all__");
  const [selected, setSelected] = useState("");
  const [n, setN] = useState<Narrative>(blankSettlementNarrative);
  const [busy, setBusy] = useState(false);
  const activity = useServerFn(getActivityReport);
  const list = useServerFn(listSettlementSubmissions);
  const submit = useServerFn(submitSettlementReport);
  const workersFn = useServerFn(listReportWorkers);
  const qc = useQueryClient();
  const period = manager && from && to ? { from, to } : settlementMonth(month);
  const dept = manager ? departmentId : session?.department?.id ?? null;
  const { data: workers = [] } = useQuery({ queryKey: ["report-workers", dept], queryFn: () => workersFn({ data: { departmentId: dept } }), enabled: open && manager });
  const { data: report, isFetching, error } = useQuery({
    queryKey: ["settlement-worker-report", period.from, period.to, dept, worker, session?.userId],
    queryFn: () => activity({ data: { ...period, departmentId: dept, workerId: manager ? (worker === "__all__" ? null : worker) : session?.userId ?? null } }),
    enabled: open && !!session,
  });
  const { data: submissions = [], error: submissionError, isFetching: submissionsLoading } = useQuery({
    queryKey: ["settlement-submissions", period.from, period.to, dept, session?.userId],
    queryFn: () => list({ data: { ...period, departmentId: dept } }), enabled: open && !!session,
    refetchInterval: open && manager ? 15000 : false,
  });
  const existing = !manager ? submissions.find((s) => s.from === period.from && s.to === period.to) : undefined;
  useEffect(() => {
    if (!manager) setN(existing?.narrative ?? blankSettlementNarrative());
  }, [month, manager, existing?.id, existing?.submittedAt]);
  const saved = submissions.find((s) => s.id === selected);
  async function exportReport(format: "excel" | "pdf", savedReport = false) {
    const d = savedReport ? saved?.report : report;
    const narrative = savedReport ? saved?.narrative : n;
    if (!d || !narrative) return;
    setBusy(true);
    try {
      if (format === "excel") await (await import("@/lib/funder-reports-export")).exportActivityReport(d, narrative);
      else await (await import("@/lib/funder-reports-pdf")).exportActivityReportPdf(d, narrative);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not export report."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      await submit({ data: { month, narrative: { ...n, comments: n.comments ?? "" } } });
      await qc.invalidateQueries({ queryKey: ["settlement-submissions"] });
      toast.success("Monthly report submitted to your Settlement manager.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit report."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1200px]">
      <DialogHeader><DialogTitle>Settlement — Monthly Activity Report</DialogTitle><DialogDescription>Period {period.from} to {period.to}.</DialogDescription></DialogHeader>
      <Tabs defaultValue="report">
        <TabsList><TabsTrigger value="report">{manager ? "Report & export" : "Fill in report"}</TabsTrigger><TabsTrigger value="submissions">{manager ? "Submitted reports" : "My submissions"}</TabsTrigger></TabsList>
        <TabsContent value="report" className="space-y-4">
          {manager ? <div className="max-w-sm space-y-1.5"><Label>Report for</Label><Select value={worker} onValueChange={setWorker}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">Whole department (consolidated)</SelectItem>{workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}</SelectContent></Select></div>
            : <div className="max-w-sm space-y-1.5"><Label htmlFor="settlement-month">Report month</Label><Input id="settlement-month" type="month" value={month} onChange={(e) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></div>}
          {existing && <p role="status" className="text-sm text-muted-foreground">Submitted {new Date(existing.submittedAt).toLocaleString()}</p>}
          {isFetching && <p role="status">Loading report…</p>}
          {error && <p role="alert" className="text-destructive">{error.message}</p>}
          {submissionError && <p role="alert" className="text-destructive">Could not load your submissions: {submissionError.message}</p>}
          {report && !isFetching && <SettlementReportSheet data={report} n={n} setN={setN} />}
          <div className="flex flex-wrap justify-end gap-2">
            {manager ? <><Button variant="outline" disabled={busy || isFetching || !report} onClick={() => exportReport("excel")}><FileSpreadsheet />Export to Excel</Button><Button variant="outline" disabled={busy || isFetching || !report} onClick={() => exportReport("pdf")}><FileDown />Export to PDF</Button></>
            : <Button disabled={busy || isFetching || submissionsLoading || !!submissionError || !report} onClick={save}><Send />{busy ? "Submitting…" : existing ? "Update submission" : "Submit monthly report"}</Button>}
          </div>
        </TabsContent>
        <TabsContent value="submissions" className="space-y-4">
          {submissionError && <p role="alert" className="text-destructive">{submissionError.message}</p>}
          {!submissions.length && <p className="text-sm text-muted-foreground">No monthly reports submitted for this period.</p>}
          {!!submissions.length && <div className="space-y-1.5"><Label>Submitted report</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger><SelectValue placeholder="Select a submission" /></SelectTrigger><SelectContent>{submissions.map((s) => <SelectItem key={s.id} value={s.id}>{s.staffName} · {s.from.slice(0, 7)} · {s.submittedAt.slice(0, 10)}</SelectItem>)}</SelectContent></Select></div>}
          {saved && <><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => exportReport("excel", true)}><FileSpreadsheet />Export to Excel</Button><Button variant="outline" disabled={busy} onClick={() => exportReport("pdf", true)}><FileDown />Export to PDF</Button></div><SettlementReportSheet data={saved.report} n={saved.narrative} setN={() => {}} readOnly /></>}
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>;
}