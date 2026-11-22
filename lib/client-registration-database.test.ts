import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// Exercise the deployed predicate used by both the registration RPC and insert trigger.
const matches = async (existing: string | null, incoming: string | null): Promise<boolean> => {
  const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const url = process.env['VITE_SUPABASE_URL'];
  const key = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  assert.ok(url && key, "Database test requires the project environment and an authorized session");
  const response = await fetch(`${url}/rest/v1/rpc/client_registration_identity_matches`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${minted.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ first_a: " Mohammad ", last_a: "Ahmadi", dob_a: existing, first_b: "mohammad", last_b: " AHMADI ", dob_b: incoming }),
  });
  assert.equal(response.status, 200, "Authenticated identity predicate must be callable");
  const result = await response.json();
  assert.equal(typeof result, "boolean");
  return result;
};

test("same normalized name and known birth date are a duplicate", async () => {
  assert.equal(await matches("1990-01-01", "1990-01-01"), true);
});
test("same-name people with different birth dates are distinct", async () => {
  assert.equal(await matches("1990-01-01", "1991-01-01"), false);
});
test("an existing missing birth date cannot block a same-name registration", async () => {
  assert.equal(await matches(null, "1990-01-01"), false);
});
test("an incoming missing birth date cannot establish a duplicate", async () => {
  assert.equal(await matches("1990-01-01", null), false);
});
test("two missing birth dates do not establish a duplicate", async () => {
  assert.equal(await matches(null, null), false);
});