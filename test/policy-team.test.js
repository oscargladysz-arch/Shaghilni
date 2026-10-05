/* Route policy, part 5 (teams): roles, invitations, join requests, removal, leaving, transfer, seats and the activity
   log, across two companies. Every refusal is paired with the allowed actor succeeding on the same resource, so a
   403/404/409 is never vacuous. "Recorded" assertions state today's behaviour and name the DEFECTS.md id or policy
   note, so the later fix has to touch the test. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, ADMIN_PHONE, JOB } from "./policy/harness.js";

after(closeAll);

const enc = p => encodeURIComponent(p);
const PH = { owner: "+963955900001", cadmin: "+963955900011", recruiter: "+963955900012", hiring: "+963955900013", ownerB: "+963955900002" };
// An employer account with no company that asks to join `companyId` with the given name.
const requester = async (S, phone, companyId, name) => { const c = await S.login(phone, "employer"); const r = await c.post(`/api/employer/companies/${companyId}/join`, { name }); assert.equal(r.status, 200, r.text); assert.equal(r.body.status, "requested"); return c; };
// Invite `phone` to the caller's company and sign the person in as a teammate.
const joined = async (S, owner, phone, name, role) => { const inv = await owner.post("/api/employer/team", { name, phone, role }); assert.equal(inv.status, 200, inv.text);
  const c = await S.login(phone, "employer"); const acc = await c.post("/api/employer/membership/accept"); assert.equal(acc.status, 200, acc.text); return c; };
const refused = async (c, method, path, body, code, msg) => { const r = await c.call(method, path, body); assert.equal(r.status, 403, `${msg}: ${method} ${path} → ${r.status} ${r.text.slice(0, 80)}`); assert.equal(r.body.error, code, msg); return r; };

test("policy team: a removed teammate and one who leaves lose every employer route at once, in the session they were signed in to", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const gone = async (who, c) => {
    const me = await c.get("/api/employer"); assert.equal(me.status, 200); assert.equal(me.body.company, null, `${who}: GET /api/employer shows no company`); assert.equal(me.body.me, null);
    const team = await c.get("/api/employer/team"); assert.equal(team.status, 409, `${who}: the team listing`); assert.equal(team.body.error, "no_company");
    for (const [method, path, body, status, code] of [["POST", "/api/employer/jobs", { job: { title: { en: "x" } } }, 409, "no_company"], ["GET", `/api/employer/jobs/${I.jobA}/applications`, undefined, 404, "not_found"],
      ["PUT", `/api/employer/applications/${I.appA}`, { note: "still here?" }, 404, "not_found"], ["POST", `/api/employer/jobs/${I.jobA}/close`, {}, 403, "role_forbidden"], ["GET", "/api/employer/plan", undefined, 409, "company_not_verified"],
      ["GET", "/api/employer/activity", undefined, 409, "no_company"], ["GET", "/api/employer/students", undefined, 409, "company_not_verified"], ["GET", "/api/employer/invitations", undefined, 409, "company_not_verified"],
      ["GET", "/api/employer/events", undefined, 409, "company_not_verified"], ["POST", "/api/employer/partners", { uni: "homs" }, 409, "company_not_verified"], ["POST", "/api/employer/team/leave", {}, 409, "no_company"]]) {
      const r = await c.call(method, path, body);
      assert.equal(r.status, status, `${who}: ${method} ${path} after removal → ${r.status} ${r.text.slice(0, 80)}`); assert.equal(r.body.error, code, `${who}: ${method} ${path}`);
    }
  };
  // before: both teammates work in A
  assert.equal((await C.recruiter.get("/api/employer")).body.company.name.en, "Policy Alpha"); assert.equal((await C.hiring.get("/api/employer")).body.me.role, "hiring_manager");
  assert.equal((await C.recruiter.get(`/api/employer/jobs/${I.jobA}/applications`)).body.applications[0].id, I.appA, "the recruiter sees A's applicant");
  // removal (by the company admin: manage level is enough for a non-admin)
  assert.equal((await C.cadmin.del(`/api/employer/team/${enc(PH.recruiter)}`)).status, 200);
  await gone("removed recruiter", C.recruiter);
  assert.equal((await C.A.e.get("/api/employer/team")).body.members.some(m => m.phone === PH.recruiter), false, "and is off the list");
  // leaving
  assert.equal((await C.hiring.post("/api/employer/team/leave")).status, 200);
  await gone("hiring manager who left", C.hiring);
  // signing in again does not bring the company back
  const again = await S.login("0955 900 012", "employer"); assert.equal((await again.get("/api/employer")).body.company, null); assert.equal((await again.get("/api/employer/team")).body.error, "no_company");
  // PUT /api/employer/company is the "no company yet: create one" path (route-policy note): it starts a new draft of their own and never reaches A's page
  assert.equal((await again.put("/api/employer/company", { company: { name: { en: "Policy Draft" }, gov: "aleppo" } })).status, 200);
  const mine = (await again.get("/api/employer")).body; assert.equal(mine.company.name.en, "Policy Draft"); assert.equal(mine.company.status, "draft"); assert.equal(mine.me.role, "owner");
  assert.equal((await C.A.e.get("/api/employer")).body.company.name.en, "Policy Alpha"); assert.equal(S.db.get("SELECT COUNT(*) AS n FROM companies WHERE owner_id = (SELECT id FROM users WHERE phone = ?)", PH.recruiter).n, 1);
  // the owner is refused by the leave route and keeps the company
  const own = await C.A.e.post("/api/employer/team/leave"); assert.equal(own.status, 409); assert.equal(own.body.error, "owner_cannot_leave");
  assert.equal((await C.A.e.get("/api/employer")).body.me.role, "owner");
  assert.deepEqual(S.db.all("SELECT action FROM audit WHERE entity = 'company' AND entity_id = ? AND action IN ('team.removed', 'team.left') ORDER BY id", I.companyA).map(x => x.action), ["team.removed", "team.left"], "both are audited");
});

test("policy team: after a transfer the old owner is an admin who cannot bill or transfer; the new owner can", async () => {
  const S = await start(), C = await cast(S), I = C.ids, old = C.A.e, next = C.cadmin;
  assert.equal((await old.get("/api/employer")).body.me.role, "owner");
  await refused(next, "POST", "/api/employer/team/transfer", { phone: PH.recruiter }, "role_forbidden", "an admin cannot hand the company over");
  await refused(next, "POST", "/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" }, "role_forbidden", "nor request a plan");
  const t = await old.post("/api/employer/team/transfer", { phone: PH.cadmin }); assert.equal(t.status, 200, t.text);
  assert.equal((await next.get("/api/employer")).body.me.role, "owner"); assert.equal((await old.get("/api/employer")).body.me.role, "admin", "the old owner stays on as an admin");
  const team = (await next.get("/api/employer/team")).body;
  assert.equal(team.owner.phone, PH.cadmin); assert.ok(team.members.some(m => m.phone === PH.owner && m.role === "admin"), "the old owner is listed as an admin"); assert.equal(team.seats.used, 4, "a transfer takes no seat");
  assert.equal(S.db.get("SELECT owner_id FROM companies WHERE id = ?", I.companyA).owner_id, (await next.get("/api/me")).body.user.id);
  // billing follows the ownership
  await refused(old, "POST", "/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" }, "role_forbidden", "the old owner cannot request plans");
  await refused(old, "POST", "/api/employer/plan/checkout", { plan: "enterprise", months: 1 }, "role_forbidden", "nor pay by card");
  await refused(old, "POST", "/api/employer/team/transfer", { phone: PH.owner }, "role_forbidden", "nor take the company back");
  const pr = await next.post("/api/employer/plan/request", { plan: "enterprise", payMethod: "wallet" }); assert.equal(pr.status, 200, pr.text);
  assert.equal((await next.get("/api/employer/plan")).body.request.plan, "enterprise", "the new owner's request is open");
  // the old owner, now an admin, is managed like any admin: the new owner may demote them, another admin may not
  await refused(old, "PUT", `/api/employer/team/${enc(PH.recruiter)}`, { role: "admin" }, "role_forbidden", "an admin cannot promote");
  assert.equal((await next.put(`/api/employer/team/${enc(PH.owner)}`, { role: "recruiter" })).status, 200, "the new owner changes the old owner's role");
  assert.equal((await old.get("/api/employer")).body.me.role, "recruiter");
  const back = await next.post("/api/employer/team/transfer", { phone: PH.owner }); assert.equal(back.status, 200, "the new owner may hand it back to any active member");
  assert.equal((await old.get("/api/employer")).body.me.role, "owner"); assert.equal((await next.get("/api/employer")).body.me.role, "admin");
  const ownerRows = S.db.all("SELECT COUNT(*) AS n FROM company_members WHERE company_id = ? AND status = 'active'", I.companyA)[0].n;
  assert.equal(ownerRows, 3, "two transfers leave exactly three member rows (admin, recruiter, hiring manager)");
  const acts = S.db.all("SELECT action FROM audit WHERE entity = 'company' AND entity_id = ? AND action = 'team.ownership_transferred'", I.companyA); assert.equal(acts.length, 2, "both transfers are audited");
});

test("policy team: recruiters and hiring managers manage nobody; a company admin manages everyone but admins and never transfers", async () => {
  const S = await start(), C = await cast(S), I = C.ids, owner = C.A.e;
  const asker = await requester(S, "0955 920 001", I.companyA, "Policy Asker"), askerPhone = "+963955920001";
  const admin2 = await joined(S, owner, "0955 920 002", "Policy Second Admin", "admin"), admin2Phone = "+963955920002";
  assert.ok((await owner.get("/api/employer/team")).body.requests.some(r => r.phone === askerPhone), "the join request is real");
  for (const [who, c] of [["recruiter", C.recruiter], ["hiring manager", C.hiring]]) {
    await refused(c, "POST", "/api/employer/team", { name: "X", phone: "0955 920 003", role: "recruiter" }, "role_forbidden", `${who} cannot invite`);
    await refused(c, "PUT", `/api/employer/team/${enc(PH.hiring)}`, { role: "recruiter" }, "role_forbidden", `${who} cannot change roles`);
    await refused(c, "DELETE", `/api/employer/team/${enc(PH.hiring)}`, undefined, "role_forbidden", `${who} cannot remove`);
    await refused(c, "POST", `/api/employer/team/requests/${enc(askerPhone)}`, { decision: "yes", role: "recruiter" }, "role_forbidden", `${who} cannot approve requests`);
    await refused(c, "POST", `/api/employer/team/requests/${enc(askerPhone)}`, { decision: "no" }, "role_forbidden", `${who} cannot decline requests`);
    await refused(c, "GET", "/api/employer/activity", undefined, "role_forbidden", `${who} cannot read the activity log`);
    await refused(c, "POST", "/api/employer/team/transfer", { phone: PH.cadmin }, "role_forbidden", `${who} cannot transfer`);
    assert.deepEqual((await c.get("/api/employer/team")).body.requests, [], `${who} is not shown the join requests`);
  }
  assert.equal(S.db.get("SELECT status FROM company_members WHERE phone = ?", askerPhone).status, "requested", "the request is untouched");
  assert.equal(S.db.get("SELECT role FROM company_members WHERE phone = ?", PH.hiring).role, "hiring_manager");
  // the company admin: manage level, but admins are the owner's alone (server/routes/team.js:62 "only the owner manages admins")
  const cadmin = C.cadmin;
  await refused(cadmin, "PUT", `/api/employer/team/${enc(admin2Phone)}`, { role: "recruiter" }, "role_forbidden", "an admin cannot demote another admin");
  await refused(cadmin, "DELETE", `/api/employer/team/${enc(admin2Phone)}`, undefined, "role_forbidden", "nor remove one");
  await refused(cadmin, "PUT", `/api/employer/team/${enc(PH.recruiter)}`, { role: "admin" }, "role_forbidden", "nor promote anyone to admin");
  await refused(cadmin, "POST", `/api/employer/team/requests/${enc(askerPhone)}`, { decision: "yes", role: "admin" }, "role_forbidden", "nor approve a request as admin");
  await refused(cadmin, "POST", "/api/employer/team/transfer", { phone: admin2Phone }, "role_forbidden", "nor transfer");
  // recorded: an admin MAY invite a new admin (test/team.test.js:119 "admins invite"); SECURITY.md:382 says only the owner approves admins, team.js:34 does not check
  const inv = await cadmin.post("/api/employer/team", { name: "Policy Third Admin", phone: "0955 920 004", role: "admin" }); assert.equal(inv.status, 200, inv.text);
  assert.equal((await cadmin.del(`/api/employer/team/${enc("+963955920004")}`)).status, 200, "and cancel that invitation");
  // and what the admin may do
  assert.equal((await cadmin.post("/api/employer/team", { name: "Policy Hire", phone: "0955 920 005", role: "hiring_manager" })).status, 200, "an admin invites");
  assert.equal((await cadmin.put(`/api/employer/team/${enc(PH.hiring)}`, { role: "recruiter" })).status, 200, "changes a non-admin's role");
  assert.equal((await cadmin.post(`/api/employer/team/requests/${enc(askerPhone)}`, { decision: "yes", role: "recruiter" })).status, 200, "approves a request as recruiter");
  assert.equal((await asker.get("/api/employer")).body.me.role, "recruiter");
  assert.equal((await cadmin.del(`/api/employer/team/${enc(askerPhone)}`)).status, 200, "removes a non-admin");
  assert.equal((await cadmin.get("/api/employer/activity")).status, 200, "and reads the activity log");
  // the owner alone touches admins
  assert.equal((await owner.put(`/api/employer/team/${enc(admin2Phone)}`, { role: "recruiter" })).status, 200);
  assert.equal((await owner.put(`/api/employer/team/${enc(admin2Phone)}`, { role: "admin" })).status, 200);
  assert.equal((await owner.del(`/api/employer/team/${enc(admin2Phone)}`)).status, 200);
  assert.equal((await admin2.get("/api/employer")).body.company, null);
});

test("policy team: a number that belongs to a job seeker, an admin, a career office, another company's owner, member or invitee cannot be invited (phone_taken)", async () => {
  const S = await start(), C = await cast(S), owner = C.A.e;
  assert.equal((await C.B.e.post("/api/employer/team", { name: "Beta Invitee", phone: "0955 920 011", role: "recruiter" })).status, 200);
  const betaMember = await joined(S, C.B.e, "0955 920 012", "Beta Member", "recruiter"); assert.equal((await betaMember.get("/api/employer")).body.company.name.en, "Policy Beta");
  const before = (await owner.get("/api/employer/team")).body.seats.used, textsTo = () => S.texts.filter(x => ["+963944900001", "+963944900301", ADMIN_PHONE, "+963955900002", "+963955920012"].includes(x.to)).length, sent = textsTo();
  for (const [who, phone] of [["job seeker", "0944 900 001"], ["Shaghilni admin", ADMIN_PHONE], ["career office", "0944 900 301"], ["B's owner", "0955 900 002"], ["B's member", "0955 920 012"], ["B's invitee", "0955 920 011"],
    ["own owner", "0955 900 001"], ["own member", "0955 900 012"]]) {
    const r = await owner.post("/api/employer/team", { name: "X", phone, role: "recruiter" });
    assert.equal(r.status, 409, `${who} ${phone} → ${r.status} ${r.text.slice(0, 80)}`); assert.equal(r.body.error, "phone_taken", who);
  }
  assert.equal((await owner.get("/api/employer/team")).body.seats.used, before, "refusals take no seat");
  assert.equal(textsTo(), sent, "no invitation text went to the seeker, the office, the admin or B's people");
  const ok = await owner.post("/api/employer/team", { name: "Fresh", phone: "0955 920 013", role: "recruiter" }); assert.equal(ok.status, 200, ok.text);
  assert.equal((await owner.get("/api/employer/team")).body.seats.used, before + 1, "a free number is invited");
  assert.equal((await owner.post("/api/employer/team", { name: "X", phone: "0955 920 013", role: "recruiter" })).body.error, "phone_taken", "and only once");
  assert.equal((await owner.post("/api/employer/team", { name: "X", phone: "abc", role: "recruiter" })).body.error, "invalid_phone");
});

test("policy team: on Free the third seat is refused; declining, cancelling and withdrawing free seats; a full team cannot approve a request", async () => {
  const S = await start(), C = await cast(S), B = C.B.e, I = C.ids;   // B is on Free: three seats counting the owner
  const seats = async () => (await B.get("/api/employer/team")).body.seats;
  assert.deepEqual(await seats(), { used: 1, limit: 3 });
  assert.equal((await B.post("/api/employer/team", { name: "One", phone: "0955 920 021", role: "recruiter" })).status, 200);
  assert.equal((await B.post("/api/employer/team", { name: "Two", phone: "0955 920 022", role: "hiring_manager" })).status, 200);
  const full = await B.post("/api/employer/team", { name: "Three", phone: "0955 920 023", role: "recruiter" });
  assert.equal(full.status, 409); assert.equal(full.body.error, "team_full"); assert.deepEqual(full.body.detail, { limit: 3 });
  assert.deepEqual(await seats(), { used: 3, limit: 3 }, "open invitations hold seats");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM company_members WHERE phone = ?", "+963955920023").n, 0, "nothing was written for the refused one");
  // a join request does not take a seat, but cannot be approved while the team is full
  const asker = await requester(S, "0955 920 024", I.companyB, "Beta Asker");
  assert.deepEqual(await seats(), { used: 3, limit: 3 }, "a request waits without a seat");
  const appr = await B.post(`/api/employer/team/requests/${enc("+963955920024")}`, { decision: "yes", role: "recruiter" }); assert.equal(appr.status, 409); assert.equal(appr.body.error, "team_full");
  assert.equal(S.db.get("SELECT status FROM company_members WHERE phone = ?", "+963955920024").status, "requested");
  // the invitee declines: the seat is free again
  const one = await S.login("0955 920 021", "employer"); assert.equal((await one.get("/api/employer")).body.pending.status, "invited");
  assert.equal((await one.post("/api/employer/membership/decline")).status, 200); assert.equal((await one.get("/api/employer")).body.pending, null);
  assert.deepEqual(await seats(), { used: 2, limit: 3 });
  assert.equal((await B.post("/api/employer/team", { name: "Three", phone: "0955 920 023", role: "recruiter" })).status, 200, "the third invitation now fits");
  // the owner cancels an invitation: the seat is free again
  assert.equal((await B.del(`/api/employer/team/${enc("+963955920022")}`)).status, 200); assert.deepEqual(await seats(), { used: 2, limit: 3 });
  assert.equal((await B.post(`/api/employer/team/requests/${enc("+963955920024")}`, { decision: "yes", role: "recruiter" })).status, 200, "and the request can be approved");
  assert.deepEqual(await seats(), { used: 3, limit: 3 }); assert.equal((await asker.get("/api/employer")).body.me.role, "recruiter");
  // a requester withdraws: no seat was held, the row is gone
  const asker2 = await requester(S, "0955 920 025", I.companyB, "Beta Asker Two"); assert.equal((await asker2.post("/api/employer/membership/cancel")).status, 200);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM company_members WHERE phone = ?", "+963955920025").n, 0);
  assert.deepEqual(S.db.all("SELECT action FROM audit WHERE entity = 'company' AND entity_id = ? AND action LIKE 'team.%' ORDER BY id", I.companyB).map(x => x.action),
    ["team.invited", "team.invited", "team.requested", "team.invite_declined", "team.invited", "team.invite_cancelled", "team.request_approved", "team.requested", "team.request_withdrawn"]);
  // on Pro the same company has ten
  assert.equal((await C.admin.post(`/api/admin/companies/${I.companyB}/plan`, { plan: "pro", months: 1 })).status, 200);
  assert.deepEqual(await seats(), { used: 3, limit: 10 });
});

test("policy team: a member of A never sees or acts on B's team; B's owner cannot approve, decline or cancel on A's team", async () => {
  const S = await start(), C = await cast(S), I = C.ids, A = C.A.e, B = C.B.e;
  const betaMember = await joined(S, B, "0955 920 031", "Beta Member", "recruiter"), betaPhone = "+963955920031";
  assert.equal((await B.post("/api/employer/team", { name: "Beta Invitee", phone: "0955 920 032", role: "recruiter" })).status, 200);
  const asker = await requester(S, "0955 920 033", I.companyA, "Alpha Asker"), askerPhone = "+963955920033";
  assert.equal((await A.post("/api/employer/team", { name: "Alpha Invitee", phone: "0955 920 034", role: "recruiter" })).status, 200);
  const bTeam = (await B.get("/api/employer/team")).body;
  assert.ok(bTeam.members.some(m => m.phone === betaPhone) && bTeam.invites.some(m => m.phone === "+963955920032"), "B's owner sees B's member and invitee");
  const phonesOf = t => [t.owner.phone, ...t.members.map(m => m.phone), ...t.invites.map(m => m.phone), ...t.requests.map(m => m.phone)];
  for (const [who, c] of [["owner A", A], ["admin of A", C.cadmin], ["recruiter of A", C.recruiter], ["hiring manager of A", C.hiring]]) {
    const t = (await c.get("/api/employer/team")).body, ph = phonesOf(t);
    assert.ok(!ph.includes(PH.ownerB) && !ph.includes(betaPhone) && !ph.includes("+963955920032"), `${who} never lists B's people: ${ph.join(" ")}`);
    assert.equal(t.owner.phone, PH.owner, `${who} sees A's owner`);
  }
  const bPh = phonesOf((await betaMember.get("/api/employer/team")).body); assert.ok(!bPh.includes(PH.owner) && !bPh.includes(PH.cadmin) && !bPh.includes(askerPhone), "B's member never lists A's people");
  // acting across the line: a 404 that never says the person exists
  const notFound = async (c, method, path, body, msg) => { const r = await c.call(method, path, body); assert.equal(r.status, 404, `${msg}: ${method} ${path} → ${r.status} ${r.text.slice(0, 80)}`); assert.equal(r.body.error, "not_found"); };
  await notFound(B, "POST", `/api/employer/team/requests/${enc(askerPhone)}`, { decision: "yes", role: "recruiter" }, "B's owner cannot approve A's join request");
  await notFound(B, "POST", `/api/employer/team/requests/${enc(askerPhone)}`, { decision: "no" }, "nor decline it");
  await notFound(B, "DELETE", `/api/employer/team/${enc("+963955920034")}`, undefined, "nor cancel A's invitation");
  await notFound(B, "PUT", `/api/employer/team/${enc(PH.cadmin)}`, { role: "recruiter" }, "nor change A's admin");
  await notFound(C.cadmin, "DELETE", `/api/employer/team/${enc(betaPhone)}`, undefined, "A's admin cannot remove B's member");
  await notFound(C.cadmin, "PUT", `/api/employer/team/${enc(betaPhone)}`, { role: "hiring_manager" }, "nor change their role");
  await notFound(C.cadmin, "DELETE", `/api/employer/team/${enc("+963955920032")}`, undefined, "nor cancel B's invitation");
  await notFound(A, "POST", "/api/employer/team/transfer", { phone: betaPhone }, "A's owner cannot hand A to B's member");
  assert.equal(S.db.get("SELECT status FROM company_members WHERE phone = ?", askerPhone).status, "requested");
  assert.deepEqual(S.db.all("SELECT company_id, role, status FROM company_members WHERE phone IN (?, ?, ?)", betaPhone, "+963955920032", "+963955920034").map(x => [x.company_id, x.role, x.status]),
    [[I.companyB, "recruiter", "active"], [I.companyB, "recruiter", "invited"], [I.companyA, "recruiter", "invited"]], "nothing moved");
  // the same calls from the right side succeed
  assert.equal((await A.post(`/api/employer/team/requests/${enc(askerPhone)}`, { decision: "yes", role: "hiring_manager" })).status, 200); assert.equal((await asker.get("/api/employer")).body.me.role, "hiring_manager");
  assert.equal((await A.del(`/api/employer/team/${enc("+963955920034")}`)).status, 200);
  assert.equal((await B.put(`/api/employer/team/${enc(betaPhone)}`, { role: "hiring_manager" })).status, 200); assert.equal((await B.del(`/api/employer/team/${enc("+963955920032")}`)).status, 200);
  assert.equal((await B.del(`/api/employer/team/${enc(betaPhone)}`)).status, 200); assert.equal((await betaMember.get("/api/employer")).body.company, null);
});

test("policy team: A's activity log never carries B's actions and names people, not numbers; a removed teammate is shown by number (U-007)", async () => {
  const S = await start(), C = await cast(S), I = C.ids, A = C.A.e, B = C.B.e;
  const log = async () => (await A.get("/api/employer/activity")).body.activity;
  const base = await log(); assert.ok(base.length >= 4, "A has activity from the cast");
  // B acts: invites, posts a job, changes a role
  const bm = await joined(S, B, "0955 920 041", "Beta Member", "recruiter");
  assert.ok((await bm.post("/api/employer/jobs", { job: { ...JOB, title: { en: "Beta clerk" } } })).body.job, "B's member posts a job");
  assert.equal((await B.put(`/api/employer/team/${enc("+963955920041")}`, { role: "hiring_manager" })).status, 200);
  const bLog = (await B.get("/api/employer/activity")).body.activity;
  assert.ok(bLog.some(x => x.action === "team.joined") && bLog.some(x => x.action === "team.role_changed") && bLog.some(x => x.action === "team.invited" && x.who === "Contact Policy Beta"), "B's own log has B's actions");
  const after1 = await log(); assert.deepEqual(after1, base, "A's log did not move");
  assert.ok(!after1.some(x => x.who === "Contact Policy Beta" || x.who === "Beta Member" || (x.job && x.job.en === "Beta clerk")), "no name or listing of B's");
  // A's people act and are named: the owner by the company's contact name (plans.js:36), teammates by the name they were added with
  assert.equal((await C.cadmin.post("/api/employer/team", { name: "Alpha Invitee", phone: "0955 920 042", role: "recruiter" })).status, 200);
  const job = (await C.recruiter.post("/api/employer/jobs", { job: { ...JOB, title: { en: "Alpha clerk" } } })).body.job; assert.ok(job && job.id);
  assert.equal((await C.hiring.put(`/api/employer/applications/${I.appA}`, { note: "Spoke on the phone." })).status, 200);
  const act = await log(), by = (action, extra = () => true) => act.find(x => x.action === action && extra(x));
  assert.deepEqual(act.filter(x => x.action === "team.invited" && x.role === "recruiter").map(x => x.who).sort(), ["Contact Policy Alpha", "Policy Admin"], "the admin by name, next to the owner's own invitation from the cast");
  assert.equal(by("job.created", x => x.job && x.job.en === "Alpha clerk").who, "Policy Recruiter", "the recruiter by name");
  assert.equal(by("team.invited", x => x.role === "admin").who, "Contact Policy Alpha", "the owner shows as the company's contact name (recorded: plans.js:36, 'Owner' when there is none)");
  assert.ok(!act.some(x => /\+?963\d{6}|\d{3} \d{3} \d{3}/.test(String(x.who))), "nobody is a phone number while they are on the team: " + act.map(x => x.who).join(", "));
  assert.deepEqual(act.filter(x => x.who === "Policy Hiring").map(x => x.action), ["team.joined"], "the hiring manager's note is not an entry (employer.js:156 audits moves only), their joining is");
  for (const x of act) assert.deepEqual(Object.keys(x).sort(), ["action", "at", "from", "job", "role", "to", "who"], "entries carry no actor id or phone field");
  // recorded (DEFECTS.md U-007): once removed, the recruiter's past entries name them by their full phone number (plans.js:38 falls back to u.phone when the member row is gone)
  assert.equal((await A.del(`/api/employer/team/${enc(PH.recruiter)}`)).status, 200);
  const gone = (await log()).find(x => x.action === "job.created" && x.job && x.job.en === "Alpha clerk");
  assert.equal(gone.who, PH.recruiter, "U-007: a removed teammate is shown to owners and admins as their number, not 'Policy Recruiter'");
});

test("policy team: who sees members' phone numbers in the team listing, by role (recorded)", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  assert.equal((await C.A.e.post("/api/employer/team", { name: "Alpha Invitee", phone: "0955 920 051", role: "recruiter" })).status, 200);
  await requester(S, "0955 920 052", I.companyA, "Alpha Asker");
  const seen = {};
  for (const [who, c] of [["owner", C.A.e], ["cadmin", C.cadmin], ["recruiter", C.recruiter], ["hiring", C.hiring]]) {
    const r = await c.get("/api/employer/team"); assert.equal(r.status, 200, who); const t = r.body;
    assert.equal(t.me.phone, PH[who], `${who} sees their own number`);
    seen[who] = { owner: t.owner.phone, members: t.members.map(m => m.phone).sort(), invites: t.invites.map(m => m.phone), requests: t.requests.map(m => m.phone), lastActive: t.members.every(m => "lastActive" in m) };
  }
  // recorded today (task item 8; lead cites DEFECTS.md U-121, the same view-level read of company data): every team role, the hiring manager
  // included, reads the owner's, every member's and every invitee's full phone number and last sign-in; join requests (name + number) go to manage only.
  const everyone = { owner: PH.owner, members: [PH.cadmin, PH.hiring, PH.recruiter].sort(), invites: ["+963955920051"], lastActive: true };
  assert.deepEqual(seen.owner, { ...everyone, requests: ["+963955920052"] });
  assert.deepEqual(seen.cadmin, { ...everyone, requests: ["+963955920052"] });
  assert.deepEqual(seen.recruiter, { ...everyone, requests: [] }, "a recruiter reads every number but not the join requests");
  assert.deepEqual(seen.hiring, { ...everyone, requests: [] }, "a hiring manager reads every number but not the join requests");
});
