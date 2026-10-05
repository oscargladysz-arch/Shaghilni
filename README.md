# Shaghilni · شغّلني

Verified jobs and internships in Syria. This is the MVP web app: Arabic first with full English, built for phones on slow connections, with a small Node.js server that has **no npm dependencies**.

![Job board on a phone, in Arabic](docs/screenshots/board-ar.png)

## What it does

**Job seekers** sign in with their mobile number and a texted code, build a bilingual profile in a few steps, and see every listing with a fit score and the reasons behind it. Anyone with a resume already can upload it (PDF or Word, Arabic or English) to fill in their profile: the file is read on the phone and never uploaded, and nothing already in the profile is replaced. They save jobs, apply in one tap or by WhatsApp, and follow each application from *Sent* to *Hired*. They get a text message when an employer moves them forward. A resume helper builds one resume from the profile, in Arabic or English, ready to print, save as PDF or send. *Tailor my resume for this job* opens that same resume focused on a job: the checks compare it with what the job asks for, and any change applies to the one resume (there are never separate versions).

**Recruiters.** Every job seeker has a **Recruiters** tab. If they switch on *Let recruiters find me*, verified employers can find them by stage (students or graduates), experience, faculty, university, governorate or skill, and invite them to apply for a job or to an event such as a careers day. Employers see only a short card: first name and last initial, education, experience level, recent job titles, skills and languages. The phone number is shared only when the person applies, or says yes to an event. Anyone can say no or block a company, and nobody is listed unless they switch it on. Recruiters sign up at **/hire**.

**Shaghilni Lite** (at **/lite**) is for phones on slow or expensive data. It has the same look as the full app (the logo, colours, tab bar and company tiles), but its pages are rendered on the server, with no web fonts and no images. One small stylesheet and one icon file (about 3 KB together) are downloaded once and cached for good, so the first visit is under 15 KB and each page after that is 2–3 KB. It needs no JavaScript except the invisible sign-in check. Job seekers get five tabs: **Jobs** (search, type chips, governorate, fit score and saving), **Applied**, **Recruiters** (the switch and invitations), **Resume** (in English or Arabic, with translation progress, *Send as text on WhatsApp* and *Save as PDF*) and **Profile** (a completeness meter and editing in five short steps, including adding, editing and deleting jobs). Recruiters sign up at /hire, add their company details, and once verified search candidates, invite them and follow their invitations. The full app shows a *Slow connection? Shaghilni Lite* link while it loads, and keeps it on 2G or data-saver connections.

**Employers** create a company page and submit it for verification. Listings must show pay and place; a listing that asks candidates for money is blocked, and gendered wording is flagged for review. Every listing is reviewed before it goes live, and edits send it back for review. Applicants arrive in a pipeline (new, shortlisted, interview, hired or rejected) with their resume, a call button, a WhatsApp button and a private note.

**You, the admins**, verify companies (including the US sanctions-list check), review listings, and confirm hires by phone. The dashboard leads with **confirmed hires**, the one metric that matters, and shows an 8-week trend.

![Admin overview](docs/screenshots/admin-overview.png)

## Quick start

You need **Node.js 22.13 or newer** (Node 22 LTS or 24). Earlier Node 22 releases hide the built-in database behind a flag. There is nothing to install.

```bash
OTP_DEV_ECHO=true ADMIN_PHONES=+963944000000 npm start
```

Open http://localhost:3000. Put your own number in `ADMIN_PHONES`.

In development, text messages are printed in the terminal instead of being sent, and `OTP_DEV_ECHO=true` also shows the sign-in code on screen. The first run adds 19 demo listings from 17 demo companies so the board isn't empty. Each demo listing says it's a demo, and none of them count in the metrics.

To keep settings in a file instead, copy `.env.example` to `.env` and edit it. The server reads it on start.

## Five-minute walkthrough

1. **Job seeker (use a phone-sized window).** Pick *I'm a university student*, enter any Syrian mobile number such as `0944 111 222`, tick the consent box, type the code shown on screen, and fill in the profile. Open a listing and tap *Quick apply*: the resume is already attached, so pick *العربية* or *English* and send it. Then check *Applications*.
2. **Employer (second browser or a private window).** Tap *Post a job*, sign in with a different number, add your company and submit it for verification. Create a listing: type the word "fee" into the description and watch the check turn red. Remove it and save the draft. Submitting now is refused, because the company isn't verified yet.
3. **Admin (third browser).** Sign in with the number in `ADMIN_PHONES`. Under *Companies*, tick the sanctions-screening box and verify the company. Back as the employer, submit the listing; as admin, publish it under *Listings*.
4. **The loop.** As the job seeker, apply to the new listing by WhatsApp. As the employer, open *Applicants*, view the resume and move the applicant to *Shortlisted*, *Interview* and *Hired*. The terminal shows the text message sent at each step. As admin, confirm the hire under *Hires*. The *Confirmed hires* number goes to 1.

## Configuration

Set these as environment variables or in `.env`.

