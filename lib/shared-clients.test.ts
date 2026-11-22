import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { ownsClientDetails, sharedIntake } from "./shared-clients";

describe("cross-department client privacy", () => {
  test("Settlement cannot read Counselling private client details", () => {
    assert.equal(ownsClientDetails({ isAdmin: false, departmentId: "settlement" }, "counselling"), false);
  });
  test("Counselling cannot read Settlement private client details", () => {
    assert.equal(ownsClientDetails({ isAdmin: false, departmentId: "counselling" }, "settlement"), false);
  });
  test("a department retains its own private details", () => {
    assert.equal(ownsClientDetails({ isAdmin: false, departmentId: "settlement" }, "settlement"), true);
  });
  test("shared setup and enrollment exclude assessment narratives", () => {
    assert.deepEqual(sharedIntake({ city: "Winnipeg", enrollments: [{ program: "Settlement" }], goals: "Private goal", intake_notes: "Private history", needs: { Health: "Private" } }), { city: "Winnipeg", enrollments: [{ program: "Settlement" }] });
  });
});