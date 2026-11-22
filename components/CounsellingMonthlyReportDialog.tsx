import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CounsellingReportAccordion } from "@/components/CounsellingReportAccordion";
import { CounsellingReportsPanel } from "@/components/CounsellingReportsPanel";
import { searchClients } from "@/lib/clients.functions";
import { getClientFamilyForServices } from "@/lib/notes.functions";
import { submitCounsellingReport } from "@/lib/counselling-reports.functions";
import { ageRangeFromDob, missingRequired, type CrAnswers } from "@/lib/counselling-report-schema";
import { useSession } from "@/hooks/useSession";

const NO_CLIENT = "__none__";
const today = () => new Date().toISOString().slice(0, 10);
type Draft = { date: string; clientId: string; answers: CrAnswers };

/** Standalone Counselling Monthly Report: workers submit entries, managers view and export. */
export function CounsellingMonthlyReportDialog({ from, to, departmentId, canSubmit, canExport, open: openProp, onOpenChange }: {
  from: string; to: string; departmentId: string | null; canSubmit: boolean; canExport: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => { if (controlled) onOpenChange?.(v); else setOpenState(v); };
  const [date, setDate] = useState(today());
  const [clientId, setClientId] = useState(NO_CLIENT);
  const [answers, setAnswers] = useState<CrAnswers>({});
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);
  const draftKey = session ? `acn-cr-draft:${session.userId}` : null;

  // Restore the auto-saved draft once, then keep it in sync while the worker types.
  useEffect(() => {
    if (!draftKey || loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setDate(d.date || today()); setClientId(d.clientId || NO_CLIENT); setAnswers(d.answers ?? {}); setVersion((v) => v + 1);
      }
    } catch { /* ignore broken draft */ }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey || !loaded.current) return;
    const empty = clientId === NO_CLIENT && Object.keys(answers).length === 0;
    if (empty) localStorage.removeItem(draftKey);
    else localStorage.setItem(draftKey, JSON.stringify({ date, clientId, answers } satisfies Draft));
  }, [draftKey, date, clientId, answers]);

  const search = useServerFn(searchClients);
  const familyFn = useServerFn(getClientFamilyForServices);
  const submit = useServerFn(submitCounsellingReport);
  const { data: clients } = useQuery({ queryKey: ["clients", ""], queryFn: () => search({ data: {} }), enabled: open && canSubmit });
  const cid = clientId !== NO_CLIENT ? clientId : null;
  const { data: family } = useQuery({ queryKey: ["cr-family", cid], queryFn: () => familyFn({ data: { clientId: cid! } }), enabled: !!cid });
  useEffect(() => {
    if (!family) return;
    setAnswers((a) => {
      const next = { ...a };
      const age = ageRangeFromDob(family.dateOfBirth, date);
      if (next["age_range"] == null && age) next["age_range"] = age;
      if (next["has_children"] == null) next["has_children"] = family.children.length > 0 ? "Yes" : "No";
      return next;
    });
  }, [family, date]);

  function reset() {
    setDate(today()); setClientId(NO_CLIENT); setAnswers({}); setVersion((v) => v + 1);
    if (draftKey) localStorage.removeItem(draftKey);
  }

  async function onSubmit() {
    const missing = missingRequired(answers);
    if (missing.length) { toast.error(`Please answer "${missing[0]}"${missing.length > 1 ? ` and ${missing.length - 1} more` : ""}.`); return; }
    setSaving(true);
    try {
      await submit({ data: { interactionDate: date, clientId: cid, answers: answers as Record<string, string | number | string[] | null> } });
      toast.success("Monthly report submitted");
      reset();
      void qc.invalidateQueries({ queryKey: ["counselling-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the report.");
    } finally { setSaving(false); }
  }

  if (!canSubmit && !canExport) return null;
  return (
    <>
      {!controlled && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ClipboardList className="mr-1.5 h-4 w-4" />Counselling — Monthly Activity Report
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Counselling — Monthly Activity Report</DialogTitle>
            <DialogDescription>Answers are saved as a draft automatically until you submit.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue={canSubmit && canExport && !(session?.roles.includes("manager") || session?.roles.includes("org_admin")) ? "submit" : canExport ? "responses" : "submit"}>
            {canSubmit && canExport && (
              <TabsList>
                <TabsTrigger value="submit">Fill in report</TabsTrigger>
                <TabsTrigger value="responses">Responses & export</TabsTrigger>
              </TabsList>
            )}
            {canSubmit && (
              <TabsContent value="submit" className="space-y-3">
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Date of interaction</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <Label>Client</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CLIENT}>No client linked</SelectItem>
                        {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.client_identifier}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CounsellingReportAccordion key={`cr-${version}`} value={answers} onChange={setAnswers} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>Clear</Button>
                  <Button size="sm" onClick={() => void onSubmit()} disabled={saving}>{saving ? "Submitting…" : "Submit report"}</Button>
                </div>
              </TabsContent>
            )}
            {canExport && (
              <TabsContent value="responses">
                <CounsellingReportsPanel from={from} to={to} departmentId={departmentId} />
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
