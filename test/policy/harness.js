/* Shared harness for the route-policy tests (test/policy-*.test.js): one in-memory app, the same client the other
   suites use, and the full cast of roles with one resource of each kind, so every route can be called by every role
   and every id-bearing route can be tried with somebody else's id. Not a test file itself (npm test runs test/*.test.js). */
import http from "node:http";
import assert from "node:assert/strict";
import { loadConfig } from "../../server/config.js";
import { openDb } from "../../server/db.js";
import { createApp } from "../../server/app.js";
import { seedDemo } from "../../server/seed.js";

export const ADMIN_PHONE = "+12025550199";
export const CARD = { PAY_PROVIDER: "test", PLAN_PRO_MONTHLY: "4000", PLAN_ENTERPRISE_MONTHLY: "20000" };
export const PROFILE = { v: 1, role: "seeker", name: "Omar Aziz", gov: "aleppo", langs: ["ar"], edu: { status: "bachelor", fac: "business" },
  exp: [{ id: "e1", role: "Cashier", org: "Souq shop", start: "2024-01", end: "2025-01", bullets: ["Handled cash for 200 customers a week"] }], skills: [] };
export const JOB = { title: { en: "Storekeeper" }, gov: "aleppo", type: "full", level: "entry", pay: [1800000, 2200000], langs: ["ar"], summary: { en: "Keep the stock records." } };
const local = days => { const d = new Date(Date.now() + days * 86400e3 + 3 * 3600e3); return d.toISOString().slice(0, 16); };
export const EV = (over = {}) => ({ title: { en: "Policy careers day", ar: "يوم المهن" }, kind: "careers_day", startsLocal: local(10), place: { en: "Faculty hall", ar: "قاعة الكلية" }, gov: "homs", host: "Sample business council", uni: "homs", capacity: 50, ...over });

const realFetch = globalThis.fetch;
const servers = [];
export const closeAll = () => { for (const s of servers) s.close(); };

export async function start({ env = {}, values = {}, seed = true } = {}) {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: ADMIN_PHONE, ...CARD, ...env }, values: { powBits: 0, anthropicKey: "", apiRateLimit: 1e6, writeRateLimit: 1e6, ...values } });
  const db = openDb(":memory:"), texts = [], logs = [];
  if (seed) seedDemo(db, () => {});
  const app = createApp({ cfg, db, log: m => logs.push(String(m)), sms: async (to, body) => { texts.push({ to, body }); } });
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
  function client(cookie0 = "") {
    let cookie = cookie0;
    const call = async (method, path, body, headers = {}) => {
      const t0 = Date.now();
      const res = await realFetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}), ...headers },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: res.status, body: json, text, headers: res.headers, ms: Date.now() - t0 };
    };
    return { call, get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b), del: p => call("DELETE", p),
             get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
  }
  async function login(phone, role = "seeker") {
    const c = client();
    const r = await c.post("/api/auth/code", { phone });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await c.post("/api/auth/verify", { phone, code: lastCode(r.body.phone), role, accept: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    return c;
  }
  return { cfg, db, app, base, texts, logs, lastCode, client, login };
}

export async function employerWithLiveJob(S, admin, phone, name) {
  const e = await S.login(phone, "employer");
  const put = await e.put("/api/employer/company", { company: { name: { en: name }, gov: "aleppo", regNo: `REG-${name}`, contactName: `Contact ${name}`, whatsapp: phone } });
  assert.equal(put.status, 200, put.text);
  assert.equal((await e.post("/api/employer/company/submit")).status, 200);
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === name);
  assert.ok(co, `${name} is awaiting verification`);
  assert.equal((await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true })).status, 200);
  const job = (await e.post("/api/employer/jobs", { job: JOB, submit: true })).body.job;
  assert.equal((await admin.post(`/api/admin/jobs/${job.id}/approve`)).status, 200);
  return { e, jobId: job.id, companyId: co.id };
}

/* The cast: every role the policy table names, plus one resource of every kind, all belonging to "A" (company A,
   seeker A, career office A) so that "B" of the same role can be shown to get nothing. */
