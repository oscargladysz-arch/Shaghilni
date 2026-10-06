/* SQLite through Node's built-in driver (node:sqlite). Numbered migrations tracked in PRAGMA user_version. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS = [
`CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('seeker','employer','admin')),
  lang TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en')),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  deleted_at INTEGER
);
CREATE TABLE otps (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  ip TEXT
);
CREATE INDEX otps_by_phone ON otps(phone, created_at);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ua TEXT
);
CREATE INDEX sessions_by_user ON sessions(user_id);
CREATE TABLE profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','verified','rejected','suspended')),
  review_note TEXT,
  screened_at INTEGER, screened_by INTEGER,
  verified_at INTEGER, verified_by INTEGER,
  submitted_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX companies_one_per_owner ON companies(owner_id) WHERE owner_id IS NOT NULL;
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected','closed')),
  review_note TEXT,
  flags TEXT NOT NULL DEFAULT '[]',
  submitted_at INTEGER,
  published_at INTEGER,
  reviewed_by INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_by_status ON jobs(status, published_at);
CREATE INDEX jobs_by_company ON jobs(company_id);
CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','shortlisted','interview','hired','rejected','withdrawn')),
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp')),
  snapshot TEXT NOT NULL,
  employer_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  hired_at INTEGER,
  hire_confirmed_at INTEGER,
  hire_confirmed_by INTEGER,
  UNIQUE (job_id, user_id)
);
CREATE INDEX applications_by_user ON applications(user_id);
CREATE INDEX applications_by_status ON applications(status, hired_at);
CREATE TABLE saved (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, job_id)
);
CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  data TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_by_entity ON audit(entity, entity_id);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);`,
`ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER;
CREATE TABLE usage (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);`,
`ALTER TABLE applications ADD COLUMN cv_lang TEXT;`,
`CREATE TABLE invitations (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  job_id INTEGER REFERENCES jobs(id),
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX invitations_user ON invitations(user_id, created_at);
CREATE INDEX invitations_company ON invitations(company_id, created_at);
CREATE TABLE recruiter_blocks (
  user_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, company_id)
);`,
`CREATE TABLE alerts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  data TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'app',
  created_at INTEGER NOT NULL,
  seen_at INTEGER,
  last_sent_at INTEGER
);
CREATE INDEX alerts_user ON alerts(user_id);`,
`ALTER TABLE companies ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE companies ADD COLUMN plan_until INTEGER;
ALTER TABLE jobs ADD COLUMN sponsored_until INTEGER;
ALTER TABLE applications ADD COLUMN programme_id INTEGER;
CREATE TABLE company_members (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  added_by INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (company_id, phone)
);
CREATE UNIQUE INDEX company_members_phone ON company_members(phone);
CREATE TABLE programmes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  rate_usd INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE charges (
  id INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  programme_id INTEGER REFERENCES programmes(id),
  application_id INTEGER,
  kind TEXT NOT NULL,
  amount_syp INTEGER NOT NULL DEFAULT 0,
  amount_usd INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'due',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX charges_company ON charges(company_id, status);
CREATE TABLE plan_requests (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  handled_at INTEGER
);`,
`ALTER TABLE plan_requests ADD COLUMN pay_method TEXT NOT NULL DEFAULT '';`,
`CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE UNIQUE INDEX payments_ref ON payments(provider, provider_ref);`,
`CREATE TABLE campus_offices (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  uni TEXT NOT NULL,
  faculty TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE student_verifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uni TEXT NOT NULL,
  student_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '',
  decided_by INTEGER,
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX student_verifications_uni ON student_verifications(uni, status);
CREATE INDEX student_verifications_user ON student_verifications(user_id);
CREATE TABLE uni_partners (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uni TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by INTEGER,
  PRIMARY KEY (company_id, uni)
);`,
// Allow university career-office accounts: SQLite can't change a CHECK constraint in place, so the users table is
// rebuilt from its own current definition (keeping every column added since) with only the role list changed.
db => {
  const cur = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().sql;
  const from = "CHECK (role IN ('seeker','employer','admin'))";
  if (!cur.includes(from)) throw new Error("users table: unexpected role constraint");
  const next = cur.replace(from, "CHECK (role IN ('seeker','employer','admin','university'))").replace(/^CREATE TABLE users\b/, "CREATE TABLE users_new");
  const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users' AND sql IS NOT NULL").all().map(r => r.sql);
  db.exec(/* sql-safe: the table's own stored definition, with one fixed substitution */ next);
  db.exec("INSERT INTO users_new SELECT * FROM users");
  db.exec("DROP TABLE users");
  db.exec("ALTER TABLE users_new RENAME TO users");
  for (const sql of indexes) db.exec(/* sql-safe: the table's own stored index definitions */ sql);
},
`CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  uni TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX events_start ON events(status, starts_at);
CREATE TABLE event_companies (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, company_id)
);
CREATE TABLE event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  created_at INTEGER NOT NULL,
  checked_in_at INTEGER,
  checked_in_by INTEGER,
  PRIMARY KEY (event_id, user_id)
);
CREATE UNIQUE INDEX event_rsvps_code ON event_rsvps(event_id, code);`,
`ALTER TABLE company_members ADD COLUMN role TEXT NOT NULL DEFAULT 'recruiter';
ALTER TABLE company_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE company_members ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE company_members ADD COLUMN user_id INTEGER;
ALTER TABLE company_members ADD COLUMN responded_at INTEGER;
ALTER TABLE jobs ADD COLUMN created_by INTEGER;
ALTER TABLE applications ADD COLUMN moved_by INTEGER;
ALTER TABLE applications ADD COLUMN note_by INTEGER;`,
`CREATE TABLE uni_domains (
  uni TEXT NOT NULL,
  domain TEXT NOT NULL,
  added_by INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (uni, domain)
);
CREATE UNIQUE INDEX uni_domains_domain ON uni_domains(domain);
CREATE TABLE email_codes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  uni TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE email_sends (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at INTEGER NOT NULL
);
CREATE INDEX email_sends_user ON email_sends(user_id, sent_at);
ALTER TABLE student_verifications ADD COLUMN email TEXT;
ALTER TABLE student_verifications ADD COLUMN method TEXT NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX student_verifications_email ON student_verifications(email) WHERE email IS NOT NULL AND status = 'verified';`,
// Applications can now arrive by phone call or email too: rebuild the table with the wider channel rule, as for users.
db => {
  const cur = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'applications'").get().sql;
  const from = "CHECK (channel IN ('web','whatsapp'))";
  if (!cur.includes(from)) throw new Error("applications table: unexpected channel constraint");
  const next = cur.replace(from, "CHECK (channel IN ('web','whatsapp','call','email'))").replace(/^CREATE TABLE applications\b/, "CREATE TABLE applications_new");
  const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'applications' AND sql IS NOT NULL").all().map(r => r.sql);
  db.exec(/* sql-safe: the table's own stored definition, with one fixed substitution */ next);
  db.exec("INSERT INTO applications_new SELECT * FROM applications");
  db.exec("DROP TABLE applications");
  db.exec("ALTER TABLE applications_new RENAME TO applications");
  for (const sql of indexes) db.exec(/* sql-safe: the table's own stored index definitions */ sql);
},
`CREATE TABLE pageviews (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT 'app',
  lang TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  conn TEXT NOT NULL DEFAULT '',
  load_ms INTEGER,
  role TEXT NOT NULL DEFAULT 'guest',
  country TEXT NOT NULL DEFAULT ''
);
CREATE INDEX pageviews_day ON pageviews(day);
CREATE INDEX pageviews_at ON pageviews(at);
CREATE TABLE shares (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL, app TEXT NOT NULL, path TEXT NOT NULL);
CREATE INDEX shares_day ON shares(day);
CREATE TABLE client_errors (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL, message TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', path TEXT NOT NULL DEFAULT '', variant TEXT NOT NULL DEFAULT '', browser TEXT NOT NULL DEFAULT '');
CREATE INDEX client_errors_day ON client_errors(day);`,
// 16 · the middle of the pay range a listing showed when the employer recorded the hire: the placement fee's basis, so a later pay edit cannot cut it (D-09)
`ALTER TABLE applications ADD COLUMN hire_pay_mid INTEGER;`,
// 17 · the employer's plan when the hire was recorded: whether a placement fee applies, so a later upgrade or a lapsed plan cannot change it (U-029)
`ALTER TABLE applications ADD COLUMN hire_plan TEXT;`
];

