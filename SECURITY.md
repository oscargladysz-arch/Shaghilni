# Security and privacy checklist

This file maps the 13-item *30-Minute Pre-Launch Security Checklist* onto Shaghilni. For each item it covers three things: what the code does, which test proves it, and what you still have to do yourselves. It was last reviewed on 28 September 2026. On 5 October 2026 (Stage 0 of the launch work) every claim below was re-checked against the code at terms version 2026-10-04 and the ones that had drifted were corrected; on 6 October 2026 (Stage 4) the four review prompts (items 6–9) were re-run by four independent reviewers at the commit that closed Stage 3, every finding went to a separate adjudicator told to disprove it, and the results below describe the code after the Stage 4 fixes (`docs/agent/DEFECTS.md`, "Stage 4 · security re-review").

Run both commands before every launch and after every change:

```bash
npm test                                             # the full suite (API, security, route policy, recruiters, import, Lite, payments, plans, universities, teams, events, demo, diaspora, applying, insights, traffic, i18n, ratchets, accessibility)
npm run security:check -- --url https://your-domain  # the code, your settings and the live site
```

> **This is not legal advice, and no checklist can promise that you won't be sued.** What it does is remove the most common causes of data breaches, surprise bills and complaints, and leave a record that you took care. Before launch, have a lawyer review the privacy notice and the terms of use (item 1). Ideally that's someone who knows Syrian law and the US rules that apply to you as founders.

## At a glance

| # | Item | Status | Proof |
|---|---|---|---|
| 1 | Privacy policy and data handling | Built. **Needs a lawyer's review and two settings** | Security tests "1 · consent" and "1 · data handling"; browser checks |
| 2 | Row Level Security on Supabase | Not applicable, because there's no Supabase. The equivalent is built | Security test 2 |
| 3 | Server-side validation on every form | Built | Security test 3 (over 1,000 junk requests) |
| 4 | Error handling that does not leak data | Built | Security test 4 |
| 5 | Auth failure case testing | Built | Security test 5 and the API tests |
| 6 | Baseline security posture prompt | Re-run on 6 October 2026 (Stage 4); prompt below | This file |
| 7 | OWASP standards prompt | Re-run against the OWASP Top 10:2025 on 6 October 2026; prompt below | This file |
| 8 | Data leak audit prompt | Re-run on 6 October 2026; every leak found is fixed (list in item 8); prompt below | Security tests 1, 2, 8 and 9, and the recruiter and team tests |
| 9 | API key exposure prompt | Re-run on 6 October 2026; prompt below | Security tests 9 (two) and 13, and the scanner |
| 10 | Environment variable lockdown | Built | Security test 10 |
| 11 | Rate limits and cost caps | Built. **Set the providers' own caps too** | Security test 11 |
| 12 | CAPTCHA and CORS restrictions | Built, with an invisible proof-of-work challenge instead of a picture CAPTCHA | Security test 12; browser flow |
| 13 | Built-in security scanner check | Built: `npm run security:check`. **Also run the free external scanners** | Security test 13 |

The security tests are in `test/security.test.js`, numbered after this list. The browser flow (`npm run test:e2e`, 80 checks) repeats the most important ones in real browsers.

---

## 1. Privacy policy and data handling

**Built**