| Setting | Default | What it does |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` when live. Turns on secure cookies, strict HTTPS and production checks. |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Where the server listens. |
| `BASE_URL` | none | **Required in production.** Your public address, exactly, starting with `https://`, for example `https://shaghilni.sy`. Used to reject requests from other sites. |
| `DB_PATH` | `data/shaghilni.db` | The database file. Put it on a persistent disk. |
| `ADMIN_PHONES` | none | Comma-separated numbers in international format (`+9639…,+1202…`). These accounts become admins when they sign in. |
| `OTP_PEPPER` | dev value | **Required in production:** a random secret of at least 32 characters, mixed into stored sign-in codes. The server won't start without it. |
| `OTP_DEV_ECHO` | `false` | Development only: shows the sign-in code on screen. Ignored in production. |
| `SESSION_DAYS` | `30` | How long people stay signed in. |
| `OTP_POW_BITS` | `14` | Difficulty of the invisible sign-in challenge that slows down bots. Each +1 doubles the work; `0` turns it off. |
| `SMS_PROVIDER` | `console` | `console` (print to log), `textbee` or `twilio`. |
| `TEXTBEE_API_KEY` | none | For `textbee`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | none | For `twilio`. |
| `SMS_ALLOWED_PREFIXES` | Syria and the main diaspora countries | Country codes that texts may go to. Admin numbers are always allowed. Keeping it narrow blocks SMS-pumping fraud. |
| `SMS_DAILY_CAP` | `1000` | Most texts the whole site sends in a day (UTC). Beyond it, sign-in pauses until midnight. |
| `ANTHROPIC_API_KEY` | none | Turns on Claude in the resume helper: wording suggestions and translation drafts. Without it, people can still write translations themselves. |
| `CLAUDE_MODEL` | `claude-sonnet-5` | The Claude model used for suggestions. |
| `AI_DAILY_CAP` / `AI_USER_DAILY_CAP` | `300` / `30` | Most Claude calls (suggestions and translations) per day: for the whole site, and per person. |
| `SEED_DEMO` | `true` | Add the demo listings on first start. They're added once and never again after removal. |
| `TRUST_PROXY` | `false` | Set to `true` behind a hosting proxy (Render, Railway, Fly, nginx, Caddy). See *Deploying*. |
| `API_RATE_LIMIT` / `WRITE_RATE_LIMIT` | `600` / `240` | Requests per minute per address: all API calls, and changes. |
| `LEGAL_NAME` | none | Your registered company name, shown in the privacy notice and terms. |
| `CONTACT_EMAIL` | none | **Needed before launch.** The address for privacy requests and reports, shown in both documents. |

Generate a pepper with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Text messages

Sign-in codes and application updates go by SMS.

- **`textbee`**: an Android phone with a Syrian SIM runs the textbee app and sends the messages from your own number. It's the cheapest route inside Syria and replies come back to that phone. Set `SMS_PROVIDER=textbee` and `TEXTBEE_API_KEY` from the textbee dashboard.
- **`twilio`**: international and reliable, but far more expensive per message to Syria. The startup cost document compares the two.
- **`console`**: prints messages to the server log. For development only.

Job seekers get a text when an employer shortlists them, invites them to interview, hires them or turns them down. Every message is stored first; failed sends show on the admin dashboard.

## Resume suggestions and translation (optional)

Names are never sent to Claude. When a resume is shown in the other language and the person hasn't typed their name in it, the name is written in that script on the device: common Syrian and Arab names get their usual spelling ("عمر نبيل الخطيب" becomes "Omar Nabil Al-Khatib"), others are spelled out, and the translation editor asks the person to check it against their passport or ID.

With `ANTHROPIC_API_KEY` set, the resume helper can suggest stronger wording for a job seeker's bullet points. The server accepts only bullet points already saved in that person's profile, allows 10 requests per hour per person, and runs every suggestion through the same fact guard the browser uses. Any suggestion that adds a number, a name, a tool or a bigger role is held back. Without a key, the helper explains that suggestions aren't switched on; everything else works.

**Resumes in both languages.** People can write their profile in Arabic, English or a mix, and the resume helper shows it in either language: switch the resume between *العربية* and *English*. Each line that isn't already in that language is shown in its saved translation. Anything still untranslated is counted in a notice above the resume, which opens an editor listing every line next to its translation.

- **Writing translations.** With no API key, people type the translations themselves. With `ANTHROPIC_API_KEY` set, *Translate with Claude* drafts every missing line, in either direction, and people check and correct them in the same editor.
- **What Claude receives.** Only the resume's text, never the person's name or phone number. Names are typed by the person (*your name in English*, *your name in Arabic*).
- **The fact check.** A translation is dropped, and left for the person to write, if it changes, drops or invents a number, or if an English version still contains Arabic.
- **Applying.** Quick apply attaches the resume and asks which language to send. The default is English when the job asks for English; otherwise it's the language the resume is mostly written in. The panel counts any lines not yet translated, links straight to the editor, and shows a preview.
- **WhatsApp and employers.** WhatsApp applications send the resume in the message's language. Employers open each resume in the language it was sent in, labelled as such, and can still switch.
- **Storage.** Translations are saved with the profile. Each application keeps the version sent at that moment, so later translations don't reach employers who already have it.
- **Cost.** Each translation counts as one call against the same daily AI caps as suggestions.

