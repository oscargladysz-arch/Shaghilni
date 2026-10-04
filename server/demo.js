/* DEMO ACCOUNTS. Everything for trying Shaghilni as a university student, a job seeker, a company and a university
   career office, with sample activity: applications at every stage, recruiter invitations and replies, events with
   tickets and check-ins, verification requests, partners and a past event's report.

   It exists only when asked for (DEMO_ACCOUNTS, on by default when you run it yourself, never in production).
   To take it out later:
     npm run demo-accounts:purge       removes the demo accounts and their activity from a database
     npm run demo-accounts:uninstall   deletes this file, public/js/demo.js and the few marked lines
   Every demo company and person is fictional. */
import { fail } from "./http.js";
import { J, now } from "./db.js";
import { TERMS_VERSION } from "./config.js";

export const DEMO = { student: "+963933000101", seeker: "+963933000102", company: "+963955000201", university: "+963944000301" };
const EXTRA = { company2: "+963955000202", lina: "+963955000203", karim: "+963955000204", fadi: "+963955000205", sara: "+963933000201", yazan: "+963933000202", lama: "+963933000203", hadi: "+963933000204", nour: "+963933000205" };
export const DEMO_PHONES = [...Object.values(DEMO), ...Object.values(EXTRA)];
export const demoOn = cfg => !!cfg.demoAccounts && !!cfg.seedDemo && !cfg.prod;
const b = (en, ar) => ({ en, ar });
const DAY = 86400e3;

async function call(router, user, method, path, body) {
  const u = new URL(path, "http://demo.local"), m = router.match(method, u.pathname);
  if (!m || m.methodNotAllowed) throw new Error(`demo: no route ${method} ${path}`);
  const ctx = { req: { headers: {} }, res: null, url: u, query: u.searchParams, params: m.params, headers: {}, ip: "127.0.0.1", cookies: {}, user, body: body || {} };
  let out; for (const h of m.handlers) out = await h(ctx);
  return out;
}
const userRow = (db, phone, role) => {
  const have = db.get("SELECT * FROM users WHERE phone = ?", phone); if (have) return have;
  db.run("INSERT INTO users (phone, role, lang, created_at, terms_version, terms_accepted_at) VALUES (?, ?, 'ar', ?, ?, ?)", phone, role, now(), TERMS_VERSION, now());
  return db.get("SELECT * FROM users WHERE phone = ?", phone);
};
const localIn = days => { const d = new Date(Date.now() + days * DAY); d.setUTCHours(7, 0, 0, 0); return { at: d.getTime(), local: new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 16) }; };
const person = (name, nameAr, uni, fac, extra = {}) => ({ v: 1, role: extra.status === "student" || !extra.status ? "student" : "seeker", name, nameAr, nameEn: name, email: "", gov: extra.gov || "homs", relocate: false,
  langs: extra.langs || ["ar", "en"], edu: { status: extra.status || "student", uni, fac, year: extra.year || 3, grad: extra.grad || 2027, gpa: "" }, prefs: { types: extra.types || ["intern", "full"], fields: [], level: extra.level || "none" },
  exp: extra.exp || [], acts: [], skills: extra.skills || ["Excel", "Teamwork"], certs: [], tailor: {}, tr: { en: [], ar: [] } });