export async function cast(S) {
  const admin = await S.login(ADMIN_PHONE);
  const A = await employerWithLiveJob(S, admin, "0955 900 001", "Policy Alpha");
  const B = await employerWithLiveJob(S, admin, "0955 900 002", "Policy Beta");
  const pro = await admin.post(`/api/admin/companies/${A.companyId}/plan`, { plan: "pro", months: 1 }); assert.equal(pro.status, 200, pro.text);   // Free has 3 seats; the cast needs four roles
  const member = async (owner, phone, name, role) => {
    const inv = await owner.post("/api/employer/team", { name, phone, role }); assert.equal(inv.status, 200, inv.text);
    const c = await S.login(phone, "employer"); const acc = await c.post("/api/employer/membership/accept"); assert.equal(acc.status, 200, acc.text); return c;
  };
  const cadmin = await member(A.e, "0955 900 011", "Policy Admin", "admin");
  const recruiter = await member(A.e, "0955 900 012", "Policy Recruiter", "recruiter");
  const hiring = await member(A.e, "0955 900 013", "Policy Hiring", "hiring_manager");
  const seeker = async (phone, name) => { const c = await S.login(phone); assert.equal((await c.put("/api/me/profile", { profile: { ...PROFILE, name } })).status, 200); assert.equal((await c.put("/api/me/recruit", { open: true })).status, 200); return c; };
  const seekerA = await seeker("0944 900 001", "Seeker Alpha"), seekerB = await seeker("0944 900 002", "Seeker Beta");
  const meA = (await seekerA.get("/api/me")).body.user, meB = (await seekerB.get("/api/me")).body.user;
  const cards = (await A.e.get("/api/employer/students")).body.students; const cardA = cards.find(x => x.id === meA.id); assert.ok(cardA, "seeker A is findable by A");
  const inv = await A.e.post(`/api/employer/students/${cardA.id}/invite`, { kind: "job", jobId: A.jobId, message: "Policy invite" }); assert.equal(inv.status, 200, inv.text); const invA = inv.body.invitation;   // invited first, then applies: the usual order
  const appA = (await seekerA.post(`/api/jobs/${A.jobId}/apply`, {})).body.application; assert.ok(appA && appA.id, "seeker A applied to A's job");
  const alertA = (await seekerA.post("/api/me/alerts", { alert: { q: "store", gov: "aleppo" }, channel: "sms" })).body.alert; assert.ok(alertA && alertA.id, "seeker A has an alert");
  await admin.post("/api/admin/campus", { phone: "0944 900 301", uni: "homs", name: "Policy Office Homs" }); const officeA = await S.login("0944 900 301");
  await admin.post("/api/admin/campus", { phone: "0944 900 302", uni: "damascus", name: "Policy Office Damascus" }); const officeB = await S.login("0944 900 302");
  const dom = await officeA.post("/api/campus/domains", { domain: "policy-homs.example" }); assert.equal(dom.status, 200, dom.text); const domainA = dom.body.domains[0];
  const evr = await officeA.post("/api/organize/events", { event: EV(), publish: true }); assert.equal(evr.status, 200, evr.text); const eventA = evr.body.event;
  assert.equal((await A.e.post("/api/employer/partners", { uni: "homs" })).status, 200, "A asked office A for a partnership");
  const pay = await A.e.post("/api/employer/plan/checkout", { plan: "pro", months: 1 }); assert.equal(pay.status, 200, pay.text); const payA = pay.body.payment;
  const rsvpA = (await seekerA.post(`/api/events/${eventA.id}/rsvp`)).body.rsvp; assert.ok(rsvpA && rsvpA.code, "seeker A holds a ticket");
  const offices = (await admin.get("/api/admin/campus")).body;
  const officeAUser = (((offices && (offices.offices || offices.accounts)) || []).find(o => /Homs/.test(o.name || "")) || {}).userId || 0;
  const actors = { guest: S.client(), seeker: seekerA, owner: A.e, cadmin, recruiter, hiring, admin, office: officeA };
  const ids = { jobA: A.jobId, jobB: B.jobId, companyA: A.companyId, companyB: B.companyId, appA: appA.id, alertA: alertA.id, cardA: cardA.id, cardB: meB.id, invA: invA.id,
    eventA: eventA.id, domainA, uniA: "homs", payA, phoneMemberA: "+963955900012", ticketA: rsvpA.code, officeAUser, userA: meA.id, userB: meB.id };
  return { admin, A, B, cadmin, recruiter, hiring, seekerA, seekerB, officeA, officeB, actors, ids };
}

