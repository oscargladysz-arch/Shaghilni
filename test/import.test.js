/* Reading a resume someone already has, and writing names in the other script. Both run on the person's
   device; these tests load the same browser files the app ships. */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { loadCore } from "../server/core.js";

const core = loadCore();
const src = f => readFileSync(new URL(`../public/js/${f}`, import.meta.url), "utf8");
const ctx = vm.createContext({ console, S: { lang: "en", saved: new Set() }, PROFILE: null, OB: {}, CV: {}, DecompressionStream, TextDecoder, Blob, Response });
for (const f of ["lookups.js", "i18n.js", "i18n2.js", "i18n3.js", "i18n4.js", "engine.js", "cv-import.js"]) vm.runInContext(src(f), ctx, { filename: f });
const { extractResumeText } = vm.runInContext("({ extractResumeText })", ctx);
const fixture = f => new Uint8Array(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)));
// The engine runs in its own sandbox, so its arrays have that realm's prototype: compare plain copies.
const same = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const read = async f => core.parseResumeText(await extractResumeText(fixture(f), f));

test("names: common Syrian names both ways, including compound and family names", () => {
  for (const [ar, en] of [["كنان عبد النور", "Kinan Abdelnour"], ["ريا أبو جراب", "Rea Abujrab"], ["عمر نبيل الخطيب", "Omar Nabil Al-Khatib"], ["لينا حداد", "Lina Haddad"]]) {
    assert.equal(core.translitName(ar, "en"), en); assert.equal(core.translitName(en, "ar"), ar);
  }
  assert.equal(core.translitName("محمد عبد الرحمن الحلبي", "en"), "Mohammad Abdulrahman Al-Halabi");
  assert.equal(core.translitName("يزن عبدالله", "en"), "Yazan Abdullah");
  assert.equal(core.translitName("Tarek Abu Saleh", "ar"), "طارق أبو صالح");
  assert.equal(core.translitName("Bassel Alshami", "ar"), "باسل الشامي");
  assert.equal(core.translitName("Lina Haddad", "en"), "Lina Haddad", "a name already in that script is left alone");
  assert.match(core.translitName("سمير ضاهر", "en"), /^Samir [A-Z][a-z]+$/, "names we don't know are still spelled out");
});

test("names: the resume shows the name in its language without anyone typing it", () => {
  const me = { v: 1, role: "student", name: "لينا حداد", nameEn: "", nameAr: "", phone: "+963944111222", email: "", gov: "damascus", langs: ["ar"],
    edu: { status: "student", uni: "damascus", fac: "telecom", year: 3, grad: 2027, gpa: "", course: "", honors: "" }, prefs: { types: [], fields: [], level: "" }, exp: [], acts: [], skills: [], certs: [], tailor: {}, tr: { en: [], ar: [] } };
  const R = core.buildResume(me, "general", "en");
  same([R.name, R.nameAuto, R.nameMissing], ["Lina Haddad", true, false]);
  assert.equal(core.buildResume({ ...me, nameEn: "Leena Haddad" }, "general", "en").name, "Leena Haddad", "a typed spelling wins");
  assert.equal(core.buildResume(me, "general", "ar").name, "لينا حداد");
});

test("reading resumes: Word, LibreOffice PDF and Chrome PDF files, in English", async () => {
  for (const f of ["resume-en.docx", "resume-en-lo.pdf", "resume-en-chrome.pdf"]) {
    const r = await read(f);
    assert.equal(r.name, "Omar Nabil Al-Khatib", f); assert.equal(r.email, "omar.khatib@example.com", f);
    same([r.edu.uni, r.edu.fac, r.edu.status, r.edu.year, r.edu.grad, r.edu.gpa], ["homs", "petroleum", "student", 4, 2027, "3.4/4"], f);
    same(r.exp.map(e => [e.role, e.org, e.place, e.start, e.end, e.bullets.length]),
      [["Field Intern", "Orontes Energy", "Homs", "2025-06", "2025-09", 2], ["Data Entry Assistant", "Barada Logistics", "", "2024-01", "2025-12", 1]], f);
    same(r.acts.map(e => [e.role, e.org, e.start, e.current]), [["Volunteer", "Syrian Arab Red Crescent", "2023-01", true]], f);
    same(r.skills, ["Excel", "AutoCAD", "Python", "Report writing"], f);
    same(r.langs, ["ar", "en", "fr"], f);
    same(r.certs, ["IELTS 7.0 (2024)", "HSE Level 1 safety training"], f);
    assert.equal(r.notes.approx, true, f + ": year-only dates are flagged for checking");
  }
});

