import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Narrative } from "@/lib/funder-reports-export";
import { SETTLEMENT_NARRATIVE_LABELS, settlementReportBands, settlementTotals, type SettlementReportData } from "@/lib/settlement-monthly-report";

const BG = {
  pink: "bg-sheet-pink", mint: "bg-sheet-mint", green: "bg-sheet-green", orange: "bg-sheet-orange",
  lavender: "bg-sheet-lavender", yellow: "bg-sheet-yellow", lime: "bg-sheet-lime", sky: "bg-sheet-sky",
  orchid: "bg-sheet-orchid", peach: "bg-sheet-peach", blue: "bg-sheet-blue", rose: "bg-sheet-rose", manual: "bg-sheet-manual",
};

export function SettlementReportSheet({ data, n, setN, readOnly = false }: { data: SettlementReportData; n: Narrative; setN: (n: Narrative) => void; readOnly?: boolean }) {
  return (
    <div className="counselling-report-sheet overflow-x-auto rounded-md border border-sheet-line bg-sheet p-4 text-sheet-ink">
      <div className="min-w-[1000px] space-y-5">
        <h3 className="text-base font-bold">ACN Monthly Activity Report — Settlement</h3>
        <dl className="grid max-w-2xl grid-cols-[140px_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
          <dt className="font-bold">Staff Name:</dt><dd><Input aria-label="Staff name" className="h-8" value={data.worker ?? `Consolidated — ${data.department}`} readOnly /></dd>
          <dt className="font-bold">Program:</dt><dd><Input aria-label="Program" className="h-8" value={n.program} readOnly={readOnly} onChange={(e) => setN({ ...n, program: e.target.value })} /></dd>
          <dt className="font-bold">Period of Report</dt><dd><Input aria-label="Period of report" className="h-8" value={`${data.from} to ${data.to} (YTD from ${data.ytdFrom})`} readOnly /></dd>
          <dt className="font-bold">Date Submitted</dt><dd><Input aria-label="Date submitted" className="h-8" type="date" value={n.submitted} readOnly /></dd>
        </dl>
        {settlementReportBands(data.sections).map((band, i) => (
          <div key={i} className="grid grid-cols-2 items-start gap-6">
            {[band.left, band.right].map((side, j) => <div key={j}>{side.map((s) => (
              <table key={s.title} className="w-full table-fixed border-collapse text-[11px] leading-tight">
                <colgroup><col className="w-[36%]" />{s.columns.map((c) => <col key={c} />)}</colgroup>
                <thead><tr>
                  <th className={`border-2 border-sheet-ink px-2 py-2 text-left font-bold ${BG[s.tint]}`}>{s.title}</th>
                  {s.columns.map((c) => <th key={c} className={`break-words border border-dashed border-sheet-ink px-1 py-2 text-center font-bold ${BG[s.tint]}`}>{c}</th>)}
                </tr></thead>
                <tbody>{[...s.rows, { label: "Total", values: settlementTotals(s) }].map((r, ri) => (
                  <tr key={`${r.label}-${ri}`} className={ri === s.rows.length ? "bg-sheet-mint font-bold" : ""}>
                    <td className="break-words border-x-2 border-b border-sheet-ink px-2 py-1 font-semibold">{r.label}</td>
                    {s.columns.map((c, ci) => <td key={c} className="border border-dashed border-sheet-line px-1 py-1 text-center tabular-nums">{r.values[ci] ?? "—"}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            ))}</div>)}
          </div>
        ))}
        <div className="space-y-2">{SETTLEMENT_NARRATIVE_LABELS.map(([k, label]) => (
          <div key={k}><div className="border-2 border-b-0 border-sheet-ink px-2 py-1 text-xs font-bold">{label}</div>
            <Textarea aria-label={label} rows={2} readOnly={readOnly} className="rounded-none border-2 border-sheet-ink" value={n[k] ?? ""} onChange={(e) => setN({ ...n, [k]: e.target.value })} />
          </div>
        ))}</div>
      </div>
    </div>
  );
}