/* Plans for employers: free hiring, invitation allowances, sponsored listings, placement fees, teams, analytics, reports and billing. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo } from "../server/seed.js";
import * as coreMod from "../server/core.js";

const servers = [];
after(() => { for (const s of servers) s.close(); });
async function start(env = {}, extra = {}) {
  const cfg = loadConfig({ skipDotEnv: true, isolated: true, env: { NODE_ENV: "test", ADMIN_PHONES: "+12025550199", ...env }, values: { powBits: 0, anthropicKey: "" } });
  const db = openDb(":memory:"), texts = [];
  seedDemo(db, () => {});
  const app = createApp({ cfg, db, log: () => {}, sms: async (to, body) => { texts.push({ to, body }); }, ...extra }), server = http.createServer(app);
  await new Promise(r => server.listen(0, "127.0.0.1", r)); servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const lastCode = phone => { const t = [...texts].reverse().find(x => x.to === phone); return t && /(\d{6})/.exec(t.body)[1]; };
  const client = () => {
    let cookie = "";
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { "content-type": "application/json", "x-shaghilni": "1", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, body: json, text };
    };
    return { get: p => call("GET", p), post: (p, b = {}) => call("POST", p, b), put: (p, b) => call("PUT", p, b), del: p => call("DELETE", p) };
  };
  const login = async (phone, role = "seeker") => {
    const c = client(); const r = await c.post("/api/auth/code", { phone });
    assert.equal((await c.post("/api/auth/verify", { phone, code: lastCode(r.body.phone), role, accept: true })).status, 200);
    return c;
  };
  const core = typeof coreMod.loadCore === "function" ? coreMod.loadCore() : coreMod.core || coreMod.default;
  return { db, texts, client, login, app, core };
}
async function publish(S, admin, e, over = {}) {
  const job = (await e.post("/api/employer/jobs", { job: { ...JOB, ...over }, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`); return job.id;
}
const STUDENT = { v: 1, role: "seeker", name: "Omar Nabil Al-Khatib", email: "omar@example.com", gov: "homs", langs: ["ar", "en"],
  edu: { status: "student", uni: "homs", fac: "petroleum", year: 4, grad: 2027 },
  exp: [{ id: "e1", role: "Field intern", org: "Orontes Energy", start: "2025-06", end: "2025-09", bullets: ["Logged pressure readings at 12 wells every day"] }],
  acts: [], skills: ["Excel", "AutoCAD"], certs: [] };
const GRAD = { ...STUDENT, name: "Lina Haddad", email: "lina@example.com", edu: { status: "bachelor", uni: "damascus", fac: "business", year: 0, grad: 2023 } };
const JOB = { title: { en: "Field trainee" }, gov: "homs", type: "intern", level: "entry", pay: [1500000, 2000000], langs: ["ar"], summary: { en: "Train with our field team." } };
const inDays = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
async function employer(S, admin, phone, name, verify = true) {
  const e = await S.login(phone, "employer");
  await e.put("/api/employer/company", { company: { name: { en: name }, gov: "homs", regNo: `REG-${name}`, contactName: `Contact ${name}`, whatsapp: phone } });
  await e.post("/api/employer/company/submit");
  if (!verify) return { e };
  const co = (await admin.get("/api/admin/companies?status=pending")).body.companies.find(c => c.name.en === name);
  await admin.post(`/api/admin/companies/${co.id}/verify`, { screened: true });
  const job = (await e.post("/api/employer/jobs", { job: JOB, submit: true })).body.job;
  await admin.post(`/api/admin/jobs/${job.id}/approve`);
  return { e, jobId: job.id };
}


const inviteJob = (e, sid, jobId) => e.post(`/api/employer/students/${sid}/invite`, { kind: "job", jobId });
async function seekerOpen(S, phone) { const s = await S.login(phone); await s.put("/api/me/profile", { profile: GRAD }); await s.put("/api/me/recruit", { open: true }); const id = S.db.get("SELECT id FROM users WHERE phone = ?", "+963" + phone.replace(/\D/g, "").replace(/^0/, "")).id; return { s, id }; }
const hire = async (e, appId) => { for (const st of ["shortlisted", "interview", "hired"]) { const r = await e.put(`/api/employer/applications/${appId}`, { status: st }); if (r.status !== 200) throw new Error("move " + st + ": " + JSON.stringify(r.body)); } };
const cid = (S, name) => S.db.get("SELECT id FROM companies WHERE json_extract(data, '$.name.en') = ?", name).id;

test("plans: hiring stays free, invitations have a monthly allowance, and plans lift it", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 760 001", "Qasioun Advisory");
  const jid = (await e.get("/api/employer")).body.jobs[0].id, plan = (await e.get("/api/employer")).body.plan;
  assert.deepEqual([plan.plan, plan.limits.invites, plan.usage.invites], ["free", 5, 0]);
  const people = []; for (let i = 0; i < 6; i++) people.push(await seekerOpen(S, `0933 76${i} 00${i}`));
  for (let i = 0; i < 5; i++) assert.equal((await inviteJob(e, people[i].id, jid)).status, 200);
  assert.equal((await inviteJob(e, people[5].id, jid)).body.error, "invite_quota", "the free allowance is five a month");
  assert.equal((await admin.post(`/api/admin/companies/${cid(S, "Qasioun Advisory")}/plan`, { plan: "pro", months: 1, amountSyp: 4000 })).status, 200);
  assert.equal((await inviteJob(e, people[5].id, jid)).status, 200, "Pro lifts it");
  const p2 = (await e.get("/api/employer/plan")).body; assert.equal(p2.plan, "pro"); assert.equal(p2.charges[0].kind, "plan");
  assert.equal((await e.post("/api/employer/plan/request", { plan: "enterprise" })).body.error, "bad_pay_method", "an upgrade request says how the employer will pay");
  const req = await e.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet", note: "Call after 4pm" });
  assert.equal(req.status, 200); assert.match(req.body.ref, /^SHG-\d+-\d+$/, "with a reference to quote when paying");
  assert.equal((await e.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "usd" })).body.error, "plan_request_open");
  const mine = (await e.get("/api/employer/plan")).body.request; assert.deepEqual([mine.plan, mine.payMethod, mine.ref], ["enterprise", "wallet", req.body.ref]);
  const bill = (await admin.get("/api/admin/billing")).body.requests[0]; assert.deepEqual([bill.payMethod, bill.ref, bill.note], ["wallet", req.body.ref, "Call after 4pm"], "the admin sees how they'll pay, and the reference");
  assert.equal((await people[0].s.get("/api/employer/plan")).status, 403, "job seekers can't see employer plans");
});

test("plans: a placement fee applies only when a Free employer hires someone it found through search", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 761 001", "Qasioun Advisory");
  const jid = (await e.get("/api/employer")).body.jobs[0].id;
  const found = await seekerOpen(S, "0933 761 101"), direct = await seekerOpen(S, "0933 761 102");
  await inviteJob(e, found.id, jid);
  const inv = (await found.s.get("/api/me/invitations")).body.invitations[0];
  await found.s.post(`/api/me/invitations/${inv.id}/respond`, { answer: "yes" });
  for (const x of [found, direct]) assert.equal((await x.s.post(`/api/jobs/${jid}/apply`, { channel: "web", cvLang: "ar" })).status, 200);
  const apps = (await e.get(`/api/employer/jobs/${jid}/applications`)).body.applications;
  for (const a of apps) await hire(e, a.id);
  const aOf = uid => S.db.get("SELECT id FROM applications WHERE user_id = ? AND job_id = ?", uid, jid).id;
  const c1 = (await admin.post(`/api/admin/applications/${aOf(found.id)}/confirm-hire`, {})).body.charges;
  assert.equal(c1.length, 1); assert.equal(c1[0].kind, "hire_fee"); assert.equal(c1[0].amountSyp, Math.round((JOB.pay[0] + (JOB.pay[1] || JOB.pay[0])) / 2), "one month's pay, the middle of the range");
  assert.deepEqual((await admin.post(`/api/admin/applications/${aOf(direct.id)}/confirm-hire`, {})).body.charges, [], "hiring your own applicants is free");
  assert.deepEqual((await admin.post(`/api/admin/applications/${aOf(found.id)}/confirm-hire`, {})).body.charges, [], "confirming twice charges nothing more");
  const due = (await e.get("/api/employer/plan")).body.feesDue; assert.equal(due.n, 1);
  const pid = (await admin.post("/api/admin/programmes", { name: "Livelihoods pilot", rateUsd: 100 })).body.id;
  const b = (await admin.get("/api/admin/billing")).body; assert.equal(b.charges.length, 1); assert.equal(b.programmes[0].rateUsd, 100);
  assert.equal((await admin.post(`/api/admin/charges/${b.charges[0].id}/paid`)).status, 200);
  assert.equal((await e.get("/api/employer/plan")).body.feesDue.n, 0);
  // a donor programme pays per confirmed placement, whatever the employer's plan
  const { e: e2 } = await employer(S, admin, "0955 761 002", "Barada Logistics"); await admin.post(`/api/admin/companies/${cid(S, "Barada Logistics")}/plan`, { plan: "pro", months: 12 });
  const j2 = (await e2.get("/api/employer")).body.jobs[0].id, w = await seekerOpen(S, "0933 761 103");
  await w.s.post(`/api/jobs/${j2}/apply`, { channel: "web", cvLang: "ar" }); const a2 = S.db.get("SELECT id FROM applications WHERE user_id = ?", w.id).id;
  await hire(e2, a2);
  assert.deepEqual((await admin.post(`/api/admin/applications/${a2}/confirm-hire`, { programmeId: pid })).body.charges, [{ kind: "placement", amountUsd: 100, programme: "Livelihoods pilot" }]);
});

test("plans: sponsored listings are for paid plans, limited, labelled, and expire", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 762 001", "Qasioun Advisory");
  const jid = (await e.get("/api/employer")).body.jobs[0].id;
  assert.equal((await e.post(`/api/employer/jobs/${jid}/sponsor`, { on: true })).body.error, "plan_required");
  await admin.post(`/api/admin/companies/${cid(S, "Qasioun Advisory")}/plan`, { plan: "pro", months: 1 });
  const on = await e.post(`/api/employer/jobs/${jid}/sponsor`, { on: true }); assert.equal(on.status, 200); assert.ok(on.body.sponsoredUntil > Date.now() + 29 * 86400e3);
  assert.equal((await S.client().get("/api/jobs")).body.jobs.find(j => j.id === jid).sponsored, true, "the public listing says it's sponsored");
  const more = []; for (let i = 0; i < 2; i++) { const r = await e.post("/api/employer/jobs", { job: { ...JOB, title: { en: "Role " + i, ar: "دور " + i } }, submit: true }); await admin.post(`/api/admin/jobs/${r.body.job.id}/approve`); more.push(r.body.job.id); }
  assert.equal((await e.post(`/api/employer/jobs/${more[0]}/sponsor`, { on: true })).status, 200);
  assert.equal((await e.post(`/api/employer/jobs/${more[1]}/sponsor`, { on: true })).body.error, "sponsor_limit", "Pro includes two at a time");
  S.db.run("UPDATE jobs SET sponsored_until = ? WHERE id = ?", Date.now() - 1000, jid);
  assert.equal((await S.client().get("/api/jobs")).body.jobs.find(j => j.id === jid).sponsored, false, "and it ends by itself");
  assert.equal((await e.post(`/api/employer/jobs/${more[1]}/sponsor`, { on: true })).status, 200, "which frees the slot");
  // D-29: a sponsored listing that leaves the board (closed, edited, rejected) loses its sponsorship and frees the slot at once
  const until = id => S.db.get("SELECT sponsored_until FROM jobs WHERE id = ?", id).sponsored_until;
  assert.equal((await e.post(`/api/employer/jobs/${more[0]}/close`)).status, 200); assert.equal(until(more[0]), null, "closing ends the sponsorship");
  assert.equal((await e.post(`/api/employer/jobs/${jid}/sponsor`, { on: true })).status, 200, "and frees the slot");
  assert.equal((await e.put(`/api/employer/jobs/${more[1]}`, { job: { ...JOB, title: { en: "Role 1 edited" } } })).body.job.status, "draft"); assert.equal(until(more[1]), null, "editing ends it");
  assert.equal((await admin.post(`/api/admin/jobs/${jid}/reject`, { note: "Pay range unclear" })).status, 200); assert.equal(until(jid), null, "rejection ends it");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM jobs WHERE company_id = ? AND sponsored_until > ?", cid(S, "Qasioun Advisory"), Date.now()).n, 0, "no slot is held by a listing that is off the board");
  // D-28: switching a sponsorship off is in the audit log, like switching it on; a click on a listing that is not sponsored writes nothing
  const rows = () => S.db.all("SELECT entity_id AS id FROM audit WHERE action = 'job.unsponsored'").map(x => x.id);
  assert.equal((await e.post(`/api/employer/jobs/${more[0]}/reopen`)).body.job.status, "published");
  assert.equal((await e.post(`/api/employer/jobs/${more[0]}/sponsor`, { on: true })).status, 200);
  assert.deepEqual((await e.post(`/api/employer/jobs/${more[0]}/sponsor`, { on: false })).body, { ok: true, sponsoredUntil: null }); assert.equal(until(more[0]), null);
  assert.deepEqual(rows(), [more[0]], "one job.unsponsored row");
  assert.equal((await e.post(`/api/employer/jobs/${more[0]}/sponsor`, { on: false })).status, 200); assert.deepEqual(rows(), [more[0]], "switching off twice writes one row");
  assert.ok((await e.get("/api/employer/activity")).body.activity.some(x => x.action === "job.unsponsored"), "and the team activity log lists it");
});

test("plans: analytics for everyone, full analytics and reports with paid plans", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 763 001", "Qasioun Advisory");
  const basic = (await e.get("/api/employer/analytics")).body;
  assert.equal(basic.full, false); assert.equal(typeof basic.total.applications, "number"); assert.equal(basic.total.fromSearch, null, "every verified employer gets basic analytics; Pro adds the rest");
  assert.equal((await e.get("/api/employer/reports/placements")).body.error, "plan_required");
  await admin.post(`/api/admin/companies/${cid(S, "Qasioun Advisory")}/plan`, { plan: "enterprise", months: 12 });
  assert.equal((await e.get("/api/employer/analytics")).body.full, true);
  assert.ok(Array.isArray((await e.get("/api/employer/reports/placements")).body.rows));
  const comp = (await e.get("/api/employer/reports/compliance")).body.rows; assert.ok(comp.some(x => x.action === "company.verified"), "the compliance record includes verification");
});
