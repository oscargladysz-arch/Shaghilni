/* Runs the same tested client engine on the server (phone rules, posting checks, resume fact guard),
   so browser and server can never disagree about a rule. */
import vm from "node:vm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";

const FILES = ["lookups.js", "i18n.js", "i18n2.js", "i18n3.js", "i18n4.js", "engine.js"];

export function loadCore() {
  const ctx = vm.createContext({ console, S: { lang: "en", gov: "all", qTerms: [], tab: "all", sort: "recent", saved: new Set() }, PROFILE: null, OB: {}, CV: { over: false } });
  for (const f of FILES) vm.runInContext(readFileSync(path.join(ROOT, "public", "js", f), "utf8"), ctx, { filename: f });
  // Lite asks for a job's fit on the server: set the profile, score, and put it back. It runs synchronously, so requests can't overlap.
  vm.runInContext("function fitFor(me, j) { const prev = PROFILE; PROFILE = deriveProfile(me); try { return assess(j); } finally { PROFILE = prev; } }", ctx);
  return vm.runInContext(`({ normPhone, norm, trSources, translitName, parseResumeText, mergeImported, buildResume, plainResume, fmtRange, fitFor, alertMatches, alertLabel, placeOf, scriptOf, sameNumbers, findGender, findFee, factGuard, factsText, jobPlain, aiPrompt, initialsOf,
    GOV, GOV_ORDER, COUNTRY, DIAL, UNI, FAC, CAT, SECTOR, TYPE, LEVEL, MODE, LANGS, INTERESTS, STR, fill })`, ctx);
}
