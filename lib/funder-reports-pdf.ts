// PDF builders for the ACN Client Services Summary and Monthly Activity Report (jsPDF, loaded on demand).
import type { FunderRow } from "@/lib/funder-reports.functions";
import type { Narrative } from "@/lib/funder-reports-export";

type C = [number, number, number];
const NAVY: C = [15, 42, 68];
const TEAL: C = [14, 124, 123];
const ORANGE: C = [237, 125, 49];
const GREEN: C = [198, 224, 180];
const GREY: C = [217, 217, 217];
const ZEBRA: C = [244, 247, 250];
const BORDER: C = [191, 191, 191];
const INK: C = [28, 43, 56];
const MUTED: C = [91, 107, 123];
const BAND_H = 52;
const TOP = BAND_H + 12;
const COHORTS = ["Total", "First-Time Clients", "Returning Clients", "Continuing / Repeat Clients"];
const METRICS = ["Unique Clients", "Services", "Interactions"];
const NARRATIVE: (keyof Narrative)[] = ["cultural", "successes", "challenges", "plans", "incidents", "meetings", "referrals", "events", "organized"];
const NARRATIVE_LABELS: Record<keyof Narrative, string> = {
  program: "Program", submitted: "Date submitted", cultural: "Cultural activities offered this month", successes: "Successes",
  challenges: "Challenges", plans: "Plans / ideas for next month", incidents: "Incident reports", meetings: "Meetings attended",
  referrals: "Referrals and partner agencies", events: "Events attended", organized: "Meetings / events organized by the program",
  comments: "Comments",
};