export function openDb(file) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  for (let i = version; i < MIGRATIONS.length; i++) {
    // A migration can be a function that rebuilds a table. Those run with foreign keys off, so dropping the old
    // table can't cascade into other tables, and are checked with foreign_key_check before they're committed.
    const m = MIGRATIONS[i], rebuild = typeof m === "function";
    if (rebuild) db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    try {
      if (rebuild) { m(db); if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error(`migration ${i + 1} left broken foreign keys`); }
      else db.exec(m);
      db.exec(/* sql-safe: loop counter */ `PRAGMA user_version = ${i + 1}`); db.exec("COMMIT");
    } catch (err) { db.exec("ROLLBACK"); if (rebuild) db.exec("PRAGMA foreign_keys = ON"); throw err; }
    if (rebuild) db.exec("PRAGMA foreign_keys = ON");
  }
  const cache = new Map();
  const st = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  let depth = 0;
  return {
    raw: db,
    get: (sql, ...p) => st(sql).get(...p),
    all: (sql, ...p) => st(sql).all(...p),
    run: (sql, ...p) => st(sql).run(...p),
    tx(fn) {
      if (depth > 0) return fn();
      depth++; db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (err) { db.exec("ROLLBACK"); throw err; }
      finally { depth--; }
    },
    close: () => db.close()
  };
}
export const now = () => Date.now();
export const J = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
