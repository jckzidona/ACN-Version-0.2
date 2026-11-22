import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { CounsellingMonthlyReportDialog } from "@/components/CounsellingMonthlyReportDialog";
import { SettlementMonthlyReportDialog } from "@/components/SettlementMonthlyReportDialog";
import { useSession } from "@/hooks/useSession";
import { getWorkerOverview } from "@/lib/reports.functions";
import { completeFollowUp, listMyFollowUps } from "@/lib/followups.functions";

function MyFollowUps() {
  const qc = useQueryClient();
  const list = useServerFn(listMyFollowUps);
  const complete = useServerFn(completeFollowUp);
  const { data } = useQuery({ queryKey: ["my-follow-ups"], queryFn: () => list() });
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (data ?? []).filter((t) => t.due_date < today).length;
  return (
    <section className="mt-6 rounded-lg border border-border bg-card lg:mt-8">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-5">
        <h2 className="text-sm font-semibold text-foreground">My follow-ups</h2>
        {overdue > 0 && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            {overdue} overdue
          </span>
        )}
      </header>
      <div className="divide-y divide-border">
        {(data?.length ?? 0) === 0 && (
          <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">No open follow-ups.</p>
        )}
        {data?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm lg:px-5">
            <div>
              <p className="text-foreground">{t.title}</p>
              <p className={`text-xs ${t.due_date < today ? "text-destructive" : "text-muted-foreground"}`}>
                Due {t.due_date}
                {t.recurrence !== "none" ? ` · repeats ${t.recurrence}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await complete({ data: { id: t.id } });
                await qc.invalidateQueries({ queryKey: ["my-follow-ups"] });
                toast.success("Follow-up completed.");
              }}
            >
              Done
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Worker dashboard — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Today's documentation activity, open drafts and recent case notes.",
      },
      { property: "og:title", content: "Worker dashboard" },
      {
        property: "og:description",
        content: "Track today's notes, resume drafts and open recent documentation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [settlementOpen, setSettlementOpen] = useState(false);
  const navigate = useNavigate();
  const { data: session } = useSession();
  const fetchOverview = useServerFn(getWorkerOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["worker-overview"],
    queryFn: () => fetchOverview(),
  });

  useEffect(() => {
    if (session && !session.onboarded) navigate({ to: "/onboarding", replace: true });
  }, [session, navigate]);

  return (
    <AppShell
      title={`Good day${session?.fullName ? `, ${session.fullName.split(" ")[0]}` : ""}`}
      description="Your documentation at a glance"
      actions={
        <div className="flex flex-wrap gap-2">
          {/settlement/i.test(session?.department?.name ?? "") && <><Button size="sm" variant="outline" onClick={() => setSettlementOpen(true)}>Settlement — Monthly Activity Report</Button><SettlementMonthlyReportDialog open={settlementOpen} onOpenChange={setSettlementOpen} /></>}
          <CounsellingMonthlyReportDialog from="" to="" departmentId={null} canSubmit={/counsel/i.test(session?.department?.name ?? "")} canExport={false} />
          <Button asChild size="sm">
            <Link to="/notes/new">New case note</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
        {[
          { label: "Notes today", value: data?.notesToday ?? 0 },
          { label: "Finalised today", value: data?.completedToday ?? 0 },
          { label: "Open drafts", value: data?.openDrafts ?? 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-4 lg:p-5"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground lg:mt-2 lg:text-3xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <MyFollowUps />

      <section className="mt-6 rounded-lg border border-border bg-card lg:mt-8">
        <header className="border-b border-border px-4 py-3 lg:px-5">
          <h2 className="text-sm font-semibold text-foreground">Open drafts</h2>
        </header>
        <div className="divide-y divide-border">
          {isLoading && <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">Loading…</p>}
          {!isLoading && (data?.drafts.length ?? 0) === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">No drafts waiting.</p>
          )}
          {data?.drafts.map((draft) => {
            const payload = (draft.draft_data ?? {}) as { interactionType?: string };
            return (
              <Link
                key={draft.id}
                to="/notes/new"
                search={{ draft: draft.id }}
                className="flex flex-col justify-between gap-1 px-4 py-3 text-sm hover:bg-secondary/60 sm:flex-row sm:items-center lg:px-5"
              >
                <span className="text-foreground">
                  {draft.clients
                    ? `${draft.clients.first_name} ${draft.clients.last_name}`
                    : "No client linked"}
                  {payload.interactionType ? ` · ${payload.interactionType}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(draft.last_saved_at).toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-card lg:mt-6">
        <header className="border-b border-border px-4 py-3 lg:px-5">
          <h2 className="text-sm font-semibold text-foreground">Recent case notes</h2>
        </header>
        <div className="divide-y divide-border">
          {!isLoading && (data?.recent.length ?? 0) === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">Nothing documented yet.</p>
          )}
          {data?.recent.map((note) => (
            <Link
              key={note.id}
              to="/notes/$noteId"
              params={{ noteId: note.id }}
              className="block px-4 py-3 hover:bg-secondary/60 lg:px-5"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                <span className="text-sm text-foreground">
                  {note.clients
                    ? `${note.clients.first_name} ${note.clients.last_name}`
                    : "No client linked"}{" "}
                  · {note.interaction_type}
                </span>
                <span className="text-xs text-muted-foreground">{note.interaction_date}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.final_note}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