test("reading resumes: the same files in Arabic, in reading order", async () => {
  for (const f of ["resume-ar.docx", "resume-ar-lo.pdf", "resume-ar-chrome.pdf"]) {
    const r = await read(f);
    assert.equal(r.name, "عمر نبيل الخطيب", f); assert.equal(r.email, "omar.khatib@example.com", f);
    same([r.edu.uni, r.edu.fac, r.edu.status, r.edu.year, r.edu.grad, r.edu.gpa], ["homs", "petroleum", "student", 4, 2027, "78%"], f);
    same(r.exp.map(e => [e.role, e.org, e.place, e.start, e.end, e.bullets.length]), [["متدرب ميداني", "شركة العاصي للطاقة", "حمص", "2025-06", "2025-09", 2]], f);
    const bare = x => x.replace(/[\u064b-\u0652]/g, "");   // PDFs often drop optional vowel marks such as tanween
    assert.equal(bare(r.exp[0].bullets[0]), bare("سجلت قراءات الضغط في 12 بئراً يومياً"), f);
    same(r.acts.map(e => [e.role, e.org, e.current]), [["متطوع", "الهلال الأحمر العربي السوري", true]], f);
    same(r.skills, ["Excel", "AutoCAD", "كتابة التقارير"], f);
    same(r.langs, ["ar", "en"], f);
    same(r.certs, ["IELTS 7.0"], f);
  }
});

test("reading resumes: files we can't read say why, and nothing is ever sent anywhere", async () => {
  const code = async (bytes, name, type) => { try { await extractResumeText(bytes, name, type); return "read"; } catch (e) { return e.code; } };
  assert.equal(await code(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), "old.doc"), "im_old_doc");
  assert.equal(await code(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "cv.jpg", "image/jpeg"), "im_image");
  assert.equal(await code(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj"), "cv.pdf"), "im_locked");
  assert.equal(await code(new Uint8Array([1, 2, 3, 4, 5]), "cv.xyz"), "im_type");
  assert.doesNotMatch(src("cv-import.js"), /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|api\.(get|post|put|del)\(/, "the importer makes no network calls");
});

test("adding a resume to a profile fills gaps and never replaces anything", () => {
  const me = { name: "لينا حداد", nameEn: "", nameAr: "", email: "lina@example.com", langs: ["ar"], edu: { status: "student", uni: "damascus", fac: "telecom", year: 3, grad: 2027, gpa: "" },
    exp: [{ id: "a", role: "Field Intern", org: "Orontes Energy", bullets: [] }], acts: [], skills: ["Excel"], certs: [] };
  const imp = { name: "Lina Haddad", email: "other@example.com", langs: ["ar", "en"], skills: ["excel", "AutoCAD"], certs: ["IELTS 7.0"], honors: "",
    edu: { uni: "homs", fac: "petroleum", grad: 2026, year: 4, gpa: "3.4/4", status: "bachelor" }, acts: [],
    exp: [{ role: "Field intern", org: "Orontes energy", bullets: [] }, { role: "Tutor", org: "Nour Centre", bullets: [] }] };
  const { me: out, added } = core.mergeImported(me, imp);
  assert.equal(out.name, "لينا حداد");
  assert.equal(out.nameEn, "Lina Haddad", "a name in the other script fills that version of the name");
  assert.equal(out.email, "lina@example.com");
  same([out.edu.uni, out.edu.fac, out.edu.grad, out.edu.year, out.edu.gpa, out.edu.status], ["damascus", "telecom", 2027, 3, "3.4/4", "student"]);
  same(out.exp.map(e => e.org), ["Orontes Energy", "Nour Centre"], "the same job isn't added twice");
  same([out.skills, out.langs, out.certs], [["Excel", "AutoCAD"], ["ar", "en"], ["IELTS 7.0"]]);
  same([added.exp, added.skills, added.any], [1, 1, true]);
  assert.equal(me.skills.length, 1, "the profile passed in isn't changed");
});
