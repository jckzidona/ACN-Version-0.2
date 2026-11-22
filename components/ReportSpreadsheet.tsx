import { SHEET_BG, tableBands, type SheetMeta, type ReportSection } from '@/lib/report-sheet';
export function ReportSpreadsheet({meta,sections}:{meta:SheetMeta;sections:ReportSection[]}) {
  return <div className="counselling-report-sheet overflow-x-auto rounded-md border border-sheet-line bg-sheet p-4 text-sheet-ink"><div className="min-w-[640px] space-y-5">
    <h3 className="text-base font-bold">{meta.title}</h3>
    <dl className="grid grid-cols-[140px_1fr] gap-2 text-xs"><dt className="font-bold">Organization</dt><dd>{meta.orgName}</dd><dt className="font-bold">Department</dt><dd>{meta.department}</dd><dt className="font-bold">Period of Report</dt><dd>{meta.from} to {meta.to}</dd>{meta.details?.map(([k,v])=><div key={k} className="contents"><dt className="font-bold">{k}</dt><dd>{v}</dd></div>)}</dl>
    {sections.map(s=><div key={s.title} className="space-y-3"><h4 className="border-2 border-sheet-ink px-2 py-1 text-sm">{s.title}</h4>{tableBands(s.tables).map((band,i)=><div key={i} className="grid grid-cols-2 items-start gap-6">{band.map(t=><table key={t.title} className={`w-full border-collapse text-[11px] ${t.wide?'col-span-2':''}`}><thead><tr><th colSpan={t.headers.length} className={`border-2 border-sheet-ink px-2 py-1 text-left ${SHEET_BG[t.tint]}`}>{t.title}</th></tr><tr>{t.headers.map(h=><th key={h} className={`border border-sheet-ink px-2 py-1 ${SHEET_BG[t.tint]}`}>{h}</th>)}</tr></thead><tbody>{t.rows.map((row,ri)=><tr key={ri}>{row.map((v,ci)=><td key={ci} className={`border border-sheet-line px-2 py-1 ${ci?'text-center tabular-nums':'font-semibold'}`}>{v}</td>)}</tr>)}</tbody></table>)}</div>)}</div>)}
    {meta.note&&<p className="text-xs">{meta.note}</p>}
  </div></div>;
}
