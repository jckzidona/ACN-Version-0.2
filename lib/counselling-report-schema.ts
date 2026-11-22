/** Single source of truth for the Counselling Monthly Report questions (form, validation, Excel, PDF). */
export type CrAnswers = Record<string, string | string[] | number | null | undefined>;
export type CrQuestion = {
  id: string;
  label: string;
  type: "single" | "multi" | "number" | "text";
  options?: string[];
  required?: boolean;
  /** Options that reveal a free-text box (stored as `${id}__other`). */
  otherOption?: string;
  showIf?: (a: CrAnswers) => boolean;
};
export type CrSection = { title: string; questions: CrQuestion[] };

const YN = ["Yes", "No"];
const YNNA = ["Yes", "No", "N/A"];
/** Referral types, in the order of the manager's Monthly Activity Report template. */
export const REFERRAL_TYPES = [
  "Community Engagement", "Education", "Employment Readiness", "Employment Training", "Extended Counselling",
  "Financial Counselling: Budget & Debt Management", "Financial Counselling: Future Planning", "Financial Counselling: Subsidies",
  "Food Hamper", "Harm Reduction", "Housing",
  "Housing - AI (Addictions Initiative)", "Identification", "Mental Health", "Newcomer Settlement", "Parenting support",
  "Physical Health", "Shelter: Houselessness", "Shelter: GBV", "Specialized Addictions Supports: Rehab", "Support for Child under 14", "Other",
];
const has = (a: CrAnswers, id: string, v: string) => {
  const x = a[id];
  return Array.isArray(x) ? x.includes(v) : x === v;
};
const isSB = (a: CrAnswers) => a["sb_participant"] === "Yes";
const hasKids = (a: CrAnswers) => a["has_children"] === "Yes";

