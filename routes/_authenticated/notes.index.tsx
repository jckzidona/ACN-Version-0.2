import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteCaseNote,
  listCaseNotes,
  purgeCaseNote,
  restoreCaseNote,
} from "@/lib/notes.functions";

export const Route = createFileRoute("/_authenticated/notes/")({
  head: () => ({
    meta: [
      { title: "Case notes — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Browse saved case notes, search documentation and open a note to add more detail.",
      },
      { property: "og:title", content: "Case notes" },
      {
        property: "og:description",
        content: "Search saved case notes and continue documenting on any existing note.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotesList,
});

function NotesList() {
  const fetchNotes = useServerFn(listCaseNotes);
  const removeNote = useServerFn(deleteCaseNote);
  const undelete = useServerFn(restoreCaseNote);
  const purge = useServerFn(purgeCaseNote);
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isManager =
    session?.roles.includes("manager") || session?.roles.includes("org_admin") || false;

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [deleted, setDeleted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["case-notes", query, scope, deleted],
    queryFn: () =>
      fetchNotes({
        data: {
          ...(query.trim() ? { query: query.trim() } : {}),
          scope,
          deleted,
        },
      }),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["case-notes"] });
    await queryClient.invalidateQueries({ queryKey: ["worker-overview"] });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try {
      await removeNote({ data: { id } });
      await refresh();
      toast.success("Case note moved to Recently deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the case note.");
    }
  }

  return (
    <AppShell
      title="Case notes"
      description={deleted ? "Recently deleted notes" : "Open any saved note to add more detail"}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/print" search={{ ids: undefined, worker: undefined }}>
              Print all
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/notes/new">New case note</Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search note text…"
          className="max-w-sm"
        />
        {isManager && (
          <Button
            size="sm"
            variant={scope === "team" ? "default" : "outline"}
            onClick={() => setScope(scope === "team" ? "mine" : "team")}
          >
            {scope === "team" ? "Showing whole team" : "Showing my notes"}
          </Button>
        )}
        <Button size="sm" variant={deleted ? "default" : "outline"} onClick={() => setDeleted(!deleted)}>
          {deleted ? "Back to active notes" : "Recently deleted"}
        </Button>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {isLoading && <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">Loading…</p>}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground lg:px-5">No case notes found.</p>
          )}
          {data?.map((note) => (
            <div
              key={note.id}
              className="flex items-start justify-between gap-3 px-4 py-3 lg:px-5"
            >
              <Link
                to="/notes/$noteId"
                params={{ noteId: note.id }}
                className="min-w-0 flex-1 hover:opacity-80"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                  <span className="text-sm text-foreground">
                    {note.clients
                      ? `${note.clients.first_name} ${note.clients.last_name}`
                      : "No client linked"}{" "}
                    · {note.interaction_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {note.interaction_date} · v{note.version_number}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.final_note}</p>
              </Link>
              <div className="flex shrink-0 flex-col gap-1">
                {!deleted && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/print" search={{ ids: note.id, worker: undefined }}>
                      Print PDF
                    </Link>
                  </Button>
                )}
                {deleted ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void undelete({ data: { id: note.id } })
                          .then(refresh)
                          .then(() => toast.success("Case note restored."))
                          .catch((err: unknown) =>
                            toast.error(err instanceof Error ? err.message : "Restore failed."),
                          )
                      }
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        void purge({ data: { id: note.id } })
                          .then(refresh)
                          .then(() => toast.success("Case note permanently deleted."))
                          .catch((err: unknown) =>
                            toast.error(
                              err instanceof Error ? err.message : "Permanent delete failed.",
                            ),
                          )
                      }
                    >
                      Delete forever
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setPendingDelete(note.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this case note?</AlertDialogTitle>
            <AlertDialogDescription>
              It moves to Recently deleted, where you can restore it or remove it permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
