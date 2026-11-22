import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/demo-requests")({
  head: () => ({
    meta: [
      { title: "Demo requests — ACN" },
      { name: "description", content: "Demonstration requests received from the ACN welcome page." },
      { property: "og:title", content: "Demo requests — ACN" },
      { property: "og:description", content: "Demonstration requests received from the ACN welcome page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoRequestsPage,
});

const STATUSES = ["new", "contacted", "closed"] as const;

function DemoRequestsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["demo-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: string) {
    await supabase.from("demo_requests").update({ status }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["demo-requests"] });
  }

  return (
    <AppShell title="Demo requests" description="Requests sent from the welcome page form">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No demonstration requests yet.</p>
      ) : (
        <div className="grid gap-3">
          {data.map((r) => (
            <article key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{r.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.agency}
                    {r.role_title ? ` · ${r.role_title}` : ""}
                  </p>
                </div>
                <select
                  aria-label="Status"
                  value={r.status}
                  onChange={(e) => void setStatus(r.id, e.target.value)}
                  className="min-h-[40px] rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0]!.toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Email: </dt><dd className="inline"><a className="underline" href={`mailto:${r.email}`}>{r.email}</a></dd></div>
                {r.phone && <div><dt className="inline text-muted-foreground">Phone: </dt><dd className="inline">{r.phone}</dd></div>}
                {r.team_size && <div><dt className="inline text-muted-foreground">Workers: </dt><dd className="inline">{r.team_size}</dd></div>}
                <div><dt className="inline text-muted-foreground">Received: </dt><dd className="inline">{new Date(r.created_at).toLocaleString()}</dd></div>
              </dl>
              {r.message && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{r.message}</p>}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
