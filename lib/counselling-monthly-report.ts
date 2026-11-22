/**
 * Builds the Counselling Monthly Activity Report in the exact layout of the manager's
 * Excel template: bands of two side-by-side tables (left = columns A–E, right = G–K),
 * each with the template's own headings, column names and colours. Figures come from
 * recorded counselling report submissions only.
 */
import type { CrAnswers } from "@/lib/counselling-report-schema";
import { REFERRAL_TYPES } from "@/lib/counselling-report-schema";

export type ReportSubmission = { date: string; clientId: string | null; answers: CrAnswers };

export type ColKey = "month" | "newMonth" | "ytd" | "ytdUnique" | "monthUnique";
export type Col = [ColKey, string];
/** Template fill colours. */
export type Tint = "pink" | "mint" | "green" | "orange" | "lavender" | "yellow" | "lime" | "sky" | "orchid" | "peach" | "blue" | "rose" | "manual";
export const TINT_HEX: Record<Tint, string> = {
  pink: "FF99FF", mint: "99FFCC", green: "66FF66", orange: "FFC000", lavender: "CCCCFF", yellow: "FFFF66",
  lime: "99FF99", sky: "83CCEB", orchid: "E49EDD", peach: "F7C7AC", blue: "A6C9EC", rose: "FF7C80",
  manual: "E97132",
};

export type MonthlyRow = {
  label: string;
  /** Visits / occasions this month (totals for numeric items). */
  month: number;
  /** Unique clients marked "first visit this year" this month (null for numeric items). */
  newMonth: number | null;
  /** Visits / occasions from April 1 to the period end. */
  ytd: number;
  /** Unique individuals YTD (null for numeric items). */
  ytdUnique: number | null;
  /** Unique individuals this month (null for numeric items). */
  monthUnique: number | null;
};
export type SheetBlock = {
  title?: string; titleTint?: Tint; heading: string; tint?: Tint; cols: Col[]; rows: MonthlyRow[];
  /** Undefined inherits the heading tint; null keeps metric headers unfilled. */
  metricTint?: Tint | null;
  headerColumnTints?: Partial<Record<ColKey, Tint>>;
  labelTint?: Tint;
  valueTints?: Partial<Record<ColKey, Tint>>;
};
export const metricCellTint = (b: SheetBlock, k: ColKey): Tint | undefined =>
  b.headerColumnTints?.[k] ?? (b.metricTint === undefined ? b.tint : b.metricTint ?? undefined);
export type SheetBand = { title?: string; tint?: Tint; left: SheetBlock[]; right: SheetBlock[] };

/** Manager-typed written highlights, matching the template's narrative section. */
export type CrNarrative = {
  program: string;
  submitted: string;
  successes: string;
  challenges: string;
  plans: string;
  incidents: string;
  meetings: string;
  agencies: string;
  organized: string;
  trainings: string;
};
export const CR_NARRATIVE_LABELS: [keyof Omit<CrNarrative, "program" | "submitted">, string][] = [
  ["successes", "Successes"],
  ["challenges", "Challenges"],
  ["plans", "Plans/Ideas for Next Month"],
  ["incidents", "Incident Reports"],
  ["meetings", "Meetings/Conferences Attended"],
  ["agencies", "Agencies Connected/Partnered with"],
  ["organized", "Meetings/Events Organized by ACN"],
  ["trainings", "Trainings Completed (indicate name of training and agency or facilitator that provided it)"],
];

