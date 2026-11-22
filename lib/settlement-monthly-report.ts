import type { ActivitySection } from "@/lib/funder-reports.functions";
import type { Narrative } from "@/lib/funder-reports-export";
import type { Tint } from "@/lib/counselling-monthly-report";

export type SettlementReportData = {
  orgName: string; department: string; worker: string | null;
  from: string; to: string; ytdFrom: string; sections: ActivitySection[];
};
export const SETTLEMENT_NARRATIVE_LABELS: [keyof Omit<Narrative, "program" | "submitted">, string][] = [
  ["cultural", "Cultural activities offered this month"], ["successes", "Successes"], ["challenges", "Challenges"],
  ["plans", "Plans / ideas for next month"], ["incidents", "Incident reports"], ["meetings", "Meetings attended"],
  ["referrals", "Referrals and partner agencies"], ["events", "Events attended"], ["organized", "Meetings / events organized by the program"],
  ["comments", "Comments"],
];
const TINTS: Tint[] = ["mint", "pink", "green", "orange", "lavender", "peach", "sky", "yellow", "orchid", "blue", "lime"];

/** Presentation only: preserve the server's section order, labels, rows and figures. */
export function settlementReportBands(sections: ActivitySection[]) {
  const blocks = sections.map((section, i) => ({ ...section, tint: TINTS[i % TINTS.length] ?? "pink" as Tint }));
  return blocks.reduce<{ left: typeof blocks; right: typeof blocks }[]>((bands, block, i) => {
    if (i % 2 === 0) bands.push({ left: [block], right: [] });
    else bands[bands.length - 1]?.right.push(block);
    return bands;
  }, []);
}
export const settlementTotals = (section: ActivitySection) =>
  section.columns.map((_, i) => section.rows.reduce((total, row) => total + (row.values[i] ?? 0), 0));