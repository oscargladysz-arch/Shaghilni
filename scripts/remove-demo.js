/* Removes the seeded demo companies and listings (and any applications or saves made on them).
   Real accounts, companies and listings are untouched. Usage: npm run demo:remove */
import { loadConfig } from "../server/config.js";
import { openDb, now } from "../server/db.js";

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const r = db.tx(() => {
  const jobs = db.run("DELETE FROM jobs WHERE is_demo = 1").changes;
  const companies = db.run("DELETE FROM companies WHERE is_demo = 1").changes;
  db.run("INSERT INTO audit (action, data, created_at) VALUES ('demo.removed', ?, ?)", JSON.stringify({ jobs, companies }), now());
  return { jobs, companies };
});
db.close();
console.log(`Removed ${r.jobs} demo listings and ${r.companies} demo companies. They will not be seeded again.`);
