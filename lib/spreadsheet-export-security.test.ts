import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { exportSheetWorkbook } from "./sheet-excel-export";
import { exportStyledReport } from "./excel-export";
import { exportActivityReport, exportAcnClientServices } from "./funder-reports-export";
import { exportCounsellingExcel } from "./counselling-report-export";
import { CR_QUESTIONS } from "./counselling-report-schema";

const payload = '=HYPERLINK("https://example.invalid","test")';

async function verifyLiteralDownload(run: () => Promise<void>) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const blobs: Blob[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({ href: "", download: "", click() {} }),
  } });
  URL.createObjectURL = (blob) => { blobs.push(blob as Blob); return "blob:test"; };
  URL.revokeObjectURL = () => {};
  try {
    await run();
    assert.equal(blobs.length, 1);
    const blob = blobs[0];
    assert.ok(blob);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    let payloadCells = 0;
    workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
      const valueCell = cell.isMerged ? cell.master : cell;
      assert.notEqual(valueCell.type, ExcelJS.ValueType.Formula, `${sheet.name}:${cell.address} must not contain a formula`);
      if (typeof valueCell.value === "string" && valueCell.value.includes(payload)) {
        payloadCells++;
        assert.equal(valueCell.type, ExcelJS.ValueType.String);
      }
    })));
    assert.ok(payloadCells > 0, "The injected text must actually be present in the exported workbook");
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

test("paired spreadsheet builder stores formula-like category and metadata text as literal strings", async () => {
  await verifyLiteralDownload(() => exportSheetWorkbook(
    { title: payload, orgName: payload, department: payload, from: "2026-11-01", to: "2026-11-17", filename: "test", note: payload },
    [{ title: "Summary", tables: [{ title: payload, tint: "mint", headers: ["Category", "Count"], rows: [[payload, 1]] }] }],
  ));
});

test("Reports & Statistics exports literal staff, counselling and demographic text", async () => {
  await verifyLiteralDownload(() => exportStyledReport({
    orgName: payload, department: payload, from: "2026-11-01", to: "2026-11-17", totals: {},
    staffCols: [["name", "Staff"]], staff: [{ name: payload }], breakdowns: { Languages: [{ label: payload, value: 1 }] }, needs: [],
    counselling: { hasDepartment: true, totals: {}, cols: [["name", "Counsellor"]], counsellors: [{ name: payload }], breakdowns: {} },
  }));
});

test("Settlement Client Services Summary exports formula-like categories as text", async () => {
  await verifyLiteralDownload(() => exportAcnClientServices({
    orgName: payload, department: "Settlement", funder: payload, generatedBy: payload,
    generatedAt: "2026-11-17T00:00:00Z", from: "2026-11-01", to: "2026-11-17",
    rows: [{ attribute: "Language", category: payload, values: Array(12).fill(1) }],
  }));
});

test("Settlement live and saved monthly report builder exports narrative and interaction labels as text", async () => {
  await verifyLiteralDownload(() => exportActivityReport({
    orgName: "ACN", department: "Settlement", worker: payload, from: "2026-11-01", to: "2026-11-17", ytdFrom: "2026-04-01",
    sections: [{ title: "Interactions", columns: ["Month", "YTD"], rows: [{ label: payload, values: [1, 1] }] }],
  }, { program: payload, submitted: "2026-11-17", cultural: "", successes: payload, challenges: "", plans: "", incidents: "", meetings: "", referrals: "", events: "", organized: "", comments: payload }));
});

test("Counselling Monthly Activity and Responses sheets retain answers and narratives as literal text", async () => {
  const question = CR_QUESTIONS.find((q) => q.type === "text") ?? CR_QUESTIONS[0];
  assert.ok(question);
  await verifyLiteralDownload(() => exportCounsellingExcel(
    { orgName: "ACN", department: "Counselling", who: payload, generatedBy: payload, from: "2026-11-01", to: "2026-11-17", ytdFrom: "2026-04-01" },
    [{ id: "test", date: "2026-11-17", submittedAt: "2026-11-17", workerId: "test", worker: payload, clientId: null, client: payload, clientFile: payload, answers: { [question.id]: payload } }],
    [], { program: payload, submitted: "2026-11-17", successes: payload, challenges: "", plans: "", incidents: "", meetings: "", agencies: "", organized: "", trainings: "" },
  ));
});