export const CR_SECTIONS: CrSection[] = [
  {
    title: "Interaction & activities",
    questions: [
      { id: "interaction_type", label: "Type of interaction", type: "multi", required: true, otherOption: "Other",
        options: ["Home Visit", "Home Visit - SB", "Zoom", "Phone", "Email", "Office", "Walk and Talk", "Other"] },
      { id: "first_visit_year", label: "First visit this year (April – March)?", type: "single", required: true, options: YN },
      { id: "activities", label: "Type(s) of activities completed with client today", type: "multi", required: true, otherOption: "Other",
        options: [
          "Intake - Individual Counselling", "Intake - Group", "Intake - EYEE", "Intake - CFS", "Intake - SUAP", "Intake - Strong Beginnings",
          "Advocacy", "Advocacy - CFS", "Brief Counselling - SUAP", "Brief Counselling - Crisis", "Crisis - Addictions", "Crisis - CFS",
          "Completing Forms", "Case Management - General", "Case Management - Family Advocacy/CFS", "Case Management - SUAP", "Counselling",
          "Home Visit - SB", "Cultural Activity", "Employment Counselling", "Family Therapy", "Psychoeducational Group (4+ sessions)",
          "Harm Reduction Support", "Harm Reduction - CFS", "Harm Reduction - SUAP", "Information & Referral - Housing",
          "Information & Referral - SUAP", "Information & Referral - Family Advocacy/CFS", "Information & Referral - Other",
          "Life Skills", "Life Skills - CFS", "Life Skills - SUAP", "Lunch and Learn", "Service Networking",
          "Workshops - 1 Day", "Event - SB", "Other",
        ] },
    ],
  },
  {
    title: "Client profile",
    questions: [
      { id: "age_range", label: "Age range", type: "single", required: true, options: ["0-6", "7-12", "13-21", "22-29", "30-54", "55-64", "65+"] },
      { id: "gender", label: "Gender identity", type: "single", required: true, otherOption: "Other",
        options: ["Male", "Female", "Trans", "Non-Binary/Gender Fluid", "Two-Spirited", "Prefer not to say", "Other"] },
      { id: "ethnicity", label: "Ethnicity", type: "single", required: true, options: [
        "Asian: East Asian", "Asian: South Asian descent", "Asian: Southeast Asian", "Asian: Central Asian",
        "Middle Eastern: Arab, West Asian descent", "Black: West African", "Black: East African", "Black: North Africa",
        "Black: South Africa", "Black: Central Africa", "Black: Afro-Caribbean", "Black: African-Canadian descent",
        "Indigenous - Metis", "Indigenous - First Nations", "Indigenous - Inuit", "Latin American",
        "White (established settler family)", "White (newcomer of European descent)", "Mixed", "Choose not to disclose",
      ] },
    ],
  },
  {
    title: "Mental health & trauma",
    questions: [
      { id: "ptsd", label: "Is the client presenting with PTSD or trauma?", type: "single", required: true, options: YN },
      { id: "trauma_type", label: "If yes, what type?", type: "single", otherOption: "Other", showIf: (a) => a["ptsd"] === "Yes",
        options: ["Type 1 (single-incident trauma)", "Type 2 (long-term trauma)", "Combination", "Other"] },
      { id: "undiagnosed", label: "Is the client presenting with symptoms of undiagnosed mental illness?", type: "single", required: true, options: YN },
      { id: "diagnosed", label: "Diagnosed with mental illness, or received a diagnosis since last visit?", type: "single", options: YN },
    ],
  },
  {
    title: "Family violence & relationships",
    questions: [
      { id: "family_violence", label: "Client's experience with family violence", type: "multi", required: true, options: [
        "Currently Experiencing", "Experienced in the past but no longer experiencing", "Recently left situation", "Has not experienced family violence",
      ] },
      { id: "relationships_improved", label: "Since last session, has the client reported improvements in personal relationships?", type: "single", required: true, options: YNNA },
    ],
  },
  {
    title: "Substance use",
    questions: [
      { id: "substance_stage", label: "Client's history with substance misuse", type: "single", required: true, options: [
        "Precontemplation - Active Use", "Contemplation - Active Use", "Preparation - Active Use", "Action - Entering Recovery",
        "Maintenance - Historical Use", "Client has no history with substance misuse",
      ] },
      { id: "substances", label: "If using, which substances?", type: "multi", otherOption: "Other",
        showIf: (a) => !!a["substance_stage"] && a["substance_stage"] !== "Client has no history with substance misuse",
        options: ["Alcohol", "Marijuana", "Prescription Medication", "Methamphetamine", "Cocaine", "Opiates", "Hallucinogens", "Inhalants", "Combination", "Unknown", "Other"] },
    ],
  },
  {
    title: "Children, CFS & Strong Beginnings",
    questions: [
      { id: "has_children", label: "Does the client have children?", type: "single", required: true, options: YN },
      { id: "sb_participant", label: "Is the client a participant of the Strong Beginnings program?", type: "single", options: YN, showIf: hasKids },
      { id: "sb_literacy_homevisitor", label: "SB: Literacy activities with the home visitor this week (number)", type: "number", showIf: isSB },
      { id: "sb_literacy_own", label: "SB: Literacy activities with their child without the home visitor (number)", type: "number", showIf: isSB },
      { id: "sb_isolation", label: "SB: Reporting reduced feelings of isolation since last visit?", type: "single", options: YN, showIf: isSB },
      { id: "sb_literacy_skills", label: "SB: Reporting improved literacy skills since last visit?", type: "text", showIf: isSB },
      { id: "parenting_challenges", label: "Is the client experiencing parenting challenges?", type: "single", options: YN, showIf: hasKids },
      { id: "relationships_children", label: "Since last visit, strengthened relationships with their children?", type: "single", options: YNNA, showIf: hasKids },
      { id: "cfs_involved", label: "Are the client's children involved with / in contact with CFS?", type: "single", options: ["Yes", "No involvement", "No, but at risk"], showIf: hasKids },
      { id: "cfs_type", label: "Current CFS involvement", type: "single", showIf: (a) => a["cfs_involved"] === "Yes",
        options: ["Voluntary Care", "Emergency Apprehension", "Permanent Ward", "Kinship Care", "In-home Intervention", "Customary Care", "Closed-Historic Involvement", "N/A"] },
      { id: "cfs_agency", label: "If known, name of the affiliated agency involved with the family", type: "text", showIf: (a) => a["cfs_involved"] === "Yes" },
      { id: "reunified", label: "Since last session, gained access to children or been re-unified?", type: "single", options: YNNA, showIf: (a) => a["cfs_involved"] === "Yes" },
    ],
  },
  {
    title: "Progress since last session",
    questions: [
      { id: "volunteering", label: "Is the client currently volunteering?", type: "single", required: true, options: ["Yes, with ACN", "Yes, with another agency", "Yes, with both", "No"] },
      { id: "education", label: "Changes in educational status since last session?", type: "single", required: true, options: [
        "Entered GED/Adult ED Program", "Entered Certificate Program (2 years or less)", "Entered Degree Program (3+ years)", "Entered Post Graduate Program", "No",
      ] },
      { id: "employment_support", label: "Did the client need any employment support?", type: "single", required: true, options: [
        "Pre-Employment Support", "Employer Advocacy - Injury Related", "Employer Advocacy - Other", "No",
      ] },
      { id: "employment_status", label: "Changes in employment status since last session?", type: "single", required: true, options: [
        "Gained Full Time Employment", "Gained Part Time Employment", "Gained Casual Employment", "Reduced Hours", "Lost Employment", "No",
      ] },
      { id: "housing", label: "Changes in housing status since last session?", type: "single", required: true, otherOption: "Other", options: [
        "Experiencing Homelessness", "Was placed in an emergency shelter", "Living in transitional housing", "Living in a rental", "Purchasing a home", "No", "Other",
      ] },
      { id: "goals", label: "Changes in counselling goals since last session?", type: "single", required: true, options: [
        "Yes, achieved short term goal", "Yes, achieved long term goal", "No", "Not applicable",
      ] },
      { id: "legal_referral", label: "Did the client require any referrals to legal support?", type: "single", required: true, options: YN },
    ],
  },
  {
    title: "Resources & referrals",
    questions: [
      { id: "resources", label: "Resources received during the session", type: "multi", required: true, options: [
        "Meal", "Snack", "Feminine Hygiene Products", "General Hygiene Products", "Clothing", "Emergency Hamper", "None / Does not apply",
      ] },
      { id: "tokens", label: "Tokens received (number)", type: "number" },
      { id: "childminding", label: "Children in childminding (number)", type: "number", required: true },
      { id: "referral_types", label: "Referral type(s) provided", type: "multi", options: REFERRAL_TYPES },
      { id: "referrals", label: "Referrals provided (write \"none\" if none)", type: "text", required: true },
      { id: "anything_else", label: "Anything else about this interaction", type: "text", required: true },
    ],
  },
];

