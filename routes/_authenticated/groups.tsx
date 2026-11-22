import { useAutoDraft } from "@/hooks/useAutoDraft";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Search, X } from "lucide-react";
import {
  addGroupAttendees, getGroupSession, listGroupSessions, markAllAttended, saveAttendeeServices, saveGroupSession, updateAttendee,
} from "@/lib/groups.functions";
import { searchClients } from "@/lib/clients.functions";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "Group sessions — ACN — Assistance Case Note" },
      { name: "description", content: "Plan workshops and group sessions, register clients and record attendance." },
      { property: "og:title", content: "Group sessions — ACN" },
      { property: "og:description", content: "Workshops, orientations and support groups with attendance tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

const TYPES = ["Workshop", "Orientation", "Information session", "Support group", "Conversation circle", "Employment workshop", "Youth program", "Community event", "Other"];
const MODES = ["In person", "Virtual", "Hybrid"];
const ATT = [
  { v: "registered", l: "Registered" },
  { v: "attended", l: "Attended" },
  { v: "absent", l: "Absent" },
  { v: "cancelled", l: "Cancelled" },
] as const;

type Form = {
  id?: string; title: string; topic: string; sessionType: string; sessionDate: string; startTime: string;
  durationMinutes: string; location: string; deliveryMode: string; language: string; coFacilitators: string; facilitatorName: string;
  partnerOrganization: string; status: "scheduled" | "completed" | "cancelled"; sessionNote: string;
};
const blank = (): Form => ({
  title: "", topic: "", sessionType: "Workshop", sessionDate: new Date().toISOString().slice(0, 10), startTime: "",
  durationMinutes: "", location: "", deliveryMode: "In person", language: "", coFacilitators: "", facilitatorName: "",
  partnerOrganization: "", status: "scheduled", sessionNote: "",
});

function GroupsPage() {
  const list = useServerFn(listGroupSessions);
  const { data, isLoading } = useQuery({ queryKey: ["groups"], queryFn: () => list() });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <AppShell
      title="Group sessions"
      description="Workshops, orientations and support groups with registration and attendance."
      actions={<Button onClick={() => { setSelected(null); setCreating(true); }}>New group session</Button>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-xl border border-border bg-card p-2">
          {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {data?.length === 0 && <p className="p-3 text-sm text-muted-foreground">No group sessions yet.</p>}
          <ul>
            {data?.map((s) => (
              <li key={s.id}>
                <button
                  className={`w-full rounded-md p-3 text-left hover:bg-secondary/60 ${selected === s.id ? "bg-secondary" : ""}`}
                  onClick={() => { setCreating(false); setSelected(s.id); }}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-foreground">{s.title}</span>
                    <span className="text-xs capitalize text-muted-foreground">{s.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.session_date}{s.start_time ? ` · ${s.start_time}` : ""} · {s.session_type} · {s.delivery_mode}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.attended}/{s.registered} attended</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <div>
          {creating && <SessionForm initial={blank()} onSaved={(id) => { setCreating(false); setSelected(id); }} />}
          {!creating && selected && <SessionDetail id={selected} />}
          {!creating && !selected && (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Select a session or create a new one.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SessionForm({ initial, onSaved }: { initial: Form; onSaved: (id: string) => void }) {
  const save = useServerFn(saveGroupSession);
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(initial);
  const groupDraft = useAutoDraft(`group:${initial.id ?? "new"}`, f, setF);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const n = (s: string) => (s.trim() ? s.trim() : null);
  return (
    <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{f.id ? "Edit session" : "New group session"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Session title</Label><Input value={f.title} onChange={set("title")} /></div>
        <div className="space-y-1.5">
          <Label>Session type</Label>
          <Select value={f.sessionType} onValueChange={(v) => setF({ ...f, sessionType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Delivery</Label>
          <Select value={f.deliveryMode} onValueChange={(v) => setF({ ...f, deliveryMode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={f.sessionDate} onChange={set("sessionDate")} /></div>
        <div className="space-y-1.5"><Label>Start time</Label><Input type="time" value={f.startTime} onChange={set("startTime")} /></div>
        <div className="space-y-1.5"><Label>Duration (minutes)</Label><Input type="number" min={0} value={f.durationMinutes} onChange={set("durationMinutes")} /></div>
        <div className="space-y-1.5"><Label>Language</Label><Input value={f.language} onChange={set("language")} /></div>
        <div className="space-y-1.5"><Label>Location / link</Label><Input value={f.location} onChange={set("location")} /></div>
        <div className="space-y-1.5"><Label>Partner organization</Label><Input value={f.partnerOrganization} onChange={set("partnerOrganization")} /></div>
        <div className="space-y-1.5"><Label>Facilitator name</Label><Input placeholder="Leave blank to use your name" value={f.facilitatorName} onChange={set("facilitatorName")} /></div>
        <div className="space-y-1.5"><Label>Co-facilitators</Label><Input value={f.coFacilitators} onChange={set("coFacilitators")} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Topic / objectives</Label><Textarea value={f.topic} onChange={set("topic")} /></div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Form["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Group session note</Label>
          <Textarea rows={6} placeholder="What was covered, group participation, materials, next steps. No individual client details." value={f.sessionNote} onChange={set("sessionNote")} />
        </div>
      </div>
      <Button
        className="mt-4"
        disabled={busy || !f.title.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await save({
              data: {
                ...(f.id ? { id: f.id } : {}), title: f.title, topic: n(f.topic), sessionType: f.sessionType,
                sessionDate: f.sessionDate, startTime: n(f.startTime),
                durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : null, location: n(f.location),
                deliveryMode: f.deliveryMode, language: n(f.language), coFacilitators: n(f.coFacilitators), facilitatorName: n(f.facilitatorName),
                partnerOrganization: n(f.partnerOrganization), status: f.status, sessionNote: n(f.sessionNote),
              },
            });
            groupDraft.clear();
            toast.success("Session saved.");
            await qc.invalidateQueries({ queryKey: ["groups"] });
            await qc.invalidateQueries({ queryKey: ["group", r.id] });
            onSaved(r.id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save session
      </Button>
    </section>
  );
}

function SessionDetail({ id }: { id: string }) {
  const get = useServerFn(getGroupSession);
  const add = useServerFn(addGroupAttendees);
  const upd = useServerFn(updateAttendee);
  const markAll = useServerFn(markAllAttended);
  const search = useServerFn(searchClients);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["group", id], queryFn: () => get({ data: { id } }) });
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: found } = useQuery({
    queryKey: ["clients", "search", term],
    queryFn: () => search({ data: { query: term, limit: 25 } }),
    enabled: term.trim().length > 0,
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["group", id] }); void qc.invalidateQueries({ queryKey: ["groups"] }); };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const s = data.session;
  if (editing) {
    return (
      <SessionForm
        initial={{
          id: s.id, title: s.title, topic: s.topic ?? "", sessionType: s.session_type, sessionDate: s.session_date,
          startTime: s.start_time ?? "", durationMinutes: s.duration_minutes?.toString() ?? "", location: s.location ?? "",
          deliveryMode: s.delivery_mode, language: s.language ?? "", coFacilitators: s.co_facilitators ?? "", facilitatorName: s.facilitator_name ?? "",
          partnerOrganization: s.partner_organization ?? "", status: s.status as Form["status"], sessionNote: s.session_note ?? "",
        }}
        onSaved={() => setEditing(false)}
      />
    );
  }
  const already = new Set(data.attendees.map((a) => a.client_id));
  const attended = data.attendees.filter((a) => a.attendance === "attended").length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
            <p className="text-sm text-muted-foreground">
              {s.session_type} · {s.session_date}{s.start_time ? ` ${s.start_time}` : ""}
              {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""} · {s.delivery_mode}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Facilitator</dt><dd>{data.facilitator ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Co-facilitators</dt><dd>{s.co_facilitators ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Location</dt><dd>{s.location ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Language</dt><dd>{s.language ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Partner</dt><dd>{s.partner_organization ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{s.status}</dd></div>
        </dl>
        {s.topic && <p className="mt-3 text-sm"><span className="text-muted-foreground">Topic: </span>{s.topic}</p>}
        {s.session_note && <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary/50 p-3 text-sm">{s.session_note}</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Participants · {attended}/{data.attendees.length} attended</h3>
          {data.attendees.length > 0 && (
            <Button size="sm" variant="outline" onClick={async () => { await markAll({ data: { sessionId: id } }); refresh(); }}>
              Mark all registered as attended
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {data.attendees.length === 0 && <li className="text-sm text-muted-foreground">No participants registered.</li>}
          {data.attendees.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to="/clients/$clientId" params={{ clientId: a.client_id }} className="text-primary underline">
                  {a.clients?.first_name} {a.clients?.last_name}
                  <span className="text-muted-foreground"> · {a.clients?.client_identifier}</span>
                </Link>
                <div className="flex items-center gap-1">
                  <Select value={a.attendance} onValueChange={async (v) => { await upd({ data: { id: a.id, attendance: v as (typeof ATT)[number]["v"] } }); refresh(); }}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ATT.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                    {openId === a.id ? "Close" : "Services & details"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await upd({ data: { id: a.id, remove: true } }); refresh(); }}>Remove</Button>
                </div>
              </div>
              {openId !== a.id && <AttendeeSummary a={a} />}
              {openId === a.id && <AttendeeServices a={a} onSaved={() => { setOpenId(null); refresh(); }} />}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          <Label>Register clients</Label>
          <Input placeholder="Search by name or file number" value={term} onChange={(e) => setTerm(e.target.value)} />
          {found && found.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-auto rounded-md border border-border p-2">
              {found.filter((c) => !already.has(c.id)).map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={picked.includes(c.id)}
                      onCheckedChange={(v) => setPicked(v === true ? [...picked, c.id] : picked.filter((x) => x !== c.id))}
                    />
                    {c.first_name} {c.last_name} <span className="text-muted-foreground">· {c.client_identifier}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <Button
            disabled={picked.length === 0}
            onClick={async () => {
              try {
                await add({ data: { sessionId: id, clientIds: picked } });
                toast.success(`${picked.length} registered.`);
                setPicked([]);
                setTerm("");
                refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not register.");
              }
            }}
          >
            Register {picked.length || ""} selected
          </Button>
        </div>
      </section>
    </div>
  );
}

type Attendee = Awaited<ReturnType<typeof getGroupSession>>["attendees"][number];
const NUMS = Array.from({ length: 10 }, (_, i) => String(i + 1));
const NONE = "__none";
const LANGUAGES = ["English", "French", "Arabic", "Spanish", "Ukrainian", "Tigrinya", "Swahili", "Somali", "Dari", "Pashto", "Farsi", "Mandarin", "Punjabi", "Tagalog", "Other"];
const yn = (v: boolean | null) => (v === null ? NONE : v ? "yes" : "no");
const toYn = (v: string) => (v === NONE ? null : v === "yes");

function ageOn(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}

function childLabel(child: Attendee["children"][number]) {
  const age = ageOn(child.date_of_birth);
  return `${child.first_name} ${child.last_name} (Child)${age === null ? "" : ` (${age} yrs old)`}`;
}

function AttendeeSummary({ a }: { a: Attendee }) {
  const kids = a.children.filter((k) => a.child_client_ids.includes(k.id));
  const bits = [
    kids.length ? `With: ${kids.map((k) => k.first_name).join(", ")}` : null,
    a.bus_tokens ? `Bus tokens: ${a.bus_tokens}` : null,
    a.emergency_food !== null ? `Emergency food: ${a.emergency_food ? "Yes" : "No"}` : null,
    a.meal_provided !== null ? `Meal/snack: ${a.meal_provided ? "Yes" : "No"}` : null,
    a.childminding_count ? `Childminding: ${a.childminding_count}${kids.length ? ` (${kids.map((k) => k.first_name).join(", ")})` : ""}` : null,
    a.pr_info ? `PR: ${a.pr_info}` : null,
    a.client_language ? `Language: ${a.client_language}` : null,
    a.interpretation_needed !== null ? `Interpretation: ${a.interpretation_needed ? "Yes" : "No"}` : null,
  ].filter(Boolean);
  if (!bits.length && !a.note) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {bits.join(" · ")}{a.note ? `${bits.length ? " · " : ""}Comment: ${a.note}` : ""}
    </p>
  );
}

function NumPick({ label, value, onChange, blank }: { label: string; value: string; onChange: (v: string) => void; blank: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{blank}</SelectItem>
          {NUMS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function YnPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function AttendeeServices({ a, onSaved }: { a: Attendee; onSaved: () => void }) {
  const save = useServerFn(saveAttendeeServices);
  const [kids, setKids] = useState<string[]>(a.child_client_ids ?? []);
  const [childTerm, setChildTerm] = useState("");
  const [childResults, setChildResults] = useState<Attendee["children"]>([]);
  const [childSearched, setChildSearched] = useState(false);
  const [openSection, setOpenSection] = useState("Services provided");
  const [bus, setBus] = useState(a.bus_tokens ? String(a.bus_tokens) : NONE);
  const [food, setFood] = useState(yn(a.emergency_food));
  const [meal, setMeal] = useState(yn(a.meal_provided));
  const [mind, setMind] = useState(a.childminding_count ? String(a.childminding_count) : NONE);
  const [pr, setPr] = useState(a.pr_info ?? "");
  const [dob, setDob] = useState(a.date_of_birth ?? a.clients?.date_of_birth ?? "");
  const [language, setLanguage] = useState(a.client_language ?? NONE);
  const [interpretation, setInterpretation] = useState(yn(a.interpretation_needed));
  const [note, setNote] = useState(a.note ?? "");
  const [busy, setBusy] = useState(false);

  const mindCount = mind === NONE ? 0 : Number(mind);
  const selectedChildren = a.children.filter((child) => kids.includes(child.id));
  // Same tinted-section system as the Monthly Activity Report accordion:
  // navy / teal / amber surfaces defined as tokens in src/styles.css.
  const TINTS = [
    { panel: "border-section-navy-line border-l-section-navy-deep bg-section-navy", ink: "text-section-navy-ink", chip: "bg-section-navy-deep" },
    { panel: "border-section-teal-line border-l-section-teal-deep bg-section-teal", ink: "text-section-teal-ink", chip: "bg-section-teal-deep" },
    { panel: "border-section-amber-line border-l-section-amber-deep bg-section-amber", ink: "text-section-amber-ink", chip: "bg-section-amber-deep" },
  ] as const;
  const section = (title: string, index: number, content: React.ReactNode) => {
    const isOpen = openSection === title;
    const tint = TINTS[index % TINTS.length]!;
    return (
      <section className={`overflow-hidden rounded-md border border-l-4 bg-card ${tint.panel}`}>
        <button
          type="button"
          aria-expanded={isOpen}
          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium ${tint.ink} hover:bg-black/[0.03]`}
          onClick={() => setOpenSection(isOpen ? "" : title)}
        >
          <span className="flex items-center gap-2.5">
            <span className={`section-chip ${tint.chip}`}>{index + 1}</span>
            {title}
          </span>
          <ChevronDown className={`size-4 shrink-0 opacity-70 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && <div className="border-t border-border bg-card p-4">{content}</div>}
      </section>
    );
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {section("Services provided", 0, (
        <div className="grid gap-3 sm:grid-cols-2">
          <NumPick label="Bus tokens" value={bus} onChange={setBus} blank="Blank" />
          <YnPick label="Emergency food" value={food} onChange={setFood} />
          <YnPick label="Meal or snack provided" value={meal} onChange={setMeal} />
          <NumPick label="# children needing childminding" value={mind} onChange={setMind} blank="Blank" />
        </div>
      ))}
      {section("Find and link children", 1, (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Search children already recorded under this client’s Family section.</p>
          <div className="flex gap-2">
            <Input
              value={childTerm}
              onChange={(e) => { setChildTerm(e.target.value); setChildSearched(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const q = childTerm.trim().toLowerCase(); setChildResults(q ? a.children.filter((child) => `${child.first_name} ${child.last_name}`.toLowerCase().includes(q)) : []); setChildSearched(Boolean(q)); } }}
              placeholder="Search by first or last name"
            />
            <Button
              type="button"
              variant="outline"
              aria-label="Search children"
              title="Search children"
              disabled={!childTerm.trim()}
              onClick={() => { const q = childTerm.trim().toLowerCase(); setChildResults(a.children.filter((child) => `${child.first_name} ${child.last_name}`.toLowerCase().includes(q))); setChildSearched(true); }}
            >
              <Search className="size-4" />
            </Button>
          </div>
          {childResults.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {childResults.map((child) => {
                const linked = kids.includes(child.id);
                return (
                  <li key={child.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span>{childLabel(child)}</span>
                    <Button type="button" size="sm" variant={linked ? "secondary" : "outline"} disabled={linked} onClick={() => setKids((current) => [...current, child.id])}>
                      {linked ? "Linked" : "Link child"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {childSearched && childResults.length === 0 && <p className="text-xs text-muted-foreground">No matching child was found in this client’s Family section.</p>}
          {selectedChildren.length > 0 && (
            <div className="space-y-2">
              <Label>Linked children</Label>
              <ul className="space-y-2">
                {selectedChildren.map((child) => (
                  <li key={child.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                    <span>{childLabel(child)}</span>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${child.first_name}`} title="Remove linked child" onClick={() => setKids((current) => current.filter((id) => id !== child.id))}>
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mindCount > kids.length && (
            <p className="text-xs text-destructive">Childminding is set to {mindCount}, but only {kids.length} {kids.length === 1 ? "child is" : "children are"} linked.</p>
          )}
        </div>
      ))}
      {section("Client details", 2, (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>PR info</Label><Input value={pr} onChange={(e) => setPr(e.target.value)} placeholder="PR card number / status" /></div>
          <div className="space-y-1"><Label>Date of birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Client’s language</Label>
            <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Blank</SelectItem>{LANGUAGES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </div>
          <YnPick label="Client needs interpretation" value={interpretation} onChange={setInterpretation} />
        </div>
      ))}
      {section("Notation or comment", 3, <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />)}
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await save({ data: {
              id: a.id, childClientIds: kids,
              busTokens: bus === NONE ? null : Number(bus), emergencyFood: toYn(food), mealProvided: toYn(meal),
              childmindingCount: mind === NONE ? null : Number(mind),
               prInfo: pr.trim() || null, dateOfBirth: dob || null,
               clientLanguage: language === NONE ? null : language,
               interpretationNeeded: toYn(interpretation), note: note.trim() || null,
            } });
            toast.success("Saved.");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save.");
          } finally { setBusy(false); }
        }}
      >
        Save services & details
      </Button>
    </div>
  );
}
