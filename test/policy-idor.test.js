/* Route policy, part 3 (IDOR): account B, in the same role as account A, cannot read or change A's resources through
   any id-bearing route, and never learns that they exist. Each refusal is paired with a positive check that A's
   resource is real and reachable by A, so a 404 is never vacuous. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll } from "./policy/harness.js";

after(closeAll);

test("policy IDOR: B cannot touch A's job, applicant, alert, invitation, payment, teammate, event, domain or partnership", async () => {
  const S = await start(), C = await cast(S), I = C.ids, enc = encodeURIComponent(I.phoneMemberA);
  // A's resources are real and reachable by A
  assert.equal((await C.A.e.get(`/api/employer/jobs/${I.jobA}/applications`)).body.applications[0].id, I.appA, "A sees its applicant");
  assert.ok((await C.seekerA.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA), "seeker A sees the invitation");
  assert.ok((await C.seekerA.get("/api/me/alerts")).body.alerts.some(a => a.id === I.alertA), "seeker A sees the alert");
  assert.equal((await C.A.e.get(`/api/employer/payments/${I.payA}`)).status, 200, "A sees its payment");
  assert.ok((await C.A.e.get("/api/employer/team")).body.members.some(m => m.phone === I.phoneMemberA), "A sees its recruiter");
  assert.equal((await C.officeA.get(`/api/organize/events/${I.eventA}`)).status, 200, "office A opens its event");
  assert.ok((await C.officeA.get("/api/campus")).body.domains.includes(I.domainA), "office A lists its domain");
  assert.ok((await C.officeA.get("/api/campus")).body.partners.some(p => p.companyId === I.companyA), "office A sees A's partnership request");
  const before = {
    app: S.db.get("SELECT status, employer_note FROM applications WHERE id = ?", I.appA), inv: S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA),
    job: S.db.get("SELECT status, data, sponsored_until FROM jobs WHERE id = ?", I.jobA), member: S.db.get("SELECT status, role FROM company_members WHERE phone = ?", I.phoneMemberA),
    event: S.db.get("SELECT status, data FROM events WHERE id = ?", I.eventA), alert: S.db.get("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", I.alertA).n,
    domain: S.db.get("SELECT COUNT(*) AS n FROM uni_domains WHERE domain = ?", I.domainA).n, partner: S.db.get("SELECT status FROM uni_partners WHERE company_id = ?", I.companyA),
    ticket: S.db.get("SELECT checked_in_at FROM event_rsvps WHERE code = ?", I.ticketA)
  };
  const B = C.B.e, attempts = [
    ["owner B", B, "PUT", `/api/employer/jobs/${I.jobA}`, { job: { title: { en: "Hijacked" } } }],
    ["owner B", B, "POST", `/api/employer/jobs/${I.jobA}/submit`, {}], ["owner B", B, "POST", `/api/employer/jobs/${I.jobA}/close`, {}], ["owner B", B, "POST", `/api/employer/jobs/${I.jobA}/reopen`, {}],
    ["owner B", B, "GET", `/api/employer/jobs/${I.jobA}/applications`], ["owner B", B, "PUT", `/api/employer/applications/${I.appA}`, { status: "rejected" }], ["owner B", B, "PUT", `/api/employer/applications/${I.appA}`, { note: "B was here" }],
    ["owner B", B, "POST", `/api/employer/jobs/${I.jobA}/sponsor`, { on: true }], ["owner B", B, "GET", `/api/employer/payments/${I.payA}`],
    ["owner B", B, "POST", `/api/employer/invitations/${I.invA}/withdraw`, {}],
    ["owner B", B, "PUT", `/api/employer/team/${enc}`, { role: "admin" }], ["owner B", B, "DELETE", `/api/employer/team/${enc}`], ["owner B", B, "POST", `/api/employer/team/requests/${enc}`, { decision: "yes", role: "admin" }],
    ["owner B", B, "POST", "/api/employer/team/transfer", { phone: I.phoneMemberA }],
    ["seeker B", C.seekerB, "POST", `/api/me/applications/${I.appA}/withdraw`, {}], ["seeker B", C.seekerB, "PUT", `/api/me/alerts/${I.alertA}`, { alert: { q: "mine now" }, channel: "sms" }], ["seeker B", C.seekerB, "DELETE", `/api/me/alerts/${I.alertA}`],
    ["seeker B", C.seekerB, "POST", `/api/me/invitations/${I.invA}/respond`, { answer: "yes" }], ["seeker B", C.seekerB, "POST", `/api/me/invitations/${I.invA}/block`, {}],
    ["office B", C.officeB, "GET", `/api/organize/events/${I.eventA}`], ["office B", C.officeB, "PUT", `/api/organize/events/${I.eventA}`, { event: { title: { en: "Hijacked" } } }],
    ["office B", C.officeB, "POST", `/api/organize/events/${I.eventA}/companies`, { companyId: I.companyB, decision: "yes" }], ["office B", C.officeB, "POST", `/api/organize/events/${I.eventA}/checkin`, { code: I.ticketA }],
    ["office B", C.officeB, "GET", `/api/organize/events/${I.eventA}/report`], ["office B", C.officeB, "DELETE", `/api/campus/domains/${I.domainA}`], ["office B", C.officeB, "POST", `/api/campus/partners/${I.companyA}`, { decision: "yes" }],
    ["hiring manager of A", C.hiring, "PUT", `/api/employer/applications/${I.appA}`, { status: "shortlisted" }],   // a stage move needs the hire level
  ];
  const holes = [];
  for (const [who, c, method, path, body] of attempts) {
    const r = await c.call(method, path, body);
    if (r.status < 400 || r.status >= 500) holes.push(`${who} ${method} ${path} → ${r.status} ${r.text.slice(0, 80)}`);
  }
  assert.deepEqual(holes, [], "every one of these lets B read or change A's data:\n" + holes.join("\n"));
  // nothing of A's moved
  const after_ = {
    app: S.db.get("SELECT status, employer_note FROM applications WHERE id = ?", I.appA), inv: S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA),
    job: S.db.get("SELECT status, data, sponsored_until FROM jobs WHERE id = ?", I.jobA), member: S.db.get("SELECT status, role FROM company_members WHERE phone = ?", I.phoneMemberA),
    event: S.db.get("SELECT status, data FROM events WHERE id = ?", I.eventA), alert: S.db.get("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", I.alertA).n,
    domain: S.db.get("SELECT COUNT(*) AS n FROM uni_domains WHERE domain = ?", I.domainA).n, partner: S.db.get("SELECT status FROM uni_partners WHERE company_id = ?", I.companyA),
    ticket: S.db.get("SELECT checked_in_at FROM event_rsvps WHERE code = ?", I.ticketA)
  };
  assert.deepEqual(after_, before, "A's data is exactly as it was");
  // lists never carry the other side's items
  assert.ok(!(await C.seekerB.get("/api/me/applications")).body.applications.some(a => a.id === I.appA));
  assert.ok(!(await C.seekerB.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA));
  assert.ok(!(await B.get("/api/employer")).body.jobs.some(j => j.id === I.jobA));
  assert.ok(!(await B.get("/api/employer/invitations")).body.invitations.some(i => i.id === I.invA));
  assert.ok(!(await C.officeB.get("/api/organize/events")).body.events.some(e => e.id === I.eventA));
  const campusB = (await C.officeB.get("/api/campus")).body;
  assert.ok(!campusB.domains.includes(I.domainA) && !campusB.partners.some(p => p.companyId === I.companyA), "office B sees neither A's domain nor A's partnership request");
  console.log(`policy IDOR: ${attempts.length} cross-account attempts refused, A's rows unchanged`);
});

test("policy revocation: a career office removed by the admin loses every organiser route, even after signing in again (D-11)", async () => {
  const S = await start(), C = await cast(S);
  const officeB = (await C.admin.get("/api/admin/campus")).body.offices.find(o => o.uni === "damascus");
  assert.ok(officeB && officeB.userId, "office B exists");
  assert.equal((await C.officeB.get("/api/organize/events")).status, 200, "before removal the office organises");
  assert.equal((await C.admin.del(`/api/admin/campus/${officeB.userId}`)).status, 200);
  assert.equal((await C.officeB.get("/api/organize/events")).status, 401, "its sessions end at once");
  const again = await S.login("0944 900 302");   // the number can still sign in: it is an ordinary account now
  for (const [method, path, body] of [["GET", "/api/organize/events"], ["POST", "/api/organize/events", { event: { title: { en: "x" } }, publish: true }], ["GET", `/api/organize/events/${C.ids.eventA}`], ["POST", `/api/organize/events/${C.ids.eventA}/checkin`, { code: C.ids.ticketA }], ["GET", "/api/campus"]]) {
    const r = await again.call(method, path, body);
    assert.ok(r.status === 403 || r.status === 401, `${method} ${path} after removal → ${r.status} ${r.text.slice(0, 80)}`);
  }
});
