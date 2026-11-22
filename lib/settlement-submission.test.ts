import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { settlementMonth, settlementWorkerScope, settlementNarrativeSchema, blankSettlementNarrative } from "./settlement-submission";
import type { WorkContext } from "./authz";
const worker: WorkContext = { userId: "worker-a", organizationId: "org", departmentId: "settlement", fullName: "Worker A", roles: ["worker"], isManager: false, isAdmin: false };
describe("Settlement monthly submissions", () => {
  test("workers cannot request another worker's figures", () => {
    assert.equal(settlementWorkerScope(worker, "worker-b"), "worker-a");
    assert.equal(settlementWorkerScope(worker, null), "worker-a");
  });
  test("managers retain individual and consolidated reports", () => {
    assert.equal(settlementWorkerScope({ ...worker, isManager: true }, "worker-b"), "worker-b");
    assert.equal(settlementWorkerScope({ ...worker, isManager: true }, null), null);
  });
  test("report period covers the entire month including leap years", () => {
    assert.deepEqual(settlementMonth("2026-10"), { from: "2026-10-01", to: "2026-10-31" });
    assert.equal(settlementMonth("2028-02").to, "2028-02-29");
    assert.throws(() => settlementMonth("2026-13"));
  });
  test("program is required and month-end comments are retained", () => {
    assert.equal(settlementNarrativeSchema.safeParse(blankSettlementNarrative()).success, false);
    assert.equal(settlementNarrativeSchema.parse({ ...blankSettlementNarrative(), program: "Settlement", comments: "October highlights" }).comments, "October highlights");
  });
});