export const CR_QUESTIONS = CR_SECTIONS.flatMap((s) => s.questions);

export const isVisible = (q: CrQuestion, a: CrAnswers) => !q.showIf || q.showIf(a);

function empty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Returns the labels of required visible questions that are unanswered. */
export function missingRequired(a: CrAnswers): string[] {
  return CR_QUESTIONS.filter((q) => q.required && isVisible(q, a) && empty(a[q.id])).map((q) => q.label);
}

/** Strip answers to hidden questions and unknown keys. */
export function cleanAnswers(a: CrAnswers): CrAnswers {
  const out: CrAnswers = {};
  for (const q of CR_QUESTIONS) {
    if (!isVisible(q, a) || empty(a[q.id])) continue;
    out[q.id] = a[q.id];
    const o = a[`${q.id}__other`];
    if (q.otherOption && has(a, q.id, q.otherOption) && typeof o === "string" && o.trim()) out[`${q.id}__other`] = o.trim().slice(0, 200);
  }
  return out;
}

/** Display text for one answer (used by exports and detail view). */
export function answerText(q: CrQuestion, a: CrAnswers): string {
  const v = a[q.id];
  if (empty(v)) return "";
  const other = a[`${q.id}__other`];
  const list = (Array.isArray(v) ? v : [String(v)]).map((x) => (q.otherOption && x === q.otherOption && other ? `Other: ${other}` : String(x)));
  return list.join("; ");
}

export function ageRangeFromDob(dob: string | null | undefined, on: string): string | null {
  if (!dob) return null;
  const b = new Date(dob), d = new Date(on);
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  const bands: [string, number][] = [["0-6", 6], ["7-12", 12], ["13-21", 21], ["22-29", 29], ["30-54", 54], ["55-64", 64]];
  return bands.find(([, hi]) => age <= hi)?.[0] ?? "65+";
}

export type CrSummaryRow = { section: string; question: string; answer: string; count: number };

/** Count every answer to every question across submissions; numeric questions are totalled. */
export function summarize(list: CrAnswers[]): CrSummaryRow[] {
  const rows: CrSummaryRow[] = [];
  for (const s of CR_SECTIONS) {
    for (const q of s.questions) {
      if (q.type === "text") {
        const n = list.filter((a) => typeof a[q.id] === "string" && String(a[q.id]).trim() && String(a[q.id]).trim().toLowerCase() !== "none").length;
        rows.push({ section: s.title, question: q.label, answer: "Responses entered", count: n });
        continue;
      }
      if (q.type === "number") {
        const total = list.reduce((t, a) => t + (typeof a[q.id] === "number" ? (a[q.id] as number) : 0), 0);
        rows.push({ section: s.title, question: q.label, answer: "Total", count: total });
        continue;
      }
      for (const o of q.options ?? []) {
        const n = list.filter((a) => (Array.isArray(a[q.id]) ? (a[q.id] as string[]).includes(o) : a[q.id] === o)).length;
        rows.push({ section: s.title, question: q.label, answer: o, count: n });
      }
    }
  }
  return rows;
}
