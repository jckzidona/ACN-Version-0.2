import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, loadContext, requireManager, scopedDepartment } from "@/lib/authz";

type Count = { label: string; value: number };
const tally = (items: (string | null | undefined)[]): Count[] => {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = i && i.trim() ? i : "Not recorded";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

const ageBand = (dob: string | null) => {
  if (!dob) return "Not recorded";
  const a = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  if (a < 6) return "0–5";
  if (a < 13) return "6–12";
  if (a < 18) return "13–17";
  if (a < 25) return "18–24";
  if (a < 45) return "25–44";
  if (a < 65) return "45–64";
  return "65+";
};

export const getStatsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), departmentId: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase, context.userId);
    requireManager(ctx);
    const sb = context.supabase;
    const org = ctx.organizationId;
    const toEnd = `${data.to}T23:59:59.999Z`;
    const dept = scopedDepartment(ctx, data.departmentId);

    let notesQ = sb.from("case_notes").select("author_id, client_id, time_spent_seconds, interaction_type, client_appearance, department_id, status, bus_tokens, emergency_food, meal_provided, childminding_count")
      .eq("organization_id", org).is("deleted_at", null).gte("interaction_date", data.from).lte("interaction_date", data.to);
    let apptQ = sb.from("appointments").select("worker_id, status, department_id").eq("organization_id", org).gte("starts_at", data.from).lte("starts_at", toEnd);
    let clientsQ = sb.from("clients").select("id, status, immigration_status, preferred_language, intake_date, enrollment_date, date_of_birth, intake_data, created_at, department_id, parent_client_id, confidentiality_level, arrival_date").eq("organization_id", org);
    if (dept) {
      notesQ = notesQ.eq("department_id", dept);
      apptQ = apptQ.eq("department_id", dept);
      clientsQ = clientsQ.eq("department_id", dept);
    }
    let groupsQ = sb.from("group_sessions").select("id, facilitator_id, session_type, status, department_id, group_session_attendees(client_id, attendance, bus_tokens, emergency_food, meal_provided, childminding_count, child_client_ids)")
      .eq("organization_id", org).gte("session_date", data.from).lte("session_date", data.to);
    if (dept) groupsQ = groupsQ.eq("department_id", dept);
    const [profiles, notes, appts, clients, refs, tasks, groups] = await Promise.all([
      sb.from("profiles").select("id, full_name, job_title, department_id, status").eq("organization_id", org),
      notesQ,
      apptQ,
      clientsQ,
      sb.from("client_referrals").select("client_id, referred_to, status, created_by").eq("organization_id", org).gte("referral_date", data.from).lte("referral_date", data.to),
      sb.from("follow_up_tasks").select("assigned_to, client_id, status, due_date, completed_at").eq("organization_id", org).gte("due_date", data.from).lte("due_date", data.to),
      groupsQ,
    ]);
    for (const r of [profiles, notes, appts, clients, refs, tasks, groups]) if (r.error) throw new Error(r.error.message);

    const clientIds = new Set((clients.data ?? []).map((c) => c.id));
    const refRows = (refs.data ?? []).filter((r) => !dept || clientIds.has(r.client_id));
    const noteRows = notes.data ?? [];
    const apptRows = appts.data ?? [];
    const deptStaffIds = new Set((profiles.data ?? []).filter((p) => !dept || p.department_id === dept).map((p) => p.id));
    const taskRows = (tasks.data ?? []).filter((t) => !dept || (t.client_id ? clientIds.has(t.client_id) : deptStaffIds.has(t.assigned_to)));
    const groupRows = (groups.data ?? []).filter((g) => g.status !== "cancelled");
    const attendedOf = (g: (typeof groupRows)[number]) => g.group_session_attendees.filter((a) => a.attendance === "attended");

    const staff = (profiles.data ?? [])
      .filter((p) => !dept || p.department_id === dept)
      .map((p) => {
        const mine = noteRows.filter((n) => n.author_id === p.id);
        const a = apptRows.filter((x) => x.worker_id === p.id);
        const t = taskRows.filter((x) => x.assigned_to === p.id);
        const secs = mine.reduce((s, n) => s + (n.time_spent_seconds ?? 0), 0);
        return {
          id: p.id,
          name: p.full_name || "Unnamed",
          jobTitle: p.job_title ?? "",
          caseNotes: mine.length,
          clientsServed: new Set(mine.map((n) => n.client_id).filter(Boolean)).size,
          meetingsScheduled: a.length,
          meetingsCompleted: a.filter((x) => x.status === "completed").length,
          meetingsMissed: a.filter((x) => ["missed", "no_show", "no-show"].includes(x.status)).length,
          meetingsCancelled: a.filter((x) => x.status === "cancelled").length,
          groupSessions: groupRows.filter((g) => g.facilitator_id === p.id).length,
          groupParticipants: groupRows.filter((g) => g.facilitator_id === p.id).reduce((n, g) => n + attendedOf(g).length, 0),
          referralsMade: refRows.filter((r) => r.created_by === p.id).length,
          followUpsDue: t.length,
          followUpsDone: t.filter((x) => x.status === "done" || x.completed_at).length,
          minutesOnNotes: Math.round(secs / 60),
          avgMinutesPerNote: mine.length ? Math.round(secs / 60 / mine.length) : 0,
        };
      })
      .filter((s) => s.caseNotes || s.meetingsScheduled || s.followUpsDue || s.referralsMade || true);

    const all = clients.data ?? [];
    const inRange = (d: string | null) => !!d && d >= data.from && d <= data.to;
    const newIntakes = all.filter((c) => inRange(c.intake_date ?? c.created_at.slice(0, 10)));
    const served = new Set(noteRows.map((n) => n.client_id).filter(Boolean));
    const needs: Record<string, Record<string, number>> = {};
    const enrollments: string[] = [];
    for (const c of all) {
      const it = (c.intake_data ?? {}) as Record<string, unknown>;
      const n = (it["needs"] ?? {}) as Record<string, { level?: string }>;
      for (const [area, v] of Object.entries(n)) {
        if (!v?.level) continue;
        needs[area] ??= {};
        needs[area][v.level] = (needs[area][v.level] ?? 0) + 1;
      }
      const e = it["enrollments"];
      if (Array.isArray(e)) for (const x of e as { program?: string; status?: string; start?: string }[]) {
        if (x.program && (x.status === "Active" || inRange(x.start ?? null))) enrollments.push(x.program);
      }
    }
    const get = (c: (typeof all)[number], k: string) => {
      const v = ((c.intake_data ?? {}) as Record<string, unknown>)[k];
      return typeof v === "string" ? v : null;
    };

    // Counselling (Momentum-style) section
    const { data: deptRows } = await sb.from("departments").select("id, name").eq("organization_id", org);
    const counselIds = new Set((deptRows ?? []).filter((d) => (!dept || d.id === dept) && /counsel/i.test(d.name)).map((d) => d.id));
    const cNotes = noteRows.filter((n) => n.department_id && counselIds.has(n.department_id));
    const cAppts = apptRows.filter((a) => a.department_id && counselIds.has(a.department_id));
    const cClients = all.filter((c) => c.department_id && counselIds.has(c.department_id));
    const missedSt = ["missed", "no_show", "no-show"];
    const { data: firstNotes } = cClients.length
      ? await sb.from("case_notes").select("client_id, interaction_date").eq("organization_id", org).is("deleted_at", null)
          .in("client_id", cClients.map((c) => c.id)).order("interaction_date", { ascending: true })
      : { data: [] as { client_id: string | null; interaction_date: string }[] };
    const firstByClient = new Map<string, string>();
    for (const n of firstNotes ?? []) if (n.client_id && !firstByClient.has(n.client_id)) firstByClient.set(n.client_id, n.interaction_date);
    const waits: number[] = [];
    for (const c of cClients) {
      const start = c.intake_date ?? c.created_at.slice(0, 10);
      const first = firstByClient.get(c.id);
      if (first && inRange(first)) waits.push(Math.max(0, Math.round((new Date(first).getTime() - new Date(start).getTime()) / 864e5)));
    }
    waits.sort((a, b) => a - b);
    const counsellors = staff
      .filter((s) => cNotes.some((n) => n.author_id === s.id) || cAppts.some((a) => a.worker_id === s.id))
      .map((s) => {
        const mine = cNotes.filter((n) => n.author_id === s.id);
        const ap = cAppts.filter((a) => a.worker_id === s.id);
        return {
          id: s.id, name: s.name,
          activeCaseload: new Set(mine.map((n) => n.client_id).filter(Boolean)).size,
          sessions: mine.length,
          hours: Math.round(mine.reduce((t, n) => t + (n.time_spent_seconds ?? 0), 0) / 360) / 10,
          booked: ap.length,
          attended: ap.filter((a) => a.status === "completed").length,
          noShows: ap.filter((a) => missedSt.includes(a.status)).length,
          cancelled: ap.filter((a) => a.status === "cancelled").length,
        };
      });
    const counselling = {
      hasDepartment: counselIds.size > 0,
      totals: {
        activeClients: cClients.filter((c) => c.status === "active").length,
        newClients: cClients.filter((c) => inRange(c.intake_date ?? c.created_at.slice(0, 10))).length,
        clientsSeen: new Set(cNotes.map((n) => n.client_id).filter(Boolean)).size,
        sessions: cNotes.length,
        hours: Math.round(cNotes.reduce((t, n) => t + (n.time_spent_seconds ?? 0), 0) / 360) / 10,
        closedCases: cClients.filter((c) => /closed|inactive|discharg/i.test(c.status)).length,
        appointmentsBooked: cAppts.length,
        noShowRate: cAppts.length ? Math.round((cAppts.filter((a) => missedSt.includes(a.status)).length / cAppts.length) * 100) : 0,
        avgWaitDays: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
        medianWaitDays: waits.length ? (waits[Math.floor(waits.length / 2)] ?? 0) : 0,
      },
      counsellors,
      breakdowns: {
        "Session type": tally(cNotes.map((n) => n.interaction_type)),
        "Client presentation": tally(cNotes.map((n) => n.client_appearance)),
        "Appointment outcome": tally(cAppts.map((a) => a.status)),
        "Wait to first session": tally(waits.map((w) => (w <= 7 ? "0–7 days" : w <= 14 ? "8–14 days" : w <= 30 ? "15–30 days" : "31+ days"))),
        "Case status": tally(cClients.map((c) => c.status)),
        "Age group": tally(cClients.map((c) => ageBand(c.date_of_birth))),
        Gender: tally(cClients.map((c) => get(c, "gender"))),
        "Preferred language": tally(cClients.map((c) => c.preferred_language)),
        "Referral source": tally(cClients.map((c) => get(c, "referral_source"))),
      } as Record<string, Count[]>,
    };

    await audit(sb, ctx, "report.generated", "report", null, { from: data.from, to: data.to });

    return {
      counselling,
      period: { from: data.from, to: data.to },
      totals: {
        activeClients: all.filter((c) => c.status === "active").length,
        totalClients: all.length,
        newIntakes: newIntakes.length,
        clientsServed: served.size,
        families: all.filter((c) => !c.parent_client_id && all.some((k) => k.parent_client_id === c.id)).length,
        caseNotes: noteRows.length,
        hoursOnNotes: Math.round(noteRows.reduce((s, n) => s + (n.time_spent_seconds ?? 0), 0) / 360) / 10,
        meetingsScheduled: apptRows.length,
        meetingsMissed: apptRows.filter((x) => ["missed", "no_show", "no-show"].includes(x.status)).length,
        referrals: refRows.length,
        groupSessions: groupRows.length,
        groupAttendances: groupRows.reduce((n, g) => n + attendedOf(g).length, 0),
        groupUniqueParticipants: new Set(groupRows.flatMap((g) => attendedOf(g).map((a) => a.client_id))).size,
        groupBusTokens: groupRows.reduce((n, g) => n + attendedOf(g).reduce((m, a) => m + (a.bus_tokens ?? 0), 0), 0) + noteRows.reduce((m, n: any) => m + (n.bus_tokens ?? 0), 0),
        groupEmergencyFood: groupRows.reduce((n, g) => n + attendedOf(g).filter((a) => a.emergency_food).length, 0) + noteRows.filter((n: any) => n.emergency_food).length,
        groupMeals: groupRows.reduce((n, g) => n + attendedOf(g).filter((a) => a.meal_provided).length, 0) + noteRows.filter((n: any) => n.meal_provided).length,
        groupChildminding: groupRows.reduce((n, g) => n + attendedOf(g).reduce((m, a) => m + (a.childminding_count ?? 0), 0), 0) + noteRows.reduce((m, n: any) => m + (n.childminding_count ?? 0), 0),
        groupChildrenAttending: groupRows.reduce((n, g) => n + attendedOf(g).reduce((m, a) => m + (a.child_client_ids?.length ?? 0), 0), 0),
        followUpsDue: taskRows.length,
        followUpsDone: taskRows.filter((x) => x.status === "done" || x.completed_at).length,
      },
      staff,
      breakdowns: {
        "Group session type": tally(groupRows.map((g) => g.session_type)),
        "Client status": tally(all.map((c) => c.status)),
        "Immigration category": tally(all.map((c) => c.immigration_status)),
        "Preferred language": tally(all.map((c) => c.preferred_language)),
        "Age group": tally(all.map((c) => ageBand(c.date_of_birth))),
        Gender: tally(all.map((c) => get(c, "gender"))),
        "Country of birth": tally(all.map((c) => get(c, "country_of_birth"))),
        "Referral source (new intakes)": tally(newIntakes.map((c) => get(c, "referral_source"))),
        "Program enrollments": tally(enrollments),
        "Service type (case notes)": tally(noteRows.map((n) => n.interaction_type)),
        "Client appearance": tally(noteRows.map((n) => n.client_appearance)),
        "Referrals by destination": tally(refRows.map((r) => r.referred_to)),
        "Referrals by status": tally(refRows.map((r) => r.status)),
        Confidentiality: tally(all.map((c) => c.confidentiality_level)),
      } as Record<string, Count[]>,
      needs,
    };
  });