- **The documents.** A privacy notice and terms of use, in Arabic and English, at `/#/privacy` and `/#/terms`, and for Lite at `/lite/privacy` and `/lite/terms` (the same texts, no JavaScript). They're linked from the welcome screen, the sign-in step and the profile page, and live in `public/js/legal.js`. They describe what this code actually does: what's collected, who sees it, which providers receive what, and how long each thing is kept. That accuracy matters, because a privacy notice that doesn't match reality is itself a legal risk. In the US, the FTC treats a false privacy promise as a deceptive practice.
- **Kept current.** On 26 September 2026 the notice and terms were updated to cover resume translation, and `TERMS_VERSION` was changed with them, so sign-in records acceptance of the new version. On 28 September 2026 they were updated again for Recruiters (now open to every job seeker, not only students) and resume uploads: what students who switch it on share, and the rule that employers may invite students only to real jobs and to events that are free for them. `TERMS_VERSION` changed again. The current version, 2026-10-04, also covers job alerts, teams and billing, sponsored listings, visit counts, events, university-email verification, card payments and email alerts; `public/js/legal.js` is the record of the current wording.
- **Explicit consent at sign-in.** The box reads: *"I'm 18 or older and I agree to the Terms of use and the Privacy notice, including my data being stored and processed outside Syria."* The app and Shaghilni Lite send no code until the box is ticked, and the server creates no account unless the acceptance flag arrives with a correct code. The version and time of acceptance are stored with the account. When you change either document, change `TERMS_VERSION` in `server/config.js`, and sign-in records acceptance of the new version.
- **Minimisation.** Employers see a job seeker's details only after that person applies: the profile snapshot sent with that application, the account's phone number and the current verified-student badge. People who switch on *Let recruiters find me* also appear as short cards in candidate search (item 8). The public board carries no private company data; test 2 checks this.
- **Download my data.** On the profile page. It gives the account, profile, saved jobs, applications with the resume sent, invitations received, the companies they blocked, student verification, event tickets, job alerts and text records (job seekers); the company page, listings, plan, invoices, card payments, plan requests and university partnerships (company owners); their own team membership (anyone on a company's team); or the office record (career offices), as a JSON file. The company's billing goes to the owner only, who handles it.
- **Deletion.**
  - A person deleting their account erases their profile, saved jobs, sessions, text-message records (texts sent to the number before the account existed, such as a team invitation, included), leftover sign-in codes, invitations, job alerts, student verification, event tickets, team membership and blocked companies. A career office deleting its account also erases its office record (the university and the contact name). Each application survives only as an anonymous record (status and dates; the resume sent and the employer's note are erased).
  - An employer deleting their account also closes their listings and removes the contact name, WhatsApp number, application phone number and email from the company page.
- **Automatic retention.** `server/retention.js` runs at start-up and every hour and deletes:
  - sign-in codes, with the IP addresses stored alongside them, after 24 hours;
  - university email codes, with the address typed for them, after 24 hours, and the address of a withdrawn student verification at the next sweep;
  - expired sessions;
  - text-message records after 90 days;
  - usage counters after 60 days;
  - visit counts, link-share counts and browser error reports after 180 days.


  These are the periods the privacy notice promises, so keep the two in step.
- **No tracking.** There's no advertising and no analytics. Fonts are served from your own server, so visitors' addresses no longer go to Google. The full app sets only the session cookie. Shaghilni Lite also sets a form-protection cookie (`lt`, one year, no personal data) and, if you pick a language, a language cookie (`ll`); the notice's own sentence on cookies is to be aligned (see `docs/agent/LEGAL_PROPOSALS.md`).

**Why the consent mentions storage outside Syria.** Syria's Law No. 12 of 2024 on the Protection of Electronic Personal Data is in force. Reported penalties reach 12 million Syrian pounds and three years in prison. Secondary summaries say the law:

- restricts transferring personal data abroad unless the destination protects it adequately or the person explicitly consents;
- requires breach notification;
- expects a designated responsible person.

Your hosting, text-message provider and Claude are probably all outside Syria, so the consent says so explicitly. The same summaries also describe duties to keep certain records and hand them to the authorities on lawful request. Ask your lawyer how that applies to a job board, and whether the short retention periods above need adjusting. Starting points (none of them is the official text, so ask the lawyer for it):

- [SANA's announcement](https://archive.sana.sy/en/?p=327980)
- [PACMap summary](https://pacmap.dev/regulation/sy-personal-data-2024)
- [WorldWatch summary](https://anuragverma.co/worldwatch/syria/data-privacy)

**You must**

- [ ] Have a lawyer review both documents in both languages (`public/js/legal.js`). The drafts deliberately leave out a governing-law and disputes clause; a lawyer should add one.
- [ ] Set `LEGAL_NAME` (your registered company) and `CONTACT_EMAIL` (a mailbox someone reads). The scanner fails until `CONTACT_EMAIL` is set.
- [ ] Name one person responsible for personal data, and agree the breach plan below with your lawyer.
- [ ] Decide how long you keep backups (the notice promises "a limited time"), and delete old ones on that schedule.
- [ ] If you market to Syrians in Europe, ask the lawyer about the GDPR as well.

## 2. Row Level Security on Supabase

Shaghilni doesn't use Supabase, and the browser never talks to the database. Every read and write goes through the server. There, every query that touches an account's data is limited to that account (`WHERE user_id = ?`) or, for employers, to the one company the person owns or is an active member of (`plans.companyFor`), and every employer route then checks the person's team role. That gives the same protection Row Level Security gives a Supabase app, enforced in one place.

Security test 2 attacks it:

- Employer B tries to read employer A's applicants, move them, and edit, submit, close and reopen A's listing. Each attempt answers "not found".
- A job seeker tries to withdraw another seeker's application, or to see it in their own list or export.
- Every role tries the other roles' endpoints and is refused (403). Guests trying private endpoints are asked to sign in (401).
- Generated from the policy table (`test/policy/route-policy.js`): every route × every role the table excludes answers 401, 403 or 404 (`test/policy-access.test.js`, 574 refusals); account B, in the same role as account A, gets nothing of A's through any id-bearing route and A's rows stay unchanged (`test/policy-idor.test.js`); a career office the admin removed loses every organiser route even after signing in again.
- The public board is searched for private company fields: WhatsApp number, registration number and contact name.
- Shaghilni Lite (`test/lite.test.js`) runs every action through the same API handlers in-process, so access control, validation and rate limits are identical. Its HTML forms can't send the API's custom header, so each form carries a token signed with the server secret and tied to a per-browser cookie. Posts without it, or sent from another site, are refused. A job seeker's number never becomes a recruiter account, and candidate search in Lite waits for verification.
- Recruiter search (`test/recruit.test.js`): only job seekers who switched it on are listed, only to verified companies (and only to their owner, admins and recruiters), and never to a company the person blocked. Anyone with a profile can switch it on, and nobody is listed otherwise. Seekers, employers and guests are refused on each other's recruiter endpoints.

**If you ever move to Supabase or Postgres,** turn on Row Level Security on every table the browser can reach, and keep these tests.

## 3. Server-side validation on every form

Every endpoint rebuilds its input field by field (`server/validate.js`). It checks types, lengths, allowed values, phone formats and pay ranges, and runs the listing checks for fees and discriminatory wording (a fee word in the listing's text blocks it, and so does, in any box, a demand whose payer is the candidate, with a modal or a sum, such as "candidates must pay", "the trainee pays 100,000 SYP", "you will need to pay 50 USD", "deposit required" or «على المتقدمين دفع», unless negated; other payment wording in any box (a fee word, a payment word near a person, «دفع», «تسديد», «رسوم», «قسط», and any sum of money written with its currency or in thousands) is flagged for the reviewer, who reads every listing before it goes live, so a benefit the company pays, such as "tuition fees covered", or a trainee's pay is not refused; both are fixed word lists, the refusal narrow and the flag wide, pinned by a corpus test of 456 realistic lines; a negated demand is flagged rather than refused), and flags phone numbers and emails anywhere in a listing's text (place, contact lines and tags included) for the reviewer. The browser's checks exist only for convenience; the server's are the ones that count. Bodies over 256 KB are refused, and so is anything that isn't JSON.

Security test 3 sends more than 1,000 junk requests to 34 of the API's endpoints (the hand-written list in `test/security.test.js`), and `test/policy-junk.test.js` sends about 2,000 more to every POST, PUT and DELETE route in the policy table (malformed JSON, wrong types, 100 KB strings, bidi and control characters, SQL metacharacters, prototype keys, deep nesting, huge arrays), as a guest, a job seeker, an employer and an admin. The junk includes wrong types, arrays, objects nested 500 levels deep, prototype-pollution payloads, NoSQL-style operators, SQL fragments and bad IDs. The test requires that:

- no request crashes the server;
- the real profile survives;
- no object prototype is polluted.

The review and this test found two bugs, both fixed:

- an audit-log `limit` of `-5` meant "no limit";
- oversized uploads lost their "too large" (413) answer, because the connection was cut before the answer was sent.

Stage 4 found a third that the junk could not reach, because its values never formed a real key: a university, faculty or governorate sent as a list (`["damascus"]`) or as a prototype name (`constructor`) passed the lookup check, and one job seeker's list made the employer's applicant list and recruiter search answer 500. Every lookup id (university, faculty, governorate, and the languages, job types and fields of a profile or listing) must now be one of the table's own keys, as a string, and a list stored before the fix reads as no university (`test/policy-campus.test.js`, U-038).

## 4. Error handling that does not leak data

- **Expected problems** return a short code, such as `{"error":"wrong_code"}`, which the app turns into a message in the person's language (a code without a translation shows the general "something went wrong" message; `test/i18n.test.js` checks that every code the server answers has one).
- **Unexpected problems** return only `{"error":"server_error"}`. The details go to the server log. Security test 4 breaks the database on purpose and checks that the answer contains no stack trace, file path or SQL.
- **Account existence.** Sign-in never reveals whether a number has an account, and asking for a student email code never reveals whether an address already verified one (the code goes out either way; only the person holding the mailbox learns it at the confirmation). The team invitation form does answer that a number is taken, but each try spends one of the company's twenty invitations a day. Someone else's listing or application answers "not found", so its existence isn't confirmed.
- **Logs.** The server log masks phone numbers (`+9639•••222`), except the development `console` text provider, which prints each message whole (never use it in production; the scanner fails it). The path of an unexpected error is masked too (the team routes carry a number in the path), and a text provider's error answer, logged and kept with a failed text, has any number in it masked the same way (a number written without its country code keeps only its last three digits, `•••222`).

## 5. Auth failure case testing

Covered in security test 5 and the API tests:

- **Codes:**
  - wrong, expired, reused and wrong-number codes are refused;
  - each code allows five attempts;
  - requests are limited per number (tested) and per address: 30 codes and 60 checks an hour, 60 challenges per 10 minutes (not yet covered by a test);
  - malformed numbers and codes get clear errors.
- **Sessions:** forged, oversized and expired session tokens don't work.
- **Sign-out:** signing out ends the session on the server, so a copied cookie stops working. Deleted accounts lose their sessions.
- **Access:** the wrong role gets 403, and a signed-out visitor gets 401.
- **Production:**
  - cookies are `HttpOnly; SameSite=Lax; Secure`;
  - the browser is told to use HTTPS only (HSTS);
  - codes never appear on screen, even if `OTP_DEV_ECHO` is left on by mistake.

---

The next four items are the checklist's "prompts". Each one gives a prompt you can paste into Claude Code, or another assistant that can read the whole repository, after big changes. Each also records what the review found for this version.

## 6. Baseline security posture

```
You are reviewing a Node.js web app before launch. Read the whole repository.
Summarise its security posture: authentication, sessions, authorisation, input handling,
secrets, logging, dependencies, deployment settings and data retention. For each area,
say what is done well, what is weak, and the smallest fix. List findings by severity,
with file and line. Don't suggest rewriting working code unless there is a concrete risk.
```

**Result for this version** (re-run on 6 October 2026)

- **Strong:**
  - no npm packages at runtime (CI refuses a dependency or a lockfile); the one third-party script, `public/js/vendor/qrcode.js` (MIT), is served from this server and loaded only for event tickets;
  - phone sign-in with peppered SHA-256 codes that expire in 10 minutes, five tries, one use, compared in constant time, behind an HMAC-signed proof-of-work challenge and per-number, per-address and per-day limits;
  - random 256-bit session tokens stored only as hashes, in HttpOnly SameSite cookies (`Secure` in production), ended on sign-out, account deletion, admin demotion and office removal;
  - access checks on the server for every route, with a policy row per route and generated cross-role, cross-account and junk-input tests;
  - every body rebuilt field by field, 256 KB cap, JSON only; SQL through `?` placeholders, with 57 reviewed `sql-safe` markers where SQL text is built from fixed parts; two HTML sinks in the app, both marked `html-safe`: `put`, fed by the escaping html`` template, and the icon hydration, which writes the app's own icon markup with only the class escaped and `esc()` throughout Lite;
  - CSRF defence (the app header plus an Origin check on every `/api` write; signed per-browser tokens on Lite forms), no CORS grant, and a strict Content-Security-Policy with no inline scripts and nothing from other sites (inline styles are still allowed);
  - secrets read only in `server/config.js`, never sent to the browser (two tests plant all seven), never committed (the scanner and `.gitignore`), and a production lockdown that refuses a weak pepper or a non-https address;
  - errors answer a code only; phone numbers are masked in every log line (the development `console` text provider aside);
  - an hourly retention sweep, a complete data download and a deletion that erases or anonymises everything about the person;
  - an audit log of account, company, listing, application, hire, plan, charge, payment, team, invitation, campus, event and programme actions, read in the admin's *Audit log* tab.
- **Fixed in this pass (Stage 4):** a request line the URL parser rejects stopped the process (D-39); a malformed percent-encoding answered 500 (D-40); the team invitation and the student email code told whether an account exists (D-41, U-037); wrong sign-in codes left no trace (D-42); a text provider's error and an unexpected error's path could log a full number (D-53, U-054); the scanner missed this app's own secret names and key files, and `.env.production` was not ignored (D-50, D-51); the email call had no timeout (D-46); spreadsheet cells could run as formulas (D-43); a suspended company kept reading applicants (U-022); the data download, deletion and retention fell short of the notice (U-014, U-053, U-055, U-035); and two money holes in the placement fee and the join requests (U-029, U-032). The second verification round and an adversarial review of these fixes then found and fixed: a university or faculty sent as a list that broke employers' applicant lists (U-038); a backup that silently copied an empty database (U-059); a company admin inviting admins (U-030); a rejected company still reading applicants; a draft that held someone else's registration number seeing and texting the people asking to join it; a placement fee lowered by cutting the pay just before the hire or by undoing it; the owner's download listing a programme's charges; formula cells starting with a sign and a figure; a flood of addresses resetting the daily limits; the scanner missing this app's secret names in Dockerfile, YAML, compose and JSON files and encrypted keys; and a sign-in lock audited with the victim as the actor.
- **Fixed in the earlier passes (Stages 1–3, and 28 September):** sample data never seeded in production; the scanner fails development settings; the admin role follows `ADMIN_PHONES`; team invitations need a verified company; edits re-enter review; the fee basis is fixed at the hire; consent recording, export and retention; Google Fonts; text and AI caps; the sign-in challenge and the production lockdown; phone masking and isolation headers.
- **Weak, recorded:** job-alert emails go to the profile's address, which nothing confirms (D-47; email alerts are off until an email service is set); after an ownership transfer the company's WhatsApp number is still the old owner's, so the hire-confirmation call can go to the wrong person until the new owner changes it; hiring managers read the company's charges and payment status (U-121, reported in Stage 0 and not yet verified); the scanner's SQL check sees only templates passed straight to `db.*` (U-060, P3, confirmed in Stage 4 and recorded); `company_exists` names the holder of a registration number (D-44, A-49).
- **Remaining, by design for an MVP:**
  - One server process. Rate limits, the used-challenge list and the daily limits on team invitations (20 per company), requests to join (5 per account) and recruiter invitations (40 per company) live in memory and reset on restart; the daily text, AI and international caps are in the database and survive.
  - SQLite rather than Postgres, and the database file is not encrypted (use an encrypted disk).
  - Admin accounts have no second factor beyond their phone.
  - There are no automatic alerts (see A09 below).
  - `style-src 'unsafe-inline'` stays in the CSP.

## 7. OWASP Top 10:2025

```
Check this codebase against each category of the OWASP Top 10:2025, from A01 Broken Access
Control to A10 Mishandling of Exceptional Conditions. For each category, name the controls
present, point to the code, and list any gaps with a fix and a test that would prove it.
```

**Result for this version** (re-run on 6 October 2026; categories from [owasp.org/Top10/2025](https://owasp.org/Top10/2025/)):

| Category | What protects Shaghilni | Gaps to know about |
|---|---|---|
| **A01 Broken Access Control** (now includes SSRF) | Every account query is limited to its owner, and every route checks roles and the team level; the route-policy table drives the cross-role, cross-account and junk-input tests for every route. The server calls only the fixed addresses of Anthropic, textbee and Twilio and the email service the operator sets in `EMAIL_API_URL`, and never fetches a URL a user supplied, so there's no SSRF surface. Since Stage 4 only a verified company's team reads applicants (not one suspended, rejected, or back in review after a resubmission or an identity edit), a request to join an unverified company waits unseen, and only the owner makes admins. | `company_exists` names the company that holds a registration number (D-44, accepted in A-49). Hiring managers read teammates' numbers (D-34) and the company's charges (U-121, unverified). |
| **A02 Security Misconfiguration** | Production refuses to start with a weak secret or a non-https address. Strict security headers (CSP, HSTS, nosniff, no framing, isolation headers); no software versions in headers. The scanner audits your settings (and warns on a plain-http email service) and the live headers. | Your host's own settings are yours to check: firewall, backups, and who can reach the dashboard. |
| **A03 Software Supply Chain Failures** | No runtime dependencies at all; CI refuses a dependency or a lockfile. Fonts, code and the one vendored library (`qrcode.js`, MIT) are served from your own server. The Docker image uses the official `node:22-alpine` and runs as the unprivileged `node` user. | Rebuild the image monthly to pick up Node and Alpine security patches; the image tag and the CI actions are pinned by version, not by digest. Puppeteer is a test-only install. |
| **A04 Cryptographic Failures** | HTTPS enforced with HSTS in production. Sign-in codes stored as SHA-256 with a secret pepper, student email codes as an HMAC under it. Session tokens come from `crypto.randomBytes` and are stored only as hashes. Every code, challenge and form token is compared in constant time. | The app doesn't encrypt the database file. Use an encrypted disk (most hosts encrypt by default) and keep backups private. |
| **A05 Injection** | Bound SQL parameters everywhere. The 57 places that build SQL text carry a `sql-safe` marker saying why it's safe (fixed fragments, lists of `?`, the database's own stored definitions, the operator's backup folder); none takes text from a user. All HTML goes through one escaping template (the app) or `esc()` (Lite); strict CSP; no `eval` and no shell. Every spreadsheet export keeps a cell that would run as a formula as text. | The scanner's SQL check sees only templates passed straight to `db.*` (U-060, recorded). |
| **A06 Insecure Design** | Threats handled by design: employer verification with a recorded sanctions-screening step (only a submitted company can be verified; a suspension is lifted by verifying it again, and until a company is verified again after a suspension, a rejection or an identity edit, its team reads no applicant and moves nobody), review of every listing (an edit in any state makes it a draft that is checked and reviewed again), the no-fees rule over every field of a listing, the placement fee fixed by the plan at the hire and the pay the listing showed when the person applied, SMS-pumping guards (invitations and requests to join capped per company and per account, and a request to an unverified company waits unseen and untexted), consent and minimisation. | Verification and sanctions screening are manual, so they're only as good as the people doing them |
| **A07 Authentication Failures** | See item 5. Sign-in never reveals whether a number has an account. | An admin account is only as safe as the admin's phone number. Ask your carrier for a SIM-swap PIN and keep `ADMIN_PHONES` short. A number taken off the list loses its sessions at its next request and the admin role at its next sign-in. |
| **A08 Software or Data Integrity Failures** | No scripts from CDNs. Built files are named by content hash. Database migrations are versioned and run in transactions. Card payment results are applied once, after the signature, amount and currency are checked. The audit log records who changed what. | None known |
| **A09 Security Logging and Alerting Failures** | The audit log records sign-ups, consent, deletions, company and listing changes and decisions, every application move (except a re-application after a withdrawal: `docs/agent/DEFECTS.md`, U-083), hire confirmations and a sign-in code locked after five wrong tries. The server log records errors, failed texts, reached caps and wrong sign-in codes, numbers masked. | **No automatic alerts yet,** but the admin's *Audit log* tab shows the log with filters, older pages and a spreadsheet export (actors masked like the logs). Watch the log, or add an alert on your host. |
| **A10 Mishandling of Exceptional Conditions** | Every request is wrapped, the request line itself included (a line the URL parser rejects answers 400 instead of stopping the process), a malformed percent-encoding is a 404, and unexpected errors answer 500 without details. Unhandled rejections are logged, and a fatal error exits so the host restarts a clean process. Fuzz-tested (test 3 and the policy junk tests); a broken database is tested (test 4). | None known |

## 8. Data leak audit

```
Trace every piece of personal data in this app (phone numbers, names, profiles, resumes,
company contacts, IP addresses, notes) from where it is collected to every place it goes:
API responses, logs, third-party services, backups, exports, error messages and the
browser. Flag anything sent to someone who doesn't need it, kept longer than needed,
or left behind after deletion.
```

**Result for this version** (re-run on 6 October 2026)

| Data | Who can see it | Where else it goes |
|---|---|---|
| Job seeker's profile, phone and email address | The seeker; the team of a company they apply to, at every level (the profile as it was sent, email address included; only while the company is verified); admins | The text provider gets the phone number. The email service gets the profile's email address with the titles of matching jobs, only for alerts the person sets to email (the address isn't confirmed: D-47). Anthropic gets only the text the person asks it to work on: for suggestions, the bullet points with their job titles and the job text; for a translation, the resume's text. The server never adds the name or phone number (tested for translation; the suggestion prompt is not yet covered by a test). |
| Company registration number, contact name, WhatsApp number, application phone number and email | The company's team and admins. The WhatsApp number, application phone number and email are released only to a signed-in applicant, and only for the ways the company switched on. A company that types a number another company holds is told which company holds it (D-44, A-49) | Never on the public board (tested). The contact name, WhatsApp number, application phone number and email are removed from the company page when the owner deletes their account; the registration number stays with the suspended company |
| Team members (name, phone number, last active) | The company's team at every level, hiring managers included (D-34); the owner and admins also see requests to join, once the company is verified. Former members are named, never shown by number | Invitation texts go through the text provider; deleted with the member's account |
| Employer notes on applicants | The company's team (owner, admins, recruiters and hiring managers) | Erased when the applicant deletes their account; not in the audit log |
| Candidate cards in recruiter search | Verified employers' owners, admins and recruiters (not hiring managers), and only for people who switched on *Let recruiters find me*: first name and last initial, education, experience level, recent job titles, governorate, skills and languages. Never the phone number or email | Gone from search as soon as the student switches it off or blocks the company. A company's own sent list keeps the invitations it sent, with the same short name, faculty, university and year: open ones are marked withdrawn when the student switches search off (tested, D-32) and declined when the student blocks the company; an event invitation the student already said yes to keeps the full name and number |
| Uploaded resume files | Nobody. The file is read in the browser and never uploaded; the importer makes no network calls (tested) | Only the details the person chooses to add are saved, exactly like typed ones |
| Invitations and replies | The student, and the owner, admins and recruiters of the company that sent them (hiring managers see neither the sent list nor any number). That company gets the student's full name and number only after the student says yes to an event | The student gets a text. Deleted with the student's account; withdrawn when the employer deletes theirs, when the admin suspends or rejects the company, and when the student switches recruiter search off |
| Event sign-ups (ticket code, check-in time) | The person; the event's organiser sees name, university and faculty to check them in; confirmed companies see only attendees who switched on *Let recruiters find me* | In the export; the code goes by text; reports hold totals only; deleted with the account |
| University email address | The student (masked); never the career office or employers | The email service, for the code. The codes, with the address typed, are deleted after 24 hours; a verified address is kept so it verifies one account, cleared when the verification is withdrawn, and deleted with the account |
| IP addresses | Nobody, through the app | Stored with sign-in codes for 24 hours; kept in memory for rate limits; your host's logs |
| Sessions | Nobody | Stored only as a hash, with the browser type; deleted at sign-out or when they expire |
| Text messages | The recipient, in their export (texts sent to the number before the account existed included) | The text provider; kept for 90 days, or until the account is deleted |
| Server log | Whoever runs the server | Errors (any number in the path masked), failed texts and wrong sign-in codes (numbers masked), reached caps. With `SMS_PROVIDER=console` every text, its number and its sign-in code is written to the log: production warns at start and the scanner fails it |
| The browser | The person on that phone | The language, the theme and, until the profile is saved or the person signs out, the profile form being filled in (without the phone number). The session cookie can't be read by scripts |
| Backups | Whoever holds the backup files | `npm run backup` copies the whole database, personal data included, to `backups/` (never committed: `.gitignore`). Deleting an account doesn't reach copies made before; keep them private, copy them off the server and delete old ones on the schedule you choose (item 1) |

**Found and fixed**

1. Fonts loaded from Google sent every visitor's IP address to Google. They're now self-hosted.
2. Deleting an account left its text-message history and sign-in codes (with phone number and IP address) behind. Both are now erased.
3. Server logs printed full phone numbers when a text failed. They're now masked.
4. An employer who deleted their account left their listings live and their contact details on the company page. The listings now close and the details are removed.
5. Stage 4: a text provider's error answer reached the log and the texts table with the number unmasked (D-53); an unexpected error on a team route logged the number in its path (U-054); the profile form stayed in the browser after sign-out, for the next person on a shared phone (D-54); deleting an owner's account left the application phone number and email on the company page (U-053); texts sent to a number before it had an account stayed after the account was deleted, and were missing from its export (U-055); the export missed the company's billing (for its owner), team memberships and blocked companies (U-014), then listed a programme's charges as the owner's (fix review); university email codes and withdrawn addresses were never swept (U-035); a rejected company kept reading its applicants, and a draft holding someone else's registration number saw and could text the people asking to join it (fix review). Each has a test.

**Reviewed when translation was added.** Translation sends more resume text to Anthropic, so it went through the same audit. Security test 8 checks four things:

- the prompt carries no name and no phone number;
- only lines not yet translated are sent;
- a translation that changes a number, or leaves Arabic in the English version, is dropped;
- translations of lines that no longer exist are pruned from the profile.

The privacy notice was updated to match (item 1).

**Reviewed when recruiters were added.** Student search is a new way for employers to see job seekers, so it went through the same audit. The recruiter tests check that nobody is listed without switching it on, that only students can, that cards carry no phone number or email, that the number reaches an employer only after a yes to their event, and that deleting an account deletes its invitations. The privacy notice and terms were updated to match (item 1).

## 9. API key exposure

```
Find every secret this app uses (API keys, tokens, peppers, passwords). For each, show where
it is read, and every way it could reach the browser, a log, an error message, the repository
or a Docker image. Explain how to rotate it. Then scan the repository for any secret that is
hard-coded or committed.
```

**Result for this version**

- **The secrets:** seven. `OTP_PEPPER` (hashes sign-in codes and student email codes; signs the sign-in challenge, Lite's form tokens and the development test-payment page; salts the daily visitor code), `ANTHROPIC_API_KEY`, `TEXTBEE_API_KEY`, `TWILIO_AUTH_TOKEN` with its account SID, `EMAIL_API_KEY` (sent only to the address in `EMAIL_API_URL`), and `QNB_API_SECRET` and `QNB_WEBHOOK_SECRET` (read, but unused until the bank's adapter is written). All are read only in `server/config.js`, used only on the server, and never logged. The browser learns only whether AI suggestions are switched on (`/api/config`).
- **Tested:** two security tests (both numbered 9) plant the seven secrets between them: the first the pepper and the Anthropic, textbee and Twilio keys, the second the email key and the two QNB secrets. They check that the page, every script and stylesheet and the public API responses never contain them; the second also checks Lite.
- **Scanned:** the scanner checks the repository for key patterns: Anthropic, OpenAI, AWS, the Twilio account SID, private keys, and hard-coded secrets under any name this app uses, in code (`textbeeKey: "..."`, or a literal behind any `...API_KEY || "..."` fallback), JSON, a settings line outside code files (`OTP_PEPPER=...`), a Dockerfile `ENV`, YAML or a compose file (a value of one repeated character is a placeholder). It reads code, settings and key or certificate files (`.pem`, `.key`, `.asc`, `id_rsa` and the like, encrypted keys included; a `.p12` or `.pfx` file is a finding by its name). Your local settings files (`.env`, `.env.production`, `.envrc` and the like) are skipped, since they are meant to hold secrets; `.env.example` is checked.
- **Ignored:** every `.env` variant (`.env`, `.env.production`, `.env.local`...) is listed in both `.gitignore` and `.dockerignore`, so none can reach GitHub or the Docker image; only `.env.example` is kept in the repository. Settings files named `*.env` (such as `production.env`) are ignored in both too, and key files (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.asc`, `id_rsa*` and the other SSH key names) are git-ignored. The image is also built from named folders only (`Dockerfile`).
- **Rotation:**
  - Anthropic keys in the Anthropic Console, under API keys;
  - textbee in its dashboard;
  - Twilio in its console;
  - the email key at the email service `EMAIL_API_URL` points to;
  - the QNB secrets with the bank, once the adapter exists.

  Restart the server after each change: settings are read once at start. Changing `OTP_PEPPER` cancels the sign-in codes and challenges in flight, any Lite form open at that moment (one refused submit), student email codes in flight and the development test-payment signature, and gives that day's visitors a new visitor code (counted twice in the traffic report); sessions aren't affected.

**You must**

- [ ] Keep `.env` private (`chmod 600 .env`), and never paste keys into chats, issues or screenshots.
- [ ] Use different keys for development and production.
- [ ] If the code goes on GitHub, turn on secret scanning and push protection. They're free on public repositories; private ones may need a paid plan.

## 10. Environment variable lockdown

- In production the server **refuses to start** if `OTP_PEPPER` is missing or shorter than 32 characters, if `BASE_URL` isn't an `https://` address, if `PAY_PROVIDER=test`, or if a card provider is set without `PLAN_PRO_MONTHLY` and `PLAN_ENTERPRISE_MONTHLY`.
- It warns if:
  - no admins are set;
  - texts only go to the log;
  - the contact email is missing;
  - texts can go to any country;
  - `OTP_DEV_ECHO` is set;
  - `.env` is readable by other users on the machine.
- Development conveniences are switched off in production: codes on screen, the development pepper and the sample listings (never seeded when `NODE_ENV=production`; a database that still holds them is reported at start-up and on the Insights screen).
- `npm run security:check` audits your settings as production would see them, and **fails** when `NODE_ENV` is anything but `production`, because the shipped `.env.example` says `development` and a public host copied from it would echo sign-in codes and use the built-in pepper. Security test 10 proves the lockdown and that a complete setup passes cleanly; tests 14 and 15 prove the scanner stays clean whatever `SEED_DEMO` says and fails development settings.
- Where you can, set secrets in your host's dashboard ("Environment" on Render or Railway) rather than in a file.

## 11. Rate limits and cost caps

| Guard | Default | Setting |
|---|---|---|
| Every API call, per address | 600 a minute | `API_RATE_LIMIT` |
| Changes (POST, PUT, DELETE), per address | 240 a minute | `WRITE_RATE_LIMIT` |
| Sign-in codes, per number | 3 per 15 minutes | fixed |
| Sign-in codes, per address | 30 an hour | fixed |
| Code checks | 5 attempts per code; 60 checks an hour per address | fixed |
| Sign-in challenges, per address | 60 per 10 minutes (API; a Lite page view is not counted, sending the code still is) | fixed |
| Team invitations (each sends a text), per company | 20 a day, verified companies only; a refused number counts too | fixed |
| Requests to join a company (each texts the owner and admins of a verified company; a request to an unverified one waits, untexted), per account | 5 a day, withdrawn ones included | fixed |
| **Where texts may go** | Syria plus the main diaspora countries; admin numbers anywhere | `SMS_ALLOWED_PREFIXES` |
| **Texts per day, whole site** | 1,000 | `SMS_DAILY_CAP` |
| **Texts per day to numbers outside Syria** | 150 | `SMS_INTL_DAILY_CAP` |
| Claude calls (suggestions and translations), per person | 10 an hour, 30 a day | `AI_USER_DAILY_CAP` (daily) |
| **Claude calls per day, whole site** | 300 | `AI_DAILY_CAP` |
| Request size | 256 KB | fixed |

The destination rule matters most. In SMS pumping, bots request codes to premium-rate international numbers, and it's the most common way a small app gets a surprise bill. The daily caps are counted in the database, so they survive restarts. When the text cap is reached, sign-in pauses until midnight UTC and the server log says so. Each AI call is capped at 4,000 output tokens; a translation call carries at most about 8,000 characters of input and a suggestion call at most 30 bullet points plus one listing's text, so 300 calls a day bounds the daily spend. Check that against your model's price.

**You must** also set caps at the providers, in case of a bug here:

- [ ] Anthropic Console: a monthly spend limit.
- [ ] Twilio, if you use it: Messaging Geographic Permissions limited to the countries in `SMS_ALLOWED_PREFIXES` (Syria only if you narrow that list), and a usage alert.
- [ ] textbee: texts go out through your Android phone's SIM, so its plan caps your cost. Pick one that fits your volume.

## 12. CAPTCHA and CORS restrictions

**An invisible challenge instead of a picture CAPTCHA.** Before a code is texted, the browser must solve a small puzzle signed by the server. It has to find a number whose SHA-256 hash, combined with the challenge, starts with 14 zero bits. This:

- takes a phone a fraction of a second and asks the person to do nothing;
- needs no third party (picture CAPTCHAs such as reCAPTCHA depend on an outside service that may be unreliable in Syria, and they send visitors' data to it);
- makes every automated request cost computing time.

Each challenge works once per server process and expires after five minutes (the used list is kept in memory, so a restart within five minutes allows one reuse). The difficulty is `OTP_POW_BITS`: each +1 doubles the work. A determined attacker can still pay that cost, which is why the destination rule and daily caps sit behind it. If abuse appears anyway, add Cloudflare Turnstile to the sign-in step; it would need updates to the privacy notice and the Content-Security-Policy.

**CORS and requests from other sites.**

- The API gives no cross-origin permission to anyone, so other sites can't read its responses.
- Every change needs a custom header that other sites can't send without permission. When `BASE_URL` is set (always, in production), a request that carries an `Origin` header must match it.
- Cookies are `SameSite=Lax`.
- The page can't be embedded in other sites (`frame-ancestors 'none'`).

Security test 12 checks all of this. It also checks the challenge end to end, using the browser's own solver, and tries path tricks such as `/fonts/../server/config.js` against the file server.

## 13. Built-in security scanner check

`npm run security:check` checks four things:

1. The repository, for committed secrets: code, settings and documentation files (this app's secret names in code, JSON, settings lines outside code files, a Dockerfile `ENV`, YAML and compose files; a value of one repeated character counts as a placeholder), and key and certificate files (`.pem`, `.key`, `.asc`, `id_rsa` and the like, encrypted keys included; a `.p12` or `.pfx` file is a finding by its name), which `.gitignore` also keeps out. It reads code, settings, documentation, key and certificate files by name (`.js`, `.json`, `.md`, `.yml`, `.toml`, `.ini`, `.cfg`, `Dockerfile`, `.pem`, `.key`, `.p12` and the like) under 2 MB, git-ignored or not; it skips your `.env*` settings files and the `node_modules`, `.git`, `data`, `backups`, `fonts`, `shots` and `screenshots` folders. Keep key files outside the checkout.
2. The code, for:
   - unreviewed SQL built from text, raw HTML writes, `eval` and shell calls;
   - inline scripts, and scripts from other sites.

   Reviewed exceptions carry a `sql-safe` or `html-safe` marker comment.
3. Your production settings, from `.env` or `--env file` (real environment variables take precedence). It fails when `NODE_ENV` is not `production`, when the lockdown would refuse to start, when no admin is set, when texts only go to the log or when the privacy contact is missing, and warns when the email service address is not `https://` (the email key would travel in clear).
4. With `--url`, the live site:
   - the security headers, including HSTS, and no software versions in them;
   - no secrets in `/api/config`;
   - that requests without the app header, and cross-origin requests, are refused;
   - that `http://` redirects to `https://`.

It exits with an error when anything fails, so it can gate a deploy. Security test 13 plants a key, an injectable query, a raw HTML write, `eval` and an inline script in a scratch folder, and checks that the scanner catches every one.

**Also run these free external scanners once the site is live:**

- [ ] [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory), for the headers. Aim for A+.
- [ ] [SSL Labs](https://www.ssllabs.com/ssltest/), for the HTTPS setup. Aim for A.
- [ ] The OWASP ZAP baseline scan: `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://your-domain`
- [ ] GitHub secret scanning, if the code is there (item 9).

---

## If something goes wrong

1. **Sign everyone out:** `node -e "new (require('node:sqlite').DatabaseSync)(process.env.DB_PATH || 'data/shaghilni.db').exec('DELETE FROM sessions')"`. On Docker, run it inside the container: `docker exec shaghilni node -e "…"`.
2. **Rotate any key that may be exposed** (item 9), and change `OTP_PEPPER`.
3. **Find out what happened.** Signed in as an admin, open the *Audit log* tab of the admin screen (filters by action, item, account and day; *Older entries* pages back through the whole log; the spreadsheet export keeps a copy), or `https://your-domain/api/admin/audit?limit=200&before=<id>` for the raw rows, and read the server log alongside it. Keep copies of both.
4. **Tell the people affected and the authorities, as the law requires.** Summaries of Law No. 12 of 2024 say breaches that may cause harm must be reported to the data-protection authority and to the people affected, within set time limits. Agree the exact steps with your lawyer now, not during an incident.
5. **Fix the cause,** add a test that reproduces the problem, and write down what changed.

## Keeping this file true

- When you change what's collected, who receives it or how long it's kept, update `public/js/legal.js`, `server/retention.js`, `TERMS_VERSION` and this file together.
- Every endpoint needs a row in `test/policy/route-policy.js` (which roles may call it). `test/policy-completeness.test.js` fails when a registered route has no row, and the rows drive the generated tests: every route × every excluded role (`test/policy-access.test.js`), account B against account A's ids (`test/policy-idor.test.js`) and hostile input on every POST, PUT and DELETE (`test/policy-junk.test.js`). Security tests 2 and 3 keep their hand-written cases; there is no list to extend by hand any more.
- Re-run the four prompts (items 6–9) after big changes, and update their results here.

## Before you go live

The launch checklist, with who owns each item (agent, owner, lawyer or provider) and how it is verified, is in [docs/LAUNCH.md](docs/LAUNCH.md). It merges the list that used to be here with the README's, the human-only items and what Stage 0 found.


## Texts abroad and email alerts

- **Countries.** Sign-in codes and texts go only to the country codes in `SMS_ALLOWED_PREFIXES`: Syria plus the main diaspora countries by default. Other destinations are refused (`phone_region`), so a bot can't pump texts to premium-rate numbers elsewhere.
- **A separate cap abroad.** Texts to numbers outside Syria also count against `SMS_INTL_DAILY_CAP` (150 a day by default). When it's reached, codes and alert texts abroad stop until midnight UTC; Syrian numbers are unaffected. Admin numbers are exempt.
- **Email alerts** are sent only to the email in the person's own profile, only for alerts they created, and each email says how to stop them. The email service is a processor, named in the privacy notice. Its key (`EMAIL_API_KEY`) is a secret like the others.
- **Alerts are the person's data:** they're included in the data export and deleted with the account.


## Plans, teams and billing

- **Nothing here touches job seekers' chances.** Sponsored listings are at most two, lifted to the top and labelled *Sponsored*, only for a signed-in job seeker whose fit score is 60% or more; everyone else sees them in the usual order, unlabelled. No job seeker can pay for anything.
- **Teammates** are matched by phone number. A number that belongs to a job seeker, an admin or another company can't be added. Only the company owner can request or pay for plans and hand the company over. The owner and admins edit company details and manage the team (only the owner invites, changes, removes or approves admins, on the server as on the team page: D-31 and U-030, fixed in Stage 4); removing a teammate ends their access immediately, and a former teammate (removed, left or deleted) is shown as "former teammate" in the activity log and on listings and applicants, never by number.
- **Placement fees are computed on the server** at the moment an admin confirms a hire, from the invitation and application records and from the plan recorded with the hire and the pay the listing showed when the person applied, or at the hire if higher (so a pay cut just before the hire, an upgrade, a pay edit, or moving the hire back and recording it again can only raise it, never lower it), and only once per hire.
- **Reports** contain no candidate names or contact details: placements list dates, job title, governorate, type and pay range; the compliance record lists company submission, verification, rejection, suspension and plan changes, listing approvals, rejections and sponsorships, and hire confirmations, with the sanctions-screening column filled in for every verification since Stage 3 (D-07).
- **Every plan change, charge update, sponsorship start and team change is in the audit log,** and so is a sponsorship switched off; a sponsorship that ends because the listing was closed, edited or rejected is in the log as that action.


<!-- demo-accounts:start -->
## Demo accounts

- The demo sign-in (`POST /api/auth/demo`) exists only in development with demo accounts on (the default there; `DEMO_ACCOUNTS=false` turns them off) and `SEED_DEMO` not `false`, and never in production: in production the route isn't registered at all, and no demo accounts are created. Tests check both.
- It signs in only as the four fixed demo numbers (student, job seeker, company, university career office), with the usual session cookie and rate limits.
- Making the demo accounts texts nobody: the text sender is muted while they are made, so no text reaches the configured provider and none counts against the daily cap.
<!-- demo-accounts:end -->

## Card payments

- **No card data touches Shaghilni.** Card details are entered on the bank's hosted page; we store only the company, plan, months, amount, currency, dates, status, the provider's name and reference, and which team member started the payment.
- **Only the bank's signed result switches a plan on.** Results arrive at `/pay/callback/<provider>`, outside `/api` (so without the CSRF header), and each is checked on its own: the signature, that the payment exists, and that the amount and currency match what we asked for. A result is applied once; repeats change nothing. The return page (`/pay/return`) never changes anything.
- **The test payment page can't reach production:** the server refuses to start with `PAY_PROVIDER=test` when `NODE_ENV=production`, and card payments need both monthly prices to be set.
- **Every checkout and every paid card payment is in the audit log.** A failed, cancelled or mismatched result changes the payment's status and writes a log line naming the payment id only, not an audit row (`test/payments.test.js`).


## Universities

- **Career offices see only their own university** (or faculty): every portal query is scoped to the office, and a partnership request made to another university can't be approved or declined by it (404).
- **Names only with consent:** for students in general, offices get counts only. Names and activity (faculty, year, how many applications and interviews, confirmed hires) appear only for students who verified themselves with their university email; they are told exactly what the office will see before they ask for the code, and can remove the verification at any time.
- **Verification is tied to the profile's university**, so it can't be carried to another university; deleting an account deletes its verification records. Every verification, partnership and office change is in the audit log.
- **Roles stay apart:** career offices can't reach employer, job seeker or admin routes, and the reverse. Accounts are created only by the admin, and when the admin removes an office its sessions end and the number loses every career-office and event-organiser route at once, even after signing in again (tested).


## Events

- **The camera** is allowed for Shaghilni's own pages only (`Permissions-Policy: camera=(self)`), and only to scan event tickets. The browser asks the organiser before it turns on; the picture is read on the phone and never recorded or uploaded, and only the decoded ticket text is sent to the check-in endpoint.
- **Tickets** are random six-character codes, unique per event. Check-in accepts the code or the QR content (`SHG-EV-<event>-<code>`); a ticket for another event, a cancelled ticket and a repeat scan are each recognised.
- **Who sees what:** organisers see the name, university and faculty of people who signed up (they're told when they sign up). Attending companies see only attendees who chose to be found by recruiters, and only once the organiser has confirmed them. Reports contain no names. Career offices can manage only their own university's events.
- **Tickets are part of the person's data:** they're in the data export and deleted with the account.


## Traffic counting

- Counted by our own server only; no third-party analytics or tracking cookies. IP addresses are never stored: a visitor code is an HMAC of the IP address and browser identity under a key derived from `OTP_PEPPER` and the date, so it changes every day and can't be reversed or linked across days.
- Do Not Track and Global Privacy Control are honoured; crawlers and automated browsers aren't counted; link-preview fetchers are counted as shares only.
- The page-view endpoint (`POST /api/t`) needs the same anti-forgery header as every other write, accepts only a cleaned page path (numbers folded into `:id`), and is limited to 400 views and 20 error reports per visitor per day.
- The privacy notice describes what's counted and the 180-day retention; reports are for admins only.
