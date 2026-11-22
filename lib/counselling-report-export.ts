// Excel builder for the Counselling Monthly Activity Report (exceljs, loaded on demand).
// Sheet 1 reproduces the manager's template cell layout: left tables in A–E, right tables in G–K.
import { CR_SECTIONS, answerText } from "@/lib/counselling-report-schema";
import type { CounsellingSubmission } from "@/lib/counselling-reports.functions";
import { CR_NARRATIVE_LABELS, TINT_HEX, metricCellTint, questionTint, type CrNarrative, type SheetBand, type SheetBlock, type Tint } from "@/lib/counselling-monthly-report";

const NAVY = "FF0F2A44", BORDER = "FFBFBFBF";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const tintFill = (t?: Tint) => (t ? fill(`FF${TINT_HEX[t]}`) : undefined);
const thin = { style: "thin" as const, color: { argb: BORDER } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const med = { style: "medium" as const, color: { argb: "FF000000" } };
const dash = { style: "dashed" as const, color: { argb: "FF000000" } };
const F = (bold = false) => ({ name: "Arial", size: 10, bold });

export type CrMeta = { orgName: string; department: string; who: string; from: string; to: string; ytdFrom: string; generatedBy: string };

export async function exportCounsellingExcel(meta: CrMeta, subs: CounsellingSubmission[], report: SheetBand[], n: CrNarrative) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ACN — Assistance Case Note";

  // Sheet 1: Monthly Activity Report (template layout)
  const ws = wb.addWorksheet("Monthly Activity Report", { properties: { tabColor: { argb: NAVY } } });
  [40.9, 22.6, 22.3, 17.9, 17.7, 9.1, 46.7, 13, 16.1, 15.7, 20.6].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.mergeCells("A1:K1");
  ws.getCell("A1").value = "ACN Monthly Activity Report";
  ws.getCell("A1").font = { name: "Arial", size: 12, bold: true };
  const details: [string, string][] = [
    ["Staff Name:", meta.who],
    ["Program:", n.program || meta.department],
    ["Period of Report", `${meta.from} to ${meta.to} (YTD from ${meta.ytdFrom})`],
    ["Date Submitted", n.submitted],
  ];
  details.forEach(([k, v], i) => {
    const r = 3 + i;
    ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = F(true); ws.getCell(r, 1).border = { left: med, top: med, bottom: med, right: med };
    ws.mergeCells(r, 2, r, 5);
    ws.getCell(r, 2).value = v; ws.getCell(r, 2).font = F(); ws.getCell(r, 2).border = { bottom: thin };
  });

  const drawSide = (blocks: SheetBlock[], c0: number, start: number) => {
    let y = start;
    blocks.forEach((b, bi) => {
      if (bi > 0) y++;
      if (b.title) {
        ws.mergeCells(y, c0, y, c0 + 4);
        const c = ws.getCell(y, c0);
        c.value = b.title; c.font = F(true); c.border = { left: med, top: med, bottom: med, right: med };
        const tf = tintFill(b.titleTint); if (tf) c.fill = tf;
        y++;
      }
      const h = ws.getCell(y, c0);
      h.value = b.heading || null; h.font = F(true); h.border = { left: med, top: med, bottom: med, right: med };
      h.alignment = { wrapText: true, vertical: "middle" };
      const tf = tintFill(b.tint); if (tf) h.fill = tf;
      b.cols.forEach(([k, label], i) => {
        const c = ws.getCell(y, c0 + 1 + i);
        c.value = label; c.font = F(true); c.border = { left: dash, top: dash, bottom: dash, right: dash };
        c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
        const metricFill = tintFill(metricCellTint(b, k)); if (metricFill) c.fill = metricFill;
      });
      ws.getRow(y).height = Math.max(ws.getRow(y).height ?? 15, 30);
      y++;
      for (const r of b.rows) {
        const l = ws.getCell(y, c0);
        l.value = r.label; l.font = F(true); l.border = { left: med, right: med, bottom: thin };
        l.alignment = { wrapText: true, vertical: "top" };
        const labelFill = tintFill(b.labelTint); if (labelFill) l.fill = labelFill;
        b.cols.forEach(([k], i) => {
          const c = ws.getCell(y, c0 + 1 + i);
          c.value = r[k] ?? null; c.font = F(); c.border = { left: dash, top: dash, bottom: dash, right: dash };
          c.alignment = { horizontal: "center", vertical: "top" };
          const valueFill = tintFill(b.valueTints?.[k]); if (valueFill) c.fill = valueFill;
        });
        y++;
      }
    });
    return y;
  };

  let row = 8;
  for (const band of report) {
    if (band.title) {
      ws.mergeCells(row, 1, row, 11);
      const c = ws.getCell(row, 1);
      c.value = band.title; c.font = F(true); c.border = { left: med, top: med, bottom: med, right: med };
      const tf = tintFill(band.tint); if (tf) c.fill = tf;
      row++;
    }
    row = Math.max(drawSide(band.left, 1, row), drawSide(band.right, 7, row)) + 1;
  }

  for (const [k, label] of CR_NARRATIVE_LABELS) {
    ws.mergeCells(row, 1, row, 11);
    const l = ws.getCell(row, 1);
    l.value = label; l.font = F(true); l.border = { left: med, top: med, right: med };
    row++;
    ws.mergeCells(row, 1, row, 11);
    const v = ws.getCell(row, 1);
    v.value = n[k] || ""; v.font = F(); v.alignment = { wrapText: true, vertical: "top" };
    v.border = { left: med, bottom: med, right: med };
    ws.getRow(row).height = 60;
    row++;
  }
  ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Sheet 2: individual responses in the same paired, tinted template layout.
  // Keep every recorded answer; these are responses, not aggregated monthly figures.
  const rs = wb.addWorksheet("Responses", { properties: { tabColor: { argb: `FF${TINT_HEX.mint}` } } });
  [40.9, 22.6, 22.3, 17.9, 17.7, 9.1, 46.7, 13, 16.1, 15.7, 20.6].forEach((w, i) => { rs.getColumn(i + 1).width = w; });
  rs.mergeCells("A1:K1");
  rs.getCell("A1").value = `${meta.orgName} — Counselling Monthly Activity Report — Responses`;
  rs.getCell("A1").font = { name: "Arial", size: 12, bold: true };
  rs.mergeCells("A2:K2");
  rs.getCell("A2").value = `${meta.department} · ${meta.who} · ${meta.from} to ${meta.to} · Generated by ${meta.generatedBy}`;
  rs.getCell("A2").font = F();
  rs.getCell("A2").alignment = { wrapText: true };
  rs.getRow(2).height = 30;

  let responseRow = 4;
  const sorted = subs.slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const submission of sorted) {
    if (responseRow > 4) rs.getRow(responseRow - 1).addPageBreak();
    rs.mergeCells(responseRow, 1, responseRow, 11);
    const heading = rs.getCell(responseRow, 1);
    heading.value = `${submission.date} — ${submission.worker}`;
    heading.font = F(true); heading.fill = tintFill("mint") ?? fill(NAVY); heading.border = box;
    responseRow++;
    rs.mergeCells(responseRow, 1, responseRow, 11);
    const client = rs.getCell(responseRow, 1);
    client.value = `Client: ${submission.client} · Client file: ${submission.clientFile}`;
    client.font = F(); client.alignment = { wrapText: true }; client.border = box;
    rs.getRow(responseRow).height = 30;
    responseRow += 2;

    const drawResponses = (section: (typeof CR_SECTIONS)[number], c0: number, start: number) => {
      rs.mergeCells(start, c0, start, c0 + 4);
      const caption = rs.getCell(start, c0);
      caption.value = section.title; caption.font = F(true); caption.border = box;
      caption.fill = tintFill(questionTint(section.questions[0]?.id ?? "")) ?? tintFill("mint") ?? fill(NAVY);
      let y = start + 1;
      for (const question of section.questions) {
        rs.mergeCells(y, c0 + 1, y, c0 + 4);
        const label = rs.getCell(y, c0);
        label.value = question.label; label.font = F(true); label.border = box;
        label.alignment = { wrapText: true, vertical: "top" };
        const tf = tintFill(questionTint(question.id)); if (tf) label.fill = tf;
        const value = rs.getCell(y, c0 + 1);
        const text = answerText(question, submission.answers);
        value.value = text; value.font = F(); value.border = box;
        value.alignment = { wrapText: true, vertical: "top" };
        rs.getRow(y).height = Math.max(rs.getRow(y).height ?? 15, 30, Math.ceil(question.label.length / 35) * 15, Math.ceil(text.length / 65) * 15);
        y++;
      }
      return y;
    };
    for (let i = 0; i < CR_SECTIONS.length; i += 2) {
      const left = CR_SECTIONS[i];
      if (!left) continue;
      const right = CR_SECTIONS[i + 1];
      responseRow = Math.max(drawResponses(left, 1, responseRow), right ? drawResponses(right, 7, responseRow) : responseRow) + 1;
    }
    responseRow += 2;
  }
  rs.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  rs.pageSetup.printArea = `A1:K${Math.max(2, responseRow - 1)}`;

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = `Counselling-Monthly-Activity-Report_${meta.who.replace(/\W+/g, "-")}_${meta.from}_${meta.to}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
