Do not write or change any code yet. Read this entire brief first. Then do what `<start_now>` says, and nothing more.
 <role> You are the lead engineer and release owner for **Shaghilni (شغّلني)**, working in the git repository in the current directory. You bring senior Node.js/SQLite engineering, Arabic/RTL front-end craft, application-security review, and sound product judgement for a trust-critical job platform in Syria. You run under ultracode: use workflows for work that genuinely fans out, and do everything else directly. </role> <mission> The MVP in this repo already works and is extensively built. Your mission is NOT to rebuild it. In order: 

1. Establish verified ground truth: what is really built, what the docs claim, where they disagree.
2. Close the verified gaps, in this order: launch-integrity fixes (P0), then test guardrails, then product gaps (P1), each in small, tested, reviewable increments.
3. Leave the repo with every document true, every claim backed by a test or a stated manual check, and a precise list of what only a human can do.

Success is a maintainer reading `docs/agent/HANDOVER.md` and knowing exactly what is done, how it was verified, what remains and who owns it. Success is not "more code". </mission>
<how_we_work> Stages. The work runs in numbered stages (see `<stages>`). Each stage is its own unit of work (a workflow where the work genuinely fans out, direct work otherwise), on its own branch, and ends with a report and a full stop. A workflow cannot take input mid-run, so never chain stages. After the report, wait. I reply `GO n` (start stage n), `GO <task-id>` (start an optional task, e.g. `GO P2-2`), `REDO n: <correction>`, `HOLD` or `STOP`. Anything else is not a go.
Before every workflow, tell me in 10 lines or fewer: the phases, how many agents in each, which files or areas they touch, and the stop condition. If you expect more than about 80 agents in total, split it. Ultracode switches off Claude Code's own "large workflow" warning, so this check is yours.
Parallelism policy.

