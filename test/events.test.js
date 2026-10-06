/* Events: careers days and fairs with sign-ups, tickets, check-in, attending companies and the after-event report. */
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


const profileAt = (uni, fac = "petroleum") => ({ ...GRAD, gov: "homs", edu: { ...(GRAD.edu || {}), status: "student", uni, fac, year: 3, grad: 2027 } });
const local = days => { const d = new Date(Date.now() + days * 86400e3 + 3 * 3600e3); return d.toISOString().slice(0, 16); };
const EV = (over = {}) => ({ title: { en: "Homs University Careers Day", ar: "يوم المهن في جامعة حمص" }, kind: "careers_day", startsLocal: local(10), place: { en: "Faculty of Petroleum Engineering", ar: "كلية هندسة البترول" }, gov: "homs", host: "Sample business council", uni: "homs", capacity: 2, ...over });

test("events: sign up for a ticket, and organisers check people in by code or QR", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  assert.equal((await admin.post("/api/organize/events", { event: EV({ startsLocal: local(-3) }), publish: true })).body.error, "invalid", "no events in the past");
  const ev = (await admin.post("/api/organize/events", { event: EV(), publish: true })).body.event;
  assert.deepEqual([ev.status, ev.capacity, ev.uni, ev.going], ["published", 2, "homs", 0]);
  const a = await S.login("0933 790 101"), b = await S.login("0933 790 102"), c = await S.login("0933 790 103");
  assert.equal((await a.post(`/api/events/${ev.id}/rsvp`)).body.error, "profile_required");
  for (const x of [a, b, c]) await x.put("/api/me/profile", { profile: profileAt("homs") });
  const ta = (await a.post(`/api/events/${ev.id}/rsvp`)).body.rsvp; assert.match(ta.code, /^[A-HJ-NP-Z2-9]{6}$/, "a readable six-character code");
  assert.ok(S.texts.some(x => x.body.includes(ta.code)), "the code also comes by text");
  assert.equal((await a.post(`/api/events/${ev.id}/rsvp`)).body.rsvp.code, ta.code, "signing up twice keeps the same ticket");
  await b.post(`/api/events/${ev.id}/rsvp`);
  assert.equal((await c.post(`/api/events/${ev.id}/rsvp`)).body.error, "event_full");
  await b.del(`/api/events/${ev.id}/rsvp`); assert.equal((await c.post(`/api/events/${ev.id}/rsvp`)).status, 200, "a cancelled place is freed");
  const pub = (await S.client().get("/api/events")).body.events.find(x => x.id === ev.id); assert.deepEqual([pub.going, pub.spotsLeft], [2, 0]);
  assert.equal((await a.get(`/api/events/${ev.id}`)).body.event.mine.code, ta.code);
  assert.equal((await a.get("/api/me/events")).body.tickets.length, 1);
  // check-in
  assert.equal((await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: ta.code.toLowerCase() })).body.already, false, "codes aren't case-sensitive");
  assert.equal((await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: `SHG-EV-${ev.id}-${ta.code}` })).body.already, true, "the QR content works, and a second scan says so");
  const tc = (await c.get(`/api/events/${ev.id}`)).body.event.mine.code;
  assert.equal((await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: `SHG-EV-${ev.id + 1}-${tc}` })).body.error, "wrong_event");
  assert.equal((await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: "ZZZZZZ" })).body.error, "ticket_not_found");
  const tb = S.db.get("SELECT code FROM event_rsvps WHERE status = 'cancelled'").code;
  assert.equal((await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: tb })).body.error, "ticket_cancelled");
  S.db.run("UPDATE event_rsvps SET code = 'Q7R8S9' WHERE event_id = ? AND code = ?", ev.id, tc);   // a code with digits, typed in lower case with Arabic-Indic and Persian digits (U-045)
  const typed = await admin.post(`/api/organize/events/${ev.id}/checkin`, { code: "q٧r٨s۹" }); assert.equal(typed.status, 200, typed.text); assert.equal(typed.body.already, false, "check-in reads Arabic-Indic digits");
  assert.equal((await a.get(`/api/events/${ev.id}`)).body.event.mine.checkedIn, true);
  assert.equal((await a.get("/api/organize/events")).status, 403, "job seekers can't organise");
  await a.del("/api/me"); assert.equal(S.db.get("SELECT COUNT(*) AS n FROM event_rsvps WHERE code = ?", ta.code).n, 0, "deleting an account deletes its tickets");
});