/** Fiscal year runs April 1 to March 31. */
export function fiscalYearStart(to: string): string {
  const d = new Date(`${to}T00:00:00Z`);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-04-01`;
}

/** Fetch both the requested period and the current fiscal year, without conflating their totals. */
export function counsellingReportWindow(from: string, to: string) {
  const ytdFrom = fiscalYearStart(to);
  return { queryFrom: from < ytdFrom ? from : ytdFrom, ytdFrom };
}

export function counsellingReportPeriods<T extends { date: string }>(rows: T[], from: string, to: string) {
  const { ytdFrom } = counsellingReportWindow(from, to);
  return {
    submissions: rows.filter((s) => s.date >= from && s.date <= to),
    ytdSubmissions: rows.filter((s) => s.date >= ytdFrom && s.date <= to),
  };
}

type Spec =
  | { kind: "option"; label: string; qid: string; options: string[] }
  | { kind: "number"; label: string; qid: string }
  | { kind: "text"; label: string; qid: string };

const opt = (qid: string, option: string | string[], label = Array.isArray(option) ? option[0]! : option): Spec => ({
  kind: "option", label, qid, options: Array.isArray(option) ? option : [option],
});
const num = (label: string, qid: string): Spec => ({ kind: "number", label, qid });
const txt = (label: string, qid: string): Spec => ({ kind: "text", label, qid });

function matches(a: CrAnswers, s: Spec): boolean {
  const v = a[s.qid];
  if (s.kind === "number") return typeof v === "number" && v > 0;
  if (s.kind === "text") {
    const t = typeof v === "string" ? v.trim().toLowerCase() : "";
    return t !== "" && t !== "none" && t !== "no";
  }
  return Array.isArray(v) ? v.some((x) => s.options.includes(x)) : typeof v === "string" && s.options.includes(v);
}

const unique = (subs: ReportSubmission[]) => new Set(subs.filter((x) => x.clientId).map((x) => x.clientId)).size;

function row(spec: Spec, month: ReportSubmission[], ytd: ReportSubmission[]): MonthlyRow {
  if (spec.kind === "number") {
    const sum = (l: ReportSubmission[]) => l.reduce((t, s) => t + (typeof s.answers[spec.qid] === "number" ? (s.answers[spec.qid] as number) : 0), 0);
    return { label: spec.label, month: sum(month), newMonth: null, ytd: sum(ytd), ytdUnique: null, monthUnique: null };
  }
  const m = month.filter((s) => matches(s.answers, spec));
  const y = ytd.filter((s) => matches(s.answers, spec));
  return {
    label: spec.label,
    month: m.length,
    newMonth: unique(m.filter((s) => s.answers["first_visit_year"] === "Yes")),
    ytd: y.length,
    ytdUnique: unique(y),
    monthUnique: unique(m),
  };
}

// Column sets, named exactly as in the template.
const MY: Col[] = [["month", "Month"], ["ytd", "YTD"]];
const MY_MANUAL: Col[] = [["month", "Month (manual count)"], ["ytd", "YTD"]];
const V4: Col[] = [["month", "Visits This Month"], ["newMonth", "New Clients This Month"], ["ytd", "YTD Total Visits"], ["ytdUnique", "YTD Unique Individuals"]];
const O4: Col[] = [["month", "Occasions This Month"], ["newMonth", "New Clients This Month"], ["ytd", "YTD Total Occasions"], ["ytdUnique", "YTD Unique Individuals"]];
const S4: Col[] = [["month", "#Sessions Completed"], ["ytd", "YTD # of Sessions"], ["monthUnique", "#Visits"], ["ytdUnique", "YTD Visits"]];
const CFS_IND: Col[] = [...V4.slice(0, 3), ["ytdUnique", "Number of individuals YTD"]];
const CFS_FAM: Col[] = [...V4.slice(0, 3), ["ytdUnique", "Number of families the CFS liaison works with"]];
const GOALS: Col[] = [["month", "Occasions This Month"], ["ytd", "YTD Total Visits"]];

type BlockDef = Omit<SheetBlock, "rows"> & { specs: Spec[] };
type BandDef = { title?: string; tint?: Tint; left: BlockDef[]; right: BlockDef[] };

const YES_NO = (qid: string) => [opt(qid, "Yes"), opt(qid, "No")];

const LAYOUT: BandDef[] = [
  {
    left: [{ heading: "Type of Interaction", tint: "pink", cols: MY,
      specs: ["Home Visit", "Home Visit - SB", "Zoom", "Phone", "Email", "Office", "Walk and Talk", "Other"].map((o) => opt("interaction_type", o)) }],
    right: [{ heading: "Access Supports", tint: "pink", valueTints: { month: "manual" }, cols: MY_MANUAL, specs: [
      num("# Bus Tokens", "tokens"),
      opt("resources", "Meal", "# Meals"),
      opt("resources", "Feminine Hygiene Products", "# Feminine Hygiene Boxes"),
      opt("resources", "Clothing", "# Times Clothing was provided"),
      opt("resources", "Emergency Hamper", "# Emergency Hampers"),
      num("# of children in childminding", "childminding"),
    ] }],
  },
  {
    left: [{ heading: "Gender Identity", tint: "mint", cols: V4, specs: [
      ...["Male", "Female", "Trans", "Non-Binary/Gender Fluid", "Two-Spirited"].map((o) => opt("gender", o)),
      opt("gender", "Prefer not to say", "Choose not to disclose"),
      opt("gender", "Other"),
    ] }],
    right: [{ heading: "Age Range", tint: "green", cols: V4, specs: [
      opt("age_range", "0-6", "Child 0-6"), opt("age_range", "7-12", "Child 7-12"), opt("age_range", "13-21", "Youth 13-21"),
      opt("age_range", "22-29", "Adult 22-29"), opt("age_range", "30-54", "Adult 30-54"),
      opt("age_range", "55-64", "Senior 55-64"), opt("age_range", "65+", "Senior 65+"),
    ] }],
  },
  {
    title: "Ethnicity", tint: "orange",
    left: [{ heading: "", cols: V4, specs: [
      opt("ethnicity", "Asian: East Asian", "Asian: East Asian (Chinese, Korean, Japanese, Taiwanese descent)"),
      opt("ethnicity", "Asian: South Asian descent", "Asian: South Asian descent (East Indian, Pakistani, Sri Lankan, Indo-Caribbean, etc.)"),
      opt("ethnicity", "Asian: Southeast Asian", "Asian: Southeast Asian (Filipino, Vietnamese, Cambodian, Thai, etc.)"),
      opt("ethnicity", "Asian: Central Asian", "Asian: Central Asian (Kazakhstan, Kyrgyzstan, Uzbekistan, etc.)"),
      opt("ethnicity", "Middle Eastern: Arab, West Asian descent", "Middle Eastern: Arab, West Asian descent (e.g. Afghan, Iranian, etc.)"),
      opt("ethnicity", "Black: West African", "Black: West African (Benin, Ghana, Nigeria, Senegal, etc.)"),
      opt("ethnicity", "Black: East African", "Black: East African (Kenya, Uganda, Somalia, Ethiopia, etc.)"),
      opt("ethnicity", "Black: North Africa", "Black: North Africa (Morocco, Algeria, Libya, Egypt, etc.)"),
      opt("ethnicity", "Black: South Africa", "Black: South Africa (Angola, Zambia, South Africa, etc.)"),
      opt("ethnicity", "Black: Central Africa", "Black: Central Africa (DRC, Burundi, Cameroon, etc.)"),
    ] }],
    right: [{ heading: "", cols: V4, specs: [
      opt("ethnicity", "Black: Afro-Caribbean"),
      opt("ethnicity", "Black: African-Canadian descent", "Black: African-Canadian descent, etc."),
      opt("ethnicity", "Indigenous - Metis"), opt("ethnicity", "Indigenous - First Nations"), opt("ethnicity", "Indigenous - Inuit"),
      opt("ethnicity", "Latin American", "Latin American (Latin American, Hispanic descent)"),
      opt("ethnicity", "White (established settler family)"), opt("ethnicity", "White (newcomer of European descent)"),
      opt("ethnicity", "Mixed"),
      opt("ethnicity", "Choose not to disclose", "Refuse to provide"),
    ] }],
  },
  {
    title: "Session Recap", tint: "pink",
    left: [{ heading: "Session Type", cols: S4, specs: [
      opt("activities", "Intake - Individual Counselling"), opt("activities", "Intake - Group"),
      opt("activities", "Intake - EYEE", "Intake-EYEE"), opt("activities", "Intake - CFS"), opt("activities", "Intake - SUAP"),
      opt("activities", "Advocacy"), opt("activities", "Advocacy - CFS"),
      opt("activities", "Brief Counselling - SUAP", "Brief Counselling (SUAP Specific)"),
      opt("activities", "Completing Forms"), opt("activities", "Case Management - General"),
      opt("activities", "Case Management - Family Advocacy/CFS", "Case Management - CFS"),
      opt("activities", "Case Management - SUAP"), opt("activities", "Counselling"),
      opt("activities", "Brief Counselling - Crisis", "Crisis"), opt("activities", "Crisis - Addictions"), opt("activities", "Crisis - CFS"),
      opt("activities", "Home Visit - SB"), opt("activities", "Intake - Strong Beginnings"),
    ] }],
    right: [{ heading: "Session Type", headerColumnTints: { month: "yellow" }, valueTints: { month: "yellow" }, cols: S4, specs: [
      opt("activities", "Cultural Activity"), opt("activities", "Employment Counselling"), opt("activities", "Family Therapy"),
      opt("activities", "Psychoeducational Group (4+ sessions)", "Group"),
      opt("activities", "Harm Reduction Support"), opt("activities", "Harm Reduction - CFS"), opt("activities", "Harm Reduction - SUAP"),
      opt("activities", ["Information & Referral - Housing", "Information & Referral - Other"], "Information and Referrals"),
      opt("activities", "Information & Referral - Family Advocacy/CFS", "I&R - CFS"),
      opt("activities", "Information & Referral - SUAP", "I&R - SUAP"),
      opt("activities", "Life Skills"), opt("activities", "Life Skills - CFS"), opt("activities", "Life Skills - SUAP"),
      opt("activities", "Lunch and Learn"), opt("activities", "Service Networking"),
      opt("activities", "Workshops - 1 Day", "Workshops (1 day)"), opt("activities", "Event - SB", "Event-SB"), opt("activities", "Other"),
    ] }],
  },
  {
    title: "Trauma", tint: "lavender",
    left: [{ heading: "Trauma Experienced", cols: V4, specs: [
      opt("trauma_type", "Type 1 (single-incident trauma)", "Type 1 (single-incident trauma ex: assault, traumatic loss, etc.)"),
      opt("trauma_type", "Type 2 (long-term trauma)", "Type 2 (Long term trauma ex: DV, neglect, abuse)"),
      opt("trauma_type", "Combination"), opt("trauma_type", "Other"),
    ] }],
    right: [{ heading: "Presented with PTSD or signs of trauma", cols: V4, specs: YES_NO("ptsd") }],
  },
  {
    left: [
      { title: "Mental Health", titleTint: "yellow", heading: "Presented with symptoms of undiagnosed mental illness", tint: "yellow", metricTint: null, cols: V4, specs: YES_NO("undiagnosed") },
      { heading: "Diagnosed with mental illness", tint: "yellow", cols: V4, specs: YES_NO("diagnosed") },
      { heading: "Family Violence", tint: "sky", metricTint: null, cols: V4, specs: [
        opt("family_violence", "Currently Experiencing"),
        opt("family_violence", "Experienced in the past but no longer experiencing"),
        opt("family_violence", "Recently left situation", "Recently Left situation"),
        opt("family_violence", "Has not experienced family violence"),
      ] },
      { heading: "Reporting Strengthened Relationship", tint: "sky", cols: V4, specs: [...YES_NO("relationships_improved"), opt("relationships_improved", "N/A")] },
    ],
    right: [
      { title: "Substance Use", titleTint: "lime", heading: "Status", tint: "lime", metricTint: null, cols: V4, specs: [
        "Precontemplation - Active Use", "Contemplation - Active Use", "Preparation - Active Use",
        "Action - Entering Recovery", "Maintenance - Historical Use", "Client has no history with substance misuse",
      ].map((o) => opt("substance_stage", o)) },
      { heading: "Substance Used", tint: "lime", cols: V4, specs: [
        "Alcohol", "Marijuana", "Prescription Medication", "Methamphetamine", "Cocaine", "Opiates", "Hallucinogens", "Inhalants", "Combination", "Other", "Unknown",
      ].map((o) => opt("substances", o)) },
    ],
  },
  {
    left: [
      { title: "Mothers Matter", titleTint: "lavender", heading: "", tint: "lavender", metricTint: null, labelTint: "lavender", cols: MY, specs: [
        num("# occasions that client engaged in literacy based activities with home visitor", "sb_literacy_homevisitor"),
        num("# occasions that client engaged in literacy activity with their child (without HV)", "sb_literacy_own"),
        opt("sb_isolation", "Yes", "# Reported reduced isolation"),
        txt("# Reported improved literacy skills", "sb_literacy_skills"),
      ] },
      { title: "Parenting", titleTint: "rose", heading: "Parenting Challenges (No CFS)", tint: "rose", metricTint: null, cols: V4, specs: [opt("parenting_challenges", "Yes")] },
      { heading: "Report Strengthened relationship with children", tint: "rose", metricTint: null, cols: V4, specs: [opt("relationships_children", "Yes")] },
      { title: "Child and Family Services", titleTint: "green", heading: "Current Involvement with CFS", tint: "lime", metricTint: null, cols: CFS_IND, specs: [
        opt("cfs_involved", "Yes"), opt("cfs_involved", "No involvement"), opt("cfs_involved", "No, but at risk"),
      ] },
      { heading: "Current CFS Involvement", tint: "green", cols: CFS_FAM, specs: [
        "Voluntary Care", "Emergency Apprehension", "Permanent Ward", "Kinship Care", "In-home Intervention", "Customary Care",
        "Closed-Historic Involvement", "N/A",
      ].map((o) => opt("cfs_type", o)) },
      { heading: "Gained Access to Children/Reunification", tint: "lime", metricTint: "green", cols: CFS_FAM, specs: YES_NO("reunified") },
    ],
    right: [
      { heading: "Volunteerism", tint: "orchid", cols: O4, specs: [
        opt("volunteering", "Yes, with ACN", "ACN"), opt("volunteering", "Yes, with another agency", "Other"), opt("volunteering", "Yes, with both", "Both"),
      ] },
      { heading: "Education", tint: "peach", metricTint: "orchid", cols: O4, specs: [
        opt("education", "Entered GED/Adult ED Program"), opt("education", "Entered Certificate Program (2 years or less)"),
        opt("education", "Entered Degree Program (3+ years)"), opt("education", "Entered Post Graduate Program", "Entered Post-Graduate Program"),
        opt("education", "No"),
      ] },
      { heading: "Employment", tint: "blue", metricTint: "orchid", cols: O4, specs: [
        ...["Pre-Employment Support", "Employer Advocacy - Injury Related", "Employer Advocacy - Other"].map((o) => opt("employment_support", o)),
        ...["Gained Full Time Employment", "Gained Part Time Employment", "Gained Casual Employment", "Reduced Hours", "Lost Employment", "No"].map((o) =>
          opt("employment_status", o),
        ),
      ] },
      { heading: "Clients requiring referral to legal support", tint: "orange", metricTint: "orchid", cols: O4, specs: YES_NO("legal_referral") },
      { heading: "Housing", tint: "yellow", cols: O4, specs: [
        "Experiencing Homelessness", "Was placed in an emergency shelter", "Living in transitional housing",
        "Living in a rental", "Purchasing a home", "No", "Other",
      ].map((o) => opt("housing", o)) },
    ],
  },
  {
    title: "Counselling Goals", tint: "yellow",
    left: [{ heading: "Achieved Counselling Goal", tint: "yellow", metricTint: null, cols: GOALS, specs: [opt("goals", "Yes, achieved short term goal"), opt("goals", "Yes, achieved long term goal")] }],
    right: [{ heading: "Achieved Counselling Goal", tint: "yellow", metricTint: null, cols: GOALS, specs: [opt("goals", "No"), opt("goals", "Not applicable")] }],
  },
  {
    title: "Referrals", tint: "pink",
    left: [{ heading: "Referral Type", metricTint: "orchid", cols: O4, specs: REFERRAL_TYPES.slice(0, 11).map((o) => opt("referral_types", o)) }],
    right: [{ heading: "Referral Type", metricTint: "orchid", cols: O4, specs: REFERRAL_TYPES.slice(11).map((o) => opt("referral_types", o)) }],
  },
];

/** Builds the whole sheet. `month` = submissions in the period; `ytd` = submissions from April 1 to the period end. */
export function buildMonthlyActivityReport(month: ReportSubmission[], ytd: ReportSubmission[]): SheetBand[] {
  const block = ({ specs, ...b }: BlockDef): SheetBlock => ({ ...b, rows: specs.map((s) => row(s, month, ytd)) });
  return LAYOUT.map(({ left, right, ...rest }) => ({ ...rest, left: left.map(block), right: right.map(block) }));
}

export const cellValue = (r: MonthlyRow, k: ColKey): number | null => r[k];

/** Resolve form colours from the same report definitions; no separate palette. */
export function questionTint(qid: string, option?: string): Tint | undefined {
  for (const band of LAYOUT) for (const block of [...band.left, ...band.right]) {
    const match = block.specs.some(s => s.qid === qid && (!option || s.kind !== "option" || s.options.includes(option)));
    if (match) return (option ? block.valueTints?.month : undefined) ?? block.tint ?? block.titleTint ?? band.tint;
  }
  return undefined;
}
