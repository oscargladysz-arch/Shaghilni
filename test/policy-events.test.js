/* Route policy, events: drafts stay invisible, capacity holds, attending companies see only opted-in attendees and
   never a phone, reports are totals only, check-in recognises every kind of wrong ticket, a career office is pinned to
   its own university, and a seeker's tickets are their own. Every refusal is paired with the allowed actor succeeding.
   (SECURITY.md "Events", README.md "Events"; the cross-role and IDOR matrices are in policy-access / policy-idor.) */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, EV } from "./policy/harness.js";

after(closeAll);
const NAMES = /Seeker Alpha|Seeker Beta/, PHONE = /\+963|0944 ?900|963944900/;

test("policy events: a draft is invisible to guests, seekers and other offices; capacity refuses the second seeker until a place is freed; tickets are one's own", async () => {
  const S = await start(), C = await cast(S), { eventA } = C.ids;
  // (1) a draft: 404 for everyone who cannot manage it, absent from the public list; its organiser and the admin open it
  const dr = await C.officeA.post("/api/organize/events", { event: EV({ title: { en: "Policy draft day" } }), publish: false }); assert.equal(dr.status, 200, dr.text);
  const draft = dr.body.event; assert.equal(draft.status, "draft");
  for (const [who, c] of [["guest", C.actors.guest], ["seeker", C.seekerA], ["office B", C.officeB], ["company A", C.A.e]]) {
    const r = await c.get(`/api/events/${draft.id}`); assert.deepEqual([r.status, r.body.error], [404, "not_found"], `${who} GET draft`);
  }
  const rs = await C.seekerA.post(`/api/events/${draft.id}/rsvp`); assert.deepEqual([rs.status, rs.body.error], [404, "not_found"], "no ticket for a draft");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ?", draft.id).n, 0);
  const listed = (await C.actors.guest.get("/api/events")).body.events.map(e => e.id);
  assert.ok(listed.includes(eventA) && !listed.includes(draft.id), `the public list has the published event and not the draft: ${listed}`);
  assert.equal((await C.officeA.get(`/api/events/${draft.id}`)).body.event.status, "draft", "the organiser opens its draft on the public route");
  assert.equal((await C.admin.get(`/api/events/${draft.id}`)).status, 200, "the admin manages every event");
  assert.equal((await C.actors.guest.get(`/api/events/${eventA}`)).status, 200, "control: the published event is public");
  // (2) capacity 1: the second seeker is refused with event_full; a cancelled RSVP frees the place
  const small = (await C.officeA.post("/api/organize/events", { event: EV({ title: { en: "Policy small session" }, capacity: 1 }), publish: true })).body.event;
  assert.deepEqual([small.status, small.capacity, small.spotsLeft], ["published", 1, 1]);
  const ta = await C.seekerA.post(`/api/events/${small.id}/rsvp`); assert.equal(ta.status, 200, ta.text); assert.match(ta.body.rsvp.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const full = await C.seekerB.post(`/api/events/${small.id}/rsvp`); assert.deepEqual([full.status, full.body.error], [409, "event_full"]);
  assert.equal((await C.actors.guest.get(`/api/events/${small.id}`)).body.event.spotsLeft, 0);
  assert.equal((await C.seekerA.post(`/api/events/${small.id}/rsvp`)).body.rsvp.code, ta.body.rsvp.code, "the holder signing up again keeps the ticket, no second place taken");
  assert.equal((await C.seekerA.del(`/api/events/${small.id}/rsvp`)).status, 200);
  assert.equal(S.db.get("SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?", small.id, C.ids.userA).status, "cancelled");
  const tb = await C.seekerB.post(`/api/events/${small.id}/rsvp`); assert.equal(tb.status, 200, "the freed place goes to the next seeker");
  assert.equal((await C.seekerA.post(`/api/events/${small.id}/rsvp`)).body.error, "event_full", "and the one who cancelled now waits like anyone else");
  // (7) GET /api/me/events lists only one's own going tickets; B's DELETE touches B's own row only
  assert.deepEqual((await C.seekerA.get("/api/me/events")).body.tickets.map(t => [t.id, t.mine.code]), [[eventA, C.ids.ticketA]], "A: its ticket for event A, not the cancelled one");
  assert.deepEqual((await C.seekerB.get("/api/me/events")).body.tickets.map(t => [t.id, t.mine.code]), [[small.id, tb.body.rsvp.code]], "B: its own ticket only");
  assert.equal((await C.seekerB.del(`/api/events/${eventA}/rsvp`)).status, 200, "DELETE answers ok even with nothing to cancel");
  assert.equal(S.db.get("SELECT status FROM event_rsvps WHERE code = ? AND event_id = ?", C.ids.ticketA, eventA).status, "going", "A's ticket survives B's cancel");
  assert.equal((await C.seekerA.get(`/api/events/${eventA}`)).body.event.mine.status, "going");
  assert.equal((await C.seekerB.get(`/api/events/${eventA}`)).body.event.mine, null, "B holds nothing for event A");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ?", eventA).n, 1, "no row was invented for B");
  // a cancelled event: no new tickets; the holder's list says cancelled, and the event page still opens for the ticket holder, saying so (U-041); strangers and guests get 404 as for any unpublished event
  assert.equal((await C.officeA.put(`/api/organize/events/${eventA}`, { event: EV(), status: "cancelled" })).body.event.status, "cancelled");
  assert.equal((await C.seekerB.post(`/api/events/${eventA}/rsvp`)).body.error, "not_found");
  assert.deepEqual((await C.seekerA.get("/api/me/events")).body.tickets.map(t => [t.id, t.mine.status]), [[eventA, "cancelled"]]);
  const held = await C.seekerA.get(`/api/events/${eventA}`); assert.equal(held.status, 200, "U-041: the ticket holder can still open the cancelled event");
  assert.deepEqual([held.body.event.status, held.body.event.mine.status], ["cancelled", "cancelled"], "U-041: and reads that it was cancelled");
  assert.equal((await C.seekerB.get(`/api/events/${eventA}`)).status, 404, "someone without a ticket gets nothing"); assert.equal((await C.actors.guest.get(`/api/events/${eventA}`)).status, 404);
  assert.ok(!(await C.actors.guest.get("/api/events")).body.events.some(e => e.id === eventA), "and it leaves the public list");
});

test("policy events: a company sees attendees only once confirmed, only those who opted in, never a phone; the report is totals only", async () => {
  const S = await start(), C = await cast(S), { eventA, companyA, userA, userB } = C.ids;
  assert.equal((await C.seekerB.post(`/api/events/${eventA}/rsvp`)).status, 200, "seeker B holds a ticket too");
  assert.equal((await C.seekerB.put("/api/me/recruit", { open: false })).body.open, false, "seeker B opts out of recruiters; A stays opted in");
  // (3) ask to attend; before confirmation the attendee view is refused (also for a company that never asked)
  const ask = await C.A.e.post(`/api/employer/events/${eventA}/attend`); assert.deepEqual([ask.status, ask.body.status], [200, "requested"], ask.text);
  assert.equal(S.db.get("SELECT status FROM event_companies WHERE event_id = ? AND company_id = ?", eventA, companyA).status, "requested");
  assert.equal((await C.A.e.post(`/api/employer/events/${eventA}/attend`)).body.status, "requested", "asking twice is one request");
  for (const [who, c] of [["A requested", C.A.e], ["A's recruiter", C.recruiter], ["B never asked", C.B.e]]) {
    const r = await c.get(`/api/employer/students?event=${eventA}`); assert.deepEqual([r.status, r.body.error], [403, "not_attending"], who);
  }
  assert.ok((await C.A.e.get("/api/employer/students")).body.students.some(x => x.id === userA), "control: plain search works for A");
  assert.equal((await C.actors.guest.get(`/api/events/${eventA}`)).body.event.companies.length, 0, "a requested company is not on the event page yet");
  assert.equal((await C.officeA.get(`/api/organize/events/${eventA}`)).body.event.companies.find(c => c.id === companyA).status, "requested", "the organiser sees the request");
  // the organiser confirms: only attendees who opted in, and no phone anywhere in the answer
  const ok = await C.officeA.post(`/api/organize/events/${eventA}/companies`, { companyId: companyA, status: "confirmed" }); assert.equal(ok.status, 200, ok.text);
  assert.deepEqual((await C.actors.guest.get(`/api/events/${eventA}`)).body.event.companies.map(c => c.id), [companyA], "a confirmed company is on the event page");
  const met = await C.A.e.get(`/api/employer/students?event=${eventA}`); assert.equal(met.status, 200, met.text);
  assert.deepEqual(met.body.students.map(x => x.id), [userA], "seeker A (opted in) is listed; seeker B (opted out) is not, though both hold tickets");
  assert.doesNotMatch(met.text, PHONE, "no phone number in the attendee list");
  assert.ok(!Object.keys(met.body.students[0]).some(k => /phone|whatsapp|email|code/i.test(k)), `card keys: ${Object.keys(met.body.students[0])}`);
  assert.equal(met.body.students[0].name.en, "Seeker A.", "the card carries the short name only");
  assert.equal((await C.recruiter.get(`/api/employer/students?event=${eventA}`)).status, 200, "A's recruiter sees the same");
  assert.equal((await C.B.e.get(`/api/employer/students?event=${eventA}`)).body.error, "not_attending", "confirmation is per company: B still gets nothing");
  assert.equal(S.db.get("SELECT 1 AS x FROM profiles WHERE user_id = ? AND json_extract(data, '$.recruit.open') = 1", userB), undefined, "control: B's opt-out is stored");
  // (4) the report: totals, universities, faculties and what companies did next; never a name, phone or ticket code
  const rep = await C.officeA.get(`/api/organize/events/${eventA}/report`); assert.equal(rep.status, 200, rep.text);
  assert.deepEqual(rep.body.totals, { registered: 2, cancelled: 0, checkedIn: 0 });
  assert.deepEqual(rep.body.companies.map(c => c.name.en), ["Policy Alpha"]);
  assert.doesNotMatch(rep.text, NAMES, "no seeker names in the report"); assert.doesNotMatch(rep.text, PHONE, "no phone numbers in the report");
  assert.ok(!rep.text.includes(C.ids.ticketA), "no ticket codes in the report");
  assert.ok(!JSON.stringify(rep.body).includes('"people"') && rep.body.people === undefined, "no per-person rows");
  const detail = await C.officeA.get(`/api/organize/events/${eventA}`);   // control: the names exist and the organiser's own page shows them (by design, SECURITY.md "Events")
  assert.match(detail.text, NAMES); assert.doesNotMatch(detail.text, PHONE, "the organiser's list has names, never phones");
  assert.equal((await C.admin.get(`/api/organize/events/${eventA}/report`)).status, 200, "the admin reads any report");
  // declining the company closes the attendee view again
  assert.equal((await C.officeA.post(`/api/organize/events/${eventA}/companies`, { companyId: companyA, status: "declined" })).status, 200);
  assert.equal((await C.A.e.get(`/api/employer/students?event=${eventA}`)).body.error, "not_attending", "a declined company sees nobody");
  assert.equal((await C.actors.guest.get(`/api/events/${eventA}`)).body.event.companies.length, 0);
});

test("policy events: check-in recognises the wrong event, a cancelled ticket, a repeat scan, lower case, and codes of another format", async () => {
  const S = await start(), C = await cast(S), { eventA, ticketA, userA, userB } = C.ids;
  const other = (await C.officeA.post("/api/organize/events", { event: EV({ title: { en: "Policy other fair" } }), publish: true })).body.event;
  const tb = (await C.seekerB.post(`/api/events/${other.id}/rsvp`)).body.rsvp; assert.ok(tb && tb.code, "seeker B holds a ticket for the other event");
  const scan = (ev, code) => C.officeA.post(`/api/organize/events/${ev}/checkin`, { code });
  const checked = (ev, uid) => S.db.get("SELECT checked_in_at FROM event_rsvps WHERE event_id = ? AND user_id = ?", ev, uid).checked_in_at;
  // (5) another event's QR at this event; another event's short code; a code of another format: none checks anyone in
  const wrong = await scan(eventA, `SHG-EV-${other.id}-${tb.code}`); assert.deepEqual([wrong.status, wrong.body.error], [409, "wrong_event"]);
  const short = await scan(eventA, tb.code); assert.deepEqual([short.status, short.body.error], [404, "ticket_not_found"], "codes are per event: B's code means nothing at event A");
  for (const junk of [`SHG-JOB-${eventA}-${ticketA}`, `SHG-EV-${eventA}-${ticketA.slice(0, 5)}`, `EV-${eventA}-${ticketA}`, "", "ZZZZZZ"]) {
    const r = await scan(eventA, junk); assert.deepEqual([r.status, r.body.error], [404, "ticket_not_found"], JSON.stringify(junk));
  }
  assert.equal(checked(other.id, userB), null, "B's ticket is untouched by the wrong scans"); assert.equal(checked(eventA, userA), null);
  // lower case works, the QR content works, and a repeat scan says already
  const first = await scan(eventA, ticketA.toLowerCase()); assert.equal(first.status, 200, first.text);
  assert.deepEqual([first.body.already, first.body.person.name.en], [false, "Seeker Alpha"]);
  assert.doesNotMatch(first.text, PHONE, "the check-in answer names the person, never their phone");
  const at = checked(eventA, userA); assert.ok(at > 0, "checked in");
  const again = await scan(eventA, `shg-ev-${eventA}-${ticketA.toLowerCase()}`); assert.deepEqual([again.status, again.body.already, again.body.at], [200, true, at], "a repeat scan (QR form, lower case) says so and keeps the first time");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM audit WHERE action = 'event.checkin' AND entity_id = ?", eventA).n, 1, "one check-in is audited once");
  assert.equal((await C.seekerA.get(`/api/events/${eventA}`)).body.event.mine.checkedIn, true);
  assert.equal((await C.seekerA.del(`/api/events/${eventA}/rsvp`)).status, 200);
  assert.equal(S.db.get("SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?", eventA, userA).status, "going", "a ticket that was used cannot be cancelled afterwards");
  // a cancelled ticket is refused, and is accepted again once the seeker signs back up
  assert.equal((await C.seekerB.del(`/api/events/${other.id}/rsvp`)).status, 200);
  const canc = await scan(other.id, tb.code); assert.deepEqual([canc.status, canc.body.error], [409, "ticket_cancelled"]);
  assert.equal(checked(other.id, userB), null);
  assert.equal((await C.seekerB.post(`/api/events/${other.id}/rsvp`)).body.rsvp.code, tb.code, "signing up again keeps the code");
  const back = await scan(other.id, `SHG-EV-${other.id}-${tb.code}`); assert.deepEqual([back.status, back.body.already, back.body.person.name.en], [200, false, "Seeker Beta"]);
  const rep = (await C.officeA.get(`/api/organize/events/${other.id}/report`)).body; assert.deepEqual(rep.totals, { registered: 1, cancelled: 0, checkedIn: 1 });
  assert.equal((await C.officeB.post(`/api/organize/events/${other.id}/checkin`, { code: tb.code })).body.error, "forbidden", "control: the other university's office cannot check in here");
});

test("policy events: a career office's events are pinned to its own university on create and edit; the admin creates for any", async () => {
  const S = await start(), C = await cast(S);
  // (6) office A (homs) asks for damascus and gets homs, stored as such
  const mine = await C.officeA.post("/api/organize/events", { event: EV({ title: { en: "Policy pinned day" }, uni: "damascus", gov: "damascus" }), publish: true }); assert.equal(mine.status, 200, mine.text);
  assert.equal(mine.body.event.uni, "homs"); assert.equal(S.db.get("SELECT uni FROM events WHERE id = ?", mine.body.event.id).uni, "homs", "stored at the office's own university");
  const edit = await C.officeA.put(`/api/organize/events/${mine.body.event.id}`, { event: EV({ title: { en: "Policy pinned day" }, uni: "aleppo" }), status: "published" }); assert.equal(edit.status, 200, edit.text);
  assert.equal(S.db.get("SELECT uni FROM events WHERE id = ?", mine.body.event.id).uni, "homs", "an edit cannot move it either");
  const theirs = await C.officeB.post("/api/organize/events", { event: EV({ title: { en: "Policy Damascus day" }, uni: "homs" }), publish: true }); assert.equal(theirs.status, 200, theirs.text);
  assert.equal(S.db.get("SELECT uni FROM events WHERE id = ?", theirs.body.event.id).uni, "damascus", "office B (damascus) is pinned to damascus");
  assert.equal((await C.officeA.get(`/api/organize/events/${theirs.body.event.id}`)).body.error, "forbidden", "and office A cannot manage it");
  assert.equal((await C.officeA.put(`/api/organize/events/${theirs.body.event.id}`, { event: EV(), status: "cancelled" })).status, 403);
  assert.equal(S.db.get("SELECT status FROM events WHERE id = ?", theirs.body.event.id).status, "published");
  // the admin creates at any university, or at none, and manages them all
  for (const [uni, want] of [["damascus", "damascus"], ["aleppo", "aleppo"], ["", ""], ["not-a-university", ""]]) {
    const r = await C.admin.post("/api/organize/events", { event: EV({ title: { en: `Policy admin ${uni || "none"}` }, uni }), publish: true }); assert.equal(r.status, 200, r.text);
    assert.equal(S.db.get("SELECT uni FROM events WHERE id = ?", r.body.event.id).uni, want, `admin uni ${JSON.stringify(uni)}`);
  }
  const listA = (await C.officeA.get("/api/organize/events")).body, listB = (await C.officeB.get("/api/organize/events")).body, all = (await C.admin.get("/api/organize/events")).body;
  assert.equal(listA.uni, "homs"); assert.ok(listA.events.every(e => e.uni === "homs") && listA.events.some(e => e.id === mine.body.event.id), "office A lists homs events only");
  assert.equal(listB.uni, "damascus"); assert.ok(listB.events.every(e => e.uni === "damascus") && listB.events.length === 2, `office B lists damascus events only: ${listB.events.map(e => e.uni)}`);
  assert.ok(all.events.length >= listA.events.length + listB.events.length + 2, "the admin lists everything, including events at no university");
});
