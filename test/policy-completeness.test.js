/* Route policy, part 1: every registered route has a policy row and every row has a route, so a forgotten endpoint
   cannot slip past the access-control and junk-input tests (SECURITY.md, "Keeping this file true"). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "../server/http.js";
import { POLICY, ROLES, key } from "./policy/route-policy.js";
import { start, closeAll } from "./policy/harness.js";

after(closeAll);

test("policy: the router lists its routes with their pattern strings, and dispatch is unchanged", () => {
  const r = createRouter();
  r.get("/api/x/:id", () => 1); r.post("/api/y", () => 2);
  assert.deepEqual(r.routes(), [{ method: "GET", pattern: "/api/x/:id" }, { method: "POST", pattern: "/api/y" }]);
  assert.deepEqual(r.match("GET", "/api/x/7").params, { id: "7" });
  assert.deepEqual(r.match("PUT", "/api/y"), { methodNotAllowed: true });
  assert.equal(r.match("GET", "/nope"), null);
  r.routes().push({ method: "GET", pattern: "/evil" });
  assert.equal(r.routes().length, 2, "routes() returns a copy, not the live table");
});

test("policy: every registered JSON route has exactly one policy row, and every row names a registered route", async () => {
  const S = await start();
  const registered = S.app.routes();
  assert.ok(registered.length >= 108, `${registered.length} routes registered`);
  const have = new Map(registered.map(r => [key(r.method, r.pattern), r]));
  const rows = new Map();
  for (const p of POLICY) {
    assert.ok(!rows.has(key(p.method, p.pattern)), `duplicate policy row ${key(p.method, p.pattern)}`);
    rows.set(key(p.method, p.pattern), p);
    assert.ok(p.roles.length && p.roles.every(x => ROLES.includes(x)), `${key(p.method, p.pattern)} names unknown roles`);
  }
  const missingRows = [...have.keys()].filter(k => !rows.has(k));
  const deadRows = [...rows.keys()].filter(k => !have.has(k) && k !== "POST /api/auth/demo");   // the demo route exists only in development
  assert.deepEqual(missingRows, [], `registered routes without a policy row: ${missingRows.join(", ")}`);
  assert.deepEqual(deadRows, [], `policy rows for routes that no longer exist: ${deadRows.join(", ")}`);
  const D = await start({ env: { NODE_ENV: "development", DEMO_ACCOUNTS: "true" } });
  if (D.app.demoReady) { await D.app.demoReady; assert.ok(D.app.routes().some(r => key(r.method, r.pattern) === "POST /api/auth/demo"), "with demo accounts on, the demo route is registered and has its row"); }   // absent once the demo code is uninstalled
  console.log(`policy rows: ${rows.size}; registered routes: ${registered.length} (test mode) + the demo route in development`);
});
