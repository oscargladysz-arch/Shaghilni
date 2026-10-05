/* Route policy, part 2: every route × every role the policy does not allow answers 401, 403 or 404, never a success.
   Any 2xx here is a vulnerability (Stage 2 stop-the-line rule). The allowed roles are not exercised here: the
   feature suites and the IDOR test do that. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { POLICY, ROLES, key } from "./policy/route-policy.js";
import { start, cast, closeAll, fill, bodyFor } from "./policy/harness.js";

after(closeAll);

test("policy: no route answers a role the policy excludes (401 for guests, 403 or 404 for the wrong role)", async () => {
  const S = await start(), C = await cast(S);
  const registered = new Set(S.app.routes().map(r => key(r.method, r.pattern)));
  const unexpected = [], tried = [], seen = {};
  for (const p of POLICY) {
    if (!registered.has(key(p.method, p.pattern))) continue;   // the demo route in test mode
    for (const role of ROLES) {
      if (p.roles.includes(role)) continue;
      const path = fill(p.pattern, C.ids), body = bodyFor(p.method, p.pattern);
      const r = await C.actors[role].call(p.method, path, body);
      tried.push(`${role} ${p.method} ${path} → ${r.status}`);
      seen[r.status] = (seen[r.status] || 0) + 1;
      const want = role === "guest" ? [401, 403, 404] : [403, 404];
      if (!want.includes(r.status)) unexpected.push(`${role} ${p.method} ${p.pattern} → ${r.status} ${r.text.slice(0, 100)}`);
    }
  }
  console.log(`policy access: ${tried.length} role × route refusals checked; statuses ${JSON.stringify(seen)}`);
  assert.deepEqual(unexpected, [], "every one of these is a hole in the access control:\n" + unexpected.join("\n"));
  assert.ok(tried.length > 500, `${tried.length} refusals checked`);
});