async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}
const finalY = (doc: unknown, fallback: number) => (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
const slug = (s: string) => s.replace(/\W+/g, "-");

/** ACN — Client Services Summary as a landscape PDF (same cohorts and metrics as the Excel export). */
export async function exportAcnClientServicesPdf(d: {
  orgName: string; department: string; funder: string; generatedBy: string; generatedAt: string; from: string; to: string; rows: FunderRow[];
}) {
  const [{clientServicesMeta,clientServicesSheets},{exportSheetPdf}]=await Promise.all([import('./report-sheet'),import('./pdf-export')]);
  await exportSheetPdf(clientServicesMeta(d),clientServicesSheets(d.rows));
}

/** Settlement sheet uses the same paired tables and colours as the on-screen report. */
export async function exportActivityReportPdf(d: import("@/lib/settlement-monthly-report").SettlementReportData, n: Narrative) {
  const { jsPDF, autoTable } = await loadPdf();
  const { settlementReportBands, settlementTotals, SETTLEMENT_NARRATIVE_LABELS } = await import("@/lib/settlement-monthly-report");
  const { TINT_HEX } = await import("@/lib/counselling-monthly-report");
  const rgb = (hex: string): C => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 30, GAP = 14, HALF = (W - M * 2 - GAP) / 2;
  const band = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, BAND_H, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("ACN Monthly Activity Report — Settlement", M, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`${d.orgName} · ${d.from} to ${d.to} · YTD from ${d.ytdFrom}`, M, 38);
  };
  const common = { theme: "grid" as const, styles: { fontSize: 7, cellPadding: 3, textColor: INK, lineColor: BORDER, lineWidth: 0.5 }, didDrawPage: band };
  autoTable(doc, {
    ...common, startY: TOP, margin: { top: TOP, left: M, right: M, bottom: 36 },
    body: [["Staff Name:", d.worker ?? `Consolidated — ${d.department}`], ["Program:", n.program || d.department],
      ["Period of Report", `${d.from} to ${d.to} (YTD from ${d.ytdFrom})`], ["Date Submitted", n.submitted]],
    columnStyles: { 0: { cellWidth: 100, fontStyle: "bold" } },
  });
  let y = finalY(doc, TOP) + 14;
  for (const pair of settlementReportBands(d.sections)) {
    const needed = Math.max(...[...pair.left, ...pair.right].map((section) =>
      64 + section.rows.reduce((height, row) => height + 16 + Math.max(0, Math.ceil(row.label.length / 23) - 1) * 9, 0))) + 18;
    if (y + needed > H - 36 && y > TOP) { doc.addPage(); y = TOP; }
    const startPage = doc.getNumberOfPages();
    let endPage = startPage, endY = y;
    for (const [i, side] of [pair.left, pair.right].entries()) {
      doc.setPage(startPage);
      const x = M + i * (HALF + GAP);
      for (const section of side) {
        autoTable(doc, {
          ...common, startY: y, margin: { top: TOP, left: x, right: W - x - HALF, bottom: 36 }, tableWidth: HALF,
          head: [[section.title, ...section.columns]],
          body: [...section.rows.map((r) => [r.label, ...r.values]), ["Total", ...settlementTotals(section)]],
          headStyles: { fillColor: rgb(TINT_HEX[section.tint]), textColor: INK, fontStyle: "bold", valign: "middle", halign: "center" },
          columnStyles: { 0: { cellWidth: HALF * 0.36, fontStyle: "bold", halign: "left" } },
          didParseCell: (h) => {
            if (h.section === "body") {
              if (h.column.index > 0) h.cell.styles.halign = "center";
              if (h.row.index === section.rows.length) { h.cell.styles.fillColor = rgb(TINT_HEX.mint); h.cell.styles.fontStyle = "bold"; }
            }
          },
        });
        const page = doc.getCurrentPageInfo().pageNumber;
        const finish = finalY(doc, y);
        if (page > endPage) { endPage = page; endY = finish; }
        else if (page === endPage) endY = Math.max(endY, finish);
      }
    }
    doc.setPage(endPage);
    y = endY + 18;
  }
  doc.addPage();
  autoTable(doc, {
    ...common, startY: TOP, margin: { top: TOP, left: M, right: M, bottom: 36 },
    body: SETTLEMENT_NARRATIVE_LABELS.flatMap(([k, label]) => [
      [{ content: label, styles: { fontStyle: "bold" as const } }],
      [{ content: n[k] || " ", styles: { minCellHeight: 34, valign: "top" as const } }],
    ]),
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Confidential — internal use · Page ${page} of ${pages}`, W / 2, H - 18, { align: "center" });
  }
  doc.save(`Settlement-Monthly-Activity-Report_${slug(d.worker ?? `Consolidated-${d.department}`)}_${d.from}_${d.to}.pdf`);
}

/** Counselling Monthly Activity Report PDF: template layout — header block, Month/YTD tables, written highlights, then the submission list. */
export async function exportCounsellingReportPdf(
  meta: { orgName: string; department: string; who: string; from: string; to: string; ytdFrom: string; generatedBy: string },
  subs: import("@/lib/counselling-reports.functions").CounsellingSubmission[],
  report: import("@/lib/counselling-monthly-report").SheetBand[],
  n: import("@/lib/counselling-monthly-report").CrNarrative,
) {
  const { jsPDF, autoTable } = await loadPdf();
  const { CR_QUESTIONS, answerText } = await import("@/lib/counselling-report-schema");
  const { CR_NARRATIVE_LABELS, TINT_HEX, metricCellTint } = await import("@/lib/counselling-monthly-report");
  type Block = import("@/lib/counselling-monthly-report").SheetBlock;
  const rgb = (t?: keyof typeof TINT_HEX): C | undefined => {
    if (!t) return undefined;
    const h = TINT_HEX[t];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const BLACK: C = [0, 0, 0];
  const WHITE: C = [255, 255, 255];
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 30, GAP = 14, HALF = (W - 2 * M - GAP) / 2;
  const bottom = H - 36;
  const band = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, BAND_H, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("ACN Monthly Activity Report — Counselling", M, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(`${meta.orgName} · ${meta.department} · ${meta.from} to ${meta.to} · YTD from ${meta.ytdFrom}`, M, 38);
  };
  const styles = { fontSize: 6.5, cellPadding: 2, textColor: BLACK, fillColor: WHITE, lineColor: BLACK, lineWidth: 0.5 };
  doc.setTextColor(...INK);
  autoTable(doc, {
    startY: TOP, margin: { top: TOP, left: M, right: M, bottom: 36 }, didDrawPage: band,
    styles: { ...styles, fontSize: 8 }, theme: "grid", tableWidth: HALF,
    body: [
      ["Staff Name:", meta.who],
      ["Program:", n.program || meta.department],
      ["Period of Report", `${meta.from} to ${meta.to} (YTD from ${meta.ytdFrom})`],
      ["Date Submitted", n.submitted],
    ],
    columnStyles: { 0: { cellWidth: 110, fontStyle: "bold" } },
  });
  let y = finalY(doc, TOP) + 12;

  const blockH = (b: Block) => (b.rows.length + 1 + (b.title ? 1 : 0)) * 13 + 6;
  const sideH = (bs: Block[]) => bs.reduce((t, b) => t + blockH(b), 0);
  const drawBlock = (b: Block, x: number, startY: number) => {
    const tint = rgb(b.tint);
    const head: import("jspdf-autotable").RowInput[] = [];
    if (b.title) head.push([{ content: b.title, colSpan: b.cols.length + 1, styles: { halign: "left", fillColor: rgb(b.titleTint) ?? WHITE, fontSize: 7.5 } }]);
    head.push([
      { content: b.heading, styles: { halign: "left", fillColor: tint ?? WHITE } },
      ...b.cols.map(([k, l]) => ({ content: l, styles: { halign: "center" as const, fillColor: rgb(metricCellTint(b, k)) ?? WHITE } })),
    ]);
    autoTable(doc, {
      startY, margin: { top: TOP, left: x, right: W - x - HALF, bottom: 36 }, didDrawPage: band,
      tableWidth: HALF, theme: "grid", styles,
      headStyles: { fontStyle: "bold", textColor: BLACK, lineColor: BLACK, lineWidth: 0.8, valign: "middle" },
      head,
      body: b.rows.map((r) => [r.label, ...b.cols.map(([k]) => (r[k] === null ? "—" : String(r[k])))]),
      columnStyles: { 0: { cellWidth: HALF - b.cols.length * (b.cols.length > 2 ? 44 : 60), fontStyle: "bold" } },
      didParseCell: (h) => {
        if (h.section !== "body") return;
        if (h.column.index === 0) h.cell.styles.fillColor = rgb(b.labelTint) ?? WHITE;
        else {
          h.cell.styles.halign = "center";
          const col = b.cols[h.column.index - 1];
          h.cell.styles.fillColor = rgb(col ? b.valueTints?.[col[0]] : undefined) ?? WHITE;
        }
      },
    });
    return finalY(doc, startY) + 6;
  };

  for (const b of report) {
    const need = (b.title ? 18 : 0) + Math.max(sideH(b.left), sideH(b.right));
    if (y + need > bottom && y > TOP + 1) { doc.addPage(); band(); y = TOP; }
    if (b.title) {
      doc.setFillColor(...(rgb(b.tint) ?? WHITE)); doc.setDrawColor(...BLACK); doc.setLineWidth(0.8);
      doc.rect(M, y, W - 2 * M, 14, "FD");
      doc.setTextColor(...BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(b.title, M + 4, y + 10);
      y += 18;
    }
    const page = doc.getNumberOfPages();
    let yl = y;
    for (const blk of b.left) yl = drawBlock(blk, M, yl);
    const endPage = doc.getNumberOfPages();
    doc.setPage(page);
    let yr = y;
    for (const blk of b.right) yr = drawBlock(blk, M + HALF + GAP, yr);
    doc.setPage(Math.max(endPage, doc.getNumberOfPages()));
    y = Math.max(yl, yr) + 8;
  }

  autoTable(doc, {
    startY: y + 60 > bottom ? (doc.addPage(), band(), TOP) : y,
    margin: { top: TOP, left: M, right: M, bottom: 36 }, didDrawPage: band,
    theme: "grid", styles: { ...styles, fontSize: 8 },
    body: CR_NARRATIVE_LABELS.flatMap(([k, label]) => [
      [{ content: label, styles: { fontStyle: "bold" as const } }],
      [{ content: n[k] || " ", styles: { minCellHeight: 34, valign: "top" as const } }],
    ]),
  });

  const key = ["interaction_type", "activities", "referrals"].map((id) => CR_QUESTIONS.find((q) => q.id === id)!);
  const common = {
    margin: { top: TOP, left: M, right: M, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 3, textColor: INK, lineColor: BORDER, lineWidth: 0.4 },
    didDrawPage: band,
  };
  doc.addPage();
  autoTable(doc, {
    ...common,
    startY: TOP,
    head: [["Date", "Worker", "Client", "Interaction", "Activities", "Referrals"]],
    body: subs.map((s) => [s.date, s.worker, s.client, ...key.map((q) => answerText(q, s.answers))]),
    headStyles: { fillColor: NAVY },
    alternateRowStyles: { fillColor: ZEBRA },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Protected-B — confidential · Page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 18, { align: "center" });
  }
  doc.save(`Counselling-Monthly-Activity-Report_${slug(meta.who)}_${meta.from}_${meta.to}.pdf`);
}
