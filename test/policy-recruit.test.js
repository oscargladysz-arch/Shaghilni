/* Route policy, recruit family: candidate search, the "let recruiters find me" switch, invitations and blocking
   (server/routes/recruit.js). Every refusal here is paired with a positive control (the same resource reachable by
   the allowed actor), so a 403/404/409 is never vacuous. What test/recruit.test.js, test/policy-access.test.js and
   test/policy-idor.test.js already assert is not repeated: this file adds the exact codes, the sent-list shape, the
   company-state and team-level refusals, the caps and the "recorded today" behaviours (each with its DEFECTS id). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll } from "./policy/harness.js";

after(closeAll);
const inDays = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const EVENT = (title, days = 10) => ({ kind: "event", event: { title, date: inDays(days), place: "Faculty hall" } });
const PHONE_A = "+963944900001", PHONE_B = "+963944900002";

test("policy recruit: switching \"let recruiters find me\" off hides the card at once and ends the open invitations (D-32)", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  assert.ok((await C.A.e.get("/api/employer/students")).body.students.some(s => s.id === I.cardA), "control: A finds seeker A while the switch is on");
  assert.deepEqual((await C.seekerA.put("/api/me/recruit", { open: false })).body, { open: false });
  const list = (await C.A.e.get("/api/employer/students")).body.students;
  assert.ok(!list.some(s => s.id === I.cardA), "seeker A is gone from the search at once");
  assert.ok(list.some(s => s.id === I.cardB), "control: the search still lists seeker B, who is still opted in");
  const inv = await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, EVENT("Open day"));
  assert.deepEqual([inv.status, inv.body.error], [404, "not_found"], "an opted-out person cannot be invited, and the answer never says they exist");
  assert.ok(!(await C.A.e.get("/api/employer/students")).text.includes(PHONE_A.slice(4)), "no phone number anywhere in the search answer");
  // D-32: the invitation sent before the switch went off is withdrawn with it, so nothing more can reach the company through it
  const inbox = (await C.seekerA.get("/api/me/invitations")).body.invitations;
  assert.ok(!inbox.some(i => i.id === I.invA), "D-32: the open invitation leaves the inbox when the person opts out");
  const yes = await C.seekerA.post(`/api/me/invitations/${I.invA}/respond`, { answer: "yes" });
  assert.deepEqual([yes.status, yes.body.error], [409, "bad_transition"], "D-32: it can no longer be answered");
  const sent = (await C.A.e.get("/api/employer/invitations")).body.invitations.find(i => i.id === I.invA);
  assert.deepEqual([sent.status, sent.student.phone, sent.student.name.en], ["withdrawn", null, "Seeker A."], "the company sees it withdrawn, with the short name and no number");
  assert.deepEqual(S.db.all("SELECT data FROM audit WHERE action = 'invitation.withdrawn' AND entity_id = ?", I.invA).map(x => JSON.parse(x.data)), [{ reason: "opted_out" }], "the withdrawal is audited with its reason");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'recruit.closed' AND actor_id = ?", I.userA).n, 1, "the switch-off is audited");
});

test("policy recruit: a person who blocked company A cannot be found or invited by A (404), while B still can", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  assert.ok((await C.A.e.get("/api/employer/students")).body.students.some(s => s.id === I.cardA), "control: A finds seeker A before the block");
  assert.equal((await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, EVENT("Before the block"))).status, 200, "control: A can invite before the block");
  assert.equal((await C.seekerA.post(`/api/me/invitations/${I.invA}/block`)).status, 200);
  assert.ok(!(await C.A.e.get("/api/employer/students")).body.students.some(s => s.id === I.cardA), "A cannot find them any more");
  const inv = await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, EVENT("After the block"));
  assert.deepEqual([inv.status, inv.body.error], [404, "not_found"], "A cannot invite them, and the answer never says they exist");
  const job = await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, { kind: "job", jobId: I.jobA });
  assert.deepEqual([job.status, job.body.error], [404, "not_found"], "the block comes before every other check (not already_invited)");
  assert.deepEqual((await C.A.e.get("/api/employer/invitations")).body.invitations.filter(i => i.student.id === I.userA).map(i => i.status), ["declined", "declined"], "every open invitation from A is declined by the block");
  assert.ok((await C.B.e.get("/api/employer/students")).body.students.some(s => s.id === I.cardA), "B still finds them");
  const byB = await C.B.e.post(`/api/employer/students/${I.cardA}/invite`, { kind: "job", jobId: I.jobB, message: "Still welcome here" });
  assert.equal(byB.status, 200, byB.text);
  assert.deepEqual((await C.seekerA.get("/api/me/invitations")).body.invitations.filter(i => i.status === "new").map(i => i.company.id), [I.companyB], "only B's invitation is new in the inbox");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM recruiter_blocks WHERE user_id = ? AND company_id = ?", I.userA, I.companyA).n, 1);
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'recruiter.blocked' AND actor_id = ? AND entity_id = ?", I.userA, I.companyA).n, 1, "the block is audited");
});

test("policy recruit: a hiring manager gets 403 role_forbidden; a pending, missing or suspended company gets 409 company_not_verified on search, invite, sent list and withdraw", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const four = c => Promise.all([c.get("/api/employer/students"), c.post(`/api/employer/students/${I.cardA}/invite`, EVENT("Open day")), c.get("/api/employer/invitations"), c.post(`/api/employer/invitations/${I.invA}/withdraw`)]);
  // control: a recruiter (hire level) of the same company gets the search, the card and the sent list
  const asRecruiter = await four(C.recruiter);
  assert.deepEqual(asRecruiter.map(r => r.status), [200, 200, 200, 200], asRecruiter.map(r => r.text.slice(0, 80)).join("\n"));
  assert.ok(asRecruiter[0].body.students.some(s => s.id === I.cardA) && asRecruiter[2].body.invitations.some(i => i.id === I.invA));
  for (const r of await four(C.hiring)) assert.deepEqual([r.status, r.body], [403, { error: "role_forbidden", detail: { need: "hire" } }], "a hiring manager is refused with the level it lacks (D-03)");
  // a company awaiting verification, and an employer account with no company at all
  const pending = await S.login("0955 920 001", "employer");
  assert.equal((await pending.put("/api/employer/company", { company: { name: { en: "Policy Pending" }, gov: "homs", regNo: "REG-Policy Pending", contactName: "Contact Pending", whatsapp: "0955 920 001" } })).status, 200);
  assert.equal((await pending.post("/api/employer/company/submit")).status, 200);
  assert.ok((await C.admin.get("/api/admin/companies?status=pending")).body.companies.some(c => c.name.en === "Policy Pending"), "control: the company exists and is pending");
  for (const r of await four(pending)) assert.deepEqual([r.status, r.body.error], [409, "company_not_verified"]);
  for (const r of await four(await S.login("0955 920 002", "employer"))) assert.deepEqual([r.status, r.body.error], [409, "company_not_verified"], "no company at all");
  // a suspended company: it had an event invitation out, so the sent list would carry a number after a yes
  const sentB = await C.B.e.post(`/api/employer/students/${I.cardB}/invite`, EVENT("Beta open day"));
  assert.equal(sentB.status, 200, "control: B invites seeker B to an event while verified");
  assert.equal((await C.B.e.get("/api/employer/invitations")).body.invitations.length, 1, "control: B reads its sent list while verified");
  assert.equal((await C.admin.post(`/api/admin/companies/${I.companyB}/suspend`, { note: "Policy test suspension" })).status, 200);
  const suspended = await Promise.all([C.B.e.get("/api/employer/students"), C.B.e.post(`/api/employer/students/${I.cardB}/invite`, EVENT("Beta again")), C.B.e.get("/api/employer/invitations"), C.B.e.post(`/api/employer/invitations/${sentB.body.invitation.id}/withdraw`)]);
  for (const r of suspended) assert.deepEqual([r.status, r.body.error], [409, "company_not_verified"], "a suspended company is refused on all four (not U-022: nothing of the sent list is readable)");
  assert.ok(!suspended.some(r => r.text.includes(PHONE_B.slice(4)) || r.text.includes("Seeker Beta")), "nothing of the sent list leaks while suspended");
  // U-017: suspending the company withdraws its open invitations, so nobody hands over a number to a company under suspicion
  const invB = sentB.body.invitation.id;
  assert.ok(!(await C.seekerB.get("/api/me/invitations")).body.invitations.some(i => i.id === invB), "U-017: the suspended company's invitation leaves the inbox");
  const yes = await C.seekerB.post(`/api/me/invitations/${invB}/respond`, { answer: "yes" });
  assert.deepEqual([yes.status, yes.body.error], [409, "bad_transition"], "U-017: it can no longer be answered");
  assert.deepEqual(S.db.all("SELECT data FROM audit WHERE action = 'invitation.withdrawn' AND entity_id = ?", invB).map(x => JSON.parse(x.data)), [{ reason: "company_suspended" }], "the withdrawal is audited with its reason");
  assert.equal((await C.admin.post(`/api/admin/companies/${I.companyB}/verify`, { screened: true })).status, 200, "the admin re-verifies B");
  const after = (await C.B.e.get("/api/employer/invitations")).body.invitations.find(i => i.id === invB);
  assert.deepEqual([after.status, after.student.phone], ["withdrawn", null], "U-017: after re-verification the old invitation stays withdrawn and carries no number");
  assert.equal((await C.B.e.post(`/api/employer/students/${I.cardB}/invite`, EVENT("Beta open day, again"))).status, 200, "control: the re-verified company can invite afresh");
});

test("policy recruit: the sent list carries the person's number only for an accepted EVENT invitation, never for a job or an open or declined one", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const evA = (await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, EVENT("Alpha open day"))).body.invitation;
  const jobB = (await C.A.e.post(`/api/employer/students/${I.cardB}/invite`, { kind: "job", jobId: I.jobA })).body.invitation;
  const evB = (await C.A.e.post(`/api/employer/students/${I.cardB}/invite`, EVENT("Beta open day"))).body.invitation;
  assert.ok(evA && jobB && evB, "control: all three invitations were sent");
  assert.equal((await C.seekerA.post(`/api/me/invitations/${evA.id}/respond`, { answer: "yes" })).body.invitation.status, "accepted");
  assert.equal((await C.seekerA.post(`/api/me/invitations/${I.invA}/respond`, { answer: "yes" })).body.invitation.status, "accepted", "a yes to the JOB invitation too");
  assert.equal((await C.seekerB.post(`/api/me/invitations/${evB.id}/respond`, { answer: "no" })).body.invitation.status, "declined");
  const r = await C.A.e.get("/api/employer/invitations"), sent = r.body.invitations, by = id => sent.find(i => i.id === id);
  assert.equal(sent.length, 4);
  for (const i of sent) {   // the real response shape: nothing beyond these keys ever reaches the employer
    assert.deepEqual(Object.keys(i).sort(), ["createdAt", "event", "id", "job", "kind", "message", "status", "student", "updatedAt"]);
    assert.deepEqual(Object.keys(i.student).sort(), ["fac", "id", "name", "phone", "uni", "year"]);
  }
  assert.deepEqual([by(evA.id).kind, by(evA.id).status, by(evA.id).student.phone, by(evA.id).student.name.en], ["event", "accepted", PHONE_A, "Seeker Alpha"], "accepted event: full name and number");
  assert.deepEqual([by(I.invA).kind, by(I.invA).status, by(I.invA).student.phone, by(I.invA).student.name.en], ["job", "accepted", null, "Seeker A."], "accepted job: short name, no number (they apply through the listing)");
  assert.deepEqual([by(jobB.id).kind, by(jobB.id).status, by(jobB.id).student.phone, by(jobB.id).student.name.en], ["job", "sent", null, "Seeker B."], "open: short name, no number");
  assert.deepEqual([by(evB.id).kind, by(evB.id).status, by(evB.id).student.phone, by(evB.id).student.name.en], ["event", "declined", null, "Seeker B."], "declined event: short name, no number");
  assert.equal((r.text.match(new RegExp(PHONE_A.slice(1), "g")) || []).length, 1, "seeker A's number appears exactly once in the whole answer");
  assert.ok(!r.text.includes(PHONE_B.slice(4)) && !r.text.includes("Seeker Beta"), "seeker B's number and full name appear nowhere");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'invitation.accepted' AND actor_id = ?", I.userA).n, 2, "both answers are audited");
});

test("policy recruit: caps — three open invitations per person (429 invite_limit), the plan's monthly quota (409 invite_quota) and forty a day per company (429 invite_limit)", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const A = C.A.e, invite = (c, id, title) => c.post(`/api/employer/students/${id}/invite`, EVENT(title));
  // open cap per person: seeker A already holds A's job invitation (open), so two more pass and the fourth is refused
  for (const t of ["Second", "Third"]) assert.equal((await invite(A, I.cardA, t)).status, 200, t);
  const fourth = await invite(A, I.cardA, "Fourth");
  assert.deepEqual([fourth.status, fourth.body.error], [429, "invite_limit"], "recruit.js:92-93: at most three open invitations per person per company");
  assert.equal((await C.seekerA.post(`/api/me/invitations/${I.invA}/respond`, { answer: "no" })).status, 200);
  assert.equal((await invite(A, I.cardA, "Fourth again")).status, 200, "an answered invitation no longer counts as open");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE company_id = ?", I.companyA).n, 4, "the refused attempt was not stored");
  // monthly quota: B is on Free (5 a month, server/plans.js:8), counted over every invitation this month, open or not
  const B = C.B.e;
  for (const [id, t] of [[I.cardA, "Beta one"], [I.cardA, "Beta two"], [I.cardA, "Beta three"], [I.cardB, "Beta four"], [I.cardB, "Beta five"]]) assert.equal((await invite(B, id, t)).status, 200, t);
  const sixth = await invite(B, I.cardB, "Beta six");
  assert.deepEqual([sixth.status, sixth.body.error], [409, "invite_quota"], "recruit.js:94-95: the Free plan's five a month");
  assert.equal((await B.get("/api/employer/plan")).body.usage.invites, 5);
  // daily cap: A is on Pro (50 a month), so the day's forty come first; invite then withdraw so no other cap interferes, and refused attempts never count
  let n = S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE company_id = ?", I.companyA).n;
  while (n < 40) {
    const r = await invite(A, I.cardB, `Day ${n}`); assert.equal(r.status, 200, r.text); n++;
    assert.equal((await A.post(`/api/employer/invitations/${r.body.invitation.id}/withdraw`)).status, 200);
  }
  const over = await invite(A, I.cardB, "Forty-first");
  assert.deepEqual([over.status, over.body.error], [429, "invite_limit"], "recruit.js:119: forty a day per company");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE company_id = ?", I.companyA).n, 40, "exactly forty stored: the refused attempts earlier in the day were not counted");
  assert.equal((await A.get("/api/employer/plan")).body.usage.invites, 40, "withdrawn invitations still count against the month");
});

test("policy recruit: seeker B never sees A's invitation and gets 404 on respond and block; after seeker A's yes the company sees the number for an event, not for a job", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  assert.ok((await C.seekerA.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA), "control: the invitation is real and seeker A sees it");
  assert.ok(!(await C.seekerB.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA), "seeker B's inbox does not carry it");
  const before = S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA);
  const respond = await C.seekerB.post(`/api/me/invitations/${I.invA}/respond`, { answer: "yes" }), block = await C.seekerB.post(`/api/me/invitations/${I.invA}/block`);
  assert.deepEqual([respond.status, respond.body.error, block.status, block.body.error], [404, "not_found", 404, "not_found"], "the same answer as for an invitation that does not exist");
  assert.deepEqual(S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA), before, "nothing moved");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM recruiter_blocks WHERE user_id = ?", I.userB).n, 0, "no block was recorded for seeker B");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE actor_id = ? AND action IN ('invitation.accepted', 'recruiter.blocked')", I.userB).n, 0);
  // the positive side: seeker A's yes to the JOB invitation shares nothing; a yes to an EVENT invitation shares the number with that company only
  assert.equal((await C.seekerA.post(`/api/me/invitations/${I.invA}/respond`, { answer: "yes" })).body.invitation.status, "accepted");
  let sent = (await C.A.e.get("/api/employer/invitations")).body.invitations.find(i => i.id === I.invA);
  assert.deepEqual([sent.student.phone, sent.student.name.en], [null, "Seeker A."], "a job yes: still the card's short name, no number");
  const ev = (await C.A.e.post(`/api/employer/students/${I.cardA}/invite`, EVENT("Alpha open day"))).body.invitation;
  assert.equal((await C.seekerA.post(`/api/me/invitations/${ev.id}/respond`, { answer: "yes" })).body.invitation.status, "accepted");
  sent = (await C.A.e.get("/api/employer/invitations")).body.invitations.find(i => i.id === ev.id);
  assert.deepEqual([sent.student.phone, sent.student.name.en], [PHONE_A, "Seeker Alpha"], "an event yes: full name and number for this company");
  assert.ok(!(await C.B.e.get("/api/employer/invitations")).text.includes(PHONE_A.slice(4)), "B, who was not accepted, never sees the number");
  assert.ok(!(await C.A.e.get("/api/employer/students")).text.includes(PHONE_A.slice(4)), "and the search card still carries no number");
});

test("policy recruit: rejecting a company withdraws its open invitations too (U-017)", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  assert.ok((await C.seekerA.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA), "control: seeker A holds A's open invitation");
  assert.equal((await C.admin.post(`/api/admin/companies/${I.companyA}/reject`, { note: "Registration document unclear" })).status, 200);
  assert.ok(!(await C.seekerA.get("/api/me/invitations")).body.invitations.some(i => i.id === I.invA), "the invitation leaves the inbox");
  assert.deepEqual((r => [r.status, r.body.error])(await C.seekerA.post(`/api/me/invitations/${I.invA}/respond`, { answer: "yes" })), [409, "bad_transition"], "and cannot be answered");
  assert.deepEqual(S.db.all("SELECT data FROM audit WHERE action = 'invitation.withdrawn' AND entity_id = ?", I.invA).map(x => JSON.parse(x.data)), [{ reason: "company_rejected" }], "audited with its reason");
});
