/* A phone browser without JavaScript for the Lite policy tests: plain HTML forms, a cookie jar, the page's signed
   token. Copied from test/lite.test.js (the feature suite) so the policy tests don't import a test file; it takes
   the policy harness's server (`start()`), and can adopt an API client's session so the cast signs in once. */
import assert from "node:assert/strict";

export function browser(S) {
  const jar = {};
  const req = async (method, path, form, headers = {}) => {
    const t0 = Date.now();
    const body = form == null ? undefined : typeof form === "string" ? form : new URLSearchParams(Array.isArray(form) ? form : Object.entries(form)).toString();
    const res = await fetch(S.base + path, { method, redirect: "manual", body,
      headers: { ...(body !== undefined ? { "content-type": "application/x-www-form-urlencoded" } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "), ...headers } });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"), i = kv.indexOf("="), k = kv.slice(0, i), v = kv.slice(i + 1); if (!v || /Max-Age=0/i.test(c)) delete jar[k]; else jar[k] = v; }
    return { status: res.status, text: await res.text(), location: res.headers.get("location"), res, ms: Date.now() - t0 };
  };
  const csrf = html => (/name="csrf" value="([0-9a-f]{32})"/.exec(html) || [])[1];
  const b = { get: p => req("GET", p), post: (p, f, h) => req("POST", p, f, h), csrf, jar };
  b.adopt = client => { const m = /^shg_sid=([^;]+)/.exec(client.cookie || ""); assert.ok(m, "the API client is signed in"); jar.shg_sid = m[1]; return b; };
  b.signin = async (phone, role = "seeker", next = "") => {
    const pg = await b.get("/lite/signin" + (role === "employer" ? "?role=employer" : ""));
    const r1 = await b.post("/lite/signin", { csrf: csrf(pg.text), phone, consent: "1", role, next, pow_challenge: /name="pow_challenge" value="([^"]+)"/.exec(pg.text)[1], pow_nonce: "" });
    assert.match(r1.text, /name="code"/, "a code is sent");
    const ph = /name="phone" value="([^"]+)"/.exec(r1.text)[1];
    return b.post("/lite/signin/code", { csrf: csrf(r1.text), phone: ph, code: S.lastCode(ph), role, next });
  };
  return b;
}