## Deploying

Shaghilni runs as **one always-on Node process with a persistent disk** for the database file. That makes it simpler and cheaper than the Vercel and Supabase setup assumed in the cost document, but it can't run on serverless functions.

**Option A: Render or Railway.** Create a web service from the repository.

- Build command: none.
- Start command: `npm start`.
- Health check path: `/api/health`.

Add a persistent disk mounted at `/data`, then set these variables:

```
NODE_ENV=production
DB_PATH=/data/shaghilni.db
BASE_URL=https://your-domain
TRUST_PROXY=true
OTP_PEPPER=<random secret, 32+ characters>
ADMIN_PHONES=<your numbers>
SMS_PROVIDER=textbee
TEXTBEE_API_KEY=<key>
ANTHROPIC_API_KEY=<key, optional>
LEGAL_NAME=<your registered company>
CONTACT_EMAIL=<privacy@your-domain>
```

Sample data is never added in production: with `NODE_ENV=production` the 19 sample listings are not seeded, whatever `SEED_DEMO` says. If a database that was first used in development still holds them, the server says so at start-up and the Insights screen shows a "Needs attention" note until `npm run demo:remove` has run.

**Option B: Docker on a small VPS.**

```bash
docker build -t shaghilni .
docker run -d --name shaghilni -p 127.0.0.1:3000:3000 -v shaghilni-data:/data --env-file .env shaghilni
```

Put Caddy or nginx in front for HTTPS (a two-line Caddyfile is enough: `your-domain { reverse_proxy 127.0.0.1:3000 }`) and set `TRUST_PROXY=true`. The `.env` you pass with `--env-file` must say `NODE_ENV=production`: it overrides the image's own setting, and the shipped `.env.example` says `development`. Run `npm run security:check` against that file first; it fails until the file says production.

Two settings matter more than they look:

- **`BASE_URL`** must match your public address exactly, including `https://`. Otherwise every form submission is refused as coming from another site.
- **`TRUST_PROXY=true`** is required behind a hosting proxy. Without it, every visitor appears to come from the proxy's address and shares one rate limit, so a busy morning could lock everyone out of sign-in. Leave it `false` when nothing sits in front of the server, or visitors could fake their address.

## Running it

**Backups.** `npm run backup` writes a consistent copy to `backups/shaghilni-YYYY-MM-DD-HH-MM.db` while the site keeps running. Schedule it daily (for example with cron) and copy the files off the server. To restore, stop the app, replace the database file, delete any `-wal` and `-shm` files next to it, and start again.

**Demo listings.** `npm run demo:remove` deletes the demo companies and listings, including any applications made to them. They won't be added again.

**Before you go live:**

- [ ] `NODE_ENV=production`, `OTP_PEPPER`, `BASE_URL`, `TRUST_PROXY` and `ADMIN_PHONES` are set.
- [ ] Sign in with your own number to confirm the SMS provider works.
- [ ] Daily backups are scheduled and copied off the server.
- [ ] Decide whether to keep the demo listings.
- [ ] Add a privacy notice and terms of use, reviewed by a lawyer under Syrian law. The app has no pages for these yet.
- [ ] Check the employment-office licence requirements listed in the startup cost document.
- [ ] Agree who screens companies. The sanctions check is manual: search each company and its owners on the OFAC sanctions list before verifying. US list-based sanctions still apply. The app records who confirmed the check and when.

## How it's built

```
server/          Node.js, no dependencies
  index.js       entry point
  app.js         routes, sessions, CSRF defence, static files
  config.js      settings and .env loading
  db.js          SQLite (node:sqlite) and migrations
  http.js        routing, JSON bodies, cookies, security headers, rate limits
  auth.js        phone sign-in codes, the sign-in challenge, consent and sessions
  guard.js       text destinations, daily text and AI caps, phone masking in logs
  retention.js   deletes data once it's no longer needed (hourly)
  core.js        runs the browser's rule engine on the server
  validate.js    input sanitising and posting checks
  notify.js      application-update text messages
  sms.js         console, textbee and Twilio senders
  seed.js        demo data
  routes/        public, me (job seekers), employer, admin, resume
public/          the interface: plain JavaScript, bundled and gzipped at start-up
  js/engine.js   matching, Arabic search, posting checks, resume builder and fact guard
  js/app*.js     views for job seekers, employers and admins
  js/i18n*.js    every string in English and Arabic
  js/legal.js    the privacy notice and terms of use (drafts: see SECURITY.md)
  js/pow.js      solves the sign-in challenge
  fonts/         IBM Plex Sans Arabic, self-hosted (SIL Open Font License, OFL.txt)
scripts/         backup, demo removal and the security scanner
test/            API and security tests, plus an optional browser test
```

**One set of rules.** The engine that scores fit, normalises Arabic search, checks listings for fees and gendered wording, and guards resume suggestions against invented facts runs in the browser for instant feedback. The server runs the same file in a sandbox to enforce those rules, so the two can never disagree.

**Data.** SQLite holds users, sign-in codes, sessions, profiles, companies, listings, applications, saved jobs, notifications and an audit log. Each application keeps a snapshot of the profile at the moment it was sent, so employers see what the person actually submitted.

