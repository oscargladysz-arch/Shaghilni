/* Demo data: the sample listings of seed/demo.json as verified demo companies, so a fresh development install is not
   empty. A sample listing goes through the same posting checks as a real one (18 of the 19 pass: one has no pay) and
   its invented contact person is never loaded (D-15, pending owner decision D1).
   Demo rows are flagged is_demo and never counted in the admin metrics. Set SEED_DEMO=false to skip in development.
   Never seeded in production (server/config.js gates seedDemo on NODE_ENV); a production database that still holds
   demo rows is reported at start-up and on the admin Insights screen until npm run demo:remove has run. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { now } from "./db.js";
import { loadCore } from "./core.js";
import { sanitizeJob, checkJob } from "./validate.js";

function seedDemoBase(db, log = console.log) {
  // Seed once: never again after demo data was removed, and never into a database that already has companies.
  if (db.get("SELECT 1 AS x FROM audit WHERE action IN ('demo.seeded', 'demo.removed') LIMIT 1")) return false;
  if (db.get("SELECT COUNT(*) AS n FROM companies").n > 0) return false;
  const seed = JSON.parse(readFileSync(path.join(ROOT, "seed", "demo.json"), "utf8"));
  const ids = new Map(), core = loadCore(); let jobs = 0;
  db.tx(() => {
    for (const c of seed.companies) {
      const data = { name: c.name, abbr: c.abbr, sector: c.sector, cat: c.cat, gov: c.gov, about: c.about, whatsapp: "", website: "", regNo: "demo", contactName: "" };
      const id = Number(db.run("INSERT INTO companies (data, status, is_demo, screened_at, verified_at, created_at, updated_at) VALUES (?, 'verified', 1, ?, ?, ?, ?)",
        JSON.stringify(data), now(), now(), now(), now()).lastInsertRowid);
      ids.set(c.key, id);
    }
    for (const j of seed.jobs) {
      const { company, daysAgo, contact, ...data } = j;   // contact: the invented person at a real organisation stays in the file, never in the database (D-15)
      const chk = checkJob(core, sanitizeJob(core, data));   // the employer's posting checks apply to sample listings too (D-02)
      if (chk.missing.length || chk.fee) { log(`[seed] skipped sample listing "${(data.title || {}).en || ""}": ${chk.fee ? "fee wording" : "missing " + chk.missing.join(", ")}`); continue; }
      const pub = now() - (daysAgo || 0) * 86400e3 - 3600e3;
      db.run("INSERT INTO jobs (company_id, data, status, is_demo, published_at, created_at, updated_at) VALUES (?, ?, 'published', 1, ?, ?, ?)",
        ids.get(company), JSON.stringify(data), pub, pub, pub);
      jobs++;
    }
  });
  db.run("INSERT INTO audit (action, data, created_at) VALUES ('demo.seeded', ?, ?)", JSON.stringify({ companies: seed.companies.length, jobs }), now());
  log(`[seed] ${seed.companies.length} demo companies and ${jobs} demo jobs added`);
  return true;
}

/* How many demo rows a database still holds (the start-up log and the admin Insights screen use it). */
export function countDemo(db) {
  return { companies: db.get("SELECT COUNT(*) AS n FROM companies WHERE is_demo = 1").n, jobs: db.get("SELECT COUNT(*) AS n FROM jobs WHERE is_demo = 1").n };
}

/* The demo marks its own jobs at international companies as welcoming Syrians coming home, so the filter has something
   to show: only when it has just seeded, and only demo rows, never a real employer's listing (D-13). */
export function seedDemo(db, log = console.log) {
  const r = seedDemoBase(db, log);
  if (r) db.run(`UPDATE jobs SET data = json_set(data, '$.returnees', json('true')) WHERE is_demo = 1 AND company_id IN (SELECT id FROM companies WHERE is_demo = 1 AND json_extract(data, '$.cat') = 'multinational')`);
  return r;
}
