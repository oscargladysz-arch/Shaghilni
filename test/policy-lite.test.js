/* Route policy, part 5: Shaghilni Lite (server/lite.js). Part A: who may see every GET page in Lite's route table,
   as a phone browser without JavaScript sees it (a sign-in gate, a redirect or the page), including the pending
   employer, the hiring manager, the career office and the admin, plus the same checks on the forms with a valid
   token. Part B: every POST form route × no token, another session's token, and generated junk with a valid token:
   never a 5xx, never a stack trace, path or SQL in the HTML, never slow, and other people's data untouched.
   Part C: a form over the 64 KB limit (lite.js readForm) gets the 413 page, as the JSON API's limit does. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { start, cast, closeAll, PROFILE } from "./policy/harness.js";
import { browser } from "./policy/lite-browser.js";

after(closeAll);

const LEAK = /\bat [A-Za-z_$][\w$.<>]* \(|\/home\/|\/app\/|node:internal|node_modules|SELECT |INSERT |UPDATE |sqlite|SQLITE_|\.js:\d+/;
const RAW_KEY = /\b(rcSt_|lvl_|edu_|err_|st_|rcErr_)[a-z]/;   // an untranslated label (test/lite.test.js:96)
const inDays = n => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const arabicDigits = s => String(s).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const english = S => { const b = browser(S); b.jar.ll = "en"; return b; };
const company = (S, phone) => S.db.get("SELECT c.status, c.data FROM companies c JOIN users u ON u.id = c.owner_id WHERE u.phone = ?", phone);

test("policy Lite gating: every GET page × guest, seeker, owner, recruiter, hiring manager, pending employer, career office and admin", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const as = c => english(S).adopt(c);
  const R = { guest: english(S), seeker: as(C.seekerA), owner: as(C.A.e), recruiter: as(C.recruiter), hiring: as(C.hiring), pending: english(S), office: as(C.officeA), admin: as(C.admin) };
  // The pending employer signs up through Lite itself: number, company form, "send to be checked".
  assert.equal((await R.pending.signin("0955 910 001", "employer", "/lite/hire/company")).location, "/lite/hire/company");
  const form = await R.pending.get("/lite/hire/company"); assert.equal(form.status, 200);
  const sub = await R.pending.post("/lite/hire/company", { csrf: R.pending.csrf(form.text), nameEn: "Policy Pending", sector: "trade", cat: "domestic", gov: "homs", regNo: "HM-910001", contactName: "Contact Pending", whatsapp: "0955 910 001", website: "", aboutAr: "", aboutEn: "", submit: "1" });
  assert.equal(sub.location, "/lite/hire?done=submitted", sub.text.slice(0, 300));
  assert.equal(company(S, "+963955910001").status, "pending");

  const board = /href="\/lite\/job\/\d+"/, toHire = "/lite/hire", toBoard = "/lite", toMe = "/lite/me";
  const gate = next => r => r.status === 200 && r.text.includes(`href="/lite/signin?next=${encodeURIComponent(next)}"`);   // signed-out visitors get a sign-in page that comes back here
  const signinEmp = p => `/lite/signin?role=employer&next=${encodeURIComponent(p)}`;
  const forbidden = r => r.status === 403 && /Your role doesn/.test(r.text);   // the Lite gate lets a team member through; the API answers 403 role_forbidden and Lite shows it
  const verifiedCo = /Your company is verified[^]*href="\/lite\/candidates"/, seekerNote = /registered as a job seeker/, adminNote = /signed in as an admin/;
  const jobPage = /action="\/lite\/job\/\d+\/apply"/, jobRead = /<h1 dir="auto"/;
  const cardA = new RegExp(`href="/lite/candidates/${I.cardA}/invite"`), inviteA = new RegExp(`action="/lite/candidates/${I.cardA}/invite"`), sentA = new RegExp(`action="/lite/invitations/${I.invA}/withdraw"`);
  const PAGES = [
    // path, what each role gets: a status, a 303 target, a 200 page matching a pattern, or a predicate
    ["/lite", { guest: board, seeker: board, owner: toHire, recruiter: toHire, hiring: toHire, pending: toHire, office: board, admin: board }],   // employers never see the board (lite.js jobsPage)
    [`/lite/job/${I.jobA}`, { guest: jobPage, seeker: /applied for this job/, owner: toHire, recruiter: toHire, hiring: toHire, pending: toHire, office: jobRead, admin: jobRead }],
    ["/lite/job/999999", { guest: 404, seeker: 404, owner: toHire, office: 404, admin: 404 }],
    // seeker-only pages: a gate for guests; every other signed-in role bounces to /lite, which bounces employers on to /lite/hire (two hops, lite.js appsPage/recruitersPage/resumePage)
    ["/lite/applications", { guest: gate("/lite/applications"), seeker: new RegExp(`href="/lite/job/${I.jobA}"`), owner: toBoard, recruiter: toBoard, hiring: toBoard, pending: toBoard, office: toBoard, admin: toBoard }],
    ["/lite/recruiters", { guest: gate("/lite/recruiters"), seeker: new RegExp(`action="/lite/invite/${I.invA}"`), owner: toBoard, recruiter: toBoard, hiring: toBoard, pending: toBoard, office: toBoard, admin: toBoard }],
    ["/lite/resume", { guest: gate("/lite/resume"), seeker: /<article class="paper"/, owner: toBoard, recruiter: toBoard, hiring: toBoard, pending: toBoard, office: toBoard, admin: toBoard }],
    // /lite/me: the office and the admin are not redirected; they get a note with a link to the full site and no tab bar (lite.js mePage)
    ["/lite/me", { guest: gate("/lite/me"), seeker: /href="\/lite\/profile\?step=1"/, owner: toHire, recruiter: toHire, hiring: toHire, pending: toHire,
      office: r => r.status === 200 && /university career office/.test(r.text) && !/<nav class="tb"/.test(r.text), admin: r => r.status === 200 && adminNote.test(r.text) && !/<nav class="tb"/.test(r.text) }],
    ["/lite/profile", { guest: gate("/lite/profile"), seeker: /name="name"/, owner: toMe, recruiter: toMe, hiring: toMe, pending: toMe, office: toMe, admin: toMe }],
    ["/lite/profile?step=3", { guest: gate("/lite/profile"), seeker: /action="\/lite\/profile\/exp"/, owner: toMe, office: toMe, admin: toMe }],
    ["/lite/privacy", Object.fromEntries(["guest", "seeker", "owner", "recruiter", "hiring", "pending", "office", "admin"].map(r => [r, /<h1>(Privacy notice|إشعار الخصوصية)<\/h1>/]))],   // the legal pages are for everyone, in the visitor's language (D-12)
    ["/lite/terms", Object.fromEntries(["guest", "seeker", "owner", "recruiter", "hiring", "pending", "office", "admin"].map(r => [r, /<h1>(Terms of use|شروط الاستخدام)<\/h1>/]))],
    ["/lite/signin", { guest: /name="pow_challenge"/, seeker: toMe, owner: toHire, recruiter: toHire, hiring: toHire, pending: toHire, office: toMe, admin: toMe }],
    ["/lite/signin?role=employer", { guest: /name="role" value="employer"/, seeker: toMe, owner: toHire }],
    ["/lite/signin?next=%2Flite%2Fresume", { guest: /name="next" value="\/lite\/resume"/, seeker: "/lite/resume" }],
    ["/lite/signin?next=%2F%2Fevil.example%2F", { guest: /name="next" value=""/, seeker: toMe }],   // safeNext (lite.js) keeps only /lite paths
    ["/lite/signin?next=%2Fapi%2Fme", { guest: /name="next" value=""/, seeker: toMe }],
    ["/lite/signin?next=https%3A%2F%2Fevil.example", { seeker: toMe }],
    // the recruiter side: /lite/hire is the one page every role can open; a career office is told its number "is registered as a job seeker" (no university wording on this page; no DEFECTS.md id)
    ["/lite/hire", { guest: /action="\/lite\/signin"[^]*name="role" value="employer"/, seeker: seekerNote, owner: verifiedCo, recruiter: verifiedCo, hiring: verifiedCo, pending: /checking your company/, office: seekerNote, admin: adminNote }],
    // the company form: any team role gets the form (employerGate only asks for the employer role); the save is refused by the API at manage level (checked below)
    ["/lite/hire/company", { guest: signinEmp("/lite/hire/company"), seeker: toHire, owner: /name="regNo"/, recruiter: /name="regNo"/, hiring: /name="regNo"/, pending: /name="regNo"/, office: toHire, admin: toHire }],
    // candidate pages need a verified company (employerGate(ctx, true)): a pending company goes back to /lite/hire; a hiring manager passes the gate and the API refuses (hire level, D-03)
    ["/lite/candidates", { guest: signinEmp("/lite/candidates"), seeker: toHire, owner: cardA, recruiter: cardA, hiring: forbidden, pending: toHire, office: toHire, admin: toHire }],
    ["/lite/candidates?gov=aleppo", { owner: cardA, hiring: forbidden, pending: toHire }],
    ["/lite/candidates/sent", { guest: signinEmp("/lite/candidates/sent"), seeker: toHire, owner: sentA, recruiter: sentA, hiring: forbidden, pending: toHire, office: toHire, admin: toHire }],
    [`/lite/candidates/${I.cardA}/invite`, { guest: signinEmp(`/lite/candidates/${I.cardA}/invite`), seeker: toHire, owner: inviteA, recruiter: inviteA, hiring: forbidden, pending: toHire, office: toHire, admin: toHire }],
    ["/lite/candidates/999999/invite", { owner: 404, recruiter: 404, hiring: forbidden, pending: toHire }],
    ["/lite/nope", { guest: 404, seeker: 404, owner: 404, office: 404, admin: 404 }]
  ];
  const show = want => (typeof want === "function" ? want.name || "predicate" : String(want));
  const check = (r, want) => (typeof want === "number" ? r.status === want : typeof want === "string" ? r.status === 303 && r.location === want : want instanceof RegExp ? r.status === 200 && want.test(r.text) : want(r));
  const wrong = []; let n = 0;
  for (const [path, cells] of PAGES) {
    for (const [role, want] of Object.entries(cells)) {
      const r = await R[role].get(path); n++;
      if (!check(r, want)) wrong.push(`${role} GET ${path} → ${r.status} ${r.location || r.text.replace(/\s+/g, " ").slice(0, 160)} (wanted ${show(want)})`);
      if (LEAK.test(r.text)) wrong.push(`${role} GET ${path} leaks: ${r.text.slice(0, 160)}`);
      if (r.status === 200 && RAW_KEY.test(r.text)) wrong.push(`${role} GET ${path} shows a raw label: ${RAW_KEY.exec(r.text)[0]}`);
    }
  }
  console.log(`policy lite gating: ${n} role × page checks over ${PAGES.length} pages`);
  assert.deepEqual(wrong, [], "pages that answered the wrong thing:\n" + wrong.join("\n"));

  // The same gates on the forms, with a valid token from the role's own page, each refusal next to the allowed actor's success above.
  const tok = async (b, p = "/lite/me") => { const r = await b.get(p); const t = b.csrf(r.text); assert.ok(t, `${p} carries a token`); return t; };
  const seekerB = as(C.seekerB), ownerB = as(C.B.e);
  const tH = await tok(R.hiring, "/lite/hire"), coBefore = company(S, "+963955900001");
  const hp = await R.hiring.post("/lite/hire/company", { csrf: tH, nameEn: "Hijacked by hiring", sector: "trade", cat: "domestic", gov: "aleppo", regNo: "REG-Policy Alpha", contactName: "X", whatsapp: "0955 900 013", submit: "0" });
  assert.equal(hp.status, 200); assert.match(hp.text, /Your role doesn/, "a hiring manager's save is refused by the API (manage level) and shown on the form");
  assert.deepEqual(company(S, "+963955900001"), coBefore, "company A is unchanged");
  const tB = await tok(seekerB), invBefore = S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA).status;
  const ib = await seekerB.post(`/lite/invite/${I.invA}`, { csrf: tB, answer: "yes" });
  assert.equal(ib.status, 200); assert.match(ib.text, /role="alert"/, "seeker B answering A's invitation sees an error, not a success");
  assert.equal(S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA).status, invBefore, "A's invitation is untouched");
  assert.equal((await seekerB.post(`/lite/alerts/${I.alertA}/delete`, { csrf: tB })).location, "/lite/me");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM alerts WHERE id = ?", I.alertA).n, 1, "A's alert survives seeker B's delete");
  const tOB = await tok(ownerB, "/lite/hire");
  const wb = await ownerB.post(`/lite/invitations/${I.invA}/withdraw`, { csrf: tOB });
  assert.equal(wb.status, 200); assert.match(wb.text, /role="alert"/, "owner B withdrawing A's invitation sees an error");
  assert.doesNotMatch(wb.text, sentA, "and never sees A's invitation in its sent list");
  assert.equal(S.db.get("SELECT status FROM invitations WHERE id = ?", I.invA).status, invBefore);
  const tG = await tok(R.guest, "/lite/signin");
  assert.equal((await R.guest.post("/lite/profile", { csrf: tG, step: "1", name: "Ghost", gov: "homs" })).location, "/lite/signin?next=%2Flite%2Fprofile");
  assert.equal((await R.guest.post(`/lite/candidates/${I.cardB}/invite`, { csrf: tG, kind: "job", jobId: String(I.jobA) })).location, signinEmp(`/lite/candidates/${I.cardB}/invite`));
  const tO = await tok(R.owner, "/lite/hire");
  assert.equal((await R.owner.post("/lite/profile", { csrf: tO, step: "1", name: "Owner as seeker", gov: "homs" })).location, "/lite/me", "an employer cannot write a seeker profile");
  assert.equal((await R.owner.post(`/lite/job/${I.jobA}/apply`, { csrf: tO, channel: "web" })).location, "/lite/hire", "an employer cannot apply");
  const tU = await tok(R.office, "/lite/hire");   // the office's /lite/me is a note without a form; /lite/hire carries its sign-out form
  const oa = await R.office.post(`/lite/job/${I.jobA}/apply`, { csrf: tU, channel: "web" });
  assert.equal(oa.status, 200); assert.match(oa.text, /role="alert"/, "a career office cannot apply");
  assert.equal((await R.office.post(`/lite/candidates/${I.cardB}/invite`, { csrf: tU, kind: "job", jobId: String(I.jobA) })).location, "/lite/hire");
  const tP = await tok(R.pending, "/lite/hire");
  assert.equal((await R.pending.post(`/lite/candidates/${I.cardB}/invite`, { csrf: tP, kind: "event", title: "Open day", date: inDays(5), place: "Homs" })).location, "/lite/hire", "a pending company cannot invite");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ?", I.cardB).n, 0, "nobody's refused invite reached seeker B");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM applications WHERE job_id = ?", I.jobA).n, 1, "only seeker A's application exists");

  // U-016 (DEFECTS.md U-016, confirmed here; fails until lite.js findCandidate looks the candidate up by id): Lite looks a candidate up in the UNFILTERED first-60 list (lite.js findCandidate), so once
  // 60 newer opted-in profiles exist, a candidate found through a filtered search gets 404 and a silent redirect, while the API invites them.
  assert.equal((await ownerB.get(`/lite/candidates/${I.cardA}/invite`)).status, 200, "before: owner B can open the invite form for seeker A");
  const t0 = Date.now();
  S.db.tx(() => { for (let i = 1; i <= 60; i++) {
    const uid = Number(S.db.run("INSERT INTO users (phone, role, lang, created_at) VALUES (?, 'seeker', 'ar', ?)", `+963944920${String(i).padStart(3, "0")}`, t0).lastInsertRowid);
    S.db.run("INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?)", uid, JSON.stringify({ ...PROFILE, name: `Filler ${i}`, gov: "damascus", recruit: { open: true } }), t0 + i);
  } });
  const filtered = await ownerB.get("/lite/candidates?gov=aleppo");
  assert.match(filtered.text, cardA, "the filtered search still finds seeker A");
  assert.equal((await ownerB.get(`/lite/candidates/${I.cardA}/invite`)).status, 200, "U-016: a candidate the filtered search lists can be opened for an invitation (lite.js findCandidate reads the unfiltered first 60)");
  assert.equal((await ownerB.post(`/lite/candidates/${I.cardA}/invite`, { csrf: tOB, kind: "event", title: "Open day", date: inDays(5), place: "Aleppo" })).location, "/lite/candidates/sent?done=invited", "U-016: and invited, as the API below allows");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ? AND company_id = ?", I.cardA, I.companyB).n, 1, "U-016: the invitation row exists");
  assert.equal((await C.B.e.post(`/api/employer/students/${I.cardA}/invite`, { kind: "event", event: { title: "Open day", date: inDays(5), place: "Aleppo" } })).status, 200, "the API invites the same candidate (a second event invite is allowed: recruit.js:92-102 caps open invitations at 3 and refuses only the same job)");
});

const BIG = "x".repeat(60 * 1024), BIDI = "‮‭عمر‏\u0000\u001F⁦abc⁩﻿", SQL = "' OR 1=1; -- \"; DROP TABLE users; --", WORDS = "twenty twenty-three", AR_DIGITS = "٠٩٤٤ ٩٣٠ ٠٠٢";
const blast = (fields, v) => Object.fromEntries(fields.map(k => [k, v]));
const bodiesFor = fields => [["empty", {}], ["bidi", blast(fields, BIDI)], ["sql", blast(fields, SQL)], ["words", blast(fields, WORDS)], ["arabic digits", blast(fields, AR_DIGITS)],
  ["repeated ×1000", Array.from({ length: 1000 }, () => [fields[0] || "x", "1"])], ...fields.map(f => [`${f}=60 KB`, { [f]: BIG }])];
const withTok = (tok, body) => (Array.isArray(body) ? [["csrf", tok], ...body] : { csrf: tok, ...body });
const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") for (const x of Object.values(v)) strings(x, out); return out; };

test("policy Lite junk: every POST form × no token, another session's token, and generated junk with a valid token", async () => {
  const S = await start(), C = await cast(S), I = C.ids;
  const seeker = english(S).adopt(C.seekerA), owner = english(S).adopt(C.A.e), ownerB = english(S).adopt(C.B.e), leaver = english(S).adopt(C.seekerB), guest = english(S), other = english(S);
  const tok = async (b, p) => { const t = b.csrf((await b.get(p)).text); assert.ok(t, `${p} carries a token`); return t; };
  const T = { seeker: await tok(seeker, "/lite/me"), owner: await tok(owner, "/lite/hire"), ownerB: await tok(ownerB, "/lite/hire"), leaver: await tok(leaver, "/lite/me"), guest: await tok(guest, "/lite/signin"), other: await tok(other, "/lite/signin") };
  const B = { seeker, owner, ownerB, leaver, guest };
  const profileB = S.db.get("SELECT data FROM profiles WHERE user_id = ?", I.userB).data, companyA = company(S, "+963955900001");
  // actor, route, the fields its form sends (lite.js handlers); routes whose first valid post changes state go last for their actor
  const FORMS = [
    ["seeker", `/lite/job/${I.jobA}/apply`, ["channel"]], ["seeker", `/lite/job/${I.jobA}/save`, ["back"]],
    ["seeker", "/lite/profile", ["step", "name", "gov", "country", "email", "status", "uni", "uniName", "fac", "year", "grad", "gpa", "skills", "langs", "certs", "types", "level", "next"]],
    ["seeker", "/lite/profile/exp", ["i", "role", "org", "place", "start", "end", "current", "bullets"]], ["seeker", "/lite/profile/exp/delete", ["i"]],
    ["seeker", "/lite/alerts", ["q", "gov", "type", "returnees"]], ["seeker", `/lite/alerts/${I.alertA}/delete`, []],
    ["seeker", `/lite/invite/${I.invA}`, ["answer"]], ["seeker", "/lite/recruit", ["open"]],
    ["owner", `/lite/candidates/${I.cardB}/invite`, ["kind", "jobId", "title", "date", "place", "link", "message"]], ["owner", `/lite/invitations/${I.invA}/withdraw`, []],
    ["ownerB", "/lite/hire/company", ["nameAr", "nameEn", "sector", "cat", "gov", "regNo", "contactName", "whatsapp", "website", "aboutAr", "aboutEn", "submit"]],   // B: identity edits send a verified company back to pending, by design
    ["guest", "/lite/signin", ["phone", "consent", "role", "next", "pow_challenge", "pow_nonce"]], ["guest", "/lite/signin/code", ["phone", "code", "role", "next"]],
    ["leaver", "/lite/signout", []]
  ];
  const problems = [], slow = [], refused = [], seen = {}; let calls = 0, worst = 0;
  const look = (who, path, label, r) => {
    calls++; worst = Math.max(worst, r.ms); seen[r.status] = (seen[r.status] || 0) + 1;
    if (r.status >= 500) problems.push(`${who} POST ${path} [${label}] → ${r.status} ${r.text.replace(/\s+/g, " ").slice(0, 120)}`);
    if (LEAK.test(r.text)) problems.push(`${who} POST ${path} [${label}] leaks: ${LEAK.exec(r.text)[0]}`);
    if (r.status === 200 && RAW_KEY.test(r.text)) problems.push(`${who} POST ${path} [${label}] shows a raw label: ${RAW_KEY.exec(r.text)[0]}`);
    if (r.ms > 3000) slow.push(`${who} POST ${path} [${label}] took ${r.ms} ms`);
  };
  for (const [who, path, fields] of FORMS) {
    const b = B[who];
    for (const [label, body] of [["no token", blast(fields, "1")], ["another session's token", withTok(T.other, blast(fields, "1"))]]) {
      const r = await b.post(path, body); look(who, path, label, r);
      if (r.status !== 403 || !/form expired/.test(r.text)) refused.push(`${who} POST ${path} [${label}] → ${r.status} ${r.location || ""}`);
    }
    for (const [label, body] of bodiesFor(fields)) look(who, path, label, await b.post(path, withTok(T[who], body)));
  }
  console.log(`policy lite junk: ${calls} requests over ${FORMS.length} forms; statuses ${JSON.stringify(seen)}; slowest ${worst} ms`);
  assert.deepEqual(refused, [], "a form without this browser's token must be refused with 403 and the expired-form page:\n" + refused.join("\n"));
  assert.deepEqual(problems, [], "junk that crashed or leaked:\n" + problems.join("\n"));
  assert.deepEqual(slow, [], "junk that took too long:\n" + slow.join("\n"));
  assert.ok(calls > 150, `${calls} requests`);
  // Other people's data is untouched; the junk seeker's own profile only ever holds what the API's sanitiser lets through.
  assert.equal(S.db.get("SELECT data FROM profiles WHERE user_id = ?", I.userB).data, profileB, "seeker B's profile is byte-for-byte the same");
  assert.deepEqual(company(S, "+963955900001"), companyA, "company A is untouched (only B's owner posted to the company form)");
  assert.equal(S.db.get("SELECT COUNT(*) AS n FROM invitations WHERE user_id = ? AND company_id = ?", I.cardB, I.companyA).n, 0, "no junk invitation reached seeker B");
  const pA = JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", I.userA).data);
  assert.ok(pA.name.length >= 2 && pA.name.length <= 100, `seeker A's name is within the sanitiser's bounds (${pA.name.length})`);
  assert.deepEqual(strings(pA).filter(s => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s) || s.length > 400), [], "no control characters or oversized text stored");
  assert.match((await seeker.get("/lite/me")).text, /href="\/lite\/profile\?step=1"/, "seeker A is still signed in");
  assert.equal((await leaver.get("/lite/me")).status, 200); assert.match((await leaver.get("/lite/me")).text, /href="\/lite\/signin\?next=%2Flite%2Fme"/, "the signout junk ended that session (its first valid post)");
  // Arabic-Indic digits, recorded: the server accepts them in the phone and the code (core.norm maps them); D-23 is the code field's pattern attribute, which only a browser enforces.
  const ar = english(S), pg = await ar.get("/lite/signin");
  const r1 = await ar.post("/lite/signin", { csrf: ar.csrf(pg.text), phone: arabicDigits("0944 930 001"), consent: "1", role: "seeker", next: "", pow_challenge: /name="pow_challenge" value="([^"]+)"/.exec(pg.text)[1], pow_nonce: "" });
  assert.match(r1.text, /name="phone" value="\+963944930001"/, "an Arabic-Indic phone number is accepted and normalised");
  assert.equal((await ar.post("/lite/signin/code", { csrf: ar.csrf(r1.text), phone: "+963944930001", code: arabicDigits(S.lastCode("+963944930001")), role: "seeker", next: "" })).location, "/lite/me", "an Arabic-Indic code signs in");
  const tA = ar.csrf((await ar.get("/lite/me")).text);
  assert.equal((await ar.post("/lite/profile", { csrf: tA, step: "1", name: "Rami Policy", gov: "homs", email: "" })).location, "/lite/profile?step=2");
  assert.equal((await ar.post("/lite/profile", { csrf: tA, step: "2", status: "bachelor", uni: "homs", fac: "business", year: "", grad: arabicDigits("2023"), gpa: "" })).location, "/lite/profile?step=3");
  const uid = S.db.get("SELECT id FROM users WHERE phone = ?", "+963944930001").id;
  assert.equal(JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", uid).data).edu.grad, 0, "recorded: a crafted Arabic-Indic graduation year is stored as 0 (Number() in lite.js profilePost; the form is a <select>, lite.js:348, so no browser sends one; no DEFECTS.md id)");
  const inv = await owner.post(`/lite/candidates/${I.cardB}/invite`, { csrf: T.owner, kind: "job", jobId: arabicDigits(I.jobA), message: "" });
  assert.equal(inv.status, 200); assert.match(inv.text, /Choose one of your published jobs/, "recorded: an Arabic-Indic job id is not a job (the form's select never sends one)");
  const tOB = await tok(ownerB, "/lite/hire");
  const co = await ownerB.post("/lite/hire/company", { csrf: tOB, nameEn: "Policy Beta", sector: "trade", cat: "domestic", gov: "aleppo", regNo: "REG-Policy Beta", contactName: "Contact Policy Beta", whatsapp: arabicDigits("0955 900 002"), submit: "0" });
  assert.equal(co.location, "/lite/hire?done=saved", co.text.slice(0, 200));
  assert.equal(JSON.parse(company(S, "+963955900002").data).whatsapp, "+963955900002", "an Arabic-Indic WhatsApp number is accepted and normalised");
});

test("policy Lite junk: a form over the 64 KB limit is answered with the 413 page, like the API's limit, not a dropped connection", async () => {
  const S = await start(), C = await cast(S);
  const seeker = english(S).adopt(C.seekerA), tok = seeker.csrf((await seeker.get("/lite/me")).text);
  const send = async (path, body) => { try { return await seeker.post(path, body); } catch (err) { return { status: `dropped (${(err.cause && err.cause.code) || err.message})`, text: "" }; } };
  assert.equal((await send("/lite/recruit", `csrf=${tok}&open=1&pad=${"x".repeat(63 * 1024)}`)).location, "/lite/recruiters?done=saved", "63 KB is within the limit");
  const api = await C.seekerA.put("/api/me/recruit", JSON.stringify({ open: true, pad: "x".repeat(300 * 1024) }));
  assert.equal(api.status, 413, "the JSON API answers a body over its 256 KB limit with 413 (server/http.js readJson)");
  for (const [label, body] of [["70 KB", `csrf=${tok}&open=1&pad=${"x".repeat(70 * 1024)}`], ["65 KB", `csrf=${tok}&open=1&pad=${"x".repeat(65 * 1024)}`],
    ["every field 100 KB", withTok(tok, blast(["open", "q", "gov", "type"], "x".repeat(100 * 1024)))]]) {
    const r = await send("/lite/recruit", body);
    assert.equal(r.status, 413, `${label}: lite.js readForm builds HttpError(413) but destroys the request first, so the page is never delivered`);
    assert.doesNotMatch(r.text, LEAK);
  }
  assert.equal(JSON.parse(S.db.get("SELECT data FROM profiles WHERE user_id = ?", C.ids.userA).data).recruit.open, true, "the oversized posts changed nothing");
});