**Security.**

- **Sign-in codes:** stored only as salted hashes, valid for 10 minutes and for 5 attempts, and rate-limited per number and per address.
- **Sessions:** random 256-bit tokens, stored hashed, in HttpOnly SameSite cookies, which are Secure in production.
- **Requests from other sites:** every change needs a custom header that other sites can't send, plus an origin check.
- **Page security policy:** strict, and allows no inline scripts.
- **Contact details:** an employer's WhatsApp number is only released to a signed-in applicant.
- **Audit trail:** admin and employer actions are recorded in the audit log.
- **Account deletion:** erases personal data but keeps an anonymous record of applications and hires, so the metrics stay honest.
- **The rest:** consent records, data export, retention, cost caps, the sign-in challenge and the full pre-launch checklist are in [SECURITY.md](SECURITY.md).

## API

All endpoints return JSON. Requests that change anything must send the header `x-shaghilni: 1`.

| Area | Endpoints |
|---|---|
| Sign-in | `GET /api/auth/challenge`, `POST /api/auth/code`, `POST /api/auth/verify`, `POST /api/auth/logout` |
| Public | `GET /api/jobs`, `GET /api/jobs/:id`, `GET /api/config`, `GET /api/health` |
| Job seekers | `GET /api/me`, `PUT /api/me/profile`, `PUT /api/me/lang`, `POST`/`DELETE /api/me/saved/:jobId`, `POST /api/jobs/:id/apply`, `GET /api/me/applications`, `POST /api/me/applications/:id/withdraw`, `GET /api/me/export`, `DELETE /api/me`, `POST /api/resume/suggest`, `POST /api/resume/translate` |
| Employers | `GET /api/employer`, `PUT /api/employer/company`, `POST /api/employer/company/submit`, `POST /api/employer/jobs`, `PUT /api/employer/jobs/:id`, `POST /api/employer/jobs/:id/submit`, `/close`, `/reopen`, `GET /api/employer/jobs/:id/applications`, `PUT /api/employer/applications/:id` |
| Recruiters | `GET /api/employer/students`, `POST /api/employer/students/:id/invite`, `GET /api/employer/invitations`, `POST /api/employer/invitations/:id/withdraw`, `PUT /api/me/recruit`, `GET /api/me/invitations`, `POST /api/me/invitations/:id/respond`, `/block` |
| Lite (HTML pages) | `GET /lite`, `/lite/job/:id`, `/lite/applications`, `/lite/recruiters`, `/lite/resume`, `/lite/me`, `/lite/profile?step=1–5`, `/lite/signin`, `/lite/hire` (also at `/hire`), `/lite/hire/company`, `/lite/candidates`, `/lite/candidates/sent`, `/lite/candidates/:id/invite`, and the matching `POST` forms |
| Admin | `GET /api/admin/overview`, `GET /api/admin/companies`, `POST /api/admin/companies/:id/verify`, `/reject`, `/suspend`, `GET /api/admin/jobs`, `POST /api/admin/jobs/:id/approve`, `/reject`, `GET /api/admin/hires`, `POST /api/admin/applications/:id/confirm-hire`, `GET /api/admin/audit` |

## Security and privacy

The pre-launch security checklist is in **[SECURITY.md](SECURITY.md)**. It covers all 13 items: what the code does for each, the test that proves it, and what you must do yourselves, such as a lawyer's review of the privacy notice and terms, provider spend limits and external scans. Run these before every launch:

```bash
npm test
npm run security:check -- --url https://your-domain
```

The scanner checks the code for secrets and risky patterns, your settings as production would see them, and the live site's headers and behaviour. It exits with an error if anything fails. In production the server also refuses to start with a weak `OTP_PEPPER` or a `BASE_URL` that isn't `https://`.

## Tests

- `npm test` runs 34 test groups against in-memory databases.
  - **11 API groups:** sign-in and rate limits, the request-origin checks, profiles, applications, company verification, listing checks, review, the pipeline and its texts, hire confirmation, resume suggestions with a stubbed Claude, account deletion and static file serving.
  - **3 Lite groups** (`test/lite.test.js`): page size and no scripts, both languages, a job seeker's whole flow and a recruiter's whole flow through plain HTML forms, and forged or cross-site forms refused.
  - **6 import groups** (`test/import.test.js`): names written in the other script, both ways; six real resume files (Word, a LibreOffice PDF and a Chrome PDF, each in English and Arabic) read field by field; files that can't be read; the rule that nothing is replaced; and a check that the importer makes no network calls.
  - **2 recruiter groups** (`test/recruit.test.js`): only students who opted in can be found, and only by verified employers; cards carry no contact details; invitation checks, replies, the number shared after a yes, limits, blocking and deletion.
  - **12 security groups,** numbered after SECURITY.md: consent and data handling, cross-account access, over 1,000 junk requests, error leaks, sign-in failures, what translation sends to Claude, secret exposure, the production lockdown, caps and rate limits, the sign-in challenge and cross-site rules, and the scanner itself.