export async function seedDemoAccounts({ db, cfg, router, log = () => {} }) {
  if (!demoOn(cfg) || db.get("SELECT 1 AS x FROM users WHERE phone = ?", DEMO.student)) return;
  if (db.get("SELECT 1 AS x FROM audit WHERE action = 'demo-accounts.purged' LIMIT 1")) return;   // purged on purpose: don't bring them back
  const U = {}; for (const [k, p] of Object.entries({ ...DEMO, ...EXTRA })) U[k] = userRow(db, p, ["company", "company2", "lina", "karim", "fadi"].includes(k) ? "employer" : k === "university" ? "university" : "seeker");

  /* ---------- two fictional companies ---------- */
  const mkCompany = async (u, company, plan) => {
    await call(router, u, "PUT", "/api/employer/company", { company }); await call(router, u, "POST", "/api/employer/company/submit");
    const c = db.get("SELECT * FROM companies WHERE owner_id = ?", u.id);
    db.run("UPDATE companies SET status = 'verified', screened_at = ?, verified_at = ?, is_demo = 1, plan = ?, plan_until = ? WHERE id = ?", now(), now(), plan, plan === "free" ? null : now() + 365 * DAY, c.id);
    return db.get("SELECT * FROM companies WHERE id = ?", c.id);
  };
  const Y = await mkCompany(U.company, { name: b("Yasmin Trading", "شركة الياسمين للتجارة"), sector: "trade", cat: "domestic", gov: "damascus", regNo: "DM-24681", contactName: "Samer Haddad", whatsapp: DEMO.company, website: "",
    about: b("Yasmin Trading distributes fuel, lubricants and household goods to shops and stations across central and southern Syria, from depots in Damascus and Homs.", "توزّع شركة الياسمين للتجارة المحروقات والزيوت والسلع المنزلية على المحال والمحطات في وسط سوريا وجنوبها، من مستودعاتها في دمشق وحمص.") }, "pro");
  const Q = await mkCompany(U.company2, { name: b("Qasioun Advisory", "قاسيون للاستشارات"), sector: "finance", cat: "domestic", gov: "damascus", regNo: "DM-35790", contactName: "Rasha Najjar", whatsapp: EXTRA.company2, website: "",
    about: b("Qasioun Advisory provides accounting, audit and tax services to small and medium businesses in Damascus and Homs.", "تقدّم قاسيون للاستشارات خدمات المحاسبة والتدقيق والضرائب للشركات الصغيرة والمتوسطة في دمشق وحمص.") }, "free");
  const tpl = db.all("SELECT data FROM jobs WHERE status = 'published' LIMIT 50").map(r => J(r.data) || {});
  const rec = fac => { const t = tpl.find(d => Array.isArray(d.recruits) && d.recruits.length); return t ? [[t.recruits[0][0], fac]] : []; };
  const post = async (u, job) => { const r = await call(router, u, "POST", "/api/employer/jobs", { job, submit: true }); db.run("UPDATE jobs SET status = 'published', published_at = ?, is_demo = 1 WHERE id = ?", now(), r.job.id); return r.job.id; };
  const prog = [localIn(240).local.slice(0, 7), localIn(330).local.slice(0, 7)];
  const J1 = await post(U.company, { title: b("Operations intern, fuel distribution", "متدرب عمليات في توزيع المحروقات"), type: "intern", level: "student", gov: "homs", unis: ["homs"], progStart: prog[0], progEnd: prog[1],
    place: b("Homs depot, Industrial City", "مستودع حمص، المدينة الصناعية"), pay: [40000, 55000], langs: ["ar", "en"], recruits: [...rec("petroleum"), ...rec("business")], seats: 2,
    summary: b("Three months with our depot team: stock, deliveries and the daily reports that keep fuel moving to stations.", "ثلاثة أشهر مع فريق المستودع: المخزون والتوصيل والتقارير اليومية التي تُبقي المحروقات متجهة إلى المحطات."),
    duties: { en: ["Track tank levels and deliveries every day", "Help plan delivery routes with the dispatch team", "Prepare the daily stock report"], ar: ["متابعة مستويات الخزانات والتوصيلات يومياً", "المساعدة في تخطيط مسارات التوصيل مع فريق الإرسال", "إعداد تقرير المخزون اليومي"] },
    needs: { en: ["Petroleum or chemical engineering, or business, third year or above", "Good with Excel", "Stock control is a plus"], ar: ["هندسة البترول أو الكيمياء أو إدارة الأعمال، السنة الثالثة فما فوق", "إتقان Excel", "معرفة بمراقبة المخزون ميزة"] },
    provides: { en: ["A monthly stipend", "Transport from central Homs", "A reference letter at the end"], ar: ["مكافأة شهرية", "مواصلات من وسط حمص", "رسالة توصية في النهاية"] } });
  const J2 = await post(U.company, { title: b("Sales supervisor, retail accounts", "مشرف مبيعات لحسابات التجزئة"), type: "full", level: "junior", gov: "damascus", place: b("Damascus, Mezzeh office", "دمشق، مكتب المزة"),
    pay: [150000, 190000], langs: ["ar"], recruits: [...rec("business"), ...rec("economics")], seats: 1, returnees: true,
    summary: b("Lead a team of four sales reps serving shops across Damascus, and grow our retail accounts.", "قيادة فريق من أربعة مندوبي مبيعات يخدمون المحال في دمشق، وتنمية حسابات التجزئة لدينا."),
    duties: { en: ["Plan weekly visits for four sales reps", "Grow orders from our 120 retail accounts", "Report sales and stock needs to the depot"], ar: ["تخطيط الزيارات الأسبوعية لأربعة مندوبين", "زيادة طلبات حسابات التجزئة الـ 120 لدينا", "رفع تقارير المبيعات واحتياجات المخزون إلى المستودع"] },
    needs: { en: ["One to three years in sales", "A degree in business or economics", "A driving licence"], ar: ["سنة إلى ثلاث سنوات في المبيعات", "شهادة في إدارة الأعمال أو الاقتصاد", "رخصة قيادة"] },
    provides: { en: ["A monthly salary plus sales bonus", "A company phone", "Health insurance"], ar: ["راتب شهري مع مكافأة مبيعات", "هاتف من الشركة", "تأمين صحي"] } });
  const J3 = await post(U.company2, { title: b("Audit internship", "تدريب في التدقيق"), type: "intern", level: "student", gov: "homs", unis: ["homs", "damascus"], progStart: prog[0], progEnd: prog[1], place: b("Homs office", "مكتب حمص"),
    pay: [35000, 45000], langs: ["ar", "en"], recruits: [...rec("business"), ...rec("economics")], seats: 3,
    summary: b("Join our audit team for a summer: real client files, with a senior auditor guiding you.", "انضم إلى فريق التدقيق لدينا في الصيف: ملفات عملاء حقيقية مع مدقق خبير يرشدك."),
    duties: { en: ["Check invoices and ledgers against records", "Prepare working papers", "Join client meetings"], ar: ["مطابقة الفواتير والدفاتر مع السجلات", "إعداد أوراق العمل", "حضور اجتماعات العملاء"] },
    needs: { en: ["Business or economics, third year or above", "Careful with numbers", "Excel"], ar: ["إدارة الأعمال أو الاقتصاد، السنة الثالثة فما فوق", "الدقة في الأرقام", "Excel"] },
    provides: { en: ["A monthly stipend", "A certificate of completion"], ar: ["مكافأة شهرية", "شهادة إتمام"] } });
  const J4 = await post(U.company2, { title: b("Junior accountant", "محاسب مبتدئ"), type: "full", level: "entry", gov: "damascus", place: b("Damascus, Abu Rummaneh", "دمشق، أبو رمانة"), pay: [110000, 140000], langs: ["ar"], recruits: [...rec("business"), ...rec("economics")], seats: 1,
    summary: b("Keep the books for a portfolio of small-business clients, with training on Syrian tax filing.", "مسك دفاتر مجموعة من عملائنا من الشركات الصغيرة، مع تدريب على التصريحات الضريبية السورية."),
    duties: { en: ["Record transactions and reconcile accounts", "Prepare monthly reports", "Help with tax filings"], ar: ["تسجيل المعاملات ومطابقة الحسابات", "إعداد التقارير الشهرية", "المساعدة في التصريحات الضريبية"] },
    needs: { en: ["A degree in accounting, business or economics", "Excel", "Up to two years' experience"], ar: ["شهادة في المحاسبة أو إدارة الأعمال أو الاقتصاد", "Excel", "خبرة حتى سنتين"] },
    provides: { en: ["A monthly salary", "Training"], ar: ["راتب شهري", "تدريب"] } });
  await call(router, U.company, "POST", `/api/employer/jobs/${J2}/sponsor`, { on: true });

  /* ---------- the people ---------- */
  await call(router, U.student, "PUT", "/api/me/profile", { profile: { ...person("Omar Nabil Al-Khatib", "عمر نبيل الخطيب", "homs", "petroleum", { year: 4, langs: ["ar", "en", "fr"], level: "lt1",
    skills: ["Excel", "AutoCAD", "Python", "Report writing", "Teamwork"],
    exp: [{ id: "d1", role: "Field intern", org: "Orontes Energy", place: "Homs", start: "2025-06", end: "2025-09", bullets: ["Logged pressure readings at 12 wells every day", "Cut daily report time from 3 days to 1 for the field team"] }] }),
    email: "omar.khatib@example.com", relocate: true, acts: [{ id: "d2", role: "Volunteer", org: "Syrian Arab Red Crescent", place: "Homs", start: "2023-01", current: true, bullets: ["Organised a first-aid course for 30 students"] }], certs: ["IELTS 7.0 (2024)"] } });
  await call(router, U.seeker, "PUT", "/api/me/profile", { profile: { ...person("Rania Saleh", "رانيا صالح", "damascus", "business", { status: "bachelor", gov: "damascus", grad: 2021, types: ["full"], level: "y1to3",
    skills: ["Sales", "Customer service", "Excel", "Stock management"],
    exp: [{ id: "d3", role: "Sales team leader", org: "Al-Sham Home Stores", place: "Damascus", start: "2022-03", current: true, bullets: ["Led 3 sales staff across two branches", "Raised monthly sales by 18% in one year"] },
          { id: "d4", role: "Sales assistant", org: "Al-Sham Home Stores", place: "Damascus", start: "2021-07", end: "2022-02", bullets: ["Served about 60 customers a day"] }] }), email: "rania.saleh@example.com" } });
  const extra = { sara: person("Sara Mahmoud", "سارة محمود", "homs", "business", { year: 3 }), yazan: person("Yazan Darwish", "يزن درويش", "homs", "petroleum", { year: 4, skills: ["Excel", "Stock control", "AutoCAD"] }),
    lama: person("Lama Khoury", "لمى خوري", "damascus", "economics", { status: "bachelor", gov: "damascus", grad: 2025 }), hadi: person("Hadi Al-Ali", "هادي العلي", "homs", "business", { year: 4 }),
    nour: person("Nour Haddad", "نور حداد", "homs", "informatics", { year: 2, skills: ["Python", "Excel", "Web design"] }) };
  for (const [k, p] of Object.entries(extra)) await call(router, U[k], "PUT", "/api/me/profile", { profile: p });
  for (const k of ["student", "seeker", "sara", "yazan", "lama", "hadi", "nour"]) await call(router, U[k], "PUT", "/api/me/recruit", { open: true });

  /* ---------- recruiters reach out, people reply ---------- */
  const inviteJob = (co, who, job, message) => call(router, co, "POST", `/api/employer/students/${U[who].id}/invite`, { kind: "job", jobId: job, message });
  const lastInvite = who => db.get("SELECT id FROM invitations WHERE user_id = ? ORDER BY id DESC LIMIT 1", U[who].id).id;
  await inviteJob(U.company2, "student", J3, "Hi Omar, your field internship stood out. Would you like to apply for our audit internship in Homs?");
  await call(router, U.student, "POST", `/api/me/invitations/${lastInvite("student")}/respond`, { answer: "yes" });
  await inviteJob(U.company2, "seeker", J4, "Hello Rania, your retail experience is a good fit for client work. We'd be glad to see your application.");
  await inviteJob(U.company, "yazan", J1, "Hi Yazan, we're looking for an operations intern at our Homs depot. Your stock-control skills caught our eye.");
  await call(router, U.yazan, "POST", `/api/me/invitations/${lastInvite("yazan")}/respond`, { answer: "yes" });
  await inviteJob(U.company2, "lama", J4, "Hi Lama, we'd like you to apply for our junior accountant role.");
  await call(router, U.company, "POST", `/api/employer/students/${U.student.id}/invite`, { kind: "event", event: { title: "Careers day at Homs University", date: localIn(14).local.slice(0, 10), place: "Homs University, Faculty of Petroleum Engineering", link: "" },
    message: "We're hiring interns and graduates for our Homs depot. Come and meet the team." });

  /* ---------- applications at every stage ---------- */
  const apply = (who, job, channel = "web", lang = "ar") => call(router, U[who], "POST", `/api/jobs/${job}/apply`, { channel, cvLang: lang });
  const appOf = (who, job) => db.get("SELECT id FROM applications WHERE user_id = ? AND job_id = ?", U[who].id, job).id;
  const move = async (co, who, job, stages, note) => { for (const s of stages) await call(router, co, "PUT", `/api/employer/applications/${appOf(who, job)}`, { status: s, ...(note ? { note } : {}) }); };
  await apply("student", J1, "web", "en"); await apply("student", J3, "web", "en");
  await apply("seeker", J2, "whatsapp"); await apply("seeker", J4);
  await apply("sara", J1); await apply("yazan", J1); await apply("hadi", J2); await apply("lama", J4); await apply("nour", J3);
  await move(U.company, "student", J1, ["shortlisted"], "Strong field experience. Call about start date.");
  await move(U.company, "seeker", J2, ["shortlisted", "interview"], "Interview on Sunday at 11, Mezzeh office.");
  await move(U.company, "yazan", J1, ["shortlisted", "interview", "hired"]);
  db.run("UPDATE applications SET hire_confirmed_at = ? WHERE id = ?", now(), appOf("yazan", J1));   // in the demo, the hire is already confirmed
  await move(U.company2, "student", J3, ["shortlisted", "interview"]);
  await move(U.company2, "seeker", J4, ["rejected"]);
  await move(U.company2, "lama", J4, ["shortlisted"]);
  // Yasmin Trading's team: Lina (admin) and Karim (hiring manager) joined; Fadi has asked to join.
  await call(router, U.company, "POST", "/api/employer/team", { name: "Lina Haddad", phone: EXTRA.lina, role: "admin" }); await call(router, U.lina, "POST", "/api/employer/membership/accept");
  await call(router, U.company, "POST", "/api/employer/team", { name: "Karim Nasser", phone: EXTRA.karim, role: "hiring_manager" }); await call(router, U.karim, "POST", "/api/employer/membership/accept");
  await call(router, U.fadi, "POST", `/api/employer/companies/${Y.id}/join`, { name: "Fadi Mansour" });
  await call(router, U.karim, "PUT", `/api/employer/applications/${appOf("sara", J1)}`, { note: "Good questions about the depot. Worth a call." });
  for (const j of [J4, J2]) await call(router, U.student, "POST", `/api/me/saved/${j}`);
  await call(router, U.student, "POST", "/api/me/alerts", { alert: { tab: "intern" }, channel: "app" });
  await call(router, U.seeker, "POST", "/api/me/alerts", { alert: { gov: "damascus", q: "sales" }, channel: "app" });

  /* ---------- the university: verification, partners ---------- */
  db.run("INSERT OR IGNORE INTO campus_offices (user_id, uni, faculty, name, created_at) VALUES (?, 'homs', '', ?, ?)", U.university.id, "Homs University Career Office", now());
  const office = { ...U.university, role: "university" };
  // Students verify with their university email. The demo domain is fictional, like everything else here.
  await call(router, office, "POST", "/api/campus/domains", { domain: "student.homs-university.example" });
  for (const [who, email] of [["student", "omar.khatib@student.homs-university.example"], ["yazan", "yazan.darwish@student.homs-university.example"]])
    db.run("INSERT INTO student_verifications (user_id, uni, student_no, status, email, method, created_at, decided_at) VALUES (?, 'homs', '', 'verified', ?, 'email', ?, ?)", U[who].id, email, now(), now());
  await call(router, U.company, "POST", "/api/employer/partners", { uni: "homs" }); await call(router, office, "POST", `/api/campus/partners/${Y.id}`, { decision: "yes" });
  await call(router, U.company2, "POST", "/api/employer/partners", { uni: "homs" });   // waiting for the office

  /* ---------- events: two upcoming at the university, one in Damascus, one past with a report ---------- */
  const ev = async (o, days, event) => (await call(router, o, "POST", "/api/organize/events", { publish: true, event: { ...event, startsLocal: localIn(days).local } })).event.id;
  const E1 = await ev(office, 14, { kind: "careers_day", host: "Sample business council", capacity: 120, gov: "homs", title: b("Careers Day at Homs University", "يوم المهن في جامعة حمص"),
    place: b("Faculty of Petroleum Engineering, main hall", "كلية هندسة البترول، القاعة الرئيسية"), about: b("Meet companies hiring interns and graduates in Homs and across Syria. Bring your ticket, and a copy of your resume if you have one.", "التقِ بشركات توظّف متدربين وخريجين في حمص وفي كل سوريا. أحضر تذكرتك، ونسخة من سيرتك الذاتية إن وُجدت.") });
  const E2 = await ev(office, 35, { kind: "internship_fair", capacity: 200, gov: "homs", title: b("Summer Internship Fair 2027", "معرض تدريب صيف 2027"), place: b("Homs University, central library", "جامعة حمص، المكتبة المركزية"),
    about: b("Companies with summer internship programmes, all in one afternoon.", "شركات لديها برامج تدريب صيفية، في عصر واحد.") });
  const insertEvent = (days, uni, data, status = "published") => Number(db.run("INSERT INTO events (data, starts_at, status, uni, capacity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 80, ?, ?, ?)",
    JSON.stringify({ ...data, startsLocal: localIn(days).local, demo: true }), localIn(days).at, status, uni, U.university.id, now(), now()).lastInsertRowid);
  const E3 = insertEvent(21, "", { kind: "talent_session", host: "Sample business council", gov: "damascus", title: b("Talent session: hiring in Damascus", "لقاء مواهب: التوظيف في دمشق"), place: b("Damascus, Four Seasons conference hall", "دمشق، قاعة المؤتمرات"),
    about: b("A short talk on hiring in Syria, then time to meet the companies.", "حديث قصير عن التوظيف في سوريا، ثم وقت للقاء الشركات.") });
  const E0 = insertEvent(-20, "homs", { kind: "careers_day", host: "Sample business council", gov: "homs", title: b("Spring Careers Day", "يوم المهن الربيعي"), place: b("Homs University, main hall", "جامعة حمص، القاعة الرئيسية"),
    about: b("Our spring careers day.", "يوم المهن الربيعي.") });
  const addCo = (e, c, s) => db.run("INSERT OR IGNORE INTO event_companies (event_id, company_id, status, created_at) VALUES (?, ?, ?, ?)", e, c.id, s, now());
  addCo(E1, Y, "confirmed"); addCo(E1, Q, "requested"); addCo(E2, Y, "confirmed"); addCo(E2, Q, "confirmed"); addCo(E3, Q, "confirmed"); addCo(E3, Y, "confirmed"); addCo(E0, Y, "confirmed"); addCo(E0, Q, "confirmed");
  for (const [e, who] of [[E1, "student"], [E1, "sara"], [E1, "yazan"], [E1, "hadi"], [E1, "nour"], [E2, "student"], [E2, "nour"], [E3, "seeker"], [E3, "lama"]])
    if (e === E3) { const code = "D" + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[01IO]/g, "X"); db.run("INSERT OR IGNORE INTO event_rsvps (event_id, user_id, code, created_at) VALUES (?, ?, ?, ?)", e, U[who].id, code.slice(0, 6), now()); }
    else await call(router, U[who], "POST", `/api/events/${e}/rsvp`);
  const past = [["student", "PAST01"], ["yazan", "PAST02"], ["sara", "PAST03"], ["hadi", "PAST04"]];
  for (const [who, code] of past) db.run("INSERT OR IGNORE INTO event_rsvps (event_id, user_id, code, created_at, checked_in_at) VALUES (?, ?, ?, ?, ?)", E0, U[who].id, code.replace(/[01IO]/g, "X"), localIn(-25).at, who === "hadi" ? null : localIn(-20).at);
  log(`[demo] demo accounts ready: student ${DEMO.student}, job seeker ${DEMO.seeker}, company ${DEMO.company}, university ${DEMO.university}`);
}