test("events: companies attend, meet signed-up candidates, and the report shows what happened next", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  const { e } = await employer(S, admin, "0955 791 001", "Qasioun Advisory"), { e: other } = await employer(S, admin, "0955 791 002", "Barada Logistics");
  const ev = (await admin.post("/api/organize/events", { event: EV({ capacity: 0, startsLocal: local(0.02) }), publish: true })).body.event;
  const st = await S.login("0933 791 101"); await st.put("/api/me/profile", { profile: profileAt("homs") }); await st.put("/api/me/recruit", { open: true });
  const hidden = await S.login("0933 791 102"); await hidden.put("/api/me/profile", { profile: profileAt("homs", "business") });
  for (const x of [st, hidden]) await x.post(`/api/events/${ev.id}/rsvp`);
  assert.equal((await e.post(`/api/employer/events/${ev.id}/attend`)).body.status, "requested");
  assert.equal((await e.get(`/api/employer/students?event=${ev.id}`)).body.error, "not_attending", "only confirmed companies see who's coming");
  const cid = S.db.get("SELECT company_id FROM event_companies").company_id;
  await admin.post(`/api/organize/events/${ev.id}/companies`, { companyId: cid, status: "confirmed" });
  assert.equal((await S.client().get(`/api/events/${ev.id}`)).body.event.companies[0].name.en, "Qasioun Advisory", "confirmed companies are on the event page");
  const met = (await e.get(`/api/employer/students?event=${ev.id}`)).body.students;
  assert.equal(met.length, 1, "attendees who let recruiters find them, and nobody else");
  assert.equal((await other.get(`/api/employer/students?event=${ev.id}`)).status, 403);
  const code = (await st.get(`/api/events/${ev.id}`)).body.event.mine.code; await admin.post(`/api/organize/events/${ev.id}/checkin`, { code });
  const jid = (await e.get("/api/employer")).body.jobs[0].id;
  await e.post(`/api/employer/students/${met[0].id}/invite`, { kind: "job", jobId: jid });
  await st.post(`/api/jobs/${jid}/apply`, { channel: "web", cvLang: "ar" });
  const app = S.db.get("SELECT id FROM applications WHERE job_id = ?", jid).id;
  for (const s of ["shortlisted", "interview", "hired"]) await e.put(`/api/employer/applications/${app}`, { status: s });
  await admin.post(`/api/admin/applications/${app}/confirm-hire`, {});
  const R = (await admin.get(`/api/organize/events/${ev.id}/report`)).body;
  assert.deepEqual([R.totals.registered, R.totals.checkedIn], [2, 1]); assert.deepEqual(R.byUni, [{ key: "homs", n: 1 }]);
  assert.deepEqual([R.companies[0].invites, R.companies[0].applications, R.companies[0].interviews, R.companies[0].hires], [1, 1, 1, 1], "what the company did next with the people it met");
  assert.equal(JSON.stringify(R).includes(GRAD.name), false, "the report has no names");
});

test("events: a confirmed company sees every attendee open to recruiters, however many newer profiles fill the first page (U-015)", async () => {
  const S = await start(), admin = await S.login("+12025550199"), { e } = await employer(S, admin, "0955 792 001", "Qasioun Advisory");
  const ev = (await admin.post("/api/organize/events", { event: EV({ capacity: 0, startsLocal: local(0.02) }), publish: true })).body.event;
  const st = await S.login("0933 792 101"); await st.put("/api/me/profile", { profile: profileAt("homs") }); await st.put("/api/me/recruit", { open: true }); await st.post(`/api/events/${ev.id}/rsvp`);
  await e.post(`/api/employer/events/${ev.id}/attend`);
  await admin.post(`/api/organize/events/${ev.id}/companies`, { companyId: S.db.get("SELECT company_id FROM event_companies").company_id, status: "confirmed" });
  const me = (await st.get("/api/me")).body.user.id, t0 = Date.now();
  S.db.tx(() => { for (let i = 1; i <= 60; i++) {   // sixty opted-in profiles, all newer than the attendee's, none of them signed up
    const uid = Number(S.db.run("INSERT INTO users (phone, role, lang, created_at) VALUES (?, 'seeker', 'ar', ?)", `+963933793${String(i).padStart(3, "0")}`, t0).lastInsertRowid);
    S.db.run("INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)", uid, JSON.stringify({ ...profileAt("homs"), name: `Filler ${i}`, recruit: { open: true } }), t0 + 1000 + i);
  } });
  assert.deepEqual((await e.get(`/api/employer/students?event=${ev.id}`)).body.students.map(x => x.id), [me], "the attendee is listed, and only the attendee");
});

test("events: a career office runs events only at its own university", async () => {
  const S = await start(), admin = await S.login("+12025550199");
  await admin.post("/api/admin/campus", { phone: "0944 792 001", uni: "homs" }); const office = await S.login("0944 792 001");
  const mine = (await office.post("/api/organize/events", { event: EV({ uni: "damascus" }), publish: true })).body.event;
  assert.equal(mine.uni, "homs", "a career office's events are always at its own university");
  const theirs = (await admin.post("/api/organize/events", { event: EV({ uni: "damascus" }), publish: true })).body.event;
  assert.equal((await office.get(`/api/organize/events/${theirs.id}`)).status, 403);
  assert.deepEqual((await office.get("/api/organize/events")).body.events.map(x => x.id), [mine.id]);
  assert.equal((await office.put(`/api/organize/events/${mine.id}`, { event: EV({ title: { en: "Engineering Careers Day" } }), status: "published" })).body.event.title.en, "Engineering Careers Day");
});