- `npm run test:e2e` drives three real browsers through the whole loop and saves screenshots to `test/e2e/shots/`. Actors: a job seeker on a phone in Arabic, and an employer and an admin on desktops in English. Its 54 checks include Lite on a phone with JavaScript switched off (the job list in a few kilobytes, applying, and the recruiter sign-up page at /hire), uploading a PDF resume on a phone and adding it to the profile, the Arabic name arriving already written in English, the posting form asking Arabic questions in Arabic, the recruiter flow (a student opts in, a verified employer invites them to an event, the student says yes), that “Tailor my resume for this job” opens the one resume focused on that job, with no version picker, the consent box, the sign-in challenge solved in a real browser, choosing which resume language to send, writing the English version of an Arabic resume, the legal pages, the self-hosted font, and that no request goes to another site. It needs Puppeteer, installed once with `npm install --no-save puppeteer`.

## Limits of this MVP

- **The privacy notice and terms are drafts.** They describe what the code does, but a lawyer must review them before launch (SECURITY.md, item 1).
- **No automatic alerts.** Errors, failed texts and reached caps go to the server log, and the admin screens don't show the audit log yet (it's at `/api/admin/audit`). Watch the log, or add an alert on your host.
- **One server process.** Rate limits live in memory; the daily text and AI caps are in the database. Running several copies would need shared limits (in the database or Redis) and, eventually, Postgres instead of SQLite.
- **Node's built-in SQLite is marked experimental in Node 22.** It works well here, and the server hides the warning, but keep Node updated.
- **Search happens in the browser.** The board sends up to 500 live listings to each visitor. That's fine for the first year; beyond that, search should move to the server.
- **Not built yet:**
  - The university career-office portal.
  - Telegram and SMS job alerts.
  - Applying by phone call.
  - Public resume links.
  - Resume file uploads.
  - Several people per employer account.
  - Admin editing of listings.
  - Email.
  - Paid employer plans.


## Syrians abroad and job alerts

**Living outside Syria.** Sign-up has a country-code picker (Syria first, then the countries where most Syrians abroad live), and "Where do you live?" includes **Outside Syria**, with a country. Resumes, recruiter cards and the fit score all use it: remote jobs count as a full match for people abroad, and jobs that welcome returnees as a good one.

**Jobs that welcome people coming home.** Employers can tick *We welcome Syrians returning from abroad* on a listing. It shows as a badge, and job seekers can filter for it (*For returnees*), in the full app and in Lite.

**Job alerts.** A job seeker saves a search (keyword, governorate, type and filter) from the job board (*Alerts*) or from Lite (*Get alerts for this search*). Up to five alerts each. New matching jobs are counted in the app straight away, and a digest goes out at most about once a day, by email or text:

| Setting | Default | What it does |
|---|---|---|
| `SMS_ALLOWED_PREFIXES` | Syria and 19 diaspora countries | Which country codes sign-in codes and texts may go to. Anything else is refused, which blocks SMS-pumping fraud. |
| `SMS_INTL_DAILY_CAP` | `150` | The most texts a day to numbers outside Syria (on top of `SMS_DAILY_CAP` overall). International texts cost more. |
| `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM` | not set | Any email service with a simple HTTP API (it receives `{from, to, subject, text}` with a bearer key). Until these are set, email alerts are offered as "not switched on yet" and people can pick texts or the app. |

The digest is checked every hour (`server/index.js`); each alert is sent at most once in about a day. Alert texts use the same notifier as other texts, so the country list and both caps apply.


## Plans for employers

Hiring is free on every plan: any verified employer can post jobs with the pay shown, manage applicants and record hires. Job seekers never pay for anything.

| | Free | Pro | Enterprise |
|---|---|---|---|
| Post jobs, manage applicants, record hires | ✓ | ✓ | ✓ |
| Candidate invitations a month | 5 | 50 | No limit |
| Sponsored listings at a time (30 days each) | none | 2 | 10 |
| Analytics for each listing (applications, shortlists, interviews, hires) | ✓ | ✓ | ✓ |
| Full analytics (from candidate search, by WhatsApp, days to hire) | | ✓ | ✓ |
| People on the company's team | 3 | 10 | 50 |
| Placement reports and compliance records (spreadsheet files) | | | ✓ |
| Placement fee for a hire found through candidate search | one month's pay | none | none |

- **Placement fees** apply only on the Free plan, only when the hired person was invited through candidate search (and accepted) before applying, and only once the Shaghilni team confirms the hire. The fee is the middle of the listing's monthly pay range. Hiring your own applicants is always free.
- **Sponsored listings** stay verified and reviewed. They're lifted to the top, labelled *Sponsored*, only for signed-in job seekers with a fit score of 60% or more; everyone else sees the usual order. Employers never see who was shown a listing.
- **Programmes** (donor or livelihood programmes) are set up by the admin with a rate per confirmed placement. When confirming a hire, the admin can tag it to a programme, which records a charge to that programme.
- **Upgrading.** A Free employer sees an **Upgrade** button on their plan card (and a locked *Sponsor · Pro* button on live listings). On the Plans page they choose Pro or Enterprise, say how they'd like to pay, and send the request. They then see *What happens next* and a reference to quote when paying (for example `SHG-18-1`).
- **Paying, by hand for now.** Companies in Syria pay in Syrian pounds by mobile wallet (Syriatel Cash or Sham Cash), bank transfer, or cash with a receipt; international organizations pay in US dollars by card or bank transfer, invoiced by the US company. The admin sees each request's payment method, note and reference on the Billing tab, sends the invoice, and once the money arrives sets the plan and its length (optionally recording the invoice amount) and marks charges paid. Nothing is charged automatically. Receiving Syrian pounds by wallet or through a Syrian bank needs a Syrian entity or local partner to hold those accounts.
- **Prices** are settings, shown on the Plans page: `PLAN_PRO_PRICE` and `PLAN_ENTERPRISE_PRICE` (for example `4,000 SYP a month`). Until they're set, the page says *Contact us for pricing*.