/* Fill a route pattern's parameters with A's ids (or something harmless where no resource of that kind is involved). */
export function fill(pattern, ids) {
  const p = pattern;
  const pick = () => {
    if (/^\/api\/me\/saved\/:jobId/.test(p) || /^\/api\/jobs\/:id/.test(p) || /^\/api\/employer\/jobs\/:id/.test(p) || /^\/api\/admin\/jobs\/:id/.test(p)) return { id: ids.jobA, jobId: ids.jobA };
    if (/applications\/:id/.test(p)) return { id: ids.appA };
    if (/^\/api\/me\/alerts\/:id/.test(p)) return { id: ids.alertA };
    if (/^\/api\/employer\/students\/:id/.test(p)) return { id: ids.cardA };
    if (/invitations\/:id/.test(p)) return { id: ids.invA };
    if (/^\/api\/employer\/payments\/:id/.test(p)) return { id: ids.payA };
    if (/^\/api\/employer\/team\/requests\/:phone/.test(p) || /^\/api\/employer\/team\/:phone/.test(p)) return { phone: encodeURIComponent(ids.phoneMemberA) };
    if (/membership\/:answer/.test(p)) return { answer: "accept" };
    if (/^\/api\/employer\/companies\/:id\/join/.test(p)) return { id: ids.companyB };
    if (/reports\/:kind/.test(p)) return { kind: "placements" };
    if (/^\/api\/admin\/campus\/domains\/:uni\/:domain/.test(p)) return { uni: ids.uniA, domain: ids.domainA };
    if (/^\/api\/campus\/domains\/:domain/.test(p)) return { domain: ids.domainA };
    if (/^\/api\/campus\/partners\/:companyId/.test(p)) return { companyId: ids.companyA };
    if (/^\/api\/admin\/campus\/:userId/.test(p)) return { userId: ids.officeAUser || 999999 };
    if (/events\/:id/.test(p)) return { id: ids.eventA };
    if (/^\/api\/admin\/companies\/:id/.test(p)) return { id: ids.companyA };
    if (/^\/api\/admin\/charges\/:id\/:what/.test(p)) return { id: 1, what: "paid" };
    return {};
  };
  const vals = pick();
  return p.replace(/:(\w+)/g, (_, k) => String(vals[k] !== undefined ? vals[k] : 1));
}

/* A body that is valid-looking enough not to be refused as "bad input" before the permission check, per route. */
export function bodyFor(method, pattern) {
  if (method === "GET" || method === "DELETE") return undefined;
  if (/\/api\/employer\/company$/.test(pattern)) return { company: { name: { en: "X" } } };
  if (/\/api\/employer\/jobs$|\/api\/employer\/jobs\/:id$/.test(pattern)) return { job: JOB };
  if (/\/api\/me\/profile$/.test(pattern)) return { profile: PROFILE };
  if (/applications\/:id$/.test(pattern)) return { note: "x" };
  if (/\/api\/employer\/team$/.test(pattern)) return { name: "X", phone: "0955 999 999", role: "recruiter" };
  if (/team\/requests\/:phone$/.test(pattern)) return { decision: "no" };
  if (/team\/:phone$/.test(pattern)) return { role: "recruiter" };
  if (/team\/transfer$/.test(pattern)) return { phone: "+963955900012" };
  if (/companies\/:id\/join$/.test(pattern)) return { name: "X" };
  if (/students\/:id\/invite$/.test(pattern)) return { kind: "job", jobId: 1 };
  if (/\/api\/me\/recruit$/.test(pattern)) return { open: true };
  if (/invitations\/:id\/respond$/.test(pattern)) return { answer: "no" };
  if (/\/api\/me\/alerts$|\/api\/me\/alerts\/:id$/.test(pattern)) return { alert: { q: "x" }, channel: "sms" };
  if (/plan\/request$/.test(pattern)) return { plan: "pro", payMethod: "wallet" };
  if (/plan\/checkout$/.test(pattern)) return { plan: "pro", months: 1 };
  if (/jobs\/:id\/sponsor$/.test(pattern)) return { on: true };
  if (/\/api\/employer\/partners$/.test(pattern)) return { uni: "homs" };
  if (/campus\/partners\/:companyId$/.test(pattern)) return { decision: "yes" };
  if (/campus\/domains$/.test(pattern)) return { domain: "x.example", uni: "homs" };
  if (/\/api\/admin\/campus$/.test(pattern)) return { phone: "0944 999 999", uni: "homs", name: "X" };
  if (/verify-student$/.test(pattern)) return { email: "x@policy-homs.example" };
  if (/verify-student\/confirm$/.test(pattern)) return { code: "000000" };
  if (/organize\/events$|organize\/events\/:id$/.test(pattern)) return { event: EV() };
  if (/events\/:id\/companies$/.test(pattern)) return { companyId: 1, decision: "yes" };
  if (/events\/:id\/checkin$/.test(pattern)) return { code: "ZZZZZZ" };
  if (/companies\/:id\/verify$/.test(pattern)) return { screened: true };
  if (/companies\/:id\/(reject|suspend)$|jobs\/:id\/reject$/.test(pattern)) return { note: "x" };
  if (/companies\/:id\/plan$/.test(pattern)) return { plan: "pro", months: 1 };
  if (/\/api\/admin\/programmes$/.test(pattern)) return { name: "X", rate: 1 };
  if (/resume\/suggest$/.test(pattern)) return { jobId: 1, items: [] };
  if (/resume\/translate$/.test(pattern)) return { dir: "ar-en", lines: [] };
  if (/\/api\/me\/lang$/.test(pattern)) return { lang: "en" };
  if (/\/api\/auth\/code$/.test(pattern)) return { phone: "0944 999 998" };
  if (/\/api\/auth\/verify$/.test(pattern)) return { phone: "0944 999 998", code: "000000" };
  if (/\/api\/t$/.test(pattern)) return { p: "/", r: "" };
  if (/\/api\/t\/error$/.test(pattern)) return { m: "x" };
  return {};
}