/* Remove every demo account and everything they made, and don't create them again. */
export function purgeDemo(db) {
  return db.tx(() => {
    const users = DEMO_PHONES.map(p => db.get("SELECT id FROM users WHERE phone = ?", p)).filter(Boolean).map(u => u.id);
    const cos = users.length ? db.all(/* sql-safe: only "?" placeholders */ `SELECT id FROM companies WHERE owner_id IN (${users.map(() => "?").join(",")})`, ...users).map(c => c.id) : [];
    const jobs = cos.length ? db.all(/* sql-safe: only "?" placeholders */ `SELECT id FROM jobs WHERE company_id IN (${cos.map(() => "?").join(",")})`, ...cos).map(j => j.id) : [];
    const ph = a => a.map(() => "?").join(",") || "NULL";
    const events = db.all("SELECT id FROM events WHERE json_extract(data, '$.demo') = 1 OR created_by IN (" + ph(users) + ")", ...users).map(e => e.id);   /* sql-safe: only "?" placeholders */
    const del = (sql, ids) => { if (ids.length) db.run(sql.replace("(?)", "(" + ph(ids) + ")"), ...ids); };   /* sql-safe: only "?" placeholders */
    del("DELETE FROM event_rsvps WHERE event_id IN (?)", events); del("DELETE FROM event_companies WHERE event_id IN (?)", events); del("DELETE FROM events WHERE id IN (?)", events);
    del("DELETE FROM event_rsvps WHERE user_id IN (?)", users); del("DELETE FROM event_companies WHERE company_id IN (?)", cos);
    del("DELETE FROM applications WHERE job_id IN (?)", jobs); del("DELETE FROM applications WHERE user_id IN (?)", users);
    del("DELETE FROM saved WHERE job_id IN (?)", jobs); del("DELETE FROM saved WHERE user_id IN (?)", users);
    del("DELETE FROM invitations WHERE company_id IN (?)", cos); del("DELETE FROM invitations WHERE user_id IN (?)", users);
    del("DELETE FROM charges WHERE company_id IN (?)", cos); del("DELETE FROM uni_partners WHERE company_id IN (?)", cos); db.run("DELETE FROM uni_domains WHERE domain LIKE '%.example'"); del("DELETE FROM plan_requests WHERE company_id IN (?)", cos);
    del("DELETE FROM jobs WHERE id IN (?)", jobs); del("DELETE FROM company_members WHERE company_id IN (?)", cos); del("DELETE FROM companies WHERE id IN (?)", cos);
    for (const t of ["student_verifications", "email_codes", "alerts", "profiles", "sessions", "campus_offices"]) del(`DELETE FROM ${t} WHERE user_id IN (?)`, users);   /* sql-safe: fixed table names */
    del("DELETE FROM users WHERE id IN (?)", users);
    db.run("INSERT INTO audit (action, data, created_at) VALUES ('demo-accounts.purged', ?, ?)", JSON.stringify({ users: users.length, companies: cos.length, jobs: jobs.length, events: events.length }), now());
    return { users: users.length, companies: cos.length, jobs: jobs.length, events: events.length };
  });
}

