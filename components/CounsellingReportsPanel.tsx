import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listCounsellingReports, type CounsellingSubmission } from "@/lib/counselling-reports.functions";
import { CR_QUESTIONS, CR_SECTIONS, answerText, isVisible } from "@/lib/counselling-report-schema";
import { buildMonthlyActivityReport, type CrNarrative } from "@/lib/counselling-monthly-report";
import { CounsellingReportSheet } from "@/components/CounsellingReportSheet";

const ALL = "__all__";
const today = () => new Date().toISOString().slice(0, 10);

const blankNarrative = (): CrNarrative => ({
  program: "", submitted: today(), successes: "", challenges: "", plans: "",
  incidents: "", meetings: "", agencies: "", organized: "", trainings: "",
});

export function CounsellingReportsPanel({ from, to, departmentId }: { from: string; to: string; departmentId: string | null }) {
  const listFn = useServerFn(listCounsellingReports);
  const [worker, setWorker] = useState(ALL);
  const [open, setOpen] = useState<CounsellingSubmission | null>(null);
  const [n, setN] = useState<CrNarrative>(blankNarrative);
  const { data, error } = useQuery({
    queryKey: ["counselling-reports", from, to, departmentId],
    queryFn: () => listFn({ data: { from, to, departmentId } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const workers = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data?.submissions ?? []) m.set(s.workerId, s.worker);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const subs = useMemo(() => (data?.submissions ?? []).filter((s) => worker === ALL || s.workerId === worker), [data, worker]);
  const ytdSubs = useMemo(() => (data?.ytdSubmissions ?? []).filter((s) => worker === ALL || s.workerId === worker), [data, worker]);
  const report = useMemo(
    () =>
      buildMonthlyActivityReport(
        subs.map((s) => ({ date: s.date, clientId: s.clientId, answers: s.answers })),
        ytdSubs.map((s) => ({ date: s.date, clientId: s.clientId, answers: s.answers })),
      ),
    [subs, ytdSubs],
  );
  const who = worker === ALL ? "All workers" : (workers.find(([id]) => id === worker)?.[1] ?? "Worker");
  const meta = data && { orgName: data.orgName, department: data.department, generatedBy: data.generatedBy, from, to, ytdFrom: data.ytdFrom, who };
  const q = (id: string) => CR_QUESTIONS.find((x) => x.id === id)!;

  async function run(kind: "excel" | "pdf") {
    if (!meta) return;
    try {
      if (kind === "excel") await (await import("@/lib/counselling-report-export")).exportCounsellingExcel(meta, subs, report, n);
      else await (await import("@/lib/funder-reports-pdf")).exportCounsellingReportPdf(meta, subs, report, n);
      toast.success(kind === "excel" ? "Excel report downloaded" : "PDF report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the report.");
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-foreground">Counselling — Monthly Activity Report</h2>
          <p className="text-xs text-muted-foreground">
            Period {from} to {to}{data ? ` · YTD from ${data.ytdFrom}` : ""} · updates live
          </p>
        </div>
        <Select value={worker} onValueChange={setWorker}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Whole department</SelectItem>
            {workers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void run("excel")} disabled={!subs.length} title={subs.length ? "" : "Export unlocks once workers submit reports in this period."}>Export to Excel</Button>
        <Button size="sm" variant="outline" onClick={() => void run("pdf")} disabled={!subs.length} title={subs.length ? "" : "Export unlocks once workers submit reports in this period."}><FileDown className="mr-1.5 h-4 w-4" />Export to PDF</Button>
      </div>
      {data && !subs.length && <p className="mt-2 text-xs text-muted-foreground">Export unlocks once workers submit reports in this period — try widening the dates above.</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error instanceof Error ? error.message : "Could not load submissions."}</p>}

      <CounsellingReportSheet report={report} who={who} period={`${from} to ${to}`} n={n} setN={setN} />

      <h3 className="mt-5 text-sm font-semibold text-foreground">Individual submissions</h3>
      <div className="mt-2 max-h-[360px] overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr><th className="p-2">Date</th><th className="p-2">Worker</th><th className="p-2">Client</th><th className="p-2">Interaction</th><th className="p-2">Activities</th></tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setOpen(s)}>
                <td className="p-2 whitespace-nowrap">{s.date}</td>
                <td className="p-2">{s.worker}</td>
                <td className="p-2">{s.client}</td>
                <td className="p-2">{answerText(q("interaction_type"), s.answers)}</td>
                <td className="p-2">{answerText(q("activities"), s.answers)}</td>
              </tr>
            ))}
            {!subs.length && (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{data ? "No submissions in this period." : "Loading…"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{open?.client} — {open?.date}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">Submitted by {open.worker}</p>
              {CR_SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <h4 className="mb-1 font-semibold text-foreground">{sec.title}</h4>
                  <dl className="space-y-1">
                    {sec.questions.filter((x) => isVisible(x, open.answers)).map((x) => (
                      <div key={x.id} className="grid grid-cols-[1fr_1fr] gap-2 border-b border-border/60 py-1">
                        <dt className="text-muted-foreground">{x.label}</dt>
                        <dd className="text-foreground">{answerText(x, open.answers) || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
