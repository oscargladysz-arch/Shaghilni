/* Both languages, always: STR.en and STR.ar carry the same keys with the same {placeholders}, no Arabic value is
   empty or Latin-only (apart from a short allow-list of brand names, units and codes), and no key is defined twice
   inside one string table (a later duplicate silently wins, which is how D-16 happened). The duplicate counts are
   ratcheted in test/ratchets.json: they may only go down. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const JS = f => readFileSync(new URL(`../public/js/${f}`, import.meta.url), "utf8");
const FILES = ["lookups.js", "i18n.js", "i18n2.js", "i18n3.js", "i18n4.js"];
const RATCHETS = new URL("./ratchets.json", import.meta.url);
/* Arabic values with no Arabic letters that are right as they are: a language name shown in English, brand names, units, codes and placeholders. */
const LATIN_OK = new Set(["langOther", "langAria", "aSubtitle", "waNum", "pPayPh", "pPayPh2", "syNode", "cpDomainPh"]);

function loadSTR(files) {
  const ctx = { window: {}, navigator: {}, document: undefined, localStorage: undefined, console };
  vm.createContext(ctx);
  vm.runInContext(files.map(JS).join("\n") + "\n;globalThis.__STR = STR;", ctx);
  return ctx.__STR;
}
const placeholders = s => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
const hasArabic = s => /[؀-ۿ]/.test(String(s));
const flat = (v, path = "") => typeof v === "object" && v !== null ? Object.entries(v).flatMap(([k, x]) => flat(x, path ? `${path}.${k}` : k)) : [[path, v]];

/* Top-level keys of every string-table literal in a source file: `Object.assign(STR.en, {…})` blocks and the `en: {…}` / `ar: {…}` members of the first file.
   A small tokenizer walks the literal, skipping strings and nested braces, so inline plural objects ({ one, other }) and text that merely contains "word:" are not counted. */
function literals(src) {
  const out = [], starts = [];
  for (const m of src.matchAll(/Object\.assign\(STR\.(en|ar),\s*\{/g)) starts.push({ lang: m[1], at: m.index + m[0].length });
  for (const m of src.matchAll(/^(en|ar): \{/gm)) starts.push({ lang: m[1], at: m.index + m[0].length });
  for (const { lang, at } of starts) {
    const keys = []; let i = at, depth = 0, q = null, ident = "";
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; ident = ""; i++; continue; }
      if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 2; continue; }
      if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
      if (c === "{" || c === "[") { depth++; ident = ""; i++; continue; }
      if (c === "}" || c === "]") { if (depth === 0) break; depth--; ident = ""; i++; continue; }
      if (depth === 0) {
        if (/[A-Za-z0-9_$]/.test(c)) ident += c;
        else if (c === ":" && ident) { keys.push(ident); ident = ""; }
        else if (!/\s/.test(c)) ident = "";
      }
      i++;
    }
    out.push({ lang, keys });
  }
  return out;
}