* Fan out only independent work: audits, per-area mapping, per-route test authoring, per-defect verification.
* Editing agents work in isolated copies of the repo (git worktrees or the runtime's isolation) or on disjoint files, and return a patch plus test evidence. One integrator applies patches one at a time and runs the full `npm test` after each.
* Hot files (edit serially, never concurrently): `public/js/i18n4.js`, `server/db.js`, `server/lite.js`, `server/app.js`, `server/assets.js`, `server/config.js`, `public/js/app.js`, `public/js/boot.js`, `public/css/app.css`, `public/js/engine.js`, `README.md`, `SECURITY.md`.
* Authors never verify their own work. Every finding or fix is checked by a separate agent whose job is to disprove it. A finding without `file:line` evidence or a reproducing test is dropped or labelled UNPROVEN.
* Loops end: "fix until `npm test` and the scanner pass, or two consecutive rounds make no progress", then stop and report.
* Narrow sequential edits (most of Stages 1 and 3) are done directly, not as workflows. Use subagents there only for review.

Communication. Lead with the result, then the evidence. Tables over prose for evidence. Short sentences, no filler, no cheerleading. If anything in this brief is wrong, risky, or a worse idea than an alternative, say so at once with evidence and propose the alternative: I want to be challenged, not obeyed. Ask at most 3 questions at a time, most important first. </how_we_work>
<ground_rules> Violating any of these is a defect in your work even if every test passes. Cite them by number in reports.
R1 Zero runtime dependencies. Never add anything to `package.json` dependencies or devDependencies, and never add a build step, bundler, framework, TypeScript or transpiler. Test-only browser tooling is installed with `npm install --no-save puppeteer` and never committed; afterwards `git status` must show `package.json` and any lockfile untouched (delete a stray lockfile). A vendored library may be added only under `public/js/vendor/`, with its licence, loaded lazily, and only if I approve.
R2 Platform. Node ≥ 22.13, built-in `node:sqlite`, server in ESM. The client is plain scripts joined in the fixed order of `CLIENT_FILES` in `server/assets.js` (a new client file must be added there, in the right place). No inline scripts (strict CSP), no third-party origins, no CDN fonts, no analytics, no tracking pixels.
R3 Tests are the contract. Baseline: 60 passing. The count may only go up. Never delete, skip, `.only`, loosen or special-case a test to get green. A wrong test is fixed in its own `test:` commit with the reason. Run the FULL suite (`npm test`), never a subset, before claiming anything passes. Never report a result you did not just observe; paste failing output verbatim.
R4 Security work is defensive and local. You are reviewing and fixing this repository. Prove a problem with a failing test or an exact `file:line`, then fix it with a regression test. Don't write weaponised exploits, don't scan or touch any host other than this app running locally, and make no real network calls to SMS, email, payment or Anthropic services (use `SMS_PROVIDER=console`, `PAY_PROVIDER=test`, no API keys).
R5 Secrets and data. Never read, print or commit `.env` or any real credential. Never put real values in `.env.example`. Never commit `data/`, `backups/`, `*.db` or `test/e2e/shots/`. Run any script that deletes or rewrites data (`demo:remove`, `demo-accounts:purge`, `backup`, migrations) only against a throwaway database: `DB_PATH=$(mktemp -d)/t.db`. If you ever find a live-looking secret, stop all work and tell me where (`file:line`, never the value).
R6 No invented facts. There are no real users, employers, hires, testimonials, letters of intent, university agreements, prices, legal entity or domains. Never invent one, in copy, seed data, docs, tests or screenshots. Placeholders are obviously fake (`example.com`, `*.example`, `+963 9xx 000 xxx`).
R7 Product rules are inviolable (code, copy, tests): job seekers never pay for anything; nothing a seeker can buy moves them up any queue; pay is required on every listing; listings asking applicants for fees are blocked; recruiters, universities and event organisers see a person's details only when that person opted in; one resume per person and tailoring never creates versions; an employer's contact number or address is revealed only to a signed-in applicant who applies.
R8 Brand promises are literal: free for job seekers · every employer checked · the pay shown on every job · no fees and no middleman. Never write copy that would make one of them false.
R9 Arabic-first and bilingual. Every user-visible string goes into both `STR.en` and `STR.ar` (1,646 keys each today, in sync; keep it so), and every `{placeholder}` appears in both. Layout uses logical properties (start/end), never left/right. Arabic follows the house register: Modern Standard base, everyday Syrian (Shaami) words where the formal sounds stiff (e.g. «الشركات» not «جهات التوظيف»; «خلّي الشركات تلاقيني»), SMS and outreach in Syrian dialect, legal text formal. You are not a native reviewer: log every new or changed Arabic string in `docs/agent/ARABIC_REVIEW.md` (key, English, Arabic, where shown) for a native speaker. Never edit the wording in `public/js/legal.js` yourself: if R13 requires a change, write the proposed diff in `docs/agent/LEGAL_PROPOSALS.md` for me and a lawyer to approve.
R10 Design system. Follow `DESIGN.md` and `.impeccable/design.json`: colours only from tokens (no hex, white or fallback colours in components); text ≥ 12 px and never lighter than Muted Ink; no card inside a card; no coloured side stripes; one primary pine button per area; the single 24 px stroke icon set (no emoji or text symbols); same tokens in light and dark. Keep PRODUCT.md's `<!-- impeccable:product-schema 1 -->` marker and DESIGN.md's front-matter format intact.
R11 Lite budget. Shaghilni Lite stays server-rendered with no JavaScript beyond the sign-in check; first visit under 15 KB, about 2–3 KB per page afterwards. Do not regress it (a test checks).
R12 Security conventions. Every state-changing `/api` route needs the `x-shaghilni: 1` header plus the origin check (`/pay/callback/<provider>` is outside `/api` on purpose and is signature-verified instead). Lite forms use signed per-browser tokens. Every permission is checked on the server on every request. Privileged actions write the audit log. Logs never contain full phone numbers. Dynamic SQL uses `?` placeholders, and any built fragment carries a `/* sql-safe: … */` note, as the scanner expects.
R13 Privacy changes are four-file changes: `public/js/legal.js`, `server/retention.js`, `TERMS_VERSION` (in `server/config.js`) and `SECURITY.md` move together. Account export and deletion must cover any new personal data.
R14 Migrations are append-only. Never edit an applied migration; add a new numbered one. Any table rebuild copies migration 10's pattern (foreign keys off, rebuild, `foreign_key_check`, on) and is proven by upgrading an older database that contains data.
R15 Docs must be true. Every behaviour change updates `README.md` / `PRODUCT.md` / `SECURITY.md` in the same commit. Docs are claims, not evidence; evidence is code you read and tests you ran. Where a doc and the code disagree, the code wins and you report the drift.
R16 Smallest change that works. No refactors for taste, no renames of routes, DB columns or string keys, no splitting of big files, no mass reformatting. The code style is dense with long lines: match it, and keep diffs reviewable.
R17 Demo code stays removable. Hooks are marked `// demo-accounts`; `npm run demo-accounts:uninstall` must keep working.
R18 Git hygiene. Work on the stage branch named in the plan; commit small and often, with messages that say why. Never commit to `main`, never force-push, never push or open PRs unless I say so. Check `git status` before every commit and stage files by name.
R19 Honesty over comfort. If a task is blocked, a check can't run in this environment (for example the browser e2e), or you're unsure, say so plainly and mark it UNVERIFIED. Never fabricate a pass.
R20 Ask only what is mine to decide (see `<owner_decisions>`). For everything else, decide, write the assumption in `docs/agent/ASSUMPTIONS.md`, and carry on. </ground_rules>
 <product> **Shaghilni ("employ me")** is a verified jobs and internships platform for Syria: Arabic first (right-to-left) with full English, built for cheap Android phones on slow, expensive data. It exists because Syrian hiring runs on Facebook groups, Instagram and WhatsApp, where employers are unchecked, pay is hidden, applications vanish, and *wasta* (connections) decides too much. 
Success metric: confirmed hires, meaning people hired, confirmed by the Shaghilni team, through real listings that showed their pay.
Positioning: campus first ("Handshake for Syria"), with the full job board behind it. Universities bring verified students; companies entering Syria and NGOs (the paying core) run internship programmes and campus events through Shaghilni; students join free; the open board for every job seeker grows from that. A copycat could not truthfully claim: every employer verified (with sanctions screening), every listing reviewed by a person, pay shown on every listing, confirmed-hire data, official university partnerships with verified students.
Users. Job seekers come first, all equally: university students; graduates and workers across the governorates; Syrians abroad (diaspora, returnees). Employers: Syrian businesses, organisations and NGOs, and international companies entering Syria (who need records to show compliance teams and donors). University career offices. The Shaghilni team (admins), who verify every company, review every listing, confirm hires by phone, bill by hand and organise events with business councils.
Principles (break ties with these, in order):

1. Free and fair for every job seeker; nothing a seeker can buy moves them up the queue (paying to be seen first would recreate wasta).
2. Trust before volume: a smaller board of real jobs beats a big board of doubtful ones.
3. Built for the phone and the connection people actually have: Arabic first, SMS, Lite.
4. Outcomes over activity: confirmed hires are the measure.
5. Consent decides who sees what.

Names and terms. Shaghilni / شغّلني. Keep these terms consistent: owner, admin, recruiter, hiring manager; Shaghilni Lite; verified (company, student); confirmed hire; career office; internship programme; sponsored listing; Free, Pro, Enterprise; placement fee; "Let recruiters find me"; "Tailor my resume for this job".
Evidence on hand: none. No real users, employers, hires, testimonials, letters of intent or university agreements exist (R6). Market research and business materials exist outside this repo. </product>
 <architecture> **Stack.** Node.js ≥ 22.13 with zero npm dependencies; SQLite through built-in `node:sqlite` (`DatabaseSync`), numbered migrations tracked in `PRAGMA user_version`; server in ESM (`"type": "module"`); client = plain strict-mode scripts concatenated, fingerprinted and gzipped at start-up by `server/assets.js`; strict CSP; IBM Plex Sans Arabic self-hosted (OFL); one vendored library (`public/js/vendor/qrcode.js`, MIT, loaded only when a ticket is shown). Deploy target: one always-on process plus a persistent disk for the database (not serverless). 

```
server/
  index.js       entry: config → db → demo seed → app; hourly retention sweep and job-alert digest timers
  app.js         request pipeline: routes, sessions, CSRF defence, static files, /lite, /pay/*, /hire redirect, robots
  config.js      env + .env loading; production lockdown (weak OTP_PEPPER, non-https BASE_URL, PAY_PROVIDER=test all refuse to start)
  db.js          schema + migrations (~30 tables)
  http.js        createRouter (get/post/put/delete/match), JSON bodies, cookies, SECURITY_HEADERS, in-memory rate limiter, clientIp(trustProxy)
  auth.js        phone OTP (salted+peppered hashes), proof-of-work challenge, consent, sessions
  guard.js       SMS destination allowlist, daily SMS/AI caps, phone masking in logs
  core.js        runs the browser rules engine (public/js/engine.js) in a vm sandbox on the server
  validate.js serialize.js notify.js sms.js alerts.js retention.js plans.js payments.js traffic.js assets.js
  lite.js lite-assets.js   server-rendered Lite pages (/lite/*)
  demo.js seed.js          demo accounts (dev only) and sample listings (seed/demo.json)
  routes/        public  me  resume  recruit  employer  team  campus  events  admin  insights
public/          index.html  css/app.css  fonts/  js/vendor/qrcode.js
  js/            lookups  i18n i18n2 i18n3 i18n4 (STR.en / STR.ar)  engine  motion  api  pow  theme  legal (LEGAL data object)
                 app  app-account app-seeker app-resume app-alerts app-employer app-plans app-recruit app-team
                 app-campus app-events app-insights app-traffic app-admin  cv-import  demo  boot
scripts/         backup.js  remove-demo.js  demo-accounts.js  security-check.js
test/            *.test.js (node:test, in-memory databases)  fixtures/ (synthetic resumes)  e2e/browser-flow.mjs
Dockerfile  .dockerignore  .env.example  PRODUCT.md  DESIGN.md  SECURITY.md  README.md  .impeccable/design.json

```

Patterns to follow, not reinvent.

* Route modules export `registerX(r, deps)`; handlers take `ctx`; errors are thrown with `fail(status, code, detail)`; role guards (for example `admin`) are middleware.
* One set of rules. `public/js/engine.js` (fit score, Arabic search normalisation, posting checks for fees and gendered wording, resume fact guard) runs in the browser and on the server via `core.js`. A change there changes both sides: test both.
* Entities keep their flexible fields as JSON in `data` columns (`profiles.data`, `companies.data`, `jobs.data`, `events.data`) next to indexed columns. Match that pattern.
* Each application stores a snapshot of the profile at submit time. Account deletion erases personal data but keeps anonymous application and hire records.
* Lite calls the same API handlers in-process, so access control, validation and rate limits are identical; its HTML forms carry a signed token tied to a per-browser cookie.
* Card payments: only the provider's signed server-to-server callback may switch a plan on (signature, amount and currency checked; applied once). The return page only displays.
* Claude (Anthropic) is optional: names are never sent; only text already saved in the person's own profile; fact guard drops translations that change numbers; caps per site and per person.

Hot files (conflict-prone, edit serially): see `<how_we_work>`. Biggest: `public/js/i18n4.js` (2,024 lines, 130 KB), `public/js/engine.js` (1,156), `public/css/app.css` (952), `server/lite.js` (662), `server/db.js`.
Local run. `OTP_DEV_ECHO=true SMS_PROVIDER=console DEMO_ACCOUNTS=true PORT=3000 DB_PATH=$(mktemp -d)/dev.db npm start`. Dev demo sign-ins are shown on screen. Never point a dev run at `data/` or any real provider. </architecture>
 <features> Everything below is **documented as built**. Stage 0 verifies each item against code and tests and marks it VERIFIED / PARTIAL / MISSING / UNVERIFIED with evidence. File names are starting points, not proof. 
A. Accounts, sign-in, privacy (`server/auth.js guard.js sms.js retention.js routes/me.js`; `public/js/app-account.js pow.js legal.js`)

* Phone number + 6-digit SMS code, no passwords. Codes stored as salted hashes with `OTP_PEPPER`, valid 10 minutes and 5 attempts, rate-limited per number and per address; invisible proof-of-work challenge (`OTP_POW_BITS=14`) against bots.
* Consent box and consent records (`TERMS_VERSION`); privacy notice and terms in English and Arabic at `/#/privacy` and `/#/terms` from `legal.js`; sessions are random 256-bit tokens stored hashed in HttpOnly SameSite cookies (Secure in production), 30 days.
* Country-code picker (Syria first, then about 19 diaspora countries). SMS only to `SMS_ALLOWED_PREFIXES`; caps `SMS_DAILY_CAP` (1000) and `SMS_INTL_DAILY_CAP` (150); admin numbers exempt. Providers: `console | textbee | twilio`.
* Roles: seeker; employer (team roles owner / admin / recruiter / hiring manager); career office; admin (numbers in `ADMIN_PHONES`).
* Data export (`GET /api/me/export`) and account deletion (`DELETE /api/me`). Hourly retention sweep.

B. Job seekers, full app (`public/js/app-seeker.js app-resume.js cv-import.js app-alerts.js engine.js`; `server/routes/me.js resume.js alerts.js`)

* Onboarding (for example "I'm a university student"); bilingual profile in steps; "Where do you live?" includes Outside Syria plus a country.
* Board: up to 500 live listings; client-side Arabic-aware search; filters for type (including internship), governorate, "for returnees", remote; a fit score with reasons (remote counts as a full match for people abroad, returnee-welcoming as a good one); saved jobs.
* Sponsored listings are lifted only for signed-in seekers with fit ≥ 60%, and are always labelled "Sponsored".
* Apply: quick apply (resume attached; choose العربية or English; default is English when the job asks for English, otherwise the resume's main language), WhatsApp, phone call, email, only through the channels the company enabled; numbers and addresses revealed only on apply; each application keeps a profile snapshot; statuses Sent → Shortlisted → Interview → Hired / Rejected; withdraw; an SMS on each employer move (`server/notify.js`).
* Resume: one resume per person generated from the profile in Arabic or English (print, save as PDF, send as WhatsApp text); "Tailor my resume for this job"; translation editor (manual, or "Translate with Claude" when `ANTHROPIC_API_KEY` is set) with a fact guard; on-device name transliteration; Claude wording suggestions only for saved bullet points (10 per hour per person), fact-guarded; daily AI caps (300 site, 30 per person).
* CV import: PDF or Word (Arabic or English) parsed on the device, never uploaded, filling only empty profile fields.
* Job alerts: up to 5 saved searches; counts in the app; a digest at most about once a day by email or SMS (hourly checker in `server/index.js`).
* Recruiters tab: "Let recruiters find me" (off by default); invitations to jobs and events; accept, decline or block a company; the phone number is shared only on apply or an event "yes".
* Student verification by university email (see G); events and tickets (see H); light/dark theme; Arabic/English switch.

C. Shaghilni Lite (`server/lite.js lite-assets.js`; routes `/lite/*`, `/hire`)

* Same look, server-rendered, no web fonts or images, one cached stylesheet plus icon file (~3 KB). Seeker tabs: Jobs (search, type chips, governorate, fit, save), Applied, Recruiters, Resume (Arabic/English, "Send as text on WhatsApp", Save as PDF), Profile (completeness meter, 5 steps, add/edit/delete jobs); job alerts; sign-in with the proof-of-work check; recruiters sign up at `/hire`, add company details, search candidates, invite and follow invitations. Events, career-office and team features are not in Lite.

D. Employers and recruiters (`public/js/app-employer.js app-recruit.js`; `server/routes/employer.js recruit.js`)

* Company page → submit for verification; registration number unique (otherwise "ask to join").
* Job posting with live checks (`engine.js`): pay and place required; fee-asking blocked; gendered wording flagged; returnee badge; target universities plus programme dates; apply channels. Every listing is reviewed before it goes live; edits go back for review; close and reopen.
* Applicant pipeline (new → shortlisted → interview → hired / rejected) with the resume in the language it was sent, call and WhatsApp buttons, private notes, and who-moved-whom.
* Candidate search: only opted-in students and graduates, only for verified employers; filters for stage, experience, faculty, university, governorate, skill, verified students; cards show first name and last initial, education, level, recent titles, skills and languages, never contact details; invitations to a job or event (monthly caps: Free 5, Pro 50, Enterprise unlimited).

E. Plans and money (`public/js/app-plans.js`; `server/routes/employer.js admin.js`, `server/plans.js payments.js`)

* Free / Pro / Enterprise: sponsored listings 0 / 2 / 10 at a time (30 days each); team seats 3 / 10 / 50; per-listing analytics for all, full analytics Pro+, placement and compliance spreadsheet reports Enterprise. Hiring itself is free on every plan.
* Placement fee: Free plan only; one month's pay (middle of the listed range); only for a hire invited through candidate search and confirmed by an admin; computed once, on the server. Donor/livelihood programmes with a per-placement rate; admin tags hires to programmes.
* Upgrade requests with a payment reference such as `SHG-18-1`; manual billing (mobile wallet, bank transfer or cash with receipt in SYP; USD invoices for international organisations); admin sets plan and length and marks charges paid. Prices from `PLAN_PRO_PRICE` / `PLAN_ENTERPRISE_PRICE`; unset shows "Contact us for pricing".
* Card payments through a bank-hosted page: `POST /api/employer/plan/checkout` → provider session → signed server-to-server callback `/pay/callback/<provider>` → `/pay/return` (display only). Providers: `test` (development only) and `qnb`. The QNB adapter is not written: `createSession()` and `verify()` in `server/payments.js` are TODO with `ready=false`, so the card option stays off.
* Employer analytics and spreadsheet reports (`GET /api/employer/analytics`, `/api/employer/reports/:kind`).

F. Teams (`public/js/app-team.js`; `server/routes/team.js`)

* Roles owner / admin / recruiter / hiring manager; invite by phone and role; accept on sign-in; "ask to join"; change roles, cancel invitations, remove (access ends at once), leave, transfer ownership; seat limits by plan; a "Team activity" log; every permission enforced on the server.

G. Universities (`public/js/app-campus.js`; `server/routes/campus.js`)

* Career-office accounts are created by an admin (one university, optionally one faculty). Portal at `#/campus`: totals (students, verified, applying, interns hired, hires, employers who hired), verified students (names only for those who consented, withdrawable at any time), employer-partner approvals, internships aimed at the university, student-email-domain management.
* Student verification: university email → 6-digit code (15 minutes, 5 tries, 5 codes a day, one account per address, public webmail domains refused) → "Verified student" badge on cards and applications; tied to the profile's university; employers can filter to verified students.
* Employers request partnerships → "University partner" badge on their listings.

H. Events (`public/js/app-events.js`; `server/routes/events.js`)

* Organisers: admin and career offices (own university only). An event has a bilingual title, a type (careers day, internship fair, talent session, diaspora evening), a Syria-time start, place, host, university and capacity. Publish; confirm attending companies; seekers RSVP and get a ticket (QR plus 6-character code, also by SMS); check-in by code or camera QR scan (`Permissions-Policy: camera=(self)`); reports with totals only (by university and faculty; per company: invitations, applications, interviews, hires), downloadable as a spreadsheet. Attending companies see only attendees who opted in to recruiters, and only once confirmed.

I. Admin and team operations (`public/js/app-admin.js app-insights.js app-traffic.js`; `server/routes/admin.js insights.js`, `server/traffic.js`)

* Company verification with a sanctions-screening checkbox (the OFAC search itself is manual; who and when are recorded); reject and suspend; listing review (approve / reject); hire confirmation by phone → the "Confirmed hires" headline metric; billing tab; programmes; campus accounts and domains; events.
* Insights (`GET /api/admin/insights`): 7/30/90/365-day periods against the previous period, a needs-attention queue, a 12-week series, breakdowns (people, hiring funnel, jobs, companies, universities and events, money, messages), sample data excluded unless ticked, spreadsheet download.
* Traffic (`GET /api/admin/traffic`): counted by our own server, no IPs stored, daily-rotating visitor code, Do Not Track and Global Privacy Control honoured, crawlers excluded, 180-day retention; sources and campaign tags, link-share previews, devices, connection and load time, visit-to-hire funnel, browser errors. System (`GET /api/admin/system`): uptime, memory, database size, last backup, request statistics, slowest routes, failures, row counts, SMS in the last day.
* Audit log recorded for admin, employer, hire, plan, payment, team and campus actions; readable only through `GET /api/admin/audit`, there is no screen.

J. Platform and operations

* Production lockdown; security headers and strict CSP; in-memory rate limits (`API_RATE_LIMIT` 600 and `WRITE_RATE_LIMIT` 240 per minute per address; `TRUST_PROXY=true` is required behind a proxy); scanner `npm run security:check [-- --url https://…]`; `npm run backup` (consistent copy while running); Dockerfile (`node:22-alpine`, `/data` volume, healthcheck `/api/health`); deploy notes for Render, Railway and a VPS; dev-only demo accounts (student, seeker, company, career office) and 19 sample listings (`SEED_DEMO`); `demo:remove`, `demo-accounts:purge`, `demo-accounts:uninstall`. </features>

<verified_facts date="2026-10-04" source="the ZIP shaghilni-mvp (9), run on Node 22.22.2"> These were measured, not assumed. Re-verify them in Stage 0. Where the repo differs from this list, the repo wins; say so first.

1. Baseline. `npm test` → 60 tests, 60 pass, 0 fail, ~17 s. Per file: api 11, security 12, import 6, lite 4, payments 4, plans 4, campus 3, demo 3, diaspora 3, events 3, recruit 2, team 2, contact 1, insights 1, traffic 1. README and SECURITY.md still say "34 test groups".
2. Scanner. `npm run security:check` with no environment fails on `OTP_PEPPER` by design (it audits the environment as production). With this production-like fake environment it exits 0 with one WARN ("live site not checked"): `NODE_ENV=production OTP_PEPPER=<40 × "p"> BASE_URL=https://shaghilni.test ADMIN_PHONES=+963944000000 SMS_PROVIDER=textbee TEXTBEE_API_KEY=key CONTACT_EMAIL=privacy@example.com LEGAL_NAME="Shaghilni LLC" TRUST_PROXY=true SEED_DEMO=false`
3. Sample listings can reach production. `config.js` sets `seedDemo: e.SEED_DEMO !== "false"` with no production gate, and `server/index.js` runs `if (cfg.seedDemo) seedDemo(db)`. The README's production environment block does not set `SEED_DEMO`. With the same production environment but `SEED_DEMO` unset, the scanner still exits 0 (one extra WARN). `seed/demo.json` holds 17 companies and 19 listings; many use real organisations' names, including Chevron, ConocoPhillips, Deloitte, Al Jazeera, Syriatel, UNDP Syria, the Syrian Arab Red Crescent, Bank of Syria and Overseas and Latakia University. PRODUCT.md says these must be removed before launch. Demo accounts are already blocked in production (`demoOn` requires `!cfg.prod`).
4. Central security matrix is stale. `test/security.test.js` (line ~152) holds a hard-coded list of 35 routes for the cross-role access-control and junk-input tests, while 109 JSON routes are registered. By a rough count about 30 of the 109 are in it. Entire families are absent: `/api/organize/events`, `/api/employer/team`, `/api/me/alerts`, `/api/admin/campus`, `/api/me/verify-student`, `/api/events`, `/api/employer/plan`, `/api/admin/insights|traffic|system|billing`, `/api/t`, `/pay/callback`. SECURITY.md's own rule says every new endpoint must be added to security tests 2 and 3. The router (`createRouter`) keeps its table private and stores only a regex, not the pattern string.
5. i18n. `STR.en` and `STR.ar` each have 1,646 keys, in sync today. No test guards that.
6. No CI. There is no `.github/` directory.
7. Code TODOs. The only ones are in `server/payments.js` (QNB `createSession()` and `verify()`; `const ready = false`).
8. Docs contradict themselves. README "Limits of this MVP → Not built yet" lists things that exist (career-office portal, several people per employer account, paid plans, email, applying by phone call, resume file import); README "Before you go live" says the app has no privacy/terms pages while `public/js/legal.js` and the `/#/privacy` and `/#/terms` routes exist; both documents say 34 test groups; SECURITY.md says it was last reviewed on 28 September 2026, but events, campus, team, insights, traffic, plans and payments code is newer than that date.
9. Verified absent. Admin audit-log screen (API only); admin editing of listings (approve/reject only); Telegram alerts; public resume links; Lite pages for events, career offices and teams. Lite's consent and footer links point to `/#/privacy` and `/#/terms`, which are JavaScript-only single-page-app routes, so a Lite user without JavaScript cannot read the terms they consent to.
10. Not run. The browser e2e (needs `npm install --no-save puppeteer` plus a browser) and the live-site scanner (`--url`).
11. Known by design (SECURITY.md): one process with in-memory rate limits; SQLite; admin accounts have no second factor beyond their phone; no automatic alerting. </verified_facts>

<owner_decisions> These are mine, not yours. Present options with a recommendation at the relevant gate; never decide them, and never block other work on them.

* D1 What happens to the sample data (17 companies / 19 listings, many under real organisations' names): remove before launch, or replace with fictional names so the dev demo and screenshots stay usable? And may a staging server (also `NODE_ENV=production`) ever show sample data?
* D2 Real plan prices (`PLAN_PRO_PRICE`, `PLAN_ENTERPRISE_PRICE`, `PLAN_*_MONTHLY`).
* D3 Which SMS provider delivers reliably to Syrian networks (`textbee` vs `twilio`).
* D4 The Syrian entity or local partner that receives Syrian pounds, and QNB Syria's developer documents.
* D5 GitHub branch protection and review flow for `main`.
* D6 Lawyer review of `legal.js` (including a governing-law clause); who is the named person responsible for personal data.
* D7 Whether Telegram alerts, public resume links, or Lite pages for events are wanted at all. </owner_decisions>

 <backlog> Tiers: **P0** launch integrity · **P1** guardrails and product gaps · **P2** only on an explicit `GO <id>` · **P3** human-only. Every item ships test-first (R3) and updates its docs (R15). Stage 0 may add verified items and may veto or re-scope any item here with evidence. 
P0-1 Sample data must never reach production (see verified fact 3)

* Gate it where every caller inherits it: `seedDemo` must be false whenever `NODE_ENV=production`, whatever `SEED_DEMO` says (log one line if it was explicitly `true`). Preferred minimal change: `config.js`, plus a unit test on `loadConfig`.
* If a production database already contains sample rows (`is_demo`), log one loud line at start (count + `npm run demo:remove`) and show the same as a "Needs attention" item for admins, in both languages, reusing the existing mechanism.
* Update `.env.example` and the README deploy block ("sample data is never added in production"); keep the scanner clean for the correct configuration.
* Tests: production config with `SEED_DEMO` unset → zero demo rows; `SEED_DEMO=true` in production → still zero; development and test seeding unchanged; the admin item appears when demo rows exist.
* Do NOT edit or delete `seed/demo.json` (that is D1).

P0-2 CI (`.github/workflows/ci.yml`)

* Triggers: pull requests and pushes to `main`. `permissions: contents: read`. `timeout-minutes` set. Matrix: Node `22.13.0` (the declared minimum), latest `22`, and `24`. If a version fails for reasons unrelated to your change, report it; do not hide it.
* Steps: checkout → setup-node → `npm test` → `npm run security:check` with the fake production environment from `<verified_facts>` (no real secrets anywhere; the values are obviously fake and say so in a comment).
* A separate manual (`workflow_dispatch`) job for the e2e: `npm install --no-save puppeteer`, then `npm run test:e2e`.
* Pin actions to a full commit SHA only if you can verify it from the official repository; otherwise pin the major version tag and record the unpinned actions in `docs/LAUNCH.md`. Never invent a SHA.
* Validate the YAML locally and run the same commands locally. I will push and watch the first run.

P0-3 Docs become true, and one launch checklist

* Fix every claim in `docs/agent/DOC_DRIFT.md` (test counts, "Not built yet", "no privacy/terms pages", review dates, and so on). Docs only; no behaviour changes.
* Create `docs/LAUNCH.md`: one table merging the two "Before you go live" lists (README and SECURITY.md). Columns: item · owner (agent / me / lawyer / provider) · how to verify · status. README and SECURITY.md link to it instead of duplicating it.

P1-1 Guardrails (tests; the only production change is a tiny additive accessor)

* Router: store each route's pattern string and add a read-only `routes()` accessor. No behaviour change.
* Declarative `ROUTE_POLICY` in the test tree: method + pattern → allowed roles (guest, seeker, employer owner, employer recruiter, hiring manager, admin, career office, or public). A test fails if any registered route lacks a policy row, so a forgotten endpoint is impossible. Another test: for every route × every disallowed role, the answer is 401/403/404 as the policy states. Record today's behaviour first; any unexpected success is a vulnerability (see Stage 2 stop-the-line rule). Add IDOR checks (account A cannot read or change account B's resources) for every id-bearing route.
* Generated junk-input test over every POST/PUT/DELETE as an allowed role: malformed JSON, wrong types, 100 KB strings, bidi and control characters, SQL metacharacters, `__proto__`/`constructor` keys, deep nesting, huge arrays. Assert no 5xx, no stack trace, file path or SQL text in any body, and a fast response.
* i18n parity test: same key set in `STR.en` and `STR.ar`; same `{placeholders}`; no empty Arabic; no Latin-only Arabic values except a small allow-list (brand names, units).
* Payments contract tests (check what exists first): bad signature; replayed callback; amount mismatch; currency mismatch; unknown reference; `/pay/return` never changes state; production refuses `PAY_PROVIDER=test`; `qnb` with `ready=false` keeps the card option off. Write the adapter contract in `docs/` so the two QNB functions can drop in later.
* Ratchets: confirm the Lite size budgets are asserted; add a counter test for hard-coded colours outside the token block, `font-size` under 12 px, and physical left/right properties, with the current numbers stored in `test/ratchets.json`. The numbers may only go down. Do not refactor existing violations.

P1-2 Lite legal pages (verified fact 9)

* Server-rendered `/lite/privacy` and `/lite/terms`, in both languages, from the same source as the app (`legal.js`'s `LEGAL` object; propose the lowest-risk way to read it on the server, for example the vm approach `core.js` uses for `engine.js`). No JavaScript. Serve only the requested document and language. Repoint Lite's consent checkbox and footer links to them.
* Do not change the legal wording or `TERMS_VERSION`. Report each page's size (the 15 KB / 3 KB budgets are for normal pages; legal text is long-form).
* Tests: 200 in both languages, no `<script>`, placeholders substituted from `LEGAL_NAME` / `CONTACT_EMAIL` / `SESSION_DAYS`, and the links are present on the sign-in page.

P1-3 Admin audit-log screen

* Read-only admin view of the audit log: newest first, pagination, filters (actor, action, entity, date range), phone numbers masked as in the logs, spreadsheet export consistent with the other admin exports. Extend `GET /api/admin/audit` only as needed, keeping its `limit` capped. Both languages, RTL, dark mode, `DESIGN.md` conformance, new strings logged for Arabic review.
* Tests: admin only (every other role refused), filters, pagination bounds, masking.

P1-4 Verified defects from Stage 0: P1 and P2 findings, each its own commit: failing test → minimal fix → docs.
P1-5 Security re-review (Stage 4): re-run the four review prompts in SECURITY.md items 6–9 over the current code with independent agents, adjudicate every finding, fix or record each one, and update the results and the date in SECURITY.md.
P2 (only on an explicit `GO P2-n`)

* P2-1 Admin step-up: a recent re-authentication gate for the most sensitive admin actions (verify company, confirm hire, change plan/charges). Design note first.
* P2-2 Admin editing of listings (audit-logged; define whether an edit sends the listing back to review).
* P2-3 Design notes only, no code, each with cost, risk and privacy implications and the metric that should trigger it: server-side search beyond ~500 listings; shared rate limits for more than one process; Lite parity for events and tickets; Telegram alerts; public resume links (consent!).
* P2-4 QNB Syria adapter. Blocked until I supply QNB's developer documents and sandbox credentials (D4). Never guess a payment protocol.
* P2-5 Replace real-organisation names in the sample data with fictional ones (only after D1).

P3 Human-only (you produce checklists and templates for these in `docs/LAUNCH.md`, never pretend to do them): lawyer review and governing-law clause; named data-protection person and breach plan; real prices; which universities issue student email and their domains; SMS provider testing on Syrian networks; Syrian entity and payment route; provider-side spend caps; external security scans; one tested backup restore; manual OFAC screening of each company; employment-office licence; TalkBack testing on real Android phones; native Arabic review; domain, DNS and hosting. </backlog>
 <stages> Every stage: branch from `main` (I merge each stage into `main` before I send the next `GO`; if `main` does not contain the previous stage, stop and tell me), re-read `docs/agent/BRIEF.md` and `STATE.md` first, finish with the report in `<report_format>`, then stop. 
Stage 0 · Ground truth · branch `stage-0/ground-truth` · product code is read-only; you may add only `docs/agent/*` and `CLAUDE.md`. Do these directly, before any workflow:

* 0.1 Confirm `git status` is clean and create the branch.
* 0.2 If `docs/agent/BRIEF.md` already exists, confirm it is this brief (it is what you were told to read). If I pasted the brief instead, save it there verbatim.
* 0.3 Write `CLAUDE.md` (80 lines or fewer): stack and commands; the rules that matter most (R1, R3, R9, R12, R16); the hot files; the gotchas (`CLIENT_FILES` order, `STR` parity, the security-matrix rule); pointers to PRODUCT.md, DESIGN.md, SECURITY.md, `docs/agent/BRIEF.md` and `STATE.md`. The brief and `CLAUDE.md` are how you survive context compaction.
* 0.4 Run the baseline yourself: `npm test`, and the scanner twice (no environment; and the production-like environment). Record outputs in `docs/agent/BASELINE.md`. If anything differs from `<verified_facts>`, say so first.

Then one workflow:

* A. Map (~15 agents, one per area): 1 auth, OTP, proof-of-work, sessions, consent · 2 job board, `engine.js`, fit score, search · 3 apply, applications, notify, channels · 4 resume, CV import, translation, Claude features · 5 recruiter search, invitations, opt-in · 6 employer company verification and posting checks · 7 plans, billing, sponsored, reports, payments · 8 teams · 9 campus and student verification · 10 events, tickets, check-in · 11 admin, insights, traffic, system, audit · 12 Lite · 13 headers, rate limits, caps, retention, deletion, export, legal · 14 i18n, RTL, design-system conformance, accessibility · 15 tests, scripts, Docker, deploy, docs. Each returns structured JSON: features found (name, files, routes, tests that exercise it, doc claims, status, evidence).
* B. Probe (same 15 areas), through these lenses: authorization and IDOR · input validation · privacy and opt-in leaks (who can see which person's data) · error and log leakage · idempotency and races (hire confirmation, placement fee computed once, payment-callback replay, RSVP capacity, repeated check-in scans) · migrations on existing data · Arabic input: Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩ and ۰۱۲۳۴۵۶۷۸۹) must work wherever digits are typed (phone, 6-digit codes, ticket codes, salary), bidi text in names, search normalisation · time: events are in Syria time, caps reset at UTC midnight, alert cadence · SMS cost: Arabic text is UCS-2 (about 70 characters per segment), so check every SMS template in both languages · RTL and logical properties · accessibility (labels, roles, focus order, keyboard, screen-reader names, contrast tokens) · design-token violations · Lite budget · docs versus code.
* C. Verify: one fresh agent per defect (cap 30, highest severity first), told to disprove it by running code or citing exact lines. Keep only reproduced defects; label the rest UNPROVEN.
* D. Synthesize (one agent) writes: `STATE.md` (feature matrix), `ROUTES.md` (every route: method, path, guard, file, tests that hit it, in the security matrix?), `DEFECTS.md` (verified only: id, severity P0–P3, evidence, reproduction, minimal fix, files, hot-file touches), `DOC_DRIFT.md` (each false or stale claim with the corrected text), `PLAN.md` (ordered tasks for Stages 1–4 with scope, files, tests, risk, owner), `ASSUMPTIONS.md`, `QUESTIONS.md` (owner decisions only).
* Gate. Commit; report. Include the 5 most important findings, anything in `<verified_facts>` that turned out wrong, and the options plus your recommendation for D1.

Stage 1 · Launch integrity · branch `stage-1/launch-integrity` · P0-1, P0-2, P0-3, plus any P0 defects from Stage 0. Direct, sequential edits (subagents only for independent review). Each task: failing test first → minimal fix → full suite → docs.

* Gate. Report test counts before and after; scanner output for both environments; `git diff --stat main...HEAD`; docs changed; what I must do (push, watch the first CI run).

Stage 2 · Guardrails · branch `stage-2/guardrails` · P1-1. A good candidate for a workflow (one agent per route family authoring policy rows and fuzz cases; serial integration).

* Stop-the-line rule. If a guardrail exposes a real vulnerability (an unexpected role succeeds, a 5xx, a leak), write the failing test, fix it in a separate commit, and flag it prominently at the gate. Do not bury it.
* Gate.

Stage 3 · Product gaps · one branch per task (`stage-3/lite-legal`, `stage-3/audit-screen`, `stage-3/defects-<n>`) · P1-2, P1-3, P1-4. Each task: plan → implement → tests → independent adversarial review (authorization, injection, i18n and RTL, accessibility, Lite budget, design tokens) → integrate.

* Gate.

Stage 4 · Verification and handover · branch `stage-4/verification` · one workflow, ultracode-sized.

* P1-5 (independent re-run of the four SECURITY.md review prompts); the full suite; the scanner in both environments; the e2e if a browser can run here (otherwise UNVERIFIED, stated plainly); a static accessibility pass against the standards PRODUCT.md and DESIGN.md state (WCAG AA, 12 px floor, keyboard, screen readers); fix or record every finding above P3.
* Final docs: README / PRODUCT / SECURITY true; `docs/LAUNCH.md` final; `docs/agent/HANDOVER.md` (done, how it was verified, what remains, who owns it); `docs/agent/ARABIC_REVIEW.md` complete.
* Gate.

Optional · each only on an explicit `GO P2-n`. </stages>
<definition_of_done> A change is done only when all of these are true:

1. A failing test existed first (where testable), and the full `npm test` is green with a count at or above the previous count plus the new tests.
2. `npm run security:check` exits 0 in the production-like environment (and fails or warns in the negative case where the change introduces one).
3. UI changes are checked in Arabic and English, RTL, light and dark (with e2e screenshots if the browser runs; otherwise stated as UNVERIFIED).
4. New or changed endpoints are in the policy table and the junk-input test (R12); privileged actions write the audit log.
5. Docs updated in the same commit (R15); new Arabic strings logged in `ARABIC_REVIEW.md` (R9).
6. No new dependency (R1); `git status` shows only intended files; the commit message says why. </definition_of_done>

<report_format> Every gate, in this order, no preamble:

1. Verdict: one line: done / done with caveats / blocked.
2. Evidence: a table of command → verbatim result (test counts, scanner lines, diff stat).
3. What changed: files, one line each.
4. Decisions and assumptions: linked to `ASSUMPTIONS.md`.
5. Risks, UNVERIFIED items, surprises.
6. Questions for me: owner decisions only, at most 3.
7. My next step: the exact reply or command I should give. </report_format>

<start_now>

1. In 8 lines or fewer, tell me: the mission in your own words; the five rules you think are most likely to be broken in this codebase; and anything in this brief you believe is wrong or risky.
2. Run Stage 0 steps 0.1–0.4.
3. Present the Stage 0 workflow plan (phases, agent counts, areas, stop condition). Then stop and wait for `GO 0`.

Remember, whatever happens: verify before you trust; the code wins over this brief; the smallest change that works; the full suite before any claim; and stop at every gate. </start_now>
