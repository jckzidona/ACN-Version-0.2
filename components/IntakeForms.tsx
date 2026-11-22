import { createContext, useContext, useMemo, useState } from "react";
import { BadgeCheck, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";

type Rec = Record<string, unknown>;
type IntakeProps = { intake: Rec; setI: (k: string, v: string) => void };
export type FamilyMember = {
  id: string;
  first_name: string;
  last_name: string;
  family_relationship: string | null;
  date_of_birth: string | null;
};

const s = (o: Rec, k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
const YND = ["Yes", "No", "Don't know"];
const YNM = ["Yes", "No", "Maybe"];

const AccordionCtx = createContext<{ open: string | null; toggle: (title: string) => void } | null>(null);

function IntakeAccordionOwn({ defaultOpen, children }: { defaultOpen: string; children: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(defaultOpen);
  const value = useMemo(
    () => ({ open, toggle: (title: string) => setOpen((cur) => (cur === title ? null : title)) }),
    [open]
  );
  return <AccordionCtx.Provider value={value}>{children}</AccordionCtx.Provider>;
}

/** Single-open accordion group. If a group already exists above it, sections join that group. */
export function IntakeAccordion({ defaultOpen, children }: { defaultOpen: string; children: React.ReactNode }) {
  const ctx = useContext(AccordionCtx);
  return ctx ? <>{children}</> : <IntakeAccordionOwn defaultOpen={defaultOpen}>{children}</IntakeAccordionOwn>;
}

export function AccSection({ title, children }: { title: string; children: React.ReactNode }) {
  const ctx = useContext(AccordionCtx) ?? { open: null, toggle: () => {} };
  const { open, toggle } = ctx;
  const isOpen = open === title;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] lg:p-6">
      <button
        type="button"
        onClick={() => toggle(title)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform${isOpen ? " rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:mt-4 lg:gap-4">{children}</div>}
    </section>
  );
}

function T({ label, value, onChange, type, span }: { label: string; value: string; onChange: (v: string) => void; type?: string; span?: boolean }) {
  return (
    <div className={`space-y-1.5${span ? " sm:col-span-2" : ""}`}>
      <Label className="text-sm">{label}</Label>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[44px]" />
    </div>
  );
}

function A({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
      <Label className="text-sm">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function P({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>
          {list.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Scale({ label, value, onChange, low, high }: { label: string; value: string; onChange: (v: string) => void; low: string; high: string }) {
  return (
    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">{low}</span>
        {Array.from({ length: 10 }, (_, n) => String(n + 1)).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm ${
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-secondary/60"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{high}</span>
      </div>
    </div>
  );
}

function Checks({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const chosen = value ? value.split(" · ") : [];
  const toggle = (o: string) => {
    const next = chosen.includes(o) ? chosen.filter((x) => x !== o) : [...chosen, o];
    onChange(next.join(" · "));
  };
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
      <Label className="text-sm">{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={chosen.includes(o)} onCheckedChange={() => toggle(o)} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Settlement intake (NISW / NARS) ---------------- */

const SETTLEMENT_PROGRAMS = [
  "Counselling Program (individual counselling)",
  "Building Futures (language & employment)",
  "GOAL — Adult Literacy",
  "Employment program (16–30 years)",
  "Reachout — Afterschool (12–21) & Summer Literacy Camps",
  "Tot Spot (school-aged afterschool)",
  "Indigenous Traditional Culture program",
  "Men's & Women's Groups",
  "Wellness Workshops",
];
const SUPPORTS = ["Childcare", "Transportation", "Language interpretation", "Translation", "Provision for disabilities", "Counselling"];
const SUBSIDIES = ["Basic: food / furniture / shelter", "Government subsidies / benefits", "Housing", "School loans", "Recreation", "EI", "Children's future education", "Other"];

export function SettlementIntake({ intake, setI, family = [] }: IntakeProps & { family?: FamilyMember[] }) {
  const g = (k: string) => s(intake, `s_${k}`);
  const set = (k: string) => (v: string) => setI(`s_${k}`, v);
  const extraRows = Array.from({ length: 3 }, (_, index) => index + 1);
  const serviceRows = Array.from({ length: 5 }, (_, index) => index + 1);
  const { data: session } = useSession();
  const signature = g("staff_signature");
  const signerLabel = session?.jobTitle?.trim()
    ? session.jobTitle.trim()
    : session?.roles?.includes("org_admin")
      ? "Organization admin"
      : session?.roles?.includes("manager")
        ? "Manager"
        : "Worker";
  const signerName = session?.fullName?.trim() || session?.email || "";
  const signIntake = () => {
    const stamp = `Confirmed electronically by ${signerName} (${signerLabel}) — ${new Date().toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`;
    setI("s_staff_signature", stamp);
    if (!g("staff_name")) setI("s_staff_name", signerName);
  };
  return (
    <IntakeAccordion defaultOpen="Service details">
      <AccSection title="Service details">
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
          Personal information (name, date of birth, address, phone, email, language, immigration and emergency contact) is recorded once under
          the <strong>Client setup</strong> tab — it is not repeated here.
        </p>
        <T label="Intake date" type="date" value={g("date")} onChange={set("date")} />
        <P label="File status" value={g("file_status")} onChange={set("file_status")} options={["New", "Returning"]} />
        <T label="Client file number" value={g("client_file_number")} onChange={set("client_file_number")} />
        <P label="Location of services" value={g("service_location")} onChange={set("service_location")} options={["Office visit", "Home visit", "School visit", "Phone", "Email"]} />
        <P label="Preferred communication" value={g("preferred_communication")} onChange={set("preferred_communication")} options={["Phone call", "Email", "Other"]} />
        <T label="Other preferred communication" value={g("preferred_communication_other")} onChange={set("preferred_communication_other")} />
        <P label="Preferred language of service" value={g("service_language")} onChange={set("service_language")} options={["French", "English", "Other"]} />
        <T label="Other preferred language" value={g("service_language_other")} onChange={set("service_language_other")} />
        <P label="Immigration category" value={g("immigration_category")} onChange={set("immigration_category")} options={["MPNP", "Skilled Worker", "Family", "GAR", "PSR", "Other"]} />
        <T label="Other immigration category" value={g("immigration_category_other")} onChange={set("immigration_category_other")} />
        <P label="Marital status" value={g("marital_status")} onChange={set("marital_status")} options={["Married", "Single", "Divorced", "Widowed", "Common law partner"]} />
        <T label="MB Health Card number" value={g("mb_health_card")} onChange={set("mb_health_card")} />
        <T label="Family size" value={g("family_size")} onChange={set("family_size")} />
        <T label="Manitoba Health Card family number" value={g("mb_health_family_number")} onChange={set("mb_health_family_number")} />
      </AccSection>

      <AccSection title="Family information — parents or caregivers first, then children">
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
          Family members recorded under the <strong>Family</strong> tab appear here automatically. Add or remove members in the Family tab;
          only their PR card and health card numbers are completed here.
        </p>
        {family.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            No family members are linked to this client yet — add them under the Family tab.
          </p>
        )}
        {family.map((member) => (
          <div key={member.id} className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Name</Label>
              <p className="min-h-[44px] rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {member.first_name} {member.last_name}
                {member.family_relationship ? <span className="text-muted-foreground"> ({member.family_relationship})</span> : null}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Date of birth</Label>
              <p className="min-h-[44px] rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {member.date_of_birth || "Not recorded"}
              </p>
            </div>
            <T label="PR card number" value={g(`fam_${member.id}_pr`)} onChange={set(`fam_${member.id}_pr`)} />
            <T label="Personal health card number" value={g(`fam_${member.id}_health`)} onChange={set(`fam_${member.id}_health`)} />
          </div>
        ))}
        <p className="text-sm font-medium text-foreground sm:col-span-2 lg:col-span-3">Other family members not in the client file</p>
        {extraRows.map((row) => (
          <div key={row} className="grid gap-3 border-b border-border pb-4 last:border-b-0 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-5">
            <T label={`Family member ${row} — full name`} value={g(`family_${row}_name`)} onChange={set(`family_${row}_name`)} />
            <T label="PR card number" value={g(`family_${row}_pr`)} onChange={set(`family_${row}_pr`)} />
            <T label="Date of birth" type="date" value={g(`family_${row}_dob`)} onChange={set(`family_${row}_dob`)} />
            <T label="Personal health card number" value={g(`family_${row}_health`)} onChange={set(`family_${row}_health`)} />
            <P label="Gender" value={g(`family_${row}_gender`)} onChange={set(`family_${row}_gender`)} options={["Male", "Female"]} />
          </div>
        ))}
      </AccSection>

      <AccSection title="Referral and family needs">
        <A label="Have you accessed other services since coming to Canada?" value={g("other_services")} onChange={set("other_services")} />
        <T label="Where did you hear about us? Who referred you?" value={g("referred_from")} onChange={set("referred_from")} span />
        <A label="What are the general needs for your family now?" value={g("family_needs")} onChange={set("family_needs")} />
      </AccSection>

      <AccSection title="2. Housing">
        <A label="Are you safe and happy where you live?" value={g("housing_safe_happy")} onChange={set("housing_safe_happy")} />
        <A label="Do you need any supports or help with housing?" value={g("housing_support_needed")} onChange={set("housing_support_needed")} />
        <A label="What are your housing ideas and goals?" value={g("housing_goals")} onChange={set("housing_goals")} />
        <A label="Plans and referrals" value={g("housing_plans")} onChange={set("housing_plans")} />
      </AccSection>

      <AccSection title="3. Language">
        <T label="English level — CLB Listening" value={g("clb_listening")} onChange={set("clb_listening")} />
        <T label="English level — CLB Speaking" value={g("clb_speaking")} onChange={set("clb_speaking")} />
        <T label="English level — CLB Writing" value={g("clb_writing")} onChange={set("clb_writing")} />
        <A label="What are your language-learning ideas and goals?" value={g("language_goals")} onChange={set("language_goals")} />
        <A label="Plans and referrals" value={g("language_plans")} onChange={set("language_plans")} />
      </AccSection>

      <AccSection title="4. Education and qualification recognition">
        <A label="What education do you have?" value={g("education_current")} onChange={set("education_current")} />
        <P label="Do you plan to have your qualifications recognized in Canada?" value={g("qual_recognition")} onChange={set("qual_recognition")} options={YNM} />
        <A label="What are your education ideas and goals?" value={g("education_goals")} onChange={set("education_goals")} />
        <A label="Plans and referrals" value={g("education_plans")} onChange={set("education_plans")} />
      </AccSection>

      <AccSection title="5. Other skills">
        <A label="What other skills are needed and why? For example: driver's licence, certificates, WHMIS or Food Handler Certification." value={g("skills_needed")} onChange={set("skills_needed")} />
        <A label="Plans and referrals" value={g("skills_plans")} onChange={set("skills_plans")} />
      </AccSection>

      <AccSection title="6. Employment and job search">
        <A label="What is your current employment situation?" value={g("employment_current")} onChange={set("employment_current")} />
        <A label="What are your employment ideas and timeline?" value={g("employment_goals")} onChange={set("employment_goals")} />
        <A label="What is your work experience inside or outside Canada?" value={g("work_experience")} onChange={set("work_experience")} />
        <A label="Are you attending, or have you attended, any employment services?" value={g("employment_services")} onChange={set("employment_services")} />
        <P label="Do you have a résumé?" value={g("resume")} onChange={set("resume")} options={["Yes", "No"]} />
        <P label="Which NOC level are you planning for?" value={g("noc_level")} onChange={set("noc_level")} options={["Labour", "Intermediate", "Skilled", "Professional", "Management"]} />
        <A label="Plans and referrals" value={g("employment_plans")} onChange={set("employment_plans")} />
      </AccSection>

      <AccSection title="7. Health and mental health">
        <P label="Do you have a family doctor?" value={g("family_doctor")} onChange={set("family_doctor")} options={YNM} />
        <A label="Do you have any urgent medical needs or concerns?" value={g("medical_needs")} onChange={set("medical_needs")} />
        <A label="How are you adjusting to life in Canada?" value={g("adjustment")} onChange={set("adjustment")} />
        <P label="Do you know about culture shock or adjustment?" value={g("culture_shock_awareness")} onChange={set("culture_shock_awareness")} options={YND} />
        <A label="Plans and referrals" value={g("health_plans")} onChange={set("health_plans")} />
      </AccSection>

      <AccSection title="Recreation and community connections">
        <A label="What kinds of supports do you have in Winnipeg?" value={g("winnipeg_supports")} onChange={set("winnipeg_supports")} />
        <P label="Have you connected with your cultural community in Winnipeg?" value={g("cultural_connection")} onChange={set("cultural_connection")} options={YND} />
        <A label="Are your children in school? How is it going? Are there any concerns?" value={g("children_school")} onChange={set("children_school")} />
        <P label="Do you know about Winnipeg's free public libraries, parks and 311 service?" value={g("city_services_awareness")} onChange={set("city_services_awareness")} options={YND} />
        <A label="Plans and referrals" value={g("community_plans")} onChange={set("community_plans")} />
      </AccSection>

      <AccSection title="8. Legal">
        <A label="Do you have any legal concerns?" value={g("legal_concerns")} onChange={set("legal_concerns")} />
        <A label="Do you understand your rights and responsibilities as a tenant, parent (CFS), spouse or partner in Canada?" value={g("rights_responsibilities")} onChange={set("rights_responsibilities")} />
        <A label="Do you know about workplace safety, WCB and Manitoba Labour Standards?" value={g("workplace_rights")} onChange={set("workplace_rights")} />
        <A label="Plans and referrals" value={g("legal_plans")} onChange={set("legal_plans")} />
      </AccSection>

      <AccSection title="9. Financial">
        <A label="Do you have any financial concerns?" value={g("financial_concerns")} onChange={set("financial_concerns")} />
        <P label="Have you done your taxes? Do you need help?" value={g("taxes")} onChange={set("taxes")} options={["Yes — completed", "No", "Needs help"]} />
        <Checks label="Potential financial help or subsidies" value={g("subsidies")} onChange={set("subsidies")} options={SUBSIDIES} />
        <A label="10. Plans and referrals" value={g("financial_plans")} onChange={set("financial_plans")} />
      </AccSection>

      <AccSection title="11. Responsibilities of citizenship">
        <P label="Do you plan to become a Canadian citizen?" value={g("citizenship_plan")} onChange={set("citizenship_plan")} options={YNM} />
        <A label="Do you understand the process and responsibilities of becoming a Canadian citizen?" value={g("citizenship_process")} onChange={set("citizenship_process")} />
        <A label="Plans and referrals" value={g("citizenship_plans")} onChange={set("citizenship_plans")} />
        <A label="Do you have any other questions or concerns about life in Canada?" value={g("other_questions")} onChange={set("other_questions")} />
      </AccSection>

      <AccSection title="12. Supports to access IRCC-funded services">
        <Checks label="Will the client or family likely require any of these supports?" value={g("supports_required")} onChange={set("supports_required")} options={SUPPORTS} />
        <A label="Did they receive any of these supports today?" value={g("supports_received")} onChange={set("supports_received")} />
      </AccSection>

      <AccSection title="13. Programs">
        <Checks label="After discussing all programs, which additional programs would the client like to access?" value={g("programs")} onChange={set("programs")} options={SETTLEMENT_PROGRAMS} />
      </AccSection>

      <AccSection title="Office use only">
        <Checks label="Forms and information provided" value={g("office_forms")} onChange={set("office_forms")} options={["Client Rights & Expectations", "Confidentiality Agreement Form", "Permission to Release Information", "Photo & Media Consent Form"]} />
        <T label="Staff full name" value={g("staff_name")} onChange={set("staff_name")} />
        {signature ? (
          <div className="sm:col-span-2 lg:col-span-3 flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Signed</p>
                <p className="text-sm text-muted-foreground">{signature}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setI("s_staff_signature", "")}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
            <Button type="button" variant="outline" onClick={signIntake}>
              Confirm &amp; sign
            </Button>
            <p className="text-xs text-muted-foreground">
              Stamps your name, role and the current date and time as the confirmation.{" "}
              {signerName ? <span className="text-foreground">Signing as {signerName} ({signerLabel}).</span> : null}
            </p>
          </div>
        )}
      </AccSection>

      <AccSection title="Settlement plan">
        <A label="Settlement plan (summary shared with the client)" value={g("settlement_plan")} onChange={set("settlement_plan")} />
        {serviceRows.map((row) => (
          <div key={row} className="grid gap-3 border-b border-border pb-4 last:border-b-0 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
            <A label={`Service requested ${row}`} value={g(`service_${row}_requested`)} onChange={set(`service_${row}_requested`)} />
            <A label={`Actions ${row}`} value={g(`service_${row}_actions`)} onChange={set(`service_${row}_actions`)} />
          </div>
        ))}
        <T label="Settlement worker name" value={g("settlement_worker_name")} onChange={set("settlement_worker_name")} />
        <T label="Settlement worker contact" value={g("settlement_worker_contact")} onChange={set("settlement_worker_contact")} />
      </AccSection>
    </IntakeAccordion>
  );
}

/* ---------------- Counselling intake ---------------- */

const ETHNICITY = [
  "Black (African, Afro-Caribbean, African-Canadian…)",
  "East Asian (Chinese, Korean, Japanese, Taiwanese…)",
  "Latin American / Hispanic",
  "Indigenous (Métis, Status, Non-Status)",
  "Middle Eastern (Arab, Persian, West Asian…)",
  "South Asian (East Indian, Pakistani, Sri Lankan…)",
  "Southeast Asian (Filipino, Vietnamese, Cambodian, Thai…)",
  "White (European descent)",
  "Mixed",
  "Other",
];
const REL_STATUS = ["Single", "In a relationship", "Common law", "Married", "Divorced", "Widowed", "Separated", "Other"];
const INCOME = ["EIA", "Disability", "Work", "Don't know", "Other"];

export function CounsellingIntake({ intake, setI }: IntakeProps) {
  const g = (k: string) => s(intake, `c_${k}`);
  const set = (k: string) => (v: string) => setI(`c_${k}`, v);
  return (
    <IntakeAccordion defaultOpen="Counselling intake">
      <AccSection title="Counselling intake">
        <T label="Assigned counsellor" value={g("counsellor")} onChange={set("counsellor")} />
        <T label="Pronouns" value={g("pronouns")} onChange={set("pronouns")} />
        <P label="OK to leave a message?" value={g("leave_message")} onChange={set("leave_message")} options={["Yes", "No"]} />
        <Scale label="How ready do you feel for counselling?" value={g("readiness")} onChange={set("readiness")} low="Not ready at all" high="Very ready" />
        <P label="Used our programs before?" value={g("used_programs")} onChange={set("used_programs")} options={["Yes", "No"]} />
        <T label="If yes, which programs" value={g("which_programs")} onChange={set("which_programs")} span />
      </AccSection>

      <AccSection title="Identity">
        <P label="Identifies as 2SLGBTQQIA+?" value={g("lgbtq")} onChange={set("lgbtq")} options={YND} />
        <P label="Ethnicity" value={g("ethnicity")} onChange={set("ethnicity")} options={ETHNICITY} />
        <P label="Newcomer to Canada?" value={g("newcomer")} onChange={set("newcomer")} options={YND} />
        <T label="PR / refugee number" value={g("pr_number")} onChange={set("pr_number")} />
        <T label="Country migrated from" value={g("migrated_from")} onChange={set("migrated_from")} />
        <T label="Year of migration" value={g("migration_year")} onChange={set("migration_year")} />
        <P label="Identifies as Indigenous?" value={g("indigenous")} onChange={set("indigenous")} options={YND} />
        <T label="If yes, which nation" value={g("nation")} onChange={set("nation")} />
        <P label="Identifies with a religious group?" value={g("religious")} onChange={set("religious")} options={YND} />
        <P label="Practices traditional healing methods?" value={g("traditional_healing")} onChange={set("traditional_healing")} options={YND} />
        <T label="Interest in traditional healing / connecting with an elder" value={g("elder_interest")} onChange={set("elder_interest")} span />
      </AccSection>

      <AccSection title="Marital & family">
        <P label="Current relationship status" value={g("relationship_status")} onChange={set("relationship_status")} options={REL_STATUS} />
        <T label="How long in that status" value={g("status_length")} onChange={set("status_length")} />
        <T label="Name of partner" value={g("partner_name")} onChange={set("partner_name")} />
        <T label="Children — how many" value={g("children_count")} onChange={set("children_count")} />
        <A label="Children's names and dates of birth" value={g("children_details")} onChange={set("children_details")} />
        <P label="Bringing kids to the program while attending?" value={g("bringing_kids")} onChange={set("bringing_kids")} options={["Yes", "No"]} />
        <A label="Current relationship with the children" value={g("children_relationship")} onChange={set("children_relationship")} />
        <P label="Involved with Child and Family Services (CFS)?" value={g("cfs_involved")} onChange={set("cfs_involved")} options={YND} />
        <P label="Any children in CFS care right now?" value={g("cfs_care")} onChange={set("cfs_care")} options={YND} />
        <P label="Would like support with CFS?" value={g("cfs_support")} onChange={set("cfs_support")} options={YND} />
        <T label="CFS worker's name" value={g("cfs_worker")} onChange={set("cfs_worker")} />
        <T label="CFS worker phone" value={g("cfs_phone")} onChange={set("cfs_phone")} />
        <T label="CFS agency" value={g("cfs_agency")} onChange={set("cfs_agency")} />
        <A label="CFS notes" value={g("cfs_notes")} onChange={set("cfs_notes")} />
      </AccSection>

      <AccSection title="Housing">
        <P label="Feels safe where living?" value={g("housing_safe")} onChange={set("housing_safe")} options={YND} />
        <T label="If no, why" value={g("housing_unsafe_why")} onChange={set("housing_unsafe_why")} span />
        <P label="Would like support finding housing?" value={g("housing_support")} onChange={set("housing_support")} options={YNM} />
        <A label="Who is currently living in the home" value={g("household_members")} onChange={set("household_members")} />
      </AccSection>

      <AccSection title="Education & employment">
        <T label="Highest level of education" value={g("education")} onChange={set("education")} />
        <P label="Currently in school?" value={g("in_school")} onChange={set("in_school")} options={YND} />
        <T label="Current school / grade / training program" value={g("school_detail")} onChange={set("school_detail")} />
        <P label="Would like support returning to school?" value={g("school_support")} onChange={set("school_support")} options={YNM} />
        <P label="Employed?" value={g("employed")} onChange={set("employed")} options={YNM} />
        <P label="Full time or part time" value={g("employment_type")} onChange={set("employment_type")} options={["Full time", "Part time"]} />
        <T label="How long at this job (months/years)" value={g("job_length")} onChange={set("job_length")} />
        <P label="Would like support to find work?" value={g("work_support")} onChange={set("work_support")} options={YNM} />
        <P label="Main source of income" value={g("income_source")} onChange={set("income_source")} options={INCOME} />
      </AccSection>

      <AccSection title="Presenting issues / concerns">
        <A label="Reason for seeking counselling" value={g("reason")} onChange={set("reason")} />
        <A label="How are you coping right now?" value={g("coping")} onChange={set("coping")} />
        <A label="Current support system" value={g("support_system")} onChange={set("support_system")} />
      </AccSection>

      <AccSection title="Health">
        <P label="Has a family doctor?" value={g("family_doctor")} onChange={set("family_doctor")} options={YNM} />
        <P label="Would like help finding a doctor?" value={g("doctor_help")} onChange={set("doctor_help")} options={YNM} />
        <T label="Physician name (optional)" value={g("physician")} onChange={set("physician")} />
        <P label="Taking any prescribed / non-prescribed medication?" value={g("medication")} onChange={set("medication")} options={["Yes", "No"]} />
        <A label="Medication — name, dosage, how often" value={g("medication_detail")} onChange={set("medication_detail")} />
        <P label="Diagnosed with a mental illness?" value={g("diagnosis")} onChange={set("diagnosis")} options={["Yes", "No"]} />
        <T label="Who was this diagnosis from?" value={g("diagnosis_from")} onChange={set("diagnosis_from")} />
        <T label="Sleep pattern" value={g("sleep")} onChange={set("sleep")} />
      </AccSection>

      <AccSection title="Abuse history">
        <A label="Experienced any forms of violence, past or present? (physical, emotional, financial, psychological, domestic…)" value={g("violence")} onChange={set("violence")} />
        <P label="Been the perpetrator of violence or abuse?" value={g("perpetrator")} onChange={set("perpetrator")} options={["Yes", "No"]} />
        <T label="If yes, who was the victim(s)" value={g("perpetrator_victim")} onChange={set("perpetrator_victim")} />
        <T label="Type of abuse" value={g("perpetrator_type")} onChange={set("perpetrator_type")} />
      </AccSection>

      <AccSection title="Substance use history">
        <P label="Current concern with substance use?" value={g("substance_current")} onChange={set("substance_current")} options={YND} />
        <P label="History with substance use?" value={g("substance_history")} onChange={set("substance_history")} options={YND} />
        <T label="Substance(s)" value={g("substances")} onChange={set("substances")} />
        <T label="How long has this been problematic?" value={g("substance_length")} onChange={set("substance_length")} />
        <T label="Actively using? How much & how often?" value={g("substance_use")} onChange={set("substance_use")} />
        <T label="Last time used or relapsed" value={g("substance_last")} onChange={set("substance_last")} />
        <P label="Reached out for support regarding this addiction?" value={g("substance_support")} onChange={set("substance_support")} options={["Yes", "No"]} />
        <T label="Where & when was the support" value={g("substance_support_where")} onChange={set("substance_support_where")} />
        <T label="How long did the support last" value={g("substance_support_length")} onChange={set("substance_support_length")} />
        <A label="Additional notes" value={g("substance_notes")} onChange={set("substance_notes")} />
      </AccSection>

      <AccSection title="Legal & safety">
        <P label="Past or present encounters with the law?" value={g("legal")} onChange={set("legal")} options={["Yes", "No"]} />
        <A label="If yes, past and present legal issues (type and dates)" value={g("legal_detail")} onChange={set("legal_detail")} />
        <A label="Personal health & safety concerns for the counselling team (triggers, allergies…)" value={g("safety")} onChange={set("safety")} />
      </AccSection>

      <AccSection title="Goals for counselling">
        <T label="Goal 1" value={g("goal1")} onChange={set("goal1")} />
        <T label="Goal 2" value={g("goal2")} onChange={set("goal2")} />
        <T label="Goal 3" value={g("goal3")} onChange={set("goal3")} />
        <Scale label="How willing are you to make changes to see this happen?" value={g("willingness")} onChange={set("willingness")} low="Not willing at all" high="Very willing" />
        <T label="Appointment preferences" value={g("appointment_prefs")} onChange={set("appointment_prefs")} span />
        <T label="How will you access video telehealth counselling? (Zoom, Teams…)" value={g("telehealth")} onChange={set("telehealth")} span />
      </AccSection>

      <AccSection title="Counsellor notes">
        <A label="Additional notes (counsellor)" value={g("counsellor_notes")} onChange={set("counsellor_notes")} />
      </AccSection>
    </IntakeAccordion>
  );
}
