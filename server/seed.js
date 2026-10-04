/* Demo data: the 19 sample listings as verified demo companies, so a fresh install is not empty.
   Demo rows are flagged is_demo and never counted in the admin metrics. Set SEED_DEMO=false to skip. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { now } from "./db.js";

function seedDemoBase(db, log = console.log) {
  // Seed once: never again after demo data was removed, and never into a database that already has companies.
  if (db.get("SELECT 1 AS x FROM audit WHERE action IN ('demo.seeded', 'demo.removed') LIMIT 1")) return false;
  if (db.get("SELECT COUNT(*) AS n FROM companies").n > 0) return false;
  const seed = JSON.parse(readFileSync(path.join(ROOT, "seed", "demo.json"), "utf8"));
  const ids = new Map();
  db.tx(() => {
    for (const c of seed.companies) {
      const data = { name: c.name, abbr: c.abbr, sector: c.sector, cat: c.cat, gov: c.gov, about: c.about, whatsapp: "", website: "", regNo: "demo", contactName: "" };
      const id = Number(db.run("INSERT INTO companies (data, status, is_demo, screened_at, verified_at, created_at, updated_at) VALUES (?, 'verified', 1, ?, ?, ?, ?)",
        JSON.stringify(data), now(), now(), now(), now()).lastInsertRowid);
      ids.set(c.key, id);
    }
    for (const j of seed.jobs) {
      const { company, daysAgo, ...data } = j;
      const pub = now() - (daysAgo || 0) * 86400e3 - 3600e3;
      db.run("INSERT INTO jobs (company_id, data, status, is_demo, published_at, created_at, updated_at) VALUES (?, ?, 'published', 1, ?, ?, ?)",
        ids.get(company), JSON.stringify(data), pub, pub, pub);
    }
  });
  db.run("INSERT INTO audit (action, data, created_at) VALUES ('demo.seeded', ?, ?)", JSON.stringify({ companies: seed.companies.length, jobs: seed.jobs.length }), now());
  log(`[seed] ${seed.companies.length} demo companies and ${seed.jobs.length} demo jobs added`);
  return true;
}

/* The demo marks jobs at international companies as welcoming Syrians coming home, so the filter has something to show. */
export function seedDemo(db, log = console.log) {
  const r = seedDemoBase(db, log);
  db.run(`UPDATE jobs SET data = json_set(data, '$.returnees', json('true')) WHERE company_id IN (SELECT id FROM companies WHERE json_extract(data, '$.cat') = 'multinational')`);
  return r;
}