/* The demo sign-in, and what the home screen and Lite need to know. Nothing at all in production. */
export function registerDemo(r, { db, cfg, auth }) {
  if (!demoOn(cfg)) return;
  cfg.demoPhones = DEMO_PHONES;   // so the admin's insights can leave the demo out
  cfg.demoConfig = () => Object.entries(DEMO).filter(([, p]) => db.get("SELECT 1 AS x FROM users WHERE phone = ? AND deleted_at IS NULL", p)).map(([who, phone]) => ({ who, phone }));
  cfg.demoLiteHint = lg => (lg === "ar" ? "حسابات تجريبية: 0933 000 101 (طالب جامعي)، 0933 000 102 (باحث عن عمل). للشركة استخدم 0955 000 201 في صفحة جهات التوظيف (/lite/hire). يظهر الرمز على الشاشة."
    : "Demo accounts: 0933 000 101 (university student), 0933 000 102 (job seeker). For the company, use 0955 000 201 on the recruiters’ page (/lite/hire). The code is shown on screen.");
  r.post("/api/auth/demo", ctx => {
    const phone = DEMO[ctx.body.who]; if (!phone) fail(404, "not_found");
    const u = db.get("SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL", phone); if (!u) fail(404, "not_found");
    auth.startSession(ctx, u);
    return { user: auth.publicUser(u) };
  });
}
