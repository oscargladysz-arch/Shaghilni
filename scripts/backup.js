/* Consistent backup while the site keeps running: VACUUM INTO writes a compact copy of the database.
   Usage: npm run backup [-- /path/to/folder]   (default folder: ./backups) */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { loadConfig, ROOT } from "../server/config.js";

const cfg = loadConfig();
if (!existsSync(cfg.dbPath) || !statSync(cfg.dbPath).size) { console.error(`No database at ${cfg.dbPath}: check DB_PATH. Nothing was backed up.`); process.exit(1); }   // never copy an empty database and call it a backup (U-059)
const dir = path.resolve(process.argv[2] || path.join(ROOT, "backups"));
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const out = path.join(dir, `shaghilni-${stamp}.db`);
const db = new DatabaseSync(cfg.dbPath);
db.exec(/* sql-safe: operator-supplied path, quotes escaped */ `VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup written: ${out}`);
