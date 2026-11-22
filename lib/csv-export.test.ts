import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvDocument } from "./csv-export";

for (const value of ["=1+1", "+1+1", "-1+1", "@SUM(1,2)", "  =1+1", "\t=1+1", "\r=1+1", "\n=1+1", "\u0000=1+1", "\ttext"]) {
  test(`CSV neutralizes formula/control prefix ${JSON.stringify(value)}`, () => {
    assert.equal(csvCell(value), `"'${value}"`);
  });
}

test("CSV preserves ordinary text, numbers, empty values and CSV quoting", () => {
  assert.equal(csvCell('Office, "visit"'), '"Office, ""visit"""');
  assert.equal(csvCell("Text/WhatsApp"), '"Text/WhatsApp"');
  assert.equal(csvCell("2026-11-17"), '"2026-11-17"');
  assert.equal(csvCell(12), '"12"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell("a\nb"), '"a\nb"');
});

test("case-note CSV neutralizes client identifiers, interaction types and worker names in every column", () => {
  const csv = csvDocument(
    ["case_note_id", "client_identifier", "interaction_type", "interaction_date", "status", "worker", "created_at"],
    [["note-1", "=1+1", "+1+1", "2026-11-17", "final", "@SUM(1,2)", "2026-11-17T00:00:00Z"]],
  );
  assert.equal(csv.split("\n")[1], '"note-1","\'=1+1","\'+1+1","2026-11-17","final","\'@SUM(1,2)","2026-11-17T00:00:00Z"');
});