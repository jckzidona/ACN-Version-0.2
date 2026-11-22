import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, loadContext, requireManager, scopedDepartment } from "@/lib/authz";
import { settlementWorkerScope } from "@/lib/settlement-submission";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NA = "(Blank / Not Available)";

export type FunderRow = { attribute: string; category: string; values: number[] };
export type ActivitySection = { title: string; columns: string[]; rows: { label: string; values: number[] }[] };

const AGE_BANDS = [
  ["Children (ages 0-6)", 0, 6], ["Children (ages 7-12)", 7, 12], ["Youth (ages 13-21)", 13, 21],
  ["Adults (ages 22-29)", 22, 29], ["Adults (ages 30-54)", 30, 54], ["Seniors (ages 55-64)", 55, 64], ["Seniors (ages 65+)", 65, 200],
] as const;
const ageOn = (dob: string | null, on: string) => {
  if (!dob) return null;
  const b = new Date(dob), d = new Date(on);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
};
const ageBand = (dob: string | null, on: string) => {
  const a = ageOn(dob, on);
  if (a === null) return NA;
  return AGE_BANDS.find(([, lo, hi]) => a >= lo && a <= hi)?.[0] ?? NA;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const fiscalStart = (to: string) => {
  const d = new Date(to);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-04-01`;
};

type ClientRow = {
  id: string; date_of_birth: string | null; immigration_status: string | null; preferred_language: string;
  intake_data: unknown; enrollment_date: string | null; status: string;
};
type Interaction = { clientId: string; date: string; kind: "one" | "group"; authorId: string | null };

function official(c: ClientRow) {
  const i = rec(c.intake_data);
  const v = (str(i["s_service_language"]) || str(i["c_service_language"]) || c.preferred_language || "").toLowerCase();
  if (v.includes("both")) return "Both (English and/or French)";
  if (v.startsWith("fr")) return "French";
  if (v.startsWith("en")) return "English";
  return "English";
}
function sex(c: ClientRow) {
  const g = str(rec(c.intake_data)["gender"]).toLowerCase();
  if (g.startsWith("f") || g.startsWith("w")) return "Female";
  if (g.startsWith("m")) return "Male";
  return NA;
}
function genderId(c: ClientRow) {
  const g = str(rec(c.intake_data)["gender"]).toLowerCase();
  if (g.startsWith("f")) return "Woman";
  if (g.startsWith("m")) return "Men";
  if (g.startsWith("non")) return "Non-binary";
  return NA;
}
function employment(c: ClientRow) {
  const e = str(rec(c.intake_data)["employment_status"]).toLowerCase();
  if (!e) return NA;
  if (e.includes("full")) return "Employed full time - 30 hours or more at main or only job";
  if (e.includes("part")) return "Employed part time - less than 30 hours at main or only job";
  if (e.includes("eia") || e.includes("income assistance")) return "On Employment and Income Assistance (EIA)";
  return "Not employed/not applicable";
}
const ethnic = (c: ClientRow) => { const i = rec(c.intake_data); return str(i["c_ethnicity"]) || str(i["s_ethnicity"]) || str(i["ethnicity"]) || NA; };
const origin = (c: ClientRow) => { const i = rec(c.intake_data); return str(i["citizenship"]) || str(i["s_country_of_origin"]) || NA; };
const birth = (c: ClientRow) => str(rec(c.intake_data)["country_of_birth"]) || NA;

/** Loads clients + interactions (case notes and attended group sessions) for the scoped department. */
async function loadInteractions(sb: any, org: string, dept: string | null, upTo: string, workerId: string | null) {
  let notesQ = sb.from("case_notes").select("client_id, interaction_date, author_id, interaction_type, time_spent_seconds, bus_tokens, emergency_food, meal_provided, childminding_count, interpretation_needed")
    .eq("organization_id", org).is("deleted_at", null).not("client_id", "is", null).lte("interaction_date", upTo);
  let groupsQ = sb.from("group_sessions").select("id, session_date, session_type, delivery_mode, duration_minutes, facilitator_id, created_by, status, group_session_attendees(client_id, attendance, bus_tokens, emergency_food, meal_provided, childminding_count, client_language, interpretation_needed)")
    .eq("organization_id", org).neq("status", "cancelled").lte("session_date", upTo);
  let clientsQ = sb.from("clients").select("id, date_of_birth, immigration_status, preferred_language, intake_data, enrollment_date, status, department_id").eq("organization_id", org);
  if (dept) { notesQ = notesQ.eq("department_id", dept); groupsQ = groupsQ.eq("department_id", dept); clientsQ = clientsQ.eq("department_id", dept); }
  const [notes, groups, clients] = await Promise.all([notesQ, groupsQ, clientsQ]);
  for (const r of [notes, groups, clients]) if (r.error) throw new Error(r.error.message);
  const notesRows = (notes.data ?? []) as { client_id: string; interaction_date: string; author_id: string; interaction_type: string; time_spent_seconds: number | null }[];
  const groupRows = (groups.data ?? []) as any[];
  const all: Interaction[] = [
    ...notesRows.map((n) => ({ clientId: n.client_id, date: n.interaction_date, kind: "one" as const, authorId: n.author_id })),
    ...groupRows.flatMap((g) => (g.group_session_attendees ?? []).filter((a: any) => a.attendance === "attended")
      .map((a: any) => ({ clientId: a.client_id, date: g.session_date, kind: "group" as const, authorId: g.facilitator_id ?? g.created_by }))),
  ];
  const firstSeen = new Map<string, string>();
  for (const x of all) { const f = firstSeen.get(x.clientId); if (!f || x.date < f) firstSeen.set(x.clientId, x.date); }
  const mine = workerId ? all.filter((x) => x.authorId === workerId) : all;
  const byId = new Map(((clients.data ?? []) as ClientRow[]).map((c) => [c.id, c]));
  return { all: mine, firstSeen, byId, notesRows: workerId ? notesRows.filter((n) => n.author_id === workerId) : notesRows, groupRows: workerId ? groupRows.filter((g) => (g.facilitator_id ?? g.created_by) === workerId) : groupRows };
}

/* ---------------------- ACN Client Services Summary ---------------------- */

async function requireSettlementDept(ctx: Awaited<ReturnType<typeof loadContext>>, supabase: any) {
  if (ctx.isAdmin) return;
  const { data } = await supabase.from("departments").select("name").eq("id", ctx.departmentId ?? "").maybeSingle();
  if (!/settlement/i.test(data?.name ?? "")) throw new Error("Settlement reports are only available to the Settlement department.");
}

export const getAcnClientServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: ymd, to: ymd, departmentId: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const dept = scopedDepartment(ctx, data.departmentId);
    await requireSettlementDept(ctx, context.supabase);
    const sb = context.supabase;
    const [{ all, firstSeen, byId }, funders, deptRow, org] = await Promise.all([
      loadInteractions(sb, ctx.organizationId, dept, data.to, null),
      sb.from("organization_funders").select("name, active").eq("organization_id", ctx.organizationId),
      dept ? sb.from("departments").select("name").eq("id", dept).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle(),
    ]);
    const funder = (funders.data ?? []).find((f) => f.active)?.name ?? "Immigration Refugees and Citizenship Canada";
    const inPeriod = all.filter((x) => x.date >= data.from && x.date <= data.to && byId.has(x.clientId));
    const cohortOf = (cid: string) => {
      const first = firstSeen.get(cid)!;
      if (first >= data.from) return 1;
      const c = byId.get(cid)!;
      return c.enrollment_date && c.enrollment_date < data.from && c.status === "active" && inPeriod.some((x) => x.clientId === cid && x.kind === "one") ? 3 : 2;
    };
    const cohort = new Map<string, number>();
    for (const x of inPeriod) if (!cohort.has(x.clientId)) cohort.set(x.clientId, cohortOf(x.clientId));

    const rows: FunderRow[] = [];
    const add = (attribute: string, keyOf: (c: ClientRow) => string, fixed?: string[]) => {
      const groups = new Map<string, number[]>();
      for (const k of fixed ?? []) groups.set(k, Array(12).fill(0));
      const seen = new Set<string>();
      for (const x of inPeriod) {
        const c = byId.get(x.clientId)!;
        const k = keyOf(c);
        const v = groups.get(k) ?? Array(12).fill(0);
        const co = cohort.get(x.clientId)!;
        const uniq = !seen.has(`${k}|${x.clientId}`);
        seen.add(`${k}|${x.clientId}`);
        for (const base of [0, co * 3]) { if (uniq) v[base]++; v[base + 1]++; v[base + 2]++; }
        groups.set(k, v);
      }
      for (const [category, values] of groups) if (values.some((n) => n) || fixed) rows.push({ attribute, category, values });
    };
    add("All Clients Served", () => "-", ["-"]);
    add("By Funder", () => funder);
    add("By Status in Canada", (c) => str(c.immigration_status) || NA);
    add("By Age Groups", (c) => ageBand(c.date_of_birth, data.to));
    add("By Sex", sex);
    add("By Official Language", official);
    add("By Gender Identities", genderId);
    add("By Ethnic Identities", ethnic);
    add("By Country of Origin", origin);
    add("By Country of Birth", birth);
    add("By Employment Status (Current)", employment);

    await audit(sb, ctx, "report.acn_client_services_exported", "organization", ctx.organizationId, { from: data.from, to: data.to, department_id: dept });
    return {
      orgName: org.data?.name ?? "", department: deptRow.data?.name ?? "All departments", funder,
      generatedBy: ctx.fullName, generatedAt: new Date().toISOString(), from: data.from, to: data.to, rows,
    };
  });

/* ------------------------- Monthly Activity Report ------------------------- */
const LENGTH_BANDS: [string, number, number][] = [
  ["10 - 30 mins", 0, 30], ["31 - 60 mins", 31, 60], ["1 - 1.5 hrs", 61, 90], ["1.5 - 2 hrs", 91, 120],
  ["2 - 2.5 hrs", 121, 150], ["2.5 - 3 hrs", 151, 180], ["3 - 3.5 hrs", 181, 210], ["3.5 - 4 hrs", 211, 100000],
];

export const listReportWorkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ departmentId: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const dept = scopedDepartment(ctx, data.departmentId);
    let q = context.supabase.from("profiles").select("id, full_name").eq("organization_id", ctx.organizationId).eq("status", "active").order("full_name");
    if (dept) q = q.eq("department_id", dept);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const activityReportSchema = z.object({ from: ymd, to: ymd, departmentId: z.string().uuid().nullable(), workerId: z.string().uuid().nullable() });

// Reuse the server implementation, never an RPC stub, when saving snapshots.
export const calculateActivityReport = createServerOnlyFn(async ({ data, context }: {
  data: z.infer<typeof activityReportSchema>;
  context: { supabase: Parameters<typeof loadContext>[0]; userId: string };
}) => {
    const ctx = await loadContext(context.supabase, context.userId);
    const dept = scopedDepartment(ctx, data.departmentId);
    await requireSettlementDept(ctx, context.supabase);
    const workerId = settlementWorkerScope(ctx, data.workerId);
    const sb = context.supabase;
    const ytdFrom = fiscalStart(data.to);
    const [{ all, firstSeen, byId, notesRows, groupRows }, deptRow, org, worker] = await Promise.all([
      loadInteractions(sb, ctx.organizationId, dept, data.to, workerId),
      dept ? sb.from("departments").select("name").eq("id", dept).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle(),
      workerId ? sb.from("profiles").select("full_name, department_id").eq("id", workerId).eq("organization_id", ctx.organizationId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (workerId && (!worker.data || (dept && worker.data.department_id !== dept))) throw new Error("That staff member is not in your department.");

    const inR = (d: string, a: string) => d >= a && d <= data.to;
    const me = all.filter((x) => inR(x.date, data.from) && byId.has(x.clientId));
    const ytd = all.filter((x) => inR(x.date, ytdFrom) && byId.has(x.clientId));
    const uniq = (xs: Interaction[]) => [...new Set(xs.map((x) => x.clientId))];
    const sections: ActivitySection[] = [];

    // Client ages
    const bands = [...AGE_BANDS.map((b) => b[0] as string), NA];
    const newMe = uniq(me).filter((c) => (firstSeen.get(c) ?? "") >= data.from);
    const newYtd = uniq(ytd).filter((c) => (firstSeen.get(c) ?? "") >= ytdFrom);
    const bandOf = (cid: string) => ageBand(byId.get(cid)!.date_of_birth, data.to);
    sections.push({
      title: "Client Ages", columns: ["New Clients (ME)", "New Clients (YTD)", "Unique Clients (ME)", "Unique Clients (YTD)"],
      rows: bands.map((b) => ({ label: b, values: [newMe, newYtd, uniq(me), uniq(ytd)].map((l) => l.filter((c) => bandOf(c) === b).length) })),
    });
    sections.push({
      title: "# Client Visits", columns: ["Visits (ME)", "Visits (YTD)"],
      rows: bands.map((b) => ({ label: b, values: [me, ytd].map((l) => l.filter((x) => bandOf(x.clientId) === b).length) })),
    });

    // Tally helper for client attributes (unique clients ME/YTD)
    const byClient = (title: string, key: (c: ClientRow) => string, fixed: string[] = []) => {
      const labels = new Set(fixed);
      const m = uniq(me), y = uniq(ytd);
      for (const c of y) labels.add(key(byId.get(c)!));
      sections.push({ title, columns: ["Unique Clients (ME)", "Unique Clients (YTD)"],
        rows: [...labels].map((l) => ({ label: l, values: [m, y].map((list) => list.filter((c) => key(byId.get(c)!) === l).length) })) });
    };
    byClient("Language of Service", (c) => ({ en: "English", fr: "French", ar: "Arabic", es: "Spanish", uk: "Ukrainian", ti: "Tigrinya", sw: "Swahili", so: "Somali", fa: "Farsi", zh: "Mandarin", pa: "Punjabi", tl: "Tagalog" } as Record<string, string>)[c.preferred_language] ?? (c.preferred_language || NA));
    byClient("Official Language of Preference", official, ["English", "French"]);
    byClient("Referred By", (c) => str(rec(c.intake_data)["referral_source"]) || NA);

    // Service delivery format / service received
    const notesMe = notesRows.filter((n) => inR(n.interaction_date, data.from));
    const notesYtd = notesRows.filter((n) => inR(n.interaction_date, ytdFrom));
    const gMe = groupRows.filter((g) => inR(g.session_date, data.from));
    const gYtd = groupRows.filter((g) => inR(g.session_date, ytdFrom));
    const fmt = new Set<string>();
    for (const n of notesYtd) fmt.add(n.interaction_type || NA);
    for (const g of gYtd) fmt.add(g.delivery_mode || NA);
    sections.push({ title: "Service Delivery Format", columns: ["Services (ME)", "Services (YTD)"],
      rows: [...fmt].map((f) => ({ label: f, values: [[notesMe, gMe], [notesYtd, gYtd]].map(([n, g]) => (n as any[]).filter((x) => (x.interaction_type || NA) === f).length + (g as any[]).filter((x) => (x.delivery_mode || NA) === f).length) })) });
    const att = (gs: any[]) => gs.reduce((s, g) => s + (g.group_session_attendees ?? []).filter((a: any) => a.attendance === "attended").length, 0);
    const isFamily = (g: any) => /family/i.test(g.session_type ?? "");
    sections.push({ title: "Orientation - Service Received", columns: ["Services (ME)", "Services (YTD)"], rows: [
      { label: "One-on-one", values: [notesMe.length, notesYtd.length] },
      { label: "Family", values: [att(gMe.filter(isFamily)), att(gYtd.filter(isFamily))] },
      { label: "Group", values: [att(gMe.filter((g) => !isFamily(g))), att(gYtd.filter((g) => !isFamily(g)))] },
    ] });

    // Session type
    const types = [...new Set(gYtd.map((g) => g.session_type || NA))];
    const partic = (gs: any[]) => new Set(gs.flatMap((g) => (g.group_session_attendees ?? []).filter((a: any) => a.attendance === "attended").map((a: any) => a.client_id))).size;
    sections.push({ title: "Session Type", columns: ["Sessions (ME)", "Sessions (YTD)", "Visits (ME)", "Visits (YTD)", "Unique Participants (ME)", "Unique Participants (YTD)"],
      rows: types.map((t) => { const m = gMe.filter((g) => (g.session_type || NA) === t), y = gYtd.filter((g) => (g.session_type || NA) === t); return { label: t, values: [m.length, y.length, att(m), att(y), partic(m), partic(y)] }; }) });

    // Length of service
    const mins = (list: { m: number | null }[], lo: number, hi: number) => list.filter((x) => x.m !== null && x.m >= lo && x.m <= hi).length;
    const lenMe = [...notesMe.map((n) => ({ m: n.time_spent_seconds ? Math.round(n.time_spent_seconds / 60) : null })), ...gMe.map((g) => ({ m: g.duration_minutes }))];
    const lenYtd = [...notesYtd.map((n) => ({ m: n.time_spent_seconds ? Math.round(n.time_spent_seconds / 60) : null })), ...gYtd.map((g) => ({ m: g.duration_minutes }))];
    sections.push({ title: "Length of Service", columns: ["Services (ME)", "Services (YTD)"],
      rows: LENGTH_BANDS.map(([l, lo, hi]) => ({ label: l, values: [mins(lenMe, lo, hi), mins(lenYtd, lo, hi)] })) });

    // Support services
    const sup = (gs: any[]) => {
      const a = gs.flatMap((g) => (g.group_session_attendees ?? []).filter((x: any) => x.attendance === "attended"));
      return {
        bus: a.reduce((s: number, x: any) => s + (x.bus_tokens ?? 0), 0), food: a.filter((x: any) => x.emergency_food).length,
        meal: a.filter((x: any) => x.meal_provided).length, mind: a.reduce((s: number, x: any) => s + (x.childminding_count ?? 0), 0),
        interp: a.filter((x: any) => x.interpretation_needed).length,
      };
    };
    const addN = (r: any, ns: any[]) => ({ bus: r.bus + ns.reduce((s, n) => s + (n.bus_tokens ?? 0), 0), food: r.food + ns.filter((n) => n.emergency_food).length,
      meal: r.meal + ns.filter((n) => n.meal_provided).length, mind: r.mind + ns.reduce((s, n) => s + (n.childminding_count ?? 0), 0),
      interp: r.interp + ns.filter((n) => n.interpretation_needed).length });
    const sm = addN(sup(gMe), notesMe as any[]), sy = addN(sup(gYtd), notesYtd as any[]);
    sections.push({ title: "Support Services Received", columns: ["Total (ME)", "Total (YTD)"], rows: [
      { label: "Bus tokens", values: [sm.bus, sy.bus] }, { label: "Emergency food", values: [sm.food, sy.food] },
      { label: "Meals / snacks", values: [sm.meal, sy.meal] }, { label: "Childminding (children)", values: [sm.mind, sy.mind] },
      { label: "Translation / interpretation provided", values: [sm.interp, sy.interp] },
    ] });

    await audit(sb, ctx, "report.activity_exported", "organization", ctx.organizationId, { from: data.from, to: data.to, department_id: dept, worker_id: workerId });
    return {
      orgName: org.data?.name ?? "", department: deptRow.data?.name ?? "All departments",
      worker: worker.data?.full_name ?? null, from: data.from, to: data.to, ytdFrom, sections,
    };
  });

export const getActivityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => activityReportSchema.parse(i))
  .handler(({ data, context }) => calculateActivityReport({ data, context }));
