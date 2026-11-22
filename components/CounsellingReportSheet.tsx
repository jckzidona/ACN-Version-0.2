// On-screen Counselling Monthly Activity Report, laid out like the manager's Excel template:
// title + details, then bands of two side-by-side tables, then written highlights.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CR_NARRATIVE_LABELS, metricCellTint, type CrNarrative, type SheetBand, type SheetBlock, type Tint } from "@/lib/counselling-monthly-report";

const BG: Record<Tint, string> = {
  pink: "bg-sheet-pink", mint: "bg-sheet-mint", green: "bg-sheet-green", orange: "bg-sheet-orange",
  lavender: "bg-sheet-lavender", yellow: "bg-sheet-yellow", lime: "bg-sheet-lime", sky: "bg-sheet-sky",
  orchid: "bg-sheet-orchid", peach: "bg-sheet-peach", blue: "bg-sheet-blue", rose: "bg-sheet-rose",
  manual: "bg-sheet-manual",
};
const bg = (t?: Tint) => t ? BG[t] : "bg-sheet";

function Block({ b }: { b: SheetBlock }) {
  const span = b.cols.length + 1;
  return (
    <table className="w-full border-collapse text-[11px] leading-tight">
      <thead>
        {b.title && (
          <tr>
            <th colSpan={span} className={`border-2 border-sheet-ink px-2 py-1 text-left text-xs font-bold ${b.titleTint ? BG[b.titleTint] : ""}`}>
              {b.title}
            </th>
          </tr>
        )}
        <tr>
          <th className={`border-2 border-sheet-ink px-2 py-1 text-left font-bold ${b.tint ? BG[b.tint] : ""}`}>{b.heading}</th>
          {b.cols.map(([k, label]) => (
            <th key={k + label} className={`w-[11%] border border-dashed border-sheet-ink px-1 py-1 text-center font-bold ${bg(metricCellTint(b, k))}`}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {b.rows.map((r) => (
          <tr key={r.label}>
            <td className={`border-x-2 border-b border-sheet-ink px-2 py-1 font-semibold ${bg(b.labelTint)}`}>{r.label}</td>
            {b.cols.map(([k]) => (
              <td key={k} className={`border border-dashed border-sheet-line px-1 py-1 text-center tabular-nums ${bg(b.valueTints?.[k])}`}>{r[k] ?? "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Side = ({ blocks }: { blocks: SheetBlock[] }) => (
  <div className="space-y-3">{blocks.map((b, i) => <Block key={`${b.heading}-${i}`} b={b} />)}</div>
);

export function CounsellingReportSheet({
  report, who, period, n, setN,
}: { report: SheetBand[]; who: string; period: string; n: CrNarrative; setN: (n: CrNarrative) => void }) {
  return (
    <div className="counselling-report-sheet mt-4 overflow-x-auto rounded-md border border-sheet-line bg-sheet p-4 text-sheet-ink">
      <div className="min-w-[640px] space-y-5">
        <h3 className="text-base font-bold">ACN Monthly Activity Report</h3>
        <dl className="grid max-w-xl grid-cols-[140px_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
          <dt className="font-bold">Staff Name:</dt><dd><Input className="h-8" value={who} readOnly disabled /></dd>
          <dt className="font-bold">Program:</dt>
          <dd><Input className="h-8" placeholder="e.g. GBV & NISW" value={n.program} onChange={(e) => setN({ ...n, program: e.target.value })} /></dd>
          <dt className="font-bold">Period of Report</dt><dd><Input className="h-8" value={period} readOnly disabled /></dd>
          <dt className="font-bold">Date Submitted</dt>
          <dd><Input className="h-8" type="date" value={n.submitted} onChange={(e) => setN({ ...n, submitted: e.target.value })} /></dd>
        </dl>

        {report.map((band, i) => (
          <div key={band.title ?? i} className="space-y-2">
            {band.title && (
              <div className={`border-2 border-sheet-ink px-2 py-1 text-xs font-bold ${band.tint ? BG[band.tint] : ""}`}>{band.title}</div>
            )}
            <div className="grid grid-cols-2 items-start gap-6">
              <Side blocks={band.left} />
              <Side blocks={band.right} />
            </div>
          </div>
        ))}

        <div className="space-y-2">
          {CR_NARRATIVE_LABELS.map(([k, label]) => (
            <div key={k}>
              <div className="border-2 border-b-0 border-sheet-ink px-2 py-1 text-xs font-bold">{label}</div>
              <Textarea rows={2} className="rounded-none border-2 border-sheet-ink" value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
