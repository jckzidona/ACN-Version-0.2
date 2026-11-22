// Excel builders for the ACN Client Services Summary and Monthly Activity Report (exceljs, loaded on demand).
import { SETTLEMENT_NARRATIVE_LABELS, settlementReportBands, settlementTotals, type SettlementReportData } from "@/lib/settlement-monthly-report";
import { TINT_HEX } from "@/lib/counselling-monthly-report";
import type { FunderRow } from "@/lib/funder-reports.functions";

const NAVY = "FF0F2A44", TEAL = "FF0E7C7B", ORANGE = "FFF4B183", GREEN = "FFC6E0B4", GREY = "FFD9D9D9", ZEBRA = "FFF4F7FA", WHITE = "FFFFFFFF", BORDER = "FFBFBFBF";
const FONT = "Arial";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: BORDER } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

async function save(wb: { xlsx: { writeBuffer: () => Promise<ArrayBuffer> } }, name: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const colL = (n: number) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export async function exportAcnClientServices(d: {
  orgName: string; department: string; funder: string; generatedBy: string; generatedAt: string; from: string; to: string; rows: FunderRow[];
}) {
  const [{clientServicesMeta,clientServicesSheets},{exportSheetWorkbook}]=await Promise.all([import('./report-sheet'),import('./sheet-excel-export')]);
  await exportSheetWorkbook(clientServicesMeta(d),clientServicesSheets(d.rows));
}

export type Narrative = {
  program: string; submitted: string; cultural: string; successes: string; challenges: string;
  plans: string; incidents: string; meetings: string; referrals: string; events: string; organized: string; comments?: string;
};

export async function exportActivityReport(d: SettlementReportData, n: Narrative) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ACN — Assistance Case Note";
  const ws = wb.addWorksheet("Monthly Activity Report");
  const bands = settlementReportBands(d.sections);
  const sideWidth = Math.max(5, ...d.sections.map((s) => s.columns.length + 1));
  const width = sideWidth * 2 + 1;
  for (let c = 1; c <= width; c++) ws.getColumn(c).width = c === sideWidth + 1 ? 4 : (c === 1 || c === sideWidth + 2 ? 38 : 16);
  ws.mergeCells(1, 1, 1, width);
  ws.getCell(1, 1).value = "ACN Monthly Activity Report — Settlement";
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  const details = [
    ["Staff Name:", d.worker ?? `Consolidated — ${d.department}`], ["Program:", n.program || d.department],
    ["Period of Report", `${d.from} to ${d.to} (YTD from ${d.ytdFrom})`], ["Date Submitted", n.submitted],
  ];
  let row = 3;
  details.forEach(([label, value]) => {
    const r = row++;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: FONT, size: 10, bold: true };
    ws.mergeCells(r, 2, r, sideWidth);
    ws.getCell(r, 2).value = value;
    ws.getCell(r, 2).font = { name: FONT, size: 10 };
  });
  row++;
  for (const band of bands) {
    const drawSide = (side: typeof band.left, c0: number) => {
      let r = row;
      for (const section of side) {
        const rows = [{ label: section.title, values: section.columns }, ...section.rows, { label: "Total", values: settlementTotals(section) }];
        rows.forEach((item, i) => {
          [item.label, ...item.values].forEach((value, ci) => {
            const cell = ws.getCell(r, c0 + ci);
            cell.value = value;
            cell.font = { name: FONT, size: 10, bold: i === 0 || ci === 0 || i === rows.length - 1 };
            cell.border = box;
            cell.alignment = { wrapText: true, vertical: "middle", horizontal: ci ? "center" : "left" };
            if (i === 0) cell.fill = fill(`FF${TINT_HEX[section.tint]}`);
            if (i === rows.length - 1) cell.fill = fill(`FF${TINT_HEX.mint}`);
          });
          const height = i === 0 ? 58 : Math.max(20, Math.ceil(item.label.length / 35) * 14);
          ws.getRow(r).height = Math.max(ws.getRow(r).height ?? 15, height);
          r++;
        });
      }
      return r;
    };
    row = Math.max(drawSide(band.left, 1), drawSide(band.right, sideWidth + 2)) + 2;
  }
  for (const [key, label] of SETTLEMENT_NARRATIVE_LABELS) {
    ws.mergeCells(row, 1, row, width);
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { name: FONT, size: 10, bold: true };
    ws.getCell(row, 1).border = box;
    row++;
    ws.mergeCells(row, 1, row, width);
    const cell = ws.getCell(row, 1);
    cell.value = n[key] || "";
    cell.font = { name: FONT, size: 10 };
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.border = box;
    ws.getRow(row).height = Math.max(60, Math.ceil((n[key] ?? "").length / 140) * 14);
    row++;
  }
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter.oddFooter = "&LConfidential — internal use&RPage &P of &N";
  const who = (d.worker ?? `Consolidated-${d.department}`).replace(/\W+/g, "-");
  await save(wb, `Settlement-Monthly-Activity-Report_${who}_${d.from}_${d.to}.xlsx`);
}
