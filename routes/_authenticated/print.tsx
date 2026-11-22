import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getPrintableNotes } from "@/lib/notes.functions";

export const Route = createFileRoute("/_authenticated/print")({
  head: () => ({
    meta: [
      { title: "Print case notes — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Print or save case notes as a PDF document for records and reporting.",
      },
      { property: "og:title", content: "Print case notes" },
      {
        property: "og:description",
        content: "Produce a clean printable PDF of one case note or a worker's full record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search["ids"] === "string" ? (search["ids"] as string) : undefined,
    worker: typeof search["worker"] === "string" ? (search["worker"] as string) : undefined,
  }),
  component: PrintNotes,
});

function PrintNotes() {
  const { ids, worker } = Route.useSearch();
  const fetchPrintable = useServerFn(getPrintableNotes);

  const noteIds = (ids ?? "").split(",").filter(Boolean);

  const { data, isLoading, error } = useQuery({
    queryKey: ["printable-notes", ids ?? "", worker ?? ""],
    queryFn: () =>
      fetchPrintable({
        data: {
          ...(noteIds.length ? { noteIds } : {}),
          ...(worker ? { workerId: worker } : {}),
        },
      }),
  });

  useEffect(() => {
    document.body.classList.add("print-mode");
    return () => document.body.classList.remove("print-mode");
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button asChild size="sm" variant="outline">
            <Link to="/notes">Back to case notes</Link>
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={isLoading || !data}>
            Print / Save as PDF
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Preparing document…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load these case notes."}
          </p>
        )}

        {data && (
          <article className="rounded-lg border border-border bg-card p-6 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
            <header className="border-b border-border pb-4 print:border-black">
              <h1 className="text-lg font-semibold">
                {data.organizationName || "Case notes"} — Case note record
              </h1>
              <p className="mt-1 text-sm text-muted-foreground print:text-black">
                {data.workerName ? `Worker: ${data.workerName} · ` : ""}
                {data.notes.length} note{data.notes.length === 1 ? "" : "s"} · Printed{" "}
                {new Date().toLocaleString()}
              </p>
            </header>

            {data.notes.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">No case notes to print.</p>
            )}

            {data.notes.map((note) => (
              <section
                key={note.id}
                className="mt-6 break-inside-avoid border-b border-border pb-6 last:border-0 print:border-black"
              >
                <h2 className="text-sm font-semibold">
                  {note.clientName}
                  {note.clientIdentifier ? ` (${note.clientIdentifier})` : ""}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground print:text-black">
                  {note.interactionType} · {note.interactionDate} · v{note.versionNumber} · Author:{" "}
                  {note.authorName}
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {note.content}
                </pre>
              </section>
            ))}
          </article>
        )}
      </div>
    </div>
  );
}
