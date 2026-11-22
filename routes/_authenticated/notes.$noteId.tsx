import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "@tanstack/react-router";
import { deleteCaseNote, getCaseNote, saveCaseNote } from "@/lib/notes.functions";
import { FollowUpEmail } from "@/components/FollowUpEmail";

export const Route = createFileRoute("/_authenticated/notes/$noteId")({
  head: () => ({
    meta: [
      { title: "Case note — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Review a saved case note, add a new entry and keep a full version history.",
      },
      { property: "og:title", content: "Case note detail" },
      {
        property: "og:description",
        content: "Add more detail to a saved case note with full version tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NoteDetail,
});

function NoteDetail() {
  const { noteId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchNote = useServerFn(getCaseNote);
  const persistNote = useServerFn(saveCaseNote);
  const removeNote = useServerFn(deleteCaseNote);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm("Delete this case note? It moves to Recently deleted.")) return;
    try {
      await removeNote({ data: { id: noteId } });
      await queryClient.invalidateQueries({ queryKey: ["case-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["worker-overview"] });
      toast.success("Case note deleted.");
      navigate({ to: "/notes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the case note.");
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["case-note", noteId],
    queryFn: () => fetchNote({ data: { id: noteId } }),
  });

  const [finalNote, setFinalNote] = useState("");
  const [addition, setAddition] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.note) setFinalNote(data.note.final_note ?? data.note.generated_note ?? "");
  }, [data?.note]);

  function appendAddition() {
    const text = addition.trim();
    if (!text) return;
    const stamp = new Date().toLocaleString();
    setFinalNote((prev) => `${prev.trim()}\n\nAddendum (${stamp}):\n${text}`.trim());
    setAddition("");
    setReviewed(false);
    toast.success("Addendum added below. Review and save.");
  }

  async function handleSave() {
    const note = data?.note;
    if (!note) return;
    if (!finalNote.trim()) {
      toast.error("The note cannot be empty.");
      return;
    }
    if (!reviewed) {
      toast.error("Confirm you have reviewed the updated note.");
      return;
    }
    setSaving(true);
    try {
      await persistNote({
        data: {
          id: note.id,
          clientId: note.client_id,
          interactionType: note.interaction_type,
          interactionDate: note.interaction_date,
          rawInput: note.raw_input ?? "",
          generatedNote: note.generated_note ?? null,
          finalNote,
          reviewed: true,
          changeType: "edited",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["case-note", noteId] });
      await queryClient.invalidateQueries({ queryKey: ["case-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["worker-overview"] });
      toast.success("Case note updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the case note.");
    } finally {
      setSaving(false);
    }
  }

  const note = data?.note;

  return (
    <AppShell
      title="Case note"
      description={
        note
          ? `${note.interaction_type} · ${note.interaction_date} · v${note.version_number}`
          : "Loading…"
      }
      actions={
        <div className="hidden flex-wrap gap-2 lg:flex">
          <Button asChild size="sm" variant="outline">
            <Link to="/notes">All notes</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/notes/new">New case note</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/print" search={{ ids: noteId, worker: undefined }}>
              Print PDF
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !note && (
        <p className="text-sm text-muted-foreground">That case note could not be found.</p>
      )}

      {/* Mobile quick actions */}
      {note && (
        <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
          <Button asChild size="sm" variant="outline">
            <Link to="/notes">All notes</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/notes/new">New case note</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/print" search={{ ids: noteId, worker: undefined }}>
              Print PDF
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>
      )}

      {note && <div className="mb-4"><FollowUpEmail noteId={note.id} /></div>}

      {note && (
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-4 lg:p-5">
            <h2 className="text-sm font-semibold text-foreground">Add to this note</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Type or dictate new information. It is appended as a dated addendum — nothing already
              documented is removed.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="addition">New entry</Label>
              <VoiceRecorder
                onTranscript={(text) =>
                  setAddition((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                }
              />
              <Textarea
                id="addition"
                rows={6}
                className="min-h-[120px] text-base"
                value={addition}
                onChange={(e) => setAddition(e.target.value)}
                placeholder="Follow-up call with the client to confirm the housing appointment…"
              />
              <Button className="min-h-[44px]" onClick={appendAddition} disabled={!addition.trim()}>
                Add to note
              </Button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">Version history</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {data?.versions.map((v) => (
                  <li key={v.id}>
                    v{v.version_number} · {v.change_type} ·{" "}
                    {new Date(v.created_at).toLocaleString()}
                  </li>
                ))}
                {(data?.versions.length ?? 0) === 0 && <li>No versions recorded yet.</li>}
              </ul>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 lg:p-5">
            <h2 className="text-sm font-semibold text-foreground">Full note</h2>
            <Textarea
              className="mt-4 min-h-[240px] font-mono text-sm lg:min-h-[360px]"
              rows={14}
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
            />
            <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
              <Checkbox
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(v === true)}
                className="mt-0.5 h-5 w-5"
              />
              <span>I have reviewed this note and confirm it accurately reflects the interaction.</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="min-h-[48px] flex-1"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save new version"}
              </Button>
              <Button
                variant="outline"
                className="min-h-[48px]"
                onClick={() => {
                  void navigator.clipboard.writeText(finalNote);
                  toast.success("Note copied.");
                }}
                disabled={!finalNote}
              >
                Copy
              </Button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
