import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import { getStatsReport } from "@/lib/stats.functions";
import { listDepartments } from "@/lib/session.functions";
import { FunderReportsMenu } from "@/components/FunderReportsDialog";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & statistics — ACN — Assistance Case Note" },
      { name: "description", content: "Monthly staff performance report, client statistics and needs summary with Excel export." },
      { property: "og:title", content: "Reports & statistics — ACN" },
      { property: "og:description", content: "Staff activity, client demographics, services and referrals by period." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

const ALL = "__all__";
const iso = (d: Date) => d.toISOString().slice(0, 10);
function presetRange(p: string): [string, string] {
  const now = new Date();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (p === "last_month") return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
  if (p === "quarter") { const q = Math.floor(m / 3) * 3; return [iso(new Date(Date.UTC(y, q, 1))), iso(now)]; }
  if (p === "fiscal") { const fy = m >= 3 ? y : y - 1; return [iso(new Date(Date.UTC(fy, 3, 1))), iso(now)]; }
  if (p === "week") { const d = new Date(now); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return [iso(d), iso(now)]; }
  return [iso(new Date(Date.UTC(y, m, 1))), iso(now)];
}

const STAFF_COLS = [
  ["name", "Staff member"], ["jobTitle", "Job title"], ["caseNotes", "Case notes"], ["clientsServed", "Clients served"],
  ["meetingsScheduled", "Meetings scheduled"], ["meetingsCompleted", "Completed"], ["meetingsMissed", "Missed"],
  ["meetingsCancelled", "Cancelled"], ["groupSessions", "Group sessions"], ["groupParticipants", "Group attendees"], ["referralsMade", "Referrals"], ["followUpsDue", "Follow-ups due"],
  ["followUpsDone", "Follow-ups done"], ["minutesOnNotes", "Minutes on notes"], ["avgMinutesPerNote", "Avg min / note"],
] as const;

const COUNSEL_COLS = [
  ["name", "Counsellor"], ["activeCaseload", "Caseload"], ["sessions", "Sessions"], ["hours", "Hours"],
  ["booked", "Booked"], ["attended", "Attended"], ["noShows", "No-shows"], ["cancelled", "Cancelled"],
] as const;

function ReportsPage() {
  const { data: session } = useSession();
  const isManager = session?.roles.includes("manager") || session?.roles.includes("org_admin");
  const [preset, setPreset] = useState("this_month");
  const [[from, to], setRange] = useState(presetRange("this_month"));
  const isAdmin = !!session?.roles.includes("org_admin");
  const [deptChoice, setDept] = useState(ALL);
  // Managers are locked to their own department; only org admins can pick another one.
  const dept = session && !isAdmin ? session.department?.id ?? ALL : deptChoice;
  const run = useServerFn(getStatsReport);
  const fetchDepts = useServerFn(listDepartments);
  const { data: depts = [] } = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepts(), staleTime: 60_000 });
  const { data, isFetching, error } = useQuery({
    queryKey: ["stats", from, to, dept],
    queryFn: () => run({ data: { from, to, departmentId: dept === ALL ? null : dept } }),
    enabled: !!isManager && (isAdmin || !!session?.department),
  });

  const selectedDeptName = dept === ALL ? null : depts.find((d) => d.id === dept)?.name ?? "";
  const showCounselling = selectedDeptName === null || /counsel/i.test(selectedDeptName);
  const [tab, setTab] = useState("summary");
  const activeTab = !showCounselling && tab === "counselling" ? "summary" : tab;

  const needRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.needs).map(([area, lv]) => ({ area, High: lv["High"] ?? 0, Medium: lv["Medium"] ?? 0, Low: lv["Low"] ?? 0, "No need": lv["No need"] ?? 0 }));
  }, [data]);

  async function exportExcel() {
    if (!data) return;
    try {
      const { exportStyledReport } = await import("@/lib/excel-export");
      const c = data.counselling;
      await exportStyledReport({
        orgName: session?.organization?.name ?? "",
        from, to,
        department: dept === ALL ? "All" : depts.find((d) => d.id === dept)?.name ?? "",
        totals: data.totals as unknown as Record<string, number>,
        staffCols: STAFF_COLS,
        staff: data.staff as unknown as Record<string, unknown>[],
        breakdowns: data.breakdowns,
        needs: needRows,
        counselling: {
          hasDepartment: showCounselling && c.hasDepartment,
          totals: c.totals as unknown as Record<string, number>,
          cols: COUNSEL_COLS,
          counsellors: c.counsellors as unknown as Record<string, unknown>[],
          breakdowns: c.breakdowns,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the Excel file.");
    }
  }

  async function exportPdf() {
    if (!data) return;
    try {
      const { exportReportPdf } = await import("@/lib/pdf-export");
      const c = data.counselling;
      await exportReportPdf({
        orgName: session?.organization?.name ?? "",
        from, to,
        department: dept === ALL ? "All" : depts.find((d) => d.id === dept)?.name ?? "",
        totals: data.totals as unknown as Record<string, number>,
        staffCols: STAFF_COLS,
        staff: data.staff as unknown as Record<string, unknown>[],
        breakdowns: data.breakdowns,
        needs: needRows,
        counselling: {
          hasDepartment: showCounselling && c.hasDepartment,
          totals: c.totals as unknown as Record<string, number>,
          cols: COUNSEL_COLS,
          counsellors: c.counsellors as unknown as Record<string, unknown>[],
          breakdowns: c.breakdowns,
        },
      });
      toast.success("PDF report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the PDF report.");
    }
  }

  if (session && !isManager) {
    return <AppShell title="Reports"><p className="text-sm text-muted-foreground">Reports are available to managers and admins.</p></AppShell>;
  }

  return (
    <AppShell
      title="Reports & statistics"
      description="Staff performance and client statistics"
      actions={
        <div className="flex flex-wrap gap-2">
          <FunderReportsMenu from={from} to={to} departmentId={dept === ALL ? null : dept} enabled={!!isManager && (isAdmin || !!session?.department)} />
          <Button size="sm" onClick={exportExcel} disabled={!data}>Export to Excel</Button>
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={!data}><FileDown className="mr-1.5 h-4 w-4" />Export to PDF</Button>
        </div>
      }
    >
      <section className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Reporting period</Label>
          <Select value={preset} onValueChange={(v) => { setPreset(v); if (v !== "custom") setRange(presetRange(v)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="quarter">This quarter</SelectItem>
              <SelectItem value="fiscal">Fiscal year to date (Apr 1)</SelectItem>
              <SelectItem value="custom">Custom dates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]); }} /></div>
        <div className="flex min-w-0 flex-col gap-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]); }} /></div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Department</Label>
          {isAdmin ? (
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
              {session?.department?.name ?? "No department assigned"}
            </div>
          )}
        </div>
      </section>

      {session && !isAdmin && !session.department && (
        <p className="text-sm text-destructive">Your account has no department yet. Ask your organization admin to assign one.</p>
      )}
      {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load the report."}</p>}
      {!data ? (
        <p className="text-sm text-muted-foreground">{isFetching ? "Building report…" : ""}</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setTab}>
          <div className="overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="staff">Staff performance</TabsTrigger>
              <TabsTrigger value="stats">Client statistics</TabsTrigger>
              <TabsTrigger value="needs">Needs assessment</TabsTrigger>
              {showCounselling && <TabsTrigger value="counselling">Counselling statistics</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="counselling">
            {!data.counselling.hasDepartment ? (
              <p className="text-sm text-muted-foreground">No department with "Counselling" in its name was found. Create one in the Manager console.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {([
                    ["Active clients", data.counselling.totals.activeClients], ["New clients", data.counselling.totals.newClients],
                    ["Clients seen", data.counselling.totals.clientsSeen], ["Sessions", data.counselling.totals.sessions],
                    ["Counselling hours", data.counselling.totals.hours], ["Closed cases", data.counselling.totals.closedCases],
                    ["Appointments booked", data.counselling.totals.appointmentsBooked], ["No-show rate", `${data.counselling.totals.noShowRate}%`],
                    ["Avg wait (days)", data.counselling.totals.avgWaitDays], ["Median wait (days)", data.counselling.totals.medianWaitDays],
                  ] as const).map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
                      <p className="text-xs text-muted-foreground">{l}</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]">
                  <h2 className="px-3 pt-3 text-sm font-semibold text-foreground">Counsellor caseload</h2>
                  <table className="mt-2 w-full text-sm">
                    <thead><tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                      {COUNSEL_COLS.map(([k, l]) => <th key={k} className="whitespace-nowrap px-3 py-2">{l}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.counselling.counsellors.length === 0 && <tr><td colSpan={COUNSEL_COLS.length} className="px-3 py-3 text-muted-foreground">No counselling activity in this period.</td></tr>}
                      {data.counselling.counsellors.map((s) => (
                        <tr key={s.id} className="border-b border-border">
                          {COUNSEL_COLS.map(([k]) => <td key={k} className="whitespace-nowrap px-3 py-2 text-foreground">{s[k]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {Object.entries(data.counselling.breakdowns).map(([title, rows]) => {
                    const total = rows.reduce((a, r) => a + r.value, 0);
                    return (
                      <section key={title} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
                        <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
                        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data for this period.</p> : (
                          <ul className="space-y-1.5 text-sm">
                            {rows.slice(0, 12).map((r) => (
                              <li key={r.label}>
                                <div className="flex justify-between gap-2"><span className="text-foreground">{r.label}</span><span className="text-muted-foreground">{r.value} · {Math.round((r.value / total) * 100)}%</span></div>
                                <div className="mt-0.5 h-1.5 rounded bg-secondary"><div className="h-1.5 rounded bg-primary" style={{ width: `${(r.value / total) * 100}%` }} /></div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="summary">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {([
                ["Active clients", data.totals.activeClients], ["New intakes", data.totals.newIntakes],
                ["Clients served", data.totals.clientsServed], ["Family files", data.totals.families],
                ["Case notes", data.totals.caseNotes], ["Hours on notes", data.totals.hoursOnNotes],
                ["Meetings scheduled", data.totals.meetingsScheduled], ["Meetings missed", data.totals.meetingsMissed],
                ["Referrals", data.totals.referrals], ["Group sessions", data.totals.groupSessions], ["Group participants", data.totals.groupUniqueParticipants], ["Follow-ups due", data.totals.followUpsDue],
                ["Follow-ups done", data.totals.followUpsDone], ["Total clients on file", data.totals.totalClients],
                ["Bus tokens given", data.totals.groupBusTokens], ["Emergency food provided", data.totals.groupEmergencyFood],
                ["Meals / snacks provided", data.totals.groupMeals], ["Children in childminding", data.totals.groupChildminding],
                ["Children attending with parents", data.totals.groupChildrenAttending],
              ] as const).map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Case notes per staff member</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.staff}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" />
                    <Tooltip />
                    <Bar dataKey="caseNotes" name="Case notes" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clientsServed" name="Clients served" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="staff">
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                    {STAFF_COLS.map(([k, l]) => <th key={k} className="whitespace-nowrap px-3 py-2">{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      {STAFF_COLS.map(([k]) => <td key={k} className="whitespace-nowrap px-3 py-2 text-foreground">{s[k]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid gap-4 lg:grid-cols-2">
              {Object.entries(data.breakdowns).map(([title, rows]) => {
                const total = rows.reduce((a, r) => a + r.value, 0);
                return (
                  <section key={title} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
                    <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
                    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data for this period.</p> : (
                      <ul className="space-y-1.5 text-sm">
                        {rows.slice(0, 12).map((r) => (
                          <li key={r.label}>
                            <div className="flex justify-between gap-2"><span className="text-foreground">{r.label}</span><span className="text-muted-foreground">{r.value} · {Math.round((r.value / total) * 100)}%</span></div>
                            <div className="mt-0.5 h-1.5 rounded bg-secondary"><div className="h-1.5 rounded bg-primary" style={{ width: `${(r.value / total) * 100}%` }} /></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="needs">
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                  {["Need area", "High", "Medium", "Low", "No need"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr></thead>
                <tbody>
                  {needRows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">No needs assessments recorded yet.</td></tr>}
                  {needRows.map((r) => (
                    <tr key={r.area} className="border-b border-border">
                      <td className="px-3 py-2 text-foreground">{r.area}</td><td className="px-3 py-2">{r.High}</td>
                      <td className="px-3 py-2">{r.Medium}</td><td className="px-3 py-2">{r.Low}</td><td className="px-3 py-2">{r["No need"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Needs are counted from each client's current intake assessment.</p>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
