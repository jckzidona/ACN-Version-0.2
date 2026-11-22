import type { ReportExportInput } from './excel-export';
import type { FunderRow } from './funder-reports.functions';
import type { Tint } from './counselling-monthly-report';

export type ReportTable = { title: string; headers: string[]; rows: (string | number)[][]; tint: Tint; wide?: boolean };
export type ReportSection = { title: string; tables: ReportTable[] };
export type SheetMeta = { title: string; orgName: string; department: string; from: string; to: string; details?: [string, string][]; note?: string; filename: string };
export const SHEET_BG: Record<Tint, string> = {
  pink: 'bg-sheet-pink', mint: 'bg-sheet-mint', green: 'bg-sheet-green', orange: 'bg-sheet-orange', lavender: 'bg-sheet-lavender', yellow: 'bg-sheet-yellow', lime: 'bg-sheet-lime', sky: 'bg-sheet-sky', orchid: 'bg-sheet-orchid', peach: 'bg-sheet-peach', blue: 'bg-sheet-blue', rose: 'bg-sheet-rose', manual: 'bg-sheet-manual',
};
const tints: Tint[] = ['mint', 'pink', 'green', 'orange', 'lavender', 'peach', 'sky', 'yellow', 'orchid', 'blue', 'lime'];
const tint = (i: number) => tints[i % tints.length] ?? 'mint';
const summary = [
  ['activeClients','Active clients'], ['newIntakes','New intakes'], ['clientsServed','Clients served'], ['families','Family files'],
  ['caseNotes','Case notes'], ['hoursOnNotes','Hours on notes'], ['meetingsScheduled','Meetings scheduled'], ['meetingsMissed','Meetings missed'],
  ['referrals','Referrals'], ['groupSessions','Group sessions'], ['groupUniqueParticipants','Group participants'], ['followUpsDue','Follow-ups due'],
  ['followUpsDone','Follow-ups done'], ['totalClients','Total clients on file'], ['groupBusTokens','Bus tokens given'], ['groupEmergencyFood','Emergency food provided'],
  ['groupMeals','Meals / snacks provided'], ['groupChildminding','Children in childminding'], ['groupChildrenAttending','Children attending with parents'],
] as const;
const counsel = [ ['activeClients','Active clients'], ['newClients','New clients'], ['clientsSeen','Clients seen'], ['sessions','Sessions'], ['hours','Counselling hours'], ['closedCases','Closed cases'], ['appointmentsBooked','Appointments booked'], ['noShowRate','No-show rate'], ['avgWaitDays','Avg wait (days)'], ['medianWaitDays','Median wait (days)'] ] as const;
export function statisticsSheets(d: ReportExportInput): ReportSection[] {
  const breakdowns = (blocks: ReportExportInput['breakdowns']) => Object.entries(blocks).map(([title, rows], i): ReportTable => {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return { title, tint: tint(i), headers: ['Category','Count','% of section'], rows: rows.map(r => [r.label, r.value, `${total ? Math.round(r.value / total * 100) : 0}%`]) };
  });
  const sections: ReportSection[] = [
    { title: 'Summary', tables: [ { title: 'Clients & activity', tint: 'mint', headers: ['Measure','Value'], rows: summary.slice(0, 10).map(([k,l]) => [l,d.totals[k] ?? 0]) }, { title: 'Services & follow-ups', tint: 'pink', headers: ['Measure','Value'], rows: summary.slice(10).map(([k,l]) => [l,d.totals[k] ?? 0]) } ] },
    { title: 'Staff performance', tables: [{ title: 'Staff performance', tint: 'orchid', wide: true, headers: d.staffCols.map(c=>c[1]), rows: d.staff.map(s=>d.staffCols.map(([k])=> String(s[k] ?? ''))) }] },
    { title: 'Client statistics', tables: breakdowns(d.breakdowns) },
    { title: 'Needs assessment', tables: [{ title: 'Needs assessment', tint: 'lavender', headers: ['Need area','High','Medium','Low','No need'], rows: d.needs.map(r=>[r.area,r.High,r.Medium,r.Low,r['No need']]) }] },
  ];
  if (d.counselling.hasDepartment) sections.push({ title: 'Counselling statistics', tables: [
    { title: 'Counselling activity', tint: 'mint', headers: ['Measure','Value'], rows: counsel.map(([k,l])=>[l,k === 'noShowRate' ? `${d.counselling.totals[k] ?? 0}%` : d.counselling.totals[k] ?? 0]) },
    { title: 'Counsellor caseload', tint: 'pink', wide: true, headers: d.counselling.cols.map(c=>c[1]), rows: d.counselling.counsellors.map(s=>d.counselling.cols.map(([k])=>String(s[k] ?? ''))) }, ...breakdowns(d.counselling.breakdowns),
  ] });
  return sections;
}
export type ClientServicesInput = { orgName: string; department: string; funder: string; generatedBy: string; generatedAt: string; from: string; to: string; rows: FunderRow[] };
export function clientServicesSheets(rows: FunderRow[]): ReportSection[] {
  const groups = new Map<string, FunderRow[]>();
  for (const r of rows) groups.set(r.attribute, [...(groups.get(r.attribute) ?? []), r]);
  return [...groups].map(([title, group])=>({ title, tables: ['Total','First-Time Clients','Returning Clients','Continuing / Repeat Clients'].map((cohort,i)=>({ title: cohort, tint: tint(i), headers: ['Category','Unique Clients','Services','Interactions'], rows: group.map(r=>[r.category,...r.values.slice(i*3,i*3+3)]) })) }));
}
export function clientServicesMeta(d: ClientServicesInput): SheetMeta {
  return { title: 'Settlement — Client Services Summary', orgName: d.orgName.replace(/\bECRC\b/gi,'ACN') || 'ACN', department: d.department, from: d.from, to: d.to, details: [['Classification','PROTECTED-B'],['Funder',d.funder],['Generated by',d.generatedBy],['Generated at',new Date(d.generatedAt).toLocaleString('en-CA')]], note: 'First-Time = first ACN service falls in the period. Returning = served before the period. Continuing = active enrolled client with ongoing one-on-one service since before the period. Total = all three cohorts.', filename: `Settlement-Client-Services-Summary_${d.department.replace(/\W+/g,'-')}_${d.from}_${d.to}` };
}
export function tableBands(tables: ReportTable[]): ReportTable[][] {
  const bands: ReportTable[][] = [];
  for (const table of tables) {
    const last = bands[bands.length-1];
    if (!table.wide && last?.length === 1 && !last[0]?.wide) last.push(table);
    else bands.push([table]);
  }
  return bands;
}