**Employer accounts** show only the company's own listings, analytics and profile: the public job board isn't part of an employer account, in the full app or in Lite. **Signing out or deleting an account** returns to the welcome screen (in Lite, to *Sign in or create an account*).


<!-- demo-accounts:start -->
## Demo accounts

When you run Shaghilni yourself, the home screen has an **Explore the demo** card. It opens a chooser with four ready-made accounts, and signs you straight in. While you're inside, a small banner says which account you're using, with **Switch account** and **Leave demo**.

| Account | Who | What's inside |
|---|---|---|
| University student | Omar Nabil Al-Khatib, Petroleum Engineering, Homs University | Applications (shortlisted, interview), invitations from two companies, tickets for a careers day and an internship fair, a past event he attended, a verified-student badge, saved jobs and an alert |
| Job seeker | Rania Saleh, Business graduate in Damascus | An interview (sent by WhatsApp), a rejection, a job invitation waiting for her answer, a talent-session ticket and an alert |
| Company | Yasmin Trading, on Pro | Two listings with applicants at every stage including a confirmed hire, invitations sent, events it's attending, analytics, a sponsored listing and a university partner |
| University career office | Homs University | Verification requests, verified students, employer partners (one approved, one waiting), internship programmes, upcoming events with sign-ups and a past careers day with its report |

There's also a second fictional company (Qasioun Advisory) and five fictional students, so the lists look real. All of them are fictional; none of the demo touches the sample listings' organisations. You can also sign in with the numbers: 0933 000 101 (student), 0933 000 102 (job seeker), 0955 000 201 (company, as a recruiter), 0944 000 301 (career office). In demo mode the code is shown on screen.

The demo accounts are made through the app's own actions the first time the server starts. They're on by default when you run it yourself (`DEMO_ACCOUNTS=false` turns them off), off in tests, and never in production.

