import { useAutoDraft } from "@/hooks/useAutoDraft";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient, getClient, searchClients, listClientNotes, updateClient } from "@/lib/clients.functions";
import { getClientRecordExtras, updateEnrollment } from "@/lib/client-record.functions";
import { listDepartments } from "@/lib/session.functions";
import { listClientGroupSessions } from "@/lib/groups.functions";
import { Documents, Referrals } from "@/components/ClientRecordPanels";
import { AppointmentsPanel } from "@/components/AppointmentsPanel";
import { AccSection, CounsellingIntake, IntakeAccordion, SettlementIntake } from "@/components/IntakeForms";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client file — ACN — Assistance Case Note" },
      {
        name: "description",
        content: "Client file with setup, family, intake needs assessment, program enrollment, referrals and documents.",
      },
      { property: "og:title", content: "Client file — ACN — Assistance Case Note" },
      { property: "og:description", content: "Client setup, family, intake and enrollment in one file." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientProfilePage,
});

type Rec = Record<string, unknown>;
const s = (o: Rec | null | undefined, k: string) => (o && typeof o[k] === "string" ? (o[k] as string) : "");
const NONE = "__none__";

const STATUSES = ["active", "inactive", "closed", "waitlist"];
const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"];
const MARITAL = ["Single", "Married", "Common-law", "Separated", "Divorced", "Widowed", "Prefer not to say"];
const LANGUAGES = ["English", "French", "Arabic", "Spanish", "Ukrainian", "Tigrinya", "Swahili", "Somali", "Dari", "Pashto", "Farsi", "Mandarin", "Punjabi", "Tagalog", "Other"];
const PROVINCES = ["MB", "AB", "BC", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const IMMIGRATION = ["Permanent resident", "Government-assisted refugee (GAR)", "Privately sponsored refugee (PSR)", "Blended visa office-referred (BVOR)", "Refugee claimant", "Protected person", "Economic immigrant", "Family class", "Temporary resident", "Work permit holder", "Study permit holder", "CUAET (Ukraine)", "Canadian citizen", "Other"];
const CLB = ["Not assessed", "CLB 0–1", "CLB 2–3", "CLB 4–5", "CLB 6–7", "CLB 8+"];
const EDUCATION = ["None", "Primary", "Secondary", "Trade / college", "Bachelor's", "Master's or higher", "Unknown"];
const EMPLOYMENT = ["Employed full-time", "Employed part-time", "Unemployed — looking", "Not in labour force", "Student", "Retired"];
const CONTACT = ["Phone call", "Text message", "Email", "WhatsApp", "In person", "No preference"];
const INTERPRETER = ["No", "Yes — phone interpreter", "Yes — in-person interpreter", "Family member interprets"];
const REF_SOURCES = ["Walk-in / self-referral", "Settlement agency", "IRCC", "Health care provider", "School", "Community organization", "Faith community", "Family or friend", "Other"];
const RELATIONSHIPS = ["Spouse / partner", "Child", "Sibling", "Parent", "Other household member"];
const EC_REL = ["Spouse / partner", "Parent", "Child", "Sibling", "Relative", "Friend", "Sponsor", "Other"];
const NEED_AREAS = ["Housing", "Employment", "Language training", "Education", "Health & mental health", "Legal / immigration", "Financial / income support", "Childcare & schooling", "Community connections", "Transportation"];
const NEED_LEVELS = ["No need", "Low", "Medium", "High"];
const ENROLL_STATUS = ["Active", "Waitlist", "Completed", "Withdrawn"];
const CONF = [
  { value: "standard", label: "Standard" },
  { value: "restricted", label: "Restricted" },
  { value: "highly_confidential", label: "Highly confidential" },
];

type Need = { level: string; note: string };
type Enrollment = { program: string; stream: string; start: string; end: string; status: string; note: string };

const ageFrom = (dob: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

function ClientProfilePage() {
  const { clientId } = useParams({ from: "/_authenticated/clients/$clientId" });
  const qc = useQueryClient();
  const fetchClient = useServerFn(getClient);
  const fetchNotes = useServerFn(listClientNotes);
  const fetchDepartments = useServerFn(listDepartments);
  const fetchExtras = useServerFn(getClientRecordExtras);
  const save = useServerFn(updateClient);
  const saveEnroll = useServerFn(updateEnrollment);
  const [busy, setBusy] = useState(false);

  const { data: client, isLoading } = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { id: clientId } }) });
  const { data: notes = [] } = useQuery({ queryKey: ["client-notes", clientId], queryFn: () => fetchNotes({ data: { clientId } }) });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments(), staleTime: 60_000 });
  const { data: extras } = useQuery({ queryKey: ["client-extras", clientId], queryFn: () => fetchExtras({ data: { clientId } }) });

  const [f, setF] = useState({
    firstName: "", lastName: "", preferredName: "", clientIdentifier: "", status: "active", dateOfBirth: "",
    arrivalDate: "", preferredLanguage: "English", phone: "", email: "", address: "", immigrationStatus: "",
    accessibilityNeeds: "", departmentId: "", householdSize: "", householdChildren: "", householdNotes: "",
    ecName: "", ecRelationship: "", ecPhone: "", contactMethod: "", interpreter: "",
    intakeDate: "", enrollmentDate: "", consentToShare: false, confidentialityLevel: "standard",
    parentClientId: NONE, familyRelationship: "",
  });
  const [intake, setIntake] = useState<Rec>({});
  const [needs, setNeeds] = useState<Record<string, Need>>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    if (!client) return;
    const h = (client.household ?? {}) as Rec;
    const ec = (client.emergency_contact ?? {}) as Rec;
    const cm = (client.communication_preferences ?? {}) as Rec;
    const it = (client.intake_data ?? {}) as Rec;
    setF((p) => ({
      ...p,
      firstName: client.first_name ?? "", lastName: client.last_name ?? "", preferredName: client.preferred_name ?? "",
      clientIdentifier: client.client_identifier ?? "", status: client.status ?? "active",
      dateOfBirth: client.date_of_birth ?? "", arrivalDate: client.arrival_date ?? "",
      preferredLanguage: client.preferred_language || "English", phone: client.phone ?? "", email: client.email ?? "",
      address: client.address ?? "", immigrationStatus: client.immigration_status ?? "",
      accessibilityNeeds: client.accessibility_needs ?? "", departmentId: client.department_id ?? "",
      householdSize: s(h, "size"), householdChildren: s(h, "children"), householdNotes: s(h, "notes"),
      ecName: s(ec, "name"), ecRelationship: s(ec, "relationship"), ecPhone: s(ec, "phone"),
      contactMethod: s(cm, "method"), interpreter: s(cm, "interpreter"),
    }));
    setIntake(it);
    setNeeds((it["needs"] as Record<string, Need>) ?? {});
    setEnrollments(Array.isArray(it["enrollments"]) ? (it["enrollments"] as Enrollment[]) : []);
  }, [client]);

  useEffect(() => {
    const c = extras?.client;
    if (!c) return;
    setF((p) => ({
      ...p,
      intakeDate: c.intake_date ?? "", enrollmentDate: c.enrollment_date ?? "",
      consentToShare: c.consent_to_share ?? false, confidentialityLevel: c.confidentiality_level ?? "standard",
      parentClientId: c.parent_client_id ?? NONE, familyRelationship: c.family_relationship ?? "",
    }));
  }, [extras]);

  const draft = useAutoDraft(
    `client:${clientId}`,
    { f, intake, needs, enrollments },
    (d) => { setF(d.f); setIntake(d.intake); setNeeds(d.needs); setEnrollments(d.enrollments); },
    Boolean(client && extras),
  );

  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const setI = (k: string, v: string) => setIntake((p) => ({ ...p, [k]: v }));
  const i = (k: string) => s(intake, k);

  async function saveAll() {
    if (!f.firstName.trim() || !f.lastName.trim()) { toast.error("First and last name are required."); return; }
    setBusy(true);
    try {
      const active = enrollments.find((e) => e.status === "Active") ?? enrollments[0];
      await save({
        data: {
          id: clientId, firstName: f.firstName.trim(), lastName: f.lastName.trim(),
          preferredName: f.preferredName.trim() || null, clientIdentifier: f.clientIdentifier.trim(), status: f.status,
          dateOfBirth: f.dateOfBirth || null, arrivalDate: f.arrivalDate || null, preferredLanguage: f.preferredLanguage,
          phone: f.phone.trim() || null, email: f.email.trim() || null, address: f.address.trim() || null,
          immigrationStatus: f.immigrationStatus || null, accessibilityNeeds: f.accessibilityNeeds.trim() || null,
          ...(f.departmentId ? { departmentId: f.departmentId } : {}),
          household: { size: f.householdSize, children: f.householdChildren, notes: f.householdNotes },
          emergencyContact: { name: f.ecName, relationship: f.ecRelationship, phone: f.ecPhone },
          communicationPreferences: { method: f.contactMethod, interpreter: f.interpreter },
          intake: { ...intake, needs, enrollments },
        },
      });
      if (!extras?.restricted) {
        await saveEnroll({
          data: {
            clientId, intakeDate: f.intakeDate || null,
            enrollmentDate: f.enrollmentDate || active?.start || null,
            enrolledProgram: active?.program || null, consentToShare: f.consentToShare,
            confidentialityLevel: f.confidentialityLevel as "standard" | "restricted" | "highly_confidential",
            parentClientId: f.parentClientId === NONE ? null : f.parentClientId,
            familyRelationship: f.familyRelationship || null,
          },
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client", clientId] }),
        qc.invalidateQueries({ queryKey: ["client-extras", clientId] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
      ]);
      draft.clear();
      toast.success("Client file saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the client file.");
    } finally {
      setBusy(false);
    }
  }

  const restricted = extras?.restricted ?? false;
  const sharedOnly = extras?.sharedOnly ?? true;
  const age = ageFrom(f.dateOfBirth);
  const deptName = departments.find((d) => d.id === f.departmentId)?.name ?? "";
  const isCounsellingDept = /counsel/i.test(deptName);
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-extras", clientId] });
  const saveBar = (
    <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom)+8px)] z-10 mt-4 lg:static">
      <Button onClick={saveAll} disabled={busy} className="w-full min-h-[48px] lg:w-auto">
        {busy ? "Saving…" : "Save client file"}
      </Button>
    </div>
  );

  return (
    <AppShell
      title={client ? `${client.first_name} ${client.last_name}` : "Client file"}
      description="Client file"
      actions={<Button asChild variant="outline" size="sm"><Link to="/clients">Back</Link></Button>}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !client ? (
        <p className="text-sm text-muted-foreground">This client record was not found.</p>
      ) : (
        <div className="space-y-4">
          {/* File header */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {client.last_name}, {client.first_name}
                  {client.preferred_name ? <span className="font-normal text-muted-foreground"> ({client.preferred_name})</span> : null}
                </h2>
                <p className="text-xs text-muted-foreground">
                  File # {client.client_identifier}
                  {i("uci") ? ` · UCI ${i("uci")}` : ""}
                  {f.dateOfBirth ? ` · DOB ${f.dateOfBirth}${age !== null ? ` (${age})` : ""}` : ""}
                  {i("gender") ? ` · ${i("gender")}` : ""}
                  {` · ${f.preferredLanguage}`}
                </p>
                {extras?.parent && (
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Family of </span>
                    <Link to="/clients/$clientId" params={{ clientId: extras.parent.id }} className="text-primary underline">
                      {extras.parent.first_name} {extras.parent.last_name}
                    </Link>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="capitalize">{f.status}</Badge>
                {f.confidentialityLevel !== "standard" && (
                  <Badge variant="destructive">{CONF.find((c) => c.value === f.confidentialityLevel)?.label}</Badge>
                )}
                {!extras?.parent && (extras?.children.length ?? 0) > 0 && <Badge variant="outline">Head of family</Badge>}
              </div>
            </div>
          </section>

          {restricted && (
            <div className="rounded-lg border border-border bg-secondary/60 p-4 text-sm text-foreground">
              This client file is confidential. You can see its status and family links only.
            </div>
          )}

          <Tabs defaultValue={restricted ? "family" : "setup"}>
            <div className="overflow-x-auto">
              <TabsList className="w-max">
                {!restricted && <TabsTrigger value="setup">Client setup</TabsTrigger>}
                <TabsTrigger value="family">Family</TabsTrigger>
                {!restricted && !sharedOnly && <TabsTrigger value="intake">Intake</TabsTrigger>}
                {!restricted && <TabsTrigger value="enrollment">Enrollment</TabsTrigger>}
                {!restricted && <TabsTrigger value="referrals">Referrals</TabsTrigger>}
                {!restricted && <TabsTrigger value="documents">Documents</TabsTrigger>}
                {!restricted && <TabsTrigger value="appointments">Appointments</TabsTrigger>}
                {!restricted && <TabsTrigger value="notes">Case notes</TabsTrigger>}
                {!restricted && <TabsTrigger value="groups">Group sessions</TabsTrigger>}
              </TabsList>
            </div>

            {!restricted && (
              <TabsContent value="setup" className="space-y-4">
                <IntakeAccordion defaultOpen="Personal information">
                <AccSection title="Personal information">
                  <Text label="Last name" value={f.lastName} onChange={(v) => set({ lastName: v })} />
                  <Text label="First name" value={f.firstName} onChange={(v) => set({ firstName: v })} />
                  <Text label="Preferred name" value={f.preferredName} onChange={(v) => set({ preferredName: v })} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">File number</p>
                    <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm">{f.clientIdentifier || "Assigned on save"}</p>
                  </div>
                  <Text label="UCI / client ID (IRCC)" value={i("uci")} onChange={(v) => setI("uci", v)} />
                  <Text label="Date of birth" type="date" value={f.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
                  <Pick label="Gender" value={i("gender")} onChange={(v) => setI("gender", v)} options={GENDERS} />
                  <Pick label="Marital status" value={i("marital_status")} onChange={(v) => setI("marital_status", v)} options={MARITAL} />
                  <Text label="Country of birth" value={i("country_of_birth")} onChange={(v) => setI("country_of_birth", v)} />
                  <Text label="Country of citizenship" value={i("citizenship")} onChange={(v) => setI("citizenship", v)} />
                  <Pick label="File status" value={f.status} onChange={(v) => set({ status: v })} options={STATUSES} />
                  {!sharedOnly && <Pick
                    label="Department"
                    value={f.departmentId}
                    onChange={(v) => set({ departmentId: v })}
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  />}
                </AccSection>
                <AccSection title="Address & contact">
                  <Text label="Street address" value={f.address} onChange={(v) => set({ address: v })} />
                  <Text label="City" value={i("city")} onChange={(v) => setI("city", v)} />
                  <Pick label="Province" value={i("province")} onChange={(v) => setI("province", v)} options={PROVINCES} />
                  <Text label="Postal code" value={i("postal_code")} onChange={(v) => setI("postal_code", v)} />
                  <Text label="Primary phone" value={f.phone} onChange={(v) => set({ phone: v })} />
                  <Text label="Alternate phone" value={i("alt_phone")} onChange={(v) => setI("alt_phone", v)} />
                  <Text label="Email" value={f.email} onChange={(v) => set({ email: v })} />
                  <Pick label="Preferred contact method" value={f.contactMethod} onChange={(v) => set({ contactMethod: v })} options={CONTACT} />
                </AccSection>
                <AccSection title="Language">
                  <Pick label="Preferred language" value={f.preferredLanguage} onChange={(v) => set({ preferredLanguage: v })} options={LANGUAGES} />
                  <Text label="Other languages spoken" value={i("other_languages")} onChange={(v) => setI("other_languages", v)} />
                  <Pick label="Interpreter needed" value={f.interpreter} onChange={(v) => set({ interpreter: v })} options={INTERPRETER} />
                  <Pick label="English level (CLB)" value={i("clb_level")} onChange={(v) => setI("clb_level", v)} options={CLB} />
                </AccSection>
                <AccSection title="Immigration, education & employment">
                  <Pick label="Immigration category" value={f.immigrationStatus} onChange={(v) => set({ immigrationStatus: v })} options={IMMIGRATION} />
                  <Text label="Landing / arrival date" type="date" value={f.arrivalDate} onChange={(v) => set({ arrivalDate: v })} />
                  <Text label="Intended city of residence" value={i("intended_destination")} onChange={(v) => setI("intended_destination", v)} />
                  <Pick label="Highest education" value={i("education")} onChange={(v) => setI("education", v)} options={EDUCATION} />
                  <Pick label="Employment status" value={i("employment_status")} onChange={(v) => setI("employment_status", v)} options={EMPLOYMENT} />
                  <Text label="Occupation (in home country)" value={i("occupation")} onChange={(v) => setI("occupation", v)} />
                </AccSection>
                <AccSection title="Emergency contact">
                  <Text label="Name" value={f.ecName} onChange={(v) => set({ ecName: v })} />
                  <Pick label="Relationship" value={f.ecRelationship} onChange={(v) => set({ ecRelationship: v })} options={EC_REL} />
                  <Text label="Phone" value={f.ecPhone} onChange={(v) => set({ ecPhone: v })} />
                </AccSection>
                </IntakeAccordion>
                {saveBar}
              </TabsContent>
            )}

            <TabsContent value="family" className="space-y-4">
              <FamilyTab
                sharedOnly={sharedOnly}
                clientId={clientId}
                client={client}
                extras={extras}
                restricted={restricted}
                f={f}
                set={set}
                onChanged={refresh}
              />
              {!restricted && saveBar}
            </TabsContent>

            {!restricted && !sharedOnly && (
              <TabsContent value="intake" className="space-y-4">
                <IntakeAccordion defaultOpen="Intake">
                  <AccSection title="Intake">
                    <Text label="Intake date" type="date" value={f.intakeDate} onChange={(v) => set({ intakeDate: v })} />
                    <Pick label="Referral source" value={i("referral_source")} onChange={(v) => setI("referral_source", v)} options={REF_SOURCES} />
                    <Text label="Intake completed by" value={i("intake_worker")} onChange={(v) => setI("intake_worker", v)} />
                    <Pick label="Confidentiality level" value={f.confidentialityLevel} onChange={(v) => set({ confidentialityLevel: v })} options={CONF} />
                    <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                      <Checkbox checked={f.consentToShare} onCheckedChange={(v) => set({ consentToShare: v === true })} />
                      Client signed consent to collect and share information
                    </label>
                  </AccSection>
                  {!f.departmentId && (
                    <p className="rounded-lg border border-border bg-secondary/60 p-4 text-sm text-foreground">
                      Set this client's department in the Client setup tab to load the matching intake form (Settlement or Counselling).
                    </p>
                  )}
                  {f.departmentId && isCounsellingDept && <CounsellingIntake intake={intake} setI={setI} />}
                  {f.departmentId && !isCounsellingDept && (
                    <>
                      <SettlementIntake intake={intake} setI={setI} family={extras?.children ?? []} />
                      <AccSection title="Needs assessment">
                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                          {NEED_AREAS.map((area) => {
                            const n = needs[area] ?? { level: "", note: "" };
                            return (
                              <div key={area} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[180px_150px_1fr] sm:items-center">
                                <span className="text-sm text-foreground">{area}</span>
                                <Select value={n.level} onValueChange={(v) => setNeeds((p) => ({ ...p, [area]: { ...n, level: v } }))}>
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Level" /></SelectTrigger>
                                  <SelectContent>{NEED_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input className="h-9" placeholder="Details (optional)" value={n.note} onChange={(e) => setNeeds((p) => ({ ...p, [area]: { ...n, note: e.target.value } }))} />
                              </div>
                            );
                          })}
                        </div>
                      </AccSection>
                    </>
                  )}
                  <AccSection title="Goals & support needs">
                    <Area label="Client goals" value={i("goals")} onChange={(v) => setI("goals", v)} />
                    <Area label="Accessibility or accommodation needs" value={f.accessibilityNeeds} onChange={(v) => set({ accessibilityNeeds: v })} />
                    <Area label="Intake notes" value={i("intake_notes")} onChange={(v) => setI("intake_notes", v)} />
                  </AccSection>
                </IntakeAccordion>
                {saveBar}
              </TabsContent>
            )}

            {!restricted && (
              <TabsContent value="enrollment" className="space-y-4">
                <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-6">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Program enrollments</h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEnrollments((p) => [...p, { program: "", stream: "", start: new Date().toISOString().slice(0, 10), end: "", status: "Active", note: "" }])}
                    >
                      Add enrollment
                    </Button>
                  </div>
                  {enrollments.length === 0 && <p className="text-sm text-muted-foreground">No program enrollments yet.</p>}
                  <div className="space-y-3">
                    {enrollments.map((e, idx) => {
                      const upd = (patch: Partial<Enrollment>) => setEnrollments((p) => p.map((x, j) => (j === idx ? { ...x, ...patch } : x)));
                      return (
                        <div key={idx} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
                          <Text label="Program" value={e.program} onChange={(v) => upd({ program: v })} />
                          <Pick label="Stream / department" value={e.stream} onChange={(v) => upd({ stream: v })} options={departments.map((d) => d.name)} />
                          <Pick label="Status" value={e.status} onChange={(v) => upd({ status: v })} options={ENROLL_STATUS} />
                          <Text label="Start date" type="date" value={e.start} onChange={(v) => upd({ start: v })} />
                          <Text label="End / exit date" type="date" value={e.end} onChange={(v) => upd({ end: v })} />
                          <Text label="Note" value={e.note} onChange={(v) => upd({ note: v })} />
                          <div className="sm:col-span-3">
                            <Button size="sm" variant="ghost" onClick={() => setEnrollments((p) => p.filter((_, j) => j !== idx))}>Remove</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <Section title="Enrollment summary">
                  <Text label="First enrollment date" type="date" value={f.enrollmentDate} onChange={(v) => set({ enrollmentDate: v })} />
                </Section>
                {saveBar}
              </TabsContent>
            )}

            {!restricted && extras && (
              <TabsContent value="referrals">
                <Referrals clientId={clientId} rows={extras.referrals} onSaved={refresh} />
              </TabsContent>
            )}
            {!restricted && extras && (
              <TabsContent value="documents">
                <Documents clientId={clientId} rows={extras.documents} onSaved={refresh} />
              </TabsContent>
            )}
            {!restricted && (
              <TabsContent value="appointments">
                <AppointmentsPanel clientId={clientId} />
              </TabsContent>
            )}
            {!restricted && (
              <TabsContent value="notes">
                <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-panel)] lg:p-6">
                  {notes.length === 0 && <p className="text-muted-foreground">No case notes yet.</p>}
                  <ul className="space-y-2">
                    {notes.map((n) => (
                      <li key={n.id}>
                        <Link to="/notes/$noteId" params={{ noteId: n.id }} className="block rounded-md border border-border px-3 py-3 hover:bg-secondary/60">
                          <span className="text-foreground">{n.interaction_type}</span>
                          <span className="block text-xs text-muted-foreground">{n.interaction_date} · {n.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Button asChild><Link to="/notes/new">New case note</Link></Button>
                </section>
              </TabsContent>
            )}
            {!restricted && (
              <TabsContent value="groups">
                <ClientGroups clientId={clientId} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}

type Form = { parentClientId: string; familyRelationship: string; householdSize: string; householdChildren: string; householdNotes: string; address: string; preferredLanguage: string; departmentId: string };

function FamilyTab({
  clientId, client, extras, restricted, sharedOnly, f, set, onChanged,
}: {
  clientId: string;
  client: { client_identifier: string; last_name: string };
  extras: Awaited<ReturnType<typeof getClientRecordExtras>> | undefined;
  restricted: boolean;
  sharedOnly: boolean;
  f: Form;
  set: (p: Partial<Form>) => void;
  onChanged: () => void;
}) {
  const create = useServerFn(createClient);
  const update = useServerFn(updateClient);
  const enroll = useServerFn(updateEnrollment);
  const qc = useQueryClient();
  const kids = extras?.children ?? [];
  const parent = extras?.parent ?? null;
  const [existingMember, setExistingMember] = useState<string | null>(null);
  const blank = { firstName: "", lastName: client.last_name, relationship: "Child", dob: "" };
  const [m, setM] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addMember() {
    if (!m.firstName.trim() || !m.lastName.trim()) { toast.error("Enter the family member's name."); return; }
    setBusy(true);
    try {
      const identifier = `${client.client_identifier}-${kids.length + 2}`;
      const row = await create({
        data: { clientIdentifier: identifier, firstName: m.firstName.trim(), lastName: m.lastName.trim(), dateOfBirth: m.dob || null, intake: {} },
      });
      if (row.duplicate) {
        setExistingMember(row.id);
        return;
      }
      await update({
        data: {
          id: row.id, firstName: m.firstName.trim(), lastName: m.lastName.trim(), clientIdentifier: identifier,
          status: "active", dateOfBirth: m.dob || null, preferredLanguage: f.preferredLanguage, address: f.address || null,
        },
      });
      await enroll({
        data: {
          clientId: row.id, intakeDate: null, enrollmentDate: null, enrolledProgram: null, consentToShare: false,
          confidentialityLevel: "standard", parentClientId: clientId, familyRelationship: m.relationship,
        },
      });
      toast.success("Family member added and linked to this file.");
      setM(blank);
      setAdding(false);
      onChanged();
      void qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add family member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IntakeAccordion defaultOpen="Family members">
      {existingMember && <div role="alert" className="border border-border bg-muted p-3 text-sm">Client already exists. <Link to="/clients/$clientId" params={{ clientId: existingMember }} className="text-primary underline">Open existing client</Link></div>}
      <AccSection title="Family members">
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="mb-3 flex items-center justify-end gap-2">
            {!restricted && !parent && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Add family member</Button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Relationship</th><th className="py-2 pr-3">File #</th>
                </tr>
              </thead>
              <tbody>
                {parent && (
                  <tr className="border-b border-border">
                    <td className="py-2 pr-3"><Link to="/clients/$clientId" params={{ clientId: parent.id }} className="text-primary underline">{parent.first_name} {parent.last_name}</Link></td>
                    <td className="py-2 pr-3">Head of family</td><td className="py-2 pr-3">{parent.client_identifier}</td>
                  </tr>
                )}
                {kids.map((k) => (
                  <tr key={k.id} className="border-b border-border">
                    <td className="py-2 pr-3"><Link to="/clients/$clientId" params={{ clientId: k.id }} className="text-primary underline">{k.first_name} {k.last_name}</Link></td>
                    <td className="py-2 pr-3">{k.family_relationship ?? "Linked"}</td><td className="py-2 pr-3">{k.client_identifier}</td>
                  </tr>
                ))}
                {!parent && kids.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-muted-foreground">No family members linked yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {parent && <p className="mt-2 text-xs text-muted-foreground">Add family members from the head-of-family file.</p>}
          {adding && (
            <div className="mt-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <Text label="First name" value={m.firstName} onChange={(v) => setM({ ...m, firstName: v })} />
              <Text label="Last name" value={m.lastName} onChange={(v) => setM({ ...m, lastName: v })} />
              <Pick label="Relationship to this client" value={m.relationship} onChange={(v) => setM({ ...m, relationship: v })} options={RELATIONSHIPS} />
              <Text label="Date of birth" type="date" value={m.dob} onChange={(v) => setM({ ...m, dob: v })} />
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={addMember} disabled={busy}>{busy ? "Adding…" : "Create linked file"}</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </AccSection>
      {!restricted && (
        <AccSection title="Household">
          <Pick label="Household size" value={f.householdSize} onChange={(v) => set({ householdSize: v })} options={["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"]} />
          <Text label="Children under 18" value={f.householdChildren} onChange={(v) => set({ householdChildren: v })} />
          {!sharedOnly && <Area label="Household notes" value={f.householdNotes} onChange={(v) => set({ householdNotes: v })} />}
          <ParentPicker clientId={clientId} value={f.parentClientId} onChange={(v) => set({ parentClientId: v })} />
          <Pick
            label="Relationship to head of family"
            value={f.familyRelationship}
            onChange={(v) => set({ familyRelationship: v })}
            options={RELATIONSHIPS}
          />
        </AccSection>
      )}
    </IntakeAccordion>
  );
}

function ParentPicker({ clientId, value, onChange }: { clientId: string; value: string; onChange: (v: string) => void }) {
  const search = useServerFn(searchClients);
  const { data: rows = [] } = useQuery({ queryKey: ["clients", "all"], queryFn: () => search({ data: { limit: 100 } }) });
  const opts = rows.filter((r) => r.id !== clientId).map((r) => ({ value: r.id, label: `${r.first_name} ${r.last_name} · ${r.client_identifier}` }));
  return <Pick label="Head of family file" value={value} onChange={onChange} options={[{ value: NONE, label: "None — this is a main file" }, ...opts]} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground lg:mb-4">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">{children}</div>
    </section>
  );
}

function Text({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[44px]" />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
      <Label className="text-sm">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function Pick({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  const list = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  if (value && !list.some((o) => o.value === value)) list.unshift({ value, label: value });
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>
          {list.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClientGroups({ clientId }: { clientId: string }) {
  const list = useServerFn(listClientGroupSessions);
  const { data } = useQuery({ queryKey: ["client-groups", clientId], queryFn: () => list({ data: { clientId } }) });
  const rows = [...(data ?? [])].sort((a, b) => (b.group_sessions?.session_date ?? "").localeCompare(a.group_sessions?.session_date ?? ""));
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-panel)] lg:p-6">
      {rows.length === 0 && <p className="text-muted-foreground">Not registered in any group session.</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-3 py-3">
            <span>
              <span className="text-foreground">{r.group_sessions?.title}</span>
              <span className="block text-xs text-muted-foreground">{r.group_sessions?.session_date} · {r.group_sessions?.session_type}</span>
            </span>
            <Badge variant="secondary" className="capitalize">{r.attendance}</Badge>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline"><Link to="/groups">Open group sessions</Link></Button>
    </section>
  );
}
