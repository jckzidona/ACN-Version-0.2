import { useAutoDraft } from "@/hooks/useAutoDraft";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteClientDocument,
  getClientRecordExtras,
  openClientDocument,
  registerClientDocument,
  saveReferral,
  updateEnrollment,
} from "@/lib/client-record.functions";
import { searchClients } from "@/lib/clients.functions";

const DOC_TYPES = ["Photo ID", "PR card", "Work permit", "Study permit", "Passport", "Refugee document", "Birth certificate", "Other"];
const REF_STATUS = ["sent", "accepted", "completed", "declined"] as const;
const CONF = [
  { v: "standard", l: "Standard" },
  { v: "restricted", l: "Restricted" },
  { v: "highly_confidential", l: "Highly confidential" },
] as const;
const NONE = "__none__";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ClientRecordPanels({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const fetchExtras = useServerFn(getClientRecordExtras);
  const { data, isLoading } = useQuery({
    queryKey: ["client-extras", clientId],
    queryFn: () => fetchExtras({ data: { clientId } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-extras", clientId] });

  if (isLoading || !data) return null;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {data.restricted && (
        <div className="rounded-lg border border-border bg-secondary/60 p-4 text-sm text-foreground lg:col-span-2">
          This client record is confidential. You can see its status and family links only.
        </div>
      )}
      {!data.restricted && <Enrollment clientId={clientId} extras={data} onSaved={refresh} />}
      <Family parent={data.parent} kids={data.children} />
      {!data.restricted && <Referrals clientId={clientId} rows={data.referrals} onSaved={refresh} />}
      {!data.restricted && <Documents clientId={clientId} rows={data.documents} onSaved={refresh} />}
    </div>
  );
}

export type Extras = Awaited<ReturnType<typeof getClientRecordExtras>>;

function Enrollment({ clientId, extras, onSaved }: { clientId: string; extras: Extras; onSaved: () => void }) {
  const save = useServerFn(updateEnrollment);
  const search = useServerFn(searchClients);
  const c = extras.client;
  const [f, setF] = useState({
    enrollmentDate: c?.enrollment_date ?? "",
    intakeDate: c?.intake_date ?? "",
    enrolledProgram: c?.enrolled_program ?? "",
    consentToShare: c?.consent_to_share ?? false,
    confidentialityLevel: (c?.confidentiality_level ?? "standard") as (typeof CONF)[number]["v"],
    parentClientId: c?.parent_client_id ?? NONE,
    familyRelationship: c?.family_relationship ?? "",
  });
  useEffect(() => {}, []);
  const { data: clients } = useQuery({ queryKey: ["clients", "all"], queryFn: () => search({ data: { limit: 100 } }) });
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="Enrollment, intake & confidentiality">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Intake date</Label>
          <Input type="date" value={f.intakeDate} onChange={(e) => setF({ ...f, intakeDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Enrollment date</Label>
          <Input type="date" value={f.enrollmentDate} onChange={(e) => setF({ ...f, enrollmentDate: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Program enrolled in</Label>
          <Input value={f.enrolledProgram} onChange={(e) => setF({ ...f, enrolledProgram: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Confidentiality level</Label>
          <Select value={f.confidentialityLevel} onValueChange={(v) => setF({ ...f, confidentialityLevel: v as typeof f.confidentialityLevel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONF.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm text-foreground">
          <Checkbox checked={f.consentToShare} onCheckedChange={(v) => setF({ ...f, consentToShare: v === true })} />
          Client consents to share information
        </label>
        <div className="space-y-1.5">
          <Label>Family case: parent / head of case</Label>
          <Select value={f.parentClientId} onValueChange={(v) => setF({ ...f, parentClientId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None (this is a main file)</SelectItem>
              {clients?.filter((x) => x.id !== clientId).map((x) => (
                <SelectItem key={x.id} value={x.id}>{x.first_name} {x.last_name} · {x.client_identifier}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Relationship to parent file</Label>
          <Select value={f.familyRelationship || NONE} onValueChange={(v) => setF({ ...f, familyRelationship: v === NONE ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {["Child", "Spouse / partner", "Sibling", "Parent", "Other household member"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        className="mt-4"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              data: {
                clientId,
                enrollmentDate: f.enrollmentDate || null,
                intakeDate: f.intakeDate || null,
                enrolledProgram: f.enrolledProgram || null,
                consentToShare: f.consentToShare,
                confidentialityLevel: f.confidentialityLevel,
                parentClientId: f.parentClientId === NONE ? null : f.parentClientId,
                familyRelationship: f.familyRelationship || null,
              },
            });
            toast.success("Enrollment saved.");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save enrollment
      </Button>
    </Panel>
  );
}

function Family({ parent, kids }: { parent: Extras["parent"]; kids: Extras["children"] }) {
  return (
    <Panel title="Family case">
      {!parent && kids.length === 0 && <p className="text-sm text-muted-foreground">No linked family files.</p>}
      {parent && (
        <p className="text-sm">
          <span className="text-muted-foreground">Parent file: </span>
          <Link to="/clients/$clientId" params={{ clientId: parent.id }} className="text-primary underline">
            {parent.first_name} {parent.last_name} ({parent.client_identifier})
          </Link>
        </p>
      )}
      {kids.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {kids.map((k) => (
            <li key={k.id}>
              <Link to="/clients/$clientId" params={{ clientId: k.id }} className="text-primary underline">
                {k.first_name} {k.last_name}
              </Link>
              <span className="text-muted-foreground"> · {k.family_relationship ?? "Linked"} · {k.client_identifier}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Referrals({ clientId, rows, onSaved }: { clientId: string; rows: Extras["referrals"]; onSaved: () => void }) {
  const save = useServerFn(saveReferral);
  const today = new Date().toISOString().slice(0, 10);
  const blank = { referredTo: "", reason: "", referralDate: today, status: "sent" as (typeof REF_STATUS)[number], followUpDate: "", notes: "" };
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);
  const refDraft = useAutoDraft(`referral:${clientId}`, open ? f : null, (d) => { if (d) { setF(d); setOpen(true); } });
  return (
    <Panel title="Referrals">
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">No referrals yet.</li>}
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-foreground">{r.referred_to}</span>
              <Select
                value={r.status}
                onValueChange={async (v) => {
                  await save({
                    data: {
                      id: r.id, clientId, referredTo: r.referred_to, reason: r.reason, referralDate: r.referral_date,
                      status: v as (typeof REF_STATUS)[number], followUpDate: r.follow_up_date, notes: r.notes,
                    },
                  });
                  onSaved();
                }}
              >
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REF_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground">{r.reason}</p>
            <p className="text-xs text-muted-foreground">
              {r.referral_date}{r.follow_up_date ? ` · follow up ${r.follow_up_date}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {!open ? (
        <Button className="mt-3" variant="outline" onClick={() => setOpen(true)}>Add referral</Button>
      ) : (
        <div className="mt-3 grid gap-2">
          <Input placeholder="Referred to (organization / service)" value={f.referredTo} onChange={(e) => setF({ ...f, referredTo: e.target.value })} />
          <Textarea placeholder="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Referral date</Label><Input type="date" value={f.referralDate} onChange={(e) => setF({ ...f, referralDate: e.target.value })} /></div>
            <div><Label>Follow-up date</Label><Input type="date" value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} /></div>
          </div>
          <Textarea placeholder="Notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await save({ data: { clientId, ...f, followUpDate: f.followUpDate || null, notes: f.notes || null } });
                  refDraft.clear();
                  toast.success("Referral added.");
                  setF(blank);
                  setOpen(false);
                  onSaved();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not save referral.");
                }
              }}
            >
              Save referral
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function Documents({ clientId, rows, onSaved }: { clientId: string; rows: Extras["documents"]; onSaved: () => void }) {
  const register = useServerFn(registerClientDocument);
  const openDoc = useServerFn(openClientDocument);
  const remove = useServerFn(deleteClientDocument);
  const [type, setType] = useState(DOC_TYPES[0]!);
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      await register({
        data: { clientId, name: file.name, documentType: type, storagePath: path, mimeType: file.type || null, expiryDate: expiry || null, note: note || null },
      });
      toast.success("Document uploaded.");
      setNote("");
      setExpiry("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Documents (ID, immigration, other)">
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">No documents on file.</li>}
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
            <div>
              <p className="text-foreground">{d.document_type} · {d.name}</p>
              <p className="text-xs text-muted-foreground">
                Added {new Date(d.created_at).toLocaleDateString()}
                {d.expiry_date ? ` · expires ${d.expiry_date}` : ""}
                {d.review_notes ? ` · ${d.review_notes}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={async () => {
                try { const r = await openDoc({ data: { id: d.id } }); window.open(r.url, "_blank", "noopener"); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Could not open."); }
              }}>Open</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                if (!confirm("Delete this document?")) return;
                try { await remove({ data: { id: d.id } }); onSaved(); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete."); }
              }}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Document type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Expiry date (optional)</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
        <Input className="sm:col-span-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Label className="sm:col-span-2 flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-sm text-foreground hover:bg-secondary/60">
          {busy ? "Uploading…" : "Upload file or take photo"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }}
          />
        </Label>
      </div>
    </Panel>
  );
}