**Taking the demo out:**
- `npm run demo-accounts:purge` removes the demo accounts and everything they made from a database, and keeps them from coming back.
- `npm run demo-accounts:uninstall` deletes the demo code: `server/demo.js`, `public/js/demo.js`, its test, and the lines marked `// demo-accounts`. The few remaining hooks in the app (on the home screen, the banner, and Lite's sign-in page) do nothing once the demo code is gone.
- The sample job listings are separate: `npm run demo:remove` takes those out.
<!-- demo-accounts:end -->

## Card payments (QNB Syria, or any bank's hosted payment page)

Employers can pay for Pro or Enterprise by card: they choose the plan and 1, 3 or 12 months, pay on the bank's own secure page, and the plan switches on as soon as the bank confirms. Shaghilni never sees or stores card numbers. Wallet, bank transfer and cash payments keep working as before, handled by hand.

| Setting | What it does |
|---|---|
| `PAY_PROVIDER` | `qnb` for QNB Syria (once its adapter is completed), or `test` for the pretend payment page in development. Empty: no card option. |
| `PAY_CURRENCY` | The currency charged, `SYP` by default. |
| `PLAN_PRO_MONTHLY`, `PLAN_ENTERPRISE_MONTHLY` | Monthly prices in that currency, for example `4000`. The card option appears only when both are set, and the Plans page then shows them. |
| `QNB_GATEWAY_URL`, `QNB_MERCHANT_ID`, `QNB_API_SECRET`, `QNB_WEBHOOK_SECRET` | QNB Syria's details, from your merchant agreement. |

**How it works.** `POST /api/employer/plan/checkout` creates a payment and asks the provider for a payment session; the employer is sent to the provider's page. The provider then sends the result to `/pay/callback/<provider>`, server to server. Only that signed result switches a plan on, after the signature, amount and currency are checked, and it's processed once. The employer comes back through `/pay/return`, which only shows the result. Renewing the same plan adds to the time left. Each paid payment is recorded as a paid charge.

**Completing QNB Syria.** Everything is built except the two functions that talk to QNB's gateway, `createSession()` and `verify()` in `server/payments.js`. Fill them in from QNB Syria's developer documents, set `ready = true`, and test against their test environment. Until then, `PAY_PROVIDER=qnb` leaves the card option switched off.

**Try it now.** Start with `PAY_PROVIDER=test PLAN_PRO_MONTHLY=4000 PLAN_ENTERPRISE_MONTHLY=20000` to use the pretend payment page (clearly labelled, no real money). The server refuses to start in production with `PAY_PROVIDER=test`.


## Universities

Shaghilni works with universities' career offices, so companies entering Syria can find verified students for internships and first jobs.

- **Career offices** are added by the admin (Admin → Universities): a university, optionally one faculty, a name and a phone number. Their staff sign in with that number and see only their university (or faculty).
- **The career office portal** (`#/campus`) has an overview of totals for all its students on Shaghilni (students, verified, applying, interns hired, all hires, employers who hired them), **Verified students** with their applications and hires, **Employer partners** to approve, and **Internships** aimed at the university with how many of its students applied.
- **Privacy:** career offices see only totals for their students in general. They see names and activity only for students who verified themselves, who are told exactly what will be shared before they do, and can remove it at any time.
- **Verified students, by university email:** each university's student email domains are listed (by its career office on the **Student email** tab, or by the admin). A student enters their university address, gets a six-digit code by email, and is verified as soon as they enter it: no one approves anything by hand. Codes expire after 15 minutes and lock after five wrong tries; each address verifies one account; a student gets at most five code emails a day; public webmail domains can't be listed. A university without student email can't verify students yet. Once verified, a *Verified student* badge appears on their candidate card and applications, and employers can filter candidate search to verified students only. Verification belongs to the university in the profile: changing university removes it.
- **Employers** ask universities to partner from their dashboard (Universities). Approved partners show a *University partner* badge on their listings. When posting, they can aim a listing at particular universities and give programme dates; the listing then shows *Internship programme, dates, for students of …*.
- **Demo:** with `DEMO_ACCOUNTS=true` there's a fourth demo account, the Homs University career office (0944 000 301), with a fictional student email domain, Omar and Yazan verified by email, and Yasmin Trading's partnership request waiting.
- **Database:** career-office accounts needed a new role. SQLite can't change the users table's role rule in place, so migration 10 rebuilds that table from its own definition with foreign keys switched off and checked with `foreign_key_check` before committing. Tested by upgrading an older database with data: every count stayed the same.


## Events

Careers days, internship fairs, talent sessions at business-council forums, and diaspora evenings.

- **Organisers** are the Shaghilni team (Admin → Events) and university career offices (Career office → Events), who can run events only at their own university. An event has a title in both languages, a type, a start time in Syria time, a place, an optional host (for example a business council), an optional university, a number of places and a description. Organisers publish it, confirm the companies attending (companies ask from their dashboard; the admin can also add verified companies directly), and check people in.
- **Job seekers** find upcoming events on their Recruiters page and at `#/events`. They sign up with **I'll attend** and get a **ticket**: a QR code and a six-character code (letters and digits that can't be misread), also sent by text.
- **Check-in** happens on the event's management page (`#/organize/<id>`): type the code, or tap **Scan a ticket** on phones whose browser can read QR codes. Counts and the list update with every check-in.
- **Companies** ask to attend from their dashboard. Once confirmed, **See who's coming** opens candidate search filtered to attendees who have switched on "Let recruiters find me".
- **The report** shows totals only: signed up, came, cancelled, by university and faculty, and for each attending company the invitations, applications, interviews and hires with the people who came. It can be downloaded as a spreadsheet to share with the host and the university.
- **The QR library** (qrcode-generator, MIT licence, in `public/js/vendor/`) is loaded only when a ticket is shown, so the app's first download doesn't grow.
- **Demo:** with `DEMO_ACCOUNTS=true`, there's a careers day at Homs University run by its career office, with Yasmin Trading attending and Omar holding a ticket.


## Product and design records

- **`PRODUCT.md`** is the durable product record: who Shaghilni is for (job seekers first, all equally), its purpose, positioning (campus first, with the full board behind it), operating context, constraints, voice (Modern Standard Arabic in the app, Syrian dialect in texts and outreach), evidence on hand and principles.
- **`DESIGN.md`** records the visual system as built ("The Verified Noticeboard"): colour tokens for light and dark mode, the type scale, corners, spacing, components, and the rules that keep new screens consistent. **`.impeccable/design.json`** carries what that format can't hold: shadows, motion, breakpoints, the dark theme and working component samples.
- Both follow the impeccable design skill's formats, so AI tools that read them generate screens in Shaghilni's own system.


## Teams

Several people can work in one company, each signing in with their own phone number, like LinkedIn Page admins.

| Role | Can do |
|---|---|
| **Owner** (one) | Everything, including billing and plans; hands the company over to someone else |
| **Admin** | Runs the team and the company page, plus everything a recruiter does; only the owner manages other admins |
| **Recruiter** | Posts and edits jobs, moves applicants through the stages, searches for candidates, sends invitations |
| **Hiring manager** | Sees jobs and applicants, reads resumes, writes notes |

- **Team size** counts the owner, active members and open invitations: 3 on Free, 10 on Pro, 50 on Enterprise.
- **Joining:** an owner or admin invites someone by name, phone number and role from the Team page (`#/company/team`); they get a text and accept when they sign in (a new number with an invitation becomes an employer account automatically). Or a recruiter signs up, finds their company and **asks to join**; the owner and admins get a text and approve with a role. Registering a company whose registration number is already on Shaghilni is refused with a pointer to ask to join instead.
- **Who did what:** listings show who posted them (with a "Posted by me" filter), applicants show who moved them and who wrote the note, and owners and admins have a **Team activity** log (`#/company/activity`).
- **Control:** change roles, cancel invitations, remove people (access ends at once), leave a company, and transfer ownership (the old owner stays on as an admin). Every permission is checked on the server for every employer action.
- **Demo:** Yasmin Trading's team has Lina (admin) and Karim (hiring manager), with Fadi's request to join waiting.


