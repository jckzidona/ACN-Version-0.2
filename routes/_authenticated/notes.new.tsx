import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CaseNoteReminderTicker } from "@/components/CaseNoteReminderTicker";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { EMPTY_MEETING_SERVICES, MeetingServicesAccordion, type MeetingServices } from "@/components/MeetingServicesAccordion";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERACTION_TYPES } from "@/lib/authz";
import { searchClients } from "@/lib/clients.functions";
import { generateCaseNote } from "@/lib/ai.functions";
import { listDepartments } from "@/lib/session.functions";
import { useSession } from "@/hooks/useSession";
import { discardDraft, getDraft, saveCaseNote, saveDraft } from "@/lib/notes.functions";

export const Route = createFileRoute("/_authenticated/notes/new")({
  validateSearch: (search: Record<string, unknown>): { draft?: string } =>
    typeof search["draft"] === "string" ? { draft: search["draft"] as string } : {},
  head: () => ({
    meta: [
      { title: "New case note — ACN — Assistance Case Note" },
      {
        name: "description",
        content:
          "Capture an interaction in your own words and generate a professional, guardrailed case note.",
      },
      { property: "og:title", content: "New case note" },
      {
        property: "og:description",
        content: "Draft, generate, review and finalise a case note in one flow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewCaseNote,
});

const NO_CLIENT = "__none__";

function NewCaseNote() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { draft: draftParam } = Route.useSearch();

  const search = useServerFn(searchClients);
  const loadDraft = useServerFn(getDraft);
  const persistDraft = useServerFn(saveDraft);
  const dropDraft = useServerFn(discardDraft);
  const generate = useServerFn(generateCaseNote);
  const persistNote = useServerFn(saveCaseNote);
  const fetchDepartments = useServerFn(listDepartments);
  const { data: session } = useSession();
  const [departmentId, setDepartmentId] = useState<string>("");
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchDepartments(),
  });
  const activeDepartments = (departments ?? []).filter((d) => d.status !== "archived" && d.status !== "inactive");
  useEffect(() => {
    if (departmentId) return;
    const own = (session as { department?: { id?: string } | null } | undefined)?.department?.id;
    if (own) setDepartmentId(own);
    else if (activeDepartments[0]) setDepartmentId(activeDepartments[0].id);
  }, [session, activeDepartments, departmentId]);
  const selectedDept = activeDepartments.find((d) => d.id === departmentId);
  const isCounsellingDept = /counsel/i.test(selectedDept?.name ?? "");

  const [draftId, setDraftId] = useState<string | null>(draftParam ?? null);
  const [clientId, setClientId] = useState<string>(NO_CLIENT);
  const [interactionType, setInteractionType] = useState<string>(INTERACTION_TYPES[0]);
  const [interactionDate, setInteractionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rawInput, setRawInput] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [services, setServices] = useState<MeetingServices>(EMPTY_MEETING_SERVICES);
  const [formVersion, setFormVersion] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(true);
  const startedAt = useRef(Date.now());
  const hydrated = useRef(false);

  const { data: clients } = useQuery({
    queryKey: ["clients", ""],
    queryFn: () => search({ data: {} }),
  });

  // Resume an existing draft
  useEffect(() => {
    if (!draftParam || hydrated.current) return;
    hydrated.current = true;
    void (async () => {
      const row = await loadDraft({ data: { id: draftParam } });
      if (!row) return;
      const payload = (row.draft_data ?? {}) as {
        clientId?: string | null;
        interactionType?: string;
        interactionDate?: string;
        rawInput?: string;
        generatedNote?: string | null;
      };
      setDraftId(row.id);
      setClientId(payload.clientId ?? NO_CLIENT);
      if (payload.interactionType) setInteractionType(payload.interactionType);
      if (payload.interactionDate) setInteractionDate(payload.interactionDate);
      setRawInput(payload.rawInput ?? "");
      setGeneratedNote(payload.generatedNote ?? "");
      setFinalNote(payload.generatedNote ?? "");
      setSavedAt(row.last_saved_at);
    })();
  }, [draftParam, loadDraft]);

  const autosave = useCallback(async () => {
    if (rawInput.trim().length < 5) return;
    try {
      const row = await persistDraft({
        data: {
          id: draftId,
          data: {
            clientId: clientId === NO_CLIENT ? null : clientId,
            interactionType,
            interactionDate,
            rawInput,
            generatedNote: finalNote || generatedNote || null,
          },
        },
      });
      if (row) {
        setDraftId(row.id);
        setSavedAt(row.last_saved_at);
      }
    } catch {
      /* autosave stays silent */
    }
  }, [clientId, draftId, finalNote, generatedNote, interactionDate, interactionType, persistDraft, rawInput]);

  // Auto-save every 20s of activity
  useEffect(() => {
    const timer = setTimeout(() => void autosave(), 20_000);
    return () => clearTimeout(timer);
  }, [autosave]);

  async function handleGenerate(regenerate = false) {
    if (rawInput.trim().length < 10) {
      toast.error("Add a little more detail before generating.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generate({
        data: {
          clientId: clientId === NO_CLIENT ? null : clientId,
          departmentId: departmentId || null,
          interactionType,
          interactionDate,
          rawInput,
          regenerate,
        },
      });
      setGeneratedNote(result.text);
      setFinalNote(result.text);
      setReviewed(false);
      void autosave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  /** Clears the whole form so a fresh case note can be recorded without reloading the page. */
  function resetForm() {
    setDraftId(null);
    setClientId(NO_CLIENT);
    setInteractionType(INTERACTION_TYPES[0]);
    setInteractionDate(new Date().toISOString().slice(0, 10));
    setRawInput("");
    setGeneratedNote("");
    setFinalNote("");
    setReviewed(false);
    setServices(EMPTY_MEETING_SERVICES);
    setFormVersion((version) => version + 1);
    setSavedAt(null);
    setShowReminder(true);
    startedAt.current = Date.now();
    hydrated.current = true;
    void navigate({ to: "/notes/new", search: {}, replace: true });
  }

  async function handleSave() {
    if (!finalNote.trim()) {
      toast.error("There is no note to save yet.");
      return;
    }
    if (!reviewed) {
      toast.error("Confirm you have reviewed the note for accuracy.");
      return;
    }
    setSaving(true);
    try {
      await persistNote({
        data: {
          draftId,
          clientId: clientId === NO_CLIENT ? null : clientId,
          departmentId: departmentId || null,
          interactionType,
          interactionDate,
          rawInput,
          generatedNote: generatedNote || null,
          finalNote,
          reviewed: true,
          changeType: "created",
          services: { ...services, prInfo: services.prInfo?.trim() || null, note: services.note?.trim() || null },
          timeSpentSeconds: Math.min(86400, Math.round((Date.now() - startedAt.current) / 1000)),
        },
      });
      if (draftId) await dropDraft({ data: { id: draftId } }).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ["worker-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["case-notes"] });
      await queryClient.invalidateQueries({ queryKey: ["my-follow-ups"] });
      resetForm();
      toast.success("Case note saved. The form is clear for your next note.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the case note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="New case note"
      description={savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : "Draft not saved yet"}
      actions={
        <div className="hidden flex-wrap gap-2 lg:flex">
          <Button size="sm" variant="outline" onClick={() => void autosave()}>
            Save draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              toast.success("Form cleared — ready for another case note.");
            }}
          >
            Start another note
          </Button>
        </div>
      }
    >
      <CaseNoteReminderTicker open={showReminder} onClose={() => setShowReminder(false)} />

      {/* Mobile quick actions */}
      <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
        <Button size="sm" variant="outline" onClick={() => void autosave()}>
          Save draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetForm();
            toast.success("Form cleared — ready for another case note.");
          }}
        >
          Start another note
        </Button>
      </div>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 lg:p-5">
          <h2 className="text-sm font-semibold text-foreground">Interaction details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setServices(EMPTY_MEETING_SERVICES); }}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>No client linked</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} · {c.client_identifier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Department</Label>
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  if (generatedNote) toast.info("Department changed — regenerate the note to apply its form.");
                }}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {activeDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isCounsellingDept
                  ? "Form: SOAP — Subjective, Objective, Assessment, Plan."
                  : "Form: Case Note, Client's Success, Client's Challenge, Follow-Up / Next Steps."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Interaction type</Label>
              <Select value={interactionType} onValueChange={setInteractionType}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={interactionDate}
                onChange={(e) => setInteractionDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="raw">What happened, in your own words</Label>
            <VoiceRecorder
              disabled={generating}
              onTranscript={(text) =>
                setRawInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
              }
            />
            <Textarea
              id="raw"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onBlur={() => void autosave()}
              rows={10}
              className="min-h-[160px] text-base"
              placeholder="Met client at the office. Went over housing application, gave list of landlords, booked follow-up for next Tuesday…"
            />
            <p className="text-xs text-muted-foreground">
              Type or dictate. The assistant only uses what appears here. It never adds facts,
              diagnoses or recommendations.
            </p>
          </div>

          <Button
            className="mt-4 w-full min-h-[48px] sm:w-auto"
            onClick={() => void handleGenerate(Boolean(generatedNote))}
            disabled={generating}
          >
            {generating
              ? "Generating…"
              : generatedNote
                ? "Regenerate note"
                : "Generate case note"}
          </Button>

        </section>

        <section className="rounded-lg border border-border bg-card p-4 lg:p-5">
          <h2 className="text-sm font-semibold text-foreground">Review and finalise</h2>
          <Textarea
            className="mt-4 min-h-[220px] font-mono text-sm lg:min-h-[320px]"
            rows={14}
            value={finalNote}
            onChange={(e) => setFinalNote(e.target.value)}
            placeholder="Your generated note appears here. Edit anything before saving."
          />
          <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
            <Checkbox
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(v === true)}
              className="mt-0.5 h-5 w-5"
            />
            <span>
              I have reviewed this note and confirm it accurately reflects the interaction.
            </span>
          </label>
          <MeetingServicesAccordion key={formVersion} value={services} onChange={setServices} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="min-h-[48px] flex-1"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save case note"}
            </Button>
            <Button
              variant="outline"
              className="min-h-[48px]"
              onClick={() => {
                if (finalNote) void navigator.clipboard.writeText(finalNote);
                toast.success("Note copied.");
              }}
              disabled={!finalNote}
            >
              Copy
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
