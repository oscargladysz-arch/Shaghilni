/* Route policy, part 4: generated junk input over every POST, PUT and DELETE route, sent by a role the policy allows,
   so validation (not the role check) is what answers. Malformed JSON, wrong types, 100 KB strings, bidi and control
   characters, SQL metacharacters, prototype keys, deep nesting and huge arrays. Nothing may answer 5xx (apart from
   the deliberate "outside service unavailable" codes), leak a stack trace, path or SQL, or take long.
   Security test 3 keeps its hand-written list; this one is derived from the policy table, so a new route is covered
   the day it gets its row. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { POLICY, key } from "./policy/route-policy.js";
import { start, cast, closeAll, fill } from "./policy/harness.js";

after(closeAll);

const BIG = "x".repeat(100 * 1024), BIDI = "‮‭عمر‏\u0000\u001F⁦abc⁩﻿", SQL = "' OR 1=1; -- \"; DROP TABLE users; --";
const FIELDS = ["profile", "job", "company", "phone", "code", "items", "status", "note", "pow", "accept", "channel", "lang", "jobId", "screened", "cvLang", "alert", "kind", "event", "message", "decision", "role", "name",
  "plan", "months", "payMethod", "amountSyp", "amountUsd", "uni", "domain", "email", "open", "q", "dir", "lines", "on", "what", "rate", "programme", "programmeId", "answer", "companyId", "publish", "p", "r", "m", "next", "invoice", "submit", "text", "bullets", "resume", "id"];
const blast = v => Object.fromEntries(FIELDS.map(k => [k, v]));
const deepArr = JSON.parse("[".repeat(500) + "]".repeat(500));
const deepObj = JSON.parse('{"a":'.repeat(200) + "1" + "}".repeat(200));
const PAYLOADS = [
  undefined, null, [], "text", 123, true, 0, -1, "", { __proto__: null, polluted: true }, JSON.parse('{"__proto__":{"polluted":true}}'), JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'),
  blast(BIG), blast(BIDI), blast(SQL), blast(123), blast(true), blast(null), blast([]), blast({}), blast([BIG]), blast({ a: SQL }), blast(deepObj), { deep: deepArr }, deepArr, Array.from({ length: 20000 }, (_, i) => i),
  { profile: { name: BIDI, exp: [{ bullets: Array.from({ length: 5000 }, () => SQL) }] }, job: { pay: [BIG, {}], title: SQL, langs: {}, duties: "x" }, company: { regNo: SQL, name: { en: BIDI } }, event: { title: BIDI, startsLocal: SQL, capacity: -1 } },
  "{not json", "[", "null", '"str"', "{\"a\":1,}", "\u0000", BIG
];
const DELIBERATE = ["ai_unavailable", "ai_error", "ai_bad_json", "sms_failed", "sms_capped", "email_unavailable"];
const LEAK = /\bat [A-Za-z_$][\w$.<>]* \(|\/home\/|\/app\/|node:internal|node_modules|SELECT |INSERT |UPDATE |sqlite|SQLITE_|\.js:\d+/;
const destructiveLast = p => /(leave|transfer|membership|logout|\/api\/me$|team\/:phone|requests\/:phone|suspend|\/reject|withdraw|block|confirm-hire|checkin|verify-student$|\/verify$|\/rsvp|close|reopen|sponsor|plan$|charges)/.test(p.pattern) ? 1 : 0;

test("policy junk input: every POST, PUT and DELETE route survives malformed, hostile and oversized input from an allowed role", async () => {
  const S = await start(), C = await cast(S);
  const registered = new Set(S.app.routes().map(r => key(r.method, r.pattern)));
  const extraSeeker = await S.login("0944 900 009");   // throwaway: DELETE /api/me ends an account
  const actorFor = p => {
    if (/\/api\/me$/.test(p.pattern) && p.method === "DELETE") return extraSeeker;
    if (p.roles.includes("guest")) return S.client();   // public routes get a fresh guest each time (logout, sign-in, beacons)
    return C.actors[p.roles[0]];
  };
  const rows = POLICY.filter(p => p.method !== "GET" && registered.has(key(p.method, p.pattern))).sort((a, b) => destructiveLast(a) - destructiveLast(b));
  const problems = [], slow = []; let calls = 0, worst = 0;
  for (const p of rows) {
    const path = fill(p.pattern, C.ids), who = actorFor(p);
    for (const body of p.method === "DELETE" ? [undefined, "{not json", blast(SQL)] : PAYLOADS) {
      const r = await who.call(p.method, path, body);
      calls++; worst = Math.max(worst, r.ms);
      const shown = typeof body === "string" ? body.slice(0, 30) : JSON.stringify(body)?.slice(0, 60);
      const deliberate = DELIBERATE.includes(r.body && r.body.error);
      if (r.status >= 500 && !deliberate) problems.push(`${p.method} ${path} ${shown} → ${r.status} ${r.text.slice(0, 120)}`);
      if (r.body && r.body.error === "server_error") problems.push(`${p.method} ${path} ${shown} → server_error`);
      if (LEAK.test(r.text)) problems.push(`${p.method} ${path} ${shown} → leaks: ${r.text.slice(0, 160)}`);
      if (r.ms > 3000) slow.push(`${p.method} ${path} ${shown} took ${r.ms} ms`);
    }
  }
  console.log(`policy junk: ${calls} requests over ${rows.length} routes; slowest ${worst} ms`);
  assert.deepEqual(problems, [], "junk that crashed or leaked:\n" + problems.join("\n"));
  assert.deepEqual(slow, [], "junk that took too long:\n" + slow.join("\n"));
  assert.equal(({}).polluted, undefined, "no prototype pollution");
  assert.ok(calls > 2000, `${calls} requests`);
  const me = await C.seekerA.get("/api/me");
  assert.ok(me.body && me.body.user, `seeker A is still signed in: ${me.text.slice(0, 200)}`);
  assert.equal(me.body.profile && me.body.profile.name, "Seeker Alpha", `junk never overwrote a real profile: ${JSON.stringify(me.body.profile).slice(0, 300)}`);
});