## Insights for the Shaghilni team

Admin → **Overview** is the team's dashboard for keeping up with the platform, in totals only (no one's personal details):

- **Period:** the last 7, 30, 90 or 365 days, compared with the period before. Sample listings and demo accounts are left out unless you tick **Include sample data**, so the numbers show real activity.
- **Headline:** confirmed hires (all time, and in the period), users and new users, active this week and month, live jobs, applications, verified companies and money received.
- **Needs attention:** companies to verify, listings to review, hires to confirm, plan requests, unpaid charges, and text messages that failed in the last week, each linking to where it's handled.
- **The last 12 weeks:** new users, new jobs, applications and confirmed hires, week by week.
- **Breakdowns:** people (students, graduates and workers, Syrians abroad, open to recruiters, verified students, employer accounts, career offices, deleted accounts, where they are); hiring (the funnel from sent to hired, applications answered within a week, WhatsApp share, internship hires); jobs (by status, governorate, with no applicants, applicants per job, sponsored); companies (by status, plan and kind, teams); universities and events; money (received, due, by kind, card payments); messages (texts sent and failed, verification emails, recruiter invitations, job alerts).
- **Download** saves every figure as a spreadsheet file.

The data comes from `GET /api/admin/insights?days=30&sample=0`, for admins only.


## How people can apply

Applications always reach the company's dashboard on Shaghilni. In its company details (**How can people apply?**), a company can also let people apply by:

- **WhatsApp**, on the number it gives (companies set up before this have WhatsApp on, with their existing number);
- **a phone call**, on the number it gives;
- **email**, to the address it gives.

Each job shows a button for every way the company chose (quick apply on its own row when there are more than two). The numbers and the address are revealed only when someone applies. Whichever way a person applies, the application is recorded and labelled (Sent by WhatsApp, By phone call, Sent by email), and a way the company didn't choose is refused. Lite offers the same ways.

## Arabic

The app's Arabic is Standard Arabic as the base, with everyday Syrian (Shaami) words where the formal ones sound stiff: for example **الشركات** for the Recruiters tab, «خلّي الشركات تلاقيني», «عم دوّر على شغل» and «بدّي وظّف». The privacy notice and terms stay formal; text messages are in Syrian dialect. The overrides are the last block in `public/js/i18n4.js`.


## Traffic and system health (for the Shaghilni team)

Admin → **Traffic** and Admin → **System**, for admins only.

**Traffic** is counted by Shaghilni's own server: no Google Analytics, no Facebook pixel, no tracking cookies, and no IP addresses stored. A visitor is recognised for one day only, by a code made from a secret that changes daily. Browsers set to Do Not Track or Global Privacy Control aren't counted, and neither are search crawlers or automated browsers. Records are deleted after 180 days (`RETENTION.trafficDays`).

- **Right now:** visitors in the last 5 minutes.
- **Over 1, 7, 30, 90 or 365 days:** visitors, page views, visits (views with less than 30 minutes between them), pages per visit, the share of visits that left after one page, and a day-by-day (or week-by-week) chart.
- **Where visitors come from:** WhatsApp, Facebook, Instagram, Telegram, Google, direct and other sites, plus **campaigns**. WhatsApp often hides where a visit came from, so tag links you share: `https://your-site/?utm_source=whatsapp&utm_campaign=homs-careers-day`.
- **Link shares:** when someone pastes a Shaghilni link into WhatsApp, Facebook, Telegram and others, those apps fetch a preview; each fetch is counted as a share (not a visit), with the most-shared pages.
- **What and who:** most viewed pages (job numbers folded together), full app or Lite, phone, tablet or computer, browser (including the WhatsApp, Facebook and Instagram in-app browsers, Opera Mini and KaiOS), operating system, Arabic or English, signed in or not, and the country when the site runs behind Cloudflare (`CF-IPCountry`).
- **Connections and speed:** 2G, 3G or 4G (from browsers that report it), and how long the first page took to load (typical and slowest quarter), overall and by connection.
- **From visit to hire:** visitors, sign-ups, profiles, people who applied, confirmed hires.
- **Errors in visitors' browsers**, grouped by message. **Download** saves every figure as a spreadsheet.

How it's collected: the full app sends `POST /api/t` with the page (never anything typed) on each screen; Lite pages are counted by the server; link previews are recognised by the preview apps' identity. Browser errors go to `POST /api/t/error`. Each visitor is limited to 400 page views and 20 errors a day.

**System** shows whether the server is healthy: running time, memory, database size, the last backup found, requests in the last hour and day (fine, refused, failed), average response time, the slowest parts of the site, recent server failures, row counts and text messages in the last day. Requests and slow parts are counted in memory since the server last started.