test("i18n: STR.en and STR.ar have the same keys, the same placeholders, and no empty or Latin-only Arabic outside the allow-list", () => {
  const STR = loadSTR(FILES);
  const en = Object.keys(STR.en), ar = Object.keys(STR.ar), setEn = new Set(en), setAr = new Set(ar);
  assert.deepEqual(en.filter(k => !setAr.has(k)), [], "keys missing from Arabic");
  assert.deepEqual(ar.filter(k => !setEn.has(k)), [], "keys missing from English");
  const mismatch = [], empty = [], latin = [];
  const union = list => [...new Set(list.flatMap(x => placeholders(x[1]).split(",").filter(Boolean)))].sort().join(",");
  for (const k of en) {
    const fe = flat(STR.en[k], k), fa = flat(STR.ar[k], k), objEn = typeof STR.en[k] === "object", objAr = typeof STR.ar[k] === "object";
    if (objEn !== objAr) mismatch.push(`${k}: an object in one language and a string in the other`);
    else if (objEn && "other" in STR.en[k]) {   // plural forms: Arabic has more categories (zero, one, two, few, many, other) than English, so compare the set of placeholders across all forms
      for (const need of ["one", "other"]) if (!(need in STR.ar[k])) mismatch.push(`${k}: Arabic plural form lacks "${need}"`);
      if (union(fe) !== union(fa)) mismatch.push(`${k}: {placeholders} across plural forms ${union(fe)} vs ${union(fa)}`);
    } else if (objEn) {   // a plain map (for example ordinal names): same keys, same placeholders per key
      if (fe.map(x => x[0]).join("|") !== fa.map(x => x[0]).join("|")) mismatch.push(`${k}: map keys ${fe.map(x => x[0]).join("|")} vs ${fa.map(x => x[0]).join("|")}`);
      else for (let i = 0; i < fe.length; i++) if (placeholders(fe[i][1]) !== placeholders(fa[i][1])) mismatch.push(`${fa[i][0]}: {placeholders} ${placeholders(fe[i][1])} vs ${placeholders(fa[i][1])}`);
    } else if (placeholders(fe[0][1]) !== placeholders(fa[0][1])) mismatch.push(`${k}: {placeholders} ${placeholders(fe[0][1])} vs ${placeholders(fa[0][1])}`);
    for (let i = 0; i < fa.length; i++) if (!String(fa[i][1]).trim() && String((fe[i] || [])[1] || "").trim()) empty.push(fa[i][0]);   // empty in Arabic where English has text (an empty slot in both, such as an ordinal table's zero, is fine)
    if (!fa.some(x => hasArabic(x[1])) && !LATIN_OK.has(k)) latin.push(`${k}=${JSON.stringify(STR.ar[k]).slice(0, 60)}`);
  }
  assert.deepEqual(mismatch, [], "placeholder or shape mismatches:\n" + mismatch.join("\n"));
  assert.deepEqual(empty, [], "empty Arabic values: " + empty.join(", "));
  assert.deepEqual(latin, [], "Arabic values with no Arabic letters, not in the allow-list:\n" + latin.join("\n"));
  for (const k of LATIN_OK) assert.ok(setAr.has(k), `allow-list key ${k} no longer exists: remove it from the list`);
  console.log(`i18n: ${en.length} keys in each language; ${LATIN_OK.size} allow-listed Latin-only Arabic values`);
});

test("i18n: no key is defined twice inside one string table (ratchet: the counts only go down)", () => {
  const dups = { en: [], ar: [] };
  for (const f of FILES.slice(1)) for (const { lang, keys } of literals(JS(f))) {
    const seen = new Map(); for (const k of keys) seen.set(k, (seen.get(k) || 0) + 1);
    for (const [k, n] of seen) if (n > 1) dups[lang].push(`${f}:${k}×${n}`);
  }
  const ratchets = JSON.parse(readFileSync(RATCHETS, "utf8"));
  const r = ratchets.i18nDuplicateKeys;
  assert.ok(r && Number.isInteger(r.en) && Number.isInteger(r.ar), `test/ratchets.json needs i18nDuplicateKeys; measured now: en ${dups.en.length}, ar ${dups.ar.length}: ${[...dups.en, ...dups.ar].join(" ")}`);
  console.log(`i18n duplicates: en ${dups.en.length} (ratchet ${r.en}), ar ${dups.ar.length} (ratchet ${r.ar})`);
  assert.ok(dups.en.length <= r.en, `English duplicate keys went up: ${dups.en.join(" ")}`);
  assert.ok(dups.ar.length <= r.ar, `Arabic duplicate keys went up: ${dups.ar.join(" ")}`);
  if (dups.en.length < r.en || dups.ar.length < r.ar) console.log(`i18n duplicates fell: lower test/ratchets.json to en ${dups.en.length}, ar ${dups.ar.length}`);
});
