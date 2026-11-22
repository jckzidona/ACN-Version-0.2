import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

test("active Settlement worker can evaluate department scope and read monthly submissions", async () => {
  const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  assert.ok(url && key, "Requires the project environment and an authorized worker session");
  const headers = { apikey: key, Authorization: `Bearer ${minted.session.access_token}`, "Content-Type": "application/json" };
  const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${minted.user_id ?? minted.session.user.id}&select=department_id,status`, { headers });
  assert.equal(profileResponse.status, 200);
  const [profile] = await profileResponse.json();
  assert.equal(profile.status, "active");
  assert.ok(profile.department_id);
  const department = await fetch(`${url}/rest/v1/rpc/current_department_id`, { method: "POST", headers, body: "{}" });
  assert.equal(department.status, 200, "Authenticated department helper must remain callable by RLS");
  assert.equal(await department.json(), profile.department_id);
  const submissions = await fetch(`${url}/rest/v1/settlement_monthly_reports?select=id&limit=1`, { headers });
  assert.equal(submissions.status, 200, "Monthly submission policies must not fail with a permission error");
  assert.ok(Array.isArray(await submissions.json()));
});