/* Demo accounts: take them out when you're ready.
     npm run demo-accounts:purge       removes the demo accounts and everything they made from the database
     npm run demo-accounts:uninstall   deletes the demo code itself, leaving just the full app (then run npm test)
   The sample job listings are separate: npm run demo:remove takes those out. */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const what = process.argv[2];

if (what === "purge") {
  const { loadConfig } = await import("../server/config.js"), { openDb } = await import("../server/db.js"), { purgeDemo } = await import("../server/demo.js");
  const cfg = loadConfig(), db = openDb(cfg.dbPath), r = purgeDemo(db);
  console.log(`Removed ${r.users} demo people, ${r.companies} demo companies, ${r.jobs} of their listings and ${r.events} demo events. They won't be created again.`);
} else if (what === "uninstall") {
  const del = rel => { const f = path.join(ROOT, rel); if (existsSync(f)) { rmSync(f); console.log("deleted   " + rel); } };
  const edit = (rel, fn) => { const f = path.join(ROOT, rel); if (!existsSync(f)) return; const a = readFileSync(f, "utf8"), b = fn(a); if (a !== b) { writeFileSync(f, b); console.log("edited    " + rel); } };
  const dropMarked = s => s.split("\n").filter(l => !/\/\/ demo-accounts\b/.test(l)).join("\n");
  for (const rel of ["server/demo.js", "public/js/demo.js", "test/demo.test.js"]) del(rel);
  for (const rel of ["server/app.js", "server/assets.js", "server/config.js", "server/notify.js"]) edit(rel, dropMarked);
  edit("public/css/app.css", s => s.replace(/\/\* demo-accounts:start \*\/[\s\S]*?\/\* demo-accounts:end \*\/\n?/, ""));
  for (const rel of ["README.md", "SECURITY.md", "PRODUCT.md"]) edit(rel, s => s.replace(/<!-- demo-accounts:start -->[\s\S]*?<!-- demo-accounts:end -->\n?/g, ""));   // the docs that describe them (U-062)
  edit("package.json", s => { const p = JSON.parse(s); delete p.scripts["demo-accounts:purge"]; delete p.scripts["demo-accounts:uninstall"]; return JSON.stringify(p, null, 2) + "\n"; });
  del("scripts/demo-accounts.js");
  console.log("\nThe demo accounts are gone from the code. Run npm test to check. (Demo accounts already in a database: run the purge first, before uninstalling.)");
} else {
  console.log("Usage: npm run demo-accounts:purge | npm run demo-accounts:uninstall");
}
