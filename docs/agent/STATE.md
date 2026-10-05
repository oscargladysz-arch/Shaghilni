# STATE · feature matrix · Stage 0 ground truth (2026-10-05)

Synthesised from the 15 area maps (`scratchpad/stage0/map-1.json` … `map-15.json`), `docs/agent/BASELINE.md`, the route grep (109 JSON routes) and the security-matrix list (`test/security.test.js:152-160`). Commit `9683221` on `stage-0/ground-truth` (code identical to `b8425b2`). Docs are claims; evidence is `file:line` or a quoted probe result. Nothing was changed in product code.

**Stage 1 status (2026-10-05).** Rows closed by Stage 1, each with its evidence in `docs/agent/DEFECTS.md` "Status" lines and `docs/agent/PLAN.md` section 1: the `seedDemo` production gate (S1-1, D-01: `server/config.js`, `countDemo` in `server/seed.js`, the start-up warning, the Insights attention fields; security tests 14 and 16, insights test); the scanner's `NODE_ENV` FAIL and the removal of its `SEED_DEMO` WARN (S1-2, D-14; security test 15); `.env.example` no longer narrowing texts to Syria (S1-2, D-18; diaspora test); continuous integration written but never run on GitHub (S1-3, UNVERIFIED until the owner's first run); 118 documentation corrections applied (S1-4, `DOC_DRIFT.md` status line). Counts that moved: `npm test` 60 → 66 (15 files); `STR.en`/`STR.ar` 1,646 → 1,647 keys each (`insSampleRows`), so `BRIEF.md:30` and `:165` now read 1,647 (the brief is the owner's text and is not edited, A-08). Rows below that say MISSING or "no `.github/`" for these items are the Stage 0 record; the two tables carry a "(Stage 1)" note where they were updated.

Status meaning:

| Status | Meaning |
|---|---|
| VERIFIED | Code read at `file:line` and at least one `npm test` test exercises the behaviour (or a probe reproduced it where no test exists and the row says so) |
| PARTIAL | Code exists; behaviour incomplete, undocumented, or no test covers it (gap in Notes) |
| MISSING | Not built (whether or not a doc claims it) |
| UNVERIFIED | Could not be checked here (browser e2e not run, Docker not built, no network) |

**Stage 2 status (2026-10-05).** Guardrails: every registered route has a policy row (`test/policy/route-policy.js`, completeness test), the generated cross-role, cross-account, revocation and junk-input tests run over every route, nine route-family files pin the rules per area, the i18n parity test and the design ratchets exist (`test/ratchets.json`). Fixed: D-03, D-11, U-016, U-128, U-165 (rows marked *Stage 2*). Confirmed by the tests and left open: U-007, U-017, U-041, U-046, U-048, U-083, U-084, U-129 and the new D-31 to D-37. CI VERIFIED on GitHub (two green runs). 133 tests.

Defect ids `D-01`…`D-37` refer to `docs/agent/DEFECTS.md`.

## Summary

| Area | VERIFIED | PARTIAL | MISSING | UNVERIFIED | Rows |
|---|---|---|---|---|---|
| 1 · Accounts, sign-in by SMS code, proof-of-work, sessions, consent | 22 | 16 | 1 | 0 | 39 |
| 2 · Job board, engine rules, fit score, search, saved jobs, job alerts | 8 | 7 | 0 | 0 | 15 |
| 3 · Applying, applications, pipeline, notifications, contact reveal | 22 | 12 | 0 | 0 | 34 |
| 4 · Resume, tailoring, translation editor, Claude features, CV import | 11 | 10 | 0 | 0 | 21 |
| 5 · Recruiter candidate search, opt-in, invitations, block | 16 | 8 | 0 | 2 | 26 |
| 6 · Employer company page, verification, posting checks, review, close/reopen | 17 | 10 | 0 | 0 | 27 |
| 7 · Plans, sponsored listings, placement fee, programmes, billing, card payments, analytics, reports | 23 | 9 | 2 | 0 | 34 |
| 8 · Teams | 14 | 13 | 1 | 0 | 28 |
| 9 · Campus and student verification | 16 | 8 | 2 | 0 | 26 |
| 10 · Events, tickets, check-in | 13 | 14 | 1 | 0 | 28 |
| 11 · Admin, insights, traffic, system, audit API | 15 | 12 | 2 | 0 | 29 |
| 12 · Shaghilni Lite | 27 | 17 | 1 | 0 | 45 |
| 13 · Security headers, CSRF, rate limits, caps, retention, export, deletion, legal, lockdown | 19 | 15 | 1 | 1 | 36 |
| 14 · i18n, RTL, design-system conformance, accessibility, theme | 3 | 21 | 0 | 2 | 26 |
| 15 · Tests, scripts, seeding, demo accounts, Docker, deploy, docs | 8 | 12 | 1 | 0 | 21 |
| **Total** | **234** | **184** | **12** | **5** | **435** |

Brief `<features>` letters → areas: A → 1, 13 · B → 1, 2, 3, 4, 5, 14 · C → 12 · D → 5, 6 · E → 7 · F → 8 · G → 9 · H → 10 · I → 11 · J → 13, 15.

## Area 1 · Accounts, sign-in by SMS code, proof-of-work, sessions, consent (brief A, B)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Request a 6-digit sign-in code by SMS, no passwords | VERIFIED | `server/auth.js:48-66`; `server/routes/public.js:26`; `public/js/app-account.js:145-160` | api: "sign-in: validation, wrong codes, Arabic digits, CSRF and rate limits" :72-75; every suite's login helper | — |
| Verify the code: sign in or create the account | VERIFIED | `server/auth.js:68-108` | api :76-85; security: "5 · sign-in failure cases" | — |
| Codes stored only as hashes keyed with `OTP_PEPPER` | PARTIAL | `server/auth.js:19` `sha(pepper:phone:code)`, :59-60, :78 timingSafeEqual | none asserts `code_hash` ≠ code (probe: 64 hex, ≠ code) | No per-code random salt: docs say "salted" (README.md:194). Secret is the pepper; salt is the phone number |
| Code valid 10 minutes, 5 attempts, one use, own number only | VERIFIED | `server/auth.js:60,74,76-77,90` | api :82, :89-92; security :211-215 | 10-minute constant not asserted; expiry path is |
| Per-number limit 3 codes / 15 min | VERIFIED | `server/auth.js:54-55` | api :86-88; security :216-217 | — |
| Per-address limits: 30 codes/h, 60 verifies/h, 60 challenges/10 min | PARTIAL | `server/auth.js:30,49,73`; limiter `server/http.js:100-110` | none (probe: 31st POST /api/auth/code → 429; 61st verify → 429; 61st challenge → 429) | SECURITY.md:121 claims coverage by test 5 |
| Arabic-Indic digits accepted in the code | VERIFIED | `server/auth.js:70`; `public/js/engine.js:57-58`; `public/js/app-account.js:168` | api :77-80 | — |
| Arabic-Indic digits in the phone number | PARTIAL | Syrian path normalises (`engine.js:329-330`); international path `server/validate.js:18` and `app-account.js:144` use ASCII `\d` | none | D-19: `+٤٩…` → `bad_phone` |
| Proof-of-work challenge (HMAC, 5-min TTL, single use, `OTP_POW_BITS`) with browser solver | VERIFIED | `server/auth.js:10,24-46`; `public/js/pow.js:42-47`; `app-account.js:151-154` | security: "12 · proof-of-work challenge…" :317-330 | Used-challenge list is in memory (`auth.js:27`): reusable after restart within 5 min (probe) |
| PoW off at `OTP_POW_BITS=0`; clamp 0..24 | PARTIAL | `server/config.js:42`; `server/auth.js:35` | all suites run with `powBits: 0` | Clamp to 24 undocumented (README.md:56, .env.example:20-21) |
| Consent at account creation (`terms_required`, `TERMS_VERSION`, audit `user.created`) | VERIFIED | `server/auth.js:86-97`; `server/config.js:22` (`2026-10-04`); `server/db.js:113-114` | security: "1 · consent: new accounts must accept the terms…" :70-81 | — |
| Re-acceptance of a newer `TERMS_VERSION` | PARTIAL | `server/auth.js:100-104` (only when client sends `accept:true`); no client compares `termsVersion` (`boot.js:241-253`) | none | Signed-in users are never prompted until next sign-in (30-day sessions); probe: old-terms user verifying without accept → 200, version unchanged |
| Consent box with links to `/#/terms`, `/#/privacy` (welcome, sign-in step, profile) | PARTIAL | `public/js/app-account.js:5-9,57,61`; `app-seeker.js:24`; strings `i18n4.js:908/1894` | e2e `browser-flow.mjs:76` only (not run) | Client-only |
| Sessions: 256-bit token, sha256 in DB, `shg_sid` HttpOnly SameSite=Lax (Secure in prod), 30 days, UA stored | VERIFIED | `server/auth.js:9,20-21,109-116`; `server/config.js:38`; `server/db.js:27-33` | api :81; security :224 | — |
| Session attach ignores forged/oversized/expired tokens and deleted accounts | VERIFIED | `server/auth.js:118-126` | security :200-209; api :227-228 | — |
| Logout deletes the session, clears cookie; guests get 200 | VERIFIED | `server/auth.js:128-132`; `app-seeker.js:59-62` | security :204-206; lite :136 | — |
| Roles at sign-in: seeker/employer chosen; invited number → employer; `ADMIN_PHONES` → admin (also promoted later); role fixed afterwards | VERIFIED | `server/auth.js:82-85,93-94,99`; `server/config.js:24,39` | api :120-123, :138-141; team :79-80 | No `university` self-registration (`auth.js:85`) |
| Onboarding and profile builder (full app, brief B): role choice student / seeker / employer, bilingual profile (`name`, `nameAr`, `nameEn`) built in steps (`OB_STEPS` = account, about, edu, goals, exp), "Where you live" with "Outside Syria" then "Which country?"; `PUT /api/me/profile` sanitises every field | VERIFIED | `public/js/app-account.js:3,53,67-68,73,82,98-117`; `public/js/engine.js:304`; `public/js/i18n2.js:9,23`; `public/js/i18n4.js:712-713`; `server/routes/me.js:35`; `server/validate.js:23-79` (`:35` names, `:36` abroad + country) | api: "seeker: profile is sanitised; saving and applying work" :96-101; diaspora :72-77 (`gov:"abroad", country:"de"`; unknown country → `other`) | Client step flow untested (browser e2e not run); server side is tested |
| Admin role revocation when removed from `ADMIN_PHONES` | MISSING | `server/auth.js:99` promotes only | none (probe: role stays admin, `/api/admin/overview` → 200) | D-17 |
| `OTP_DEV_ECHO` code echo outside production only | PARTIAL | `server/config.js:41`; `server/auth.js:65`; `server/lite.js:467` | api :74; security :220-222 (negative paths) | Positive path untested |
| Country-code picker: Syria first then 19 diaspora codes (`DIAL` 20 entries) | PARTIAL | `public/js/lookups.js:136-137`; `app-account.js:60,142-144,262` | none (UI); server side diaspora :65-68 | `+1` labelled United States only though `COUNTRY` has Canada (`lookups.js:133-134,137`) |
| Phone normalisation: Syrian forms → E.164; other countries `+` + 8-15 digits | VERIFIED | `server/validate.js:15-20`; `engine.js:329-335` | api :72-73; diaspora :65-66; security :219 | — |
| SMS destination allowlist (`SMS_ALLOWED_PREFIXES`, default +963 + 19); admin numbers exempt | VERIFIED | `server/config.js:49,82`; `server/guard.js:12-15`; `server/auth.js:53` | security :307-308; diaspora :67 | D-18: `.env.example:30` narrows to +963 |
| `SMS_DAILY_CAP` (1000, UTC day) with one log line | VERIFIED | `server/guard.js:16-25`; `server/config.js:59`; `server/auth.js:56` | security: "11 · rate limits and cost caps…" :295-311 | — |
| `SMS_INTL_DAILY_CAP` (150) in `usage` table, admins exempt | VERIFIED | `server/guard.js:27-34`; `server/config.js:50`; `server/db.js:115-120` | diaspora: "diaspora: numbers abroad can sign in, within their own daily cap…" :64-70 | — |
| Same allowlist and caps on notification texts | PARTIAL | `server/notify.js:41-47` (blocked → status `failed`) | none | — |
| SMS providers `console \| textbee \| twilio` with start-up errors for missing keys | PARTIAL | `server/sms.js:3-26`; `server/config.js:43-47` | none (all tests stub `sms`) | `console` prints full number and code (`sms.js:26`); production only warns (`config.js:79`), scanner FAILs it |
| Phone masking in server logs | PARTIAL | `server/guard.js:4`; `auth.js:64`; `notify.js:51` | none | Unmasked: `console` provider; `server/app.js:78` logs raw path on 500 (team routes carry the phone in the path, probe) |
| Sign-in never reveals whether a number has an account | PARTIAL | `server/auth.js:48-66` (no users lookup) | none (probe: known/unknown → identical 200) | SECURITY.md:111 claim untested |
| A failed text send still consumes quota, caps and the intl counter | PARTIAL | `server/auth.js:57,59-60` run before :63 `await sms()` | none (probe: 502, usage `sms-intl` n=1, otps row kept) | Three provider failures lock a number for 15 min |
| CSRF defence: `x-shaghilni: 1` + Origin = `BASE_URL` on non-GET `/api`; write rate limit | VERIFIED | `server/app.js:57-63`; `public/js/api.js:8-9` | api :71; security :331-337 | — |
| `GET /api/me` role payloads; guests `{user:null}` | VERIFIED | `server/routes/me.js:11-26`; `boot.js:241-253` | api :83-84, :228; security :201, :209 | — |
| `PUT /api/me/lang` saves interface language (any role) | PARTIAL | `server/routes/me.js:28-33`; `boot.js:25,250` | security test 3 (junk only) | Persistence never asserted; `boot.js:250` pushes the device language on every load (device wins) |
| `GET /api/config` exposes `termsVersion, sessionDays, legalName, contactEmail, dev, ai, demo, card` | VERIFIED | `server/routes/public.js:36` | security :79-80, :273; api :261 | No secrets (test 9) |
| Demo sign-in `POST /api/auth/demo` (development only) | VERIFIED | `server/demo.js:17,189-200`; `public/js/demo.js:55` | demo :66, :102-104 | Absent from README API table |
| SMS code text: Syrian-dialect Arabic, English when `lang=en` | VERIFIED | `server/auth.js:61-62` | api :75 | — |
| Resend after 30 s; change number | PARTIAL | `public/js/app-account.js:155,161-166,243-244` | none | Client-only |
| Production lockdown for sign-in (pepper ≥ 32, no echo, Secure cookie, HSTS) | VERIFIED | `server/config.js:40-41,74-84`; `server/auth.js:21`; `server/app.js:104` | security: "10 · environment lockdown…" :278-292; :220-225 | — |
| Error strings for sign-in error codes in both languages | PARTIAL | `public/js/i18n4.js:748/911, 1734/1897` (duplicates); `api.js:20-26` | none | Stage 3: the later, wrong `err_phone_region` definitions are gone (D-16 fixed); the i18n test keeps the duplicate count from rising |

## Area 2 · Job board, engine rules, fit score, search, saved jobs, job alerts (brief B)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Public feed: published jobs of verified companies, newest first, `LIMIT 500` | PARTIAL | `server/routes/public.js:6-13,29`; `boot.js:225,232-235,260` | api: "public board lists the seeded demo jobs"; api: "admin: verification needs sanctions screening…" :157-161; api: "edits send live listings…" :197,203; security test 2 :135-136, test 4 :187, test 12 :335-339 | D-27: 539 published → 500 returned; oldest (sponsored, saved) listings vanish; 322,050 B gzipped per load when full (probe) |
| Single listing `GET /api/jobs/:id`; deep links `#/job/:id` | VERIFIED | `server/routes/public.js:14-19,30-34`; `boot.js:167-179,226-230` | api :64-65; security test 3 (junk ids) | — |
| Job object shape (bilingual fields, pay, applicants, apply-channel booleans, `sponsored`, `demo`, partner universities) | VERIFIED | `server/serialize.js:5-8,15-28`; `engine.js:183-209` | api :58-66; plans :121,126; diaspora :116 | Probe: no `whatsapp/regNo/contactName/applyPhone` on the public object |
| Client-side Arabic-aware search (`norm`: diacritics, tatweel, alef/ya/kaf/ta-marbuta folding, Arabic-Indic and Persian digits), per-term AND over the full haystack | PARTIAL | `engine.js:47-60,199-212`; `boot.js:101` | none for the board search path (`norm` only indirectly via normPhone and alertMatches) | Probe D1/E1-E5 confirmed folding and matches; e2e counts rows only |
| Filters: chips All / Internship / Syrian business / Multinational / For returnees / No experience; governorate select incl. Remote; Saved view; counts; sorts Most recent / Best match / Highest pay; `/`, Escape, j/k | PARTIAL | `app.js:20,155-170`; `engine.js:210-232`; `boot.js:47,101-143`; `lookups.js:26-27` | none in the full app (Lite's returnees filter: lite: "lite: people abroad…") | Brief overstates: only Internship is a type chip; "remote" is a governorate option |
| Fit score with reasons (field 35, stage 30, place 20, language 15; cap 35 on a field miss; remote = full place match abroad, returnee-welcoming = good); ring, tiers, "Why it suits you"; same `assess` on the server (`core.fitFor`) | VERIFIED | `engine.js:110-153,243`; `app.js:175,190,222-232`; `server/core.js:14` | diaspora: "diaspora: numbers abroad…" (placeRemote ok, placeReturn part) | Only the place part is asserted. D-25 (fixed in Stage 3): summary reads "living in ." for people abroad (`app.js:228`) |
| Sponsored lift: at most 2 sponsored with fit ≥ 60 moved to the top and labelled, signed-in seekers with a profile only, never in Saved; same rule in Lite | PARTIAL | `app.js:176-183,189,255`; `server/lite.js:169-170,183`; `serialize.js:19` | plans: "plans: sponsored listings are for paid plans, limited, labelled, and expire" (server flag only) | Lift, ≥60 rule and label untested; non-lifted sponsored listings carry no label (SECURITY.md:384 says "always labelled") |
| Saved jobs (optimistic toggle, undo toast, Saved view, badges; server `INSERT OR IGNORE`, published listing required; in export; deleted with account) | VERIFIED | `server/routes/me.js:17,42-51,110-111,142`; `server/db.js:87-92`; `app.js:406-421` | api: "seeker: profile is sanitised; saving and applying work" :103-106; security test 3; lite :124-125 | Badge counts saved rows whose listing is closed (Saved view empty, probe C10) |
| Board/detail UI: list + detail pane, phone sheet, badges (verified, returnee, partner, programme), pay with indicative USD (`RATE` 122 SYP), "Unpaid" fallback, demo note, share | PARTIAL | `app.js:142-150,184-210,250-277,289-302,422-429`; `engine.js:233-241`; `lookups.js:7` | e2e `browser-flow.mjs:116,124` only (not run) | D-02: sample listing with `pay:null` shows "Unpaid" / "غير مدفوع"; D-15: invented named employee per sample listing |
| Shared engine on the server (vm): `norm, normPhone, fitFor, alertMatches, alertLabel, findGender, findFee, placeOf` | VERIFIED | `server/core.js:8-16` | diaspora (fitFor, alertMatches, buildResume); api (findFee/findGender); lite (norm, fitFor) | `assess()` throws when a job has no `recruits` array (probe D8; not reachable through sanitised data) |
| Job alerts: up to 5 saved searches, duplicate refused, channel app/email/sms, new-match counts, mark seen, delete; owner-scoped | VERIFIED | `server/alerts.js:48-76` (`alert_limit` :61, `alert_exists` :62, audit `alert.created` :66); `server/validate.js:139-143` | diaspora: "job alerts: save a search, count new matches, and get one digest a day by email or text" :89-109; lite :182-189 | `PUT /api/me/alerts/:id` has no test |
| Alert digest at most about once a day (0.8 day) by email or SMS, up to 10 jobs, Lite links; hourly checker | VERIFIED | `server/alerts.js:19-45`; `server/index.js:15` | diaspora :83-110 | Hourly timer itself untested (entry point) |
| Alert match rule shared with the board (`alertMatches`) | PARTIAL | `engine.js:1141-1148`; `server/alerts.js:19-20` | diaspora :96-104; diaspora: "returnees…" | D-26: `a.gov` must equal `j.gov` (`engine.js:1143`), so remote listings never match a governorate alert while the board shows them (`engine.js:211`); Lite's governorate filter has the same gap (`lite.js:166`) |
| Lite jobs tab (search, type chips, governorate, returnees, saved, fit pill, sponsored, 12 per page) | PARTIAL | `server/lite.js:161-190` | lite :83,87,124-126,179-181 | Lite search = whole-phrase substring over title and company only (`lite.js:164,167`) |
| Admin re-approval keeps the original `published_at` (edited listing returns to its old position) | VERIFIED | `server/routes/admin.js:76` `COALESCE` | api: "edits send live listings…" :198-199 | Undocumented behaviour (anti-gaming) |

## Area 3 · Applying, applications, pipeline, notifications, contact reveal (brief B, D)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Quick apply on Shaghilni (channel `web`) with the resume attached | VERIFIED | `server/routes/me.js:53-78`; `app.js:322-351` | api: "seeker: profile is sanitised…" :111-112; security: "1 · data handling…" :88; lite :121-122 | — |
| Resume language choice (ar/en) stored as `cv_lang`; employer sees it | VERIFIED | `me.js:61,73`; `employer.js:138`; `db.js:121` | api: "pipeline: status moves are checked, seekers are texted, hires need confirmation" :165-169; api :107-108 | — |
| Default resume language (English when the job asks for English, else the resume's main script) | PARTIAL | `app.js:434-438` | none (client) | — |
| Apply panel: untranslated-line count, link to the editor, preview | PARTIAL | `app.js:439-462` | none (client) | — |
| Apply by WhatsApp (bilingual template, wa.me, number only in the apply response) | VERIFIED | `me.js:58-60,74`; `app.js:355-396`; `lite.js:233-239` | api :165-166; contact: "applying: only the ways the company chose, each recorded in its dashboard"; api :110 | — |
| Apply by phone call (application recorded, `tel:` link) | VERIFIED | `me.js:58,75`; `app.js:397-405`; `lite.js:226-228` | contact (body.phone `+963955830002`) | README.md:248 lists it as not built |
| Apply by email (`mailto:` with message / plain resume in Lite) | VERIFIED | `me.js:58,76`; `app.js:386-388`; `lite.js:229-232`; `validate.js:92` | contact (email lower-cased) | — |
| Only the channels the company switched on (`applyVia`); unchosen → 409 `channel_unavailable`; pre-existing companies have WhatsApp on | VERIFIED | `me.js:60`; `serialize.js:5-8`; `validate.js:90-92,102-105` | contact | — |
| Employer contact details revealed only on apply; board carries booleans only | VERIFIED | `me.js:74-76`; `serialize.js:15-27`; `public.js:6-19` | contact :75; security test 2 :135-136 | D-30: `place` and `contact.*` free text can carry numbers/addresses unchecked |
| Profile snapshot stored per application; employer sees the snapshot | VERIFIED | `me.js:66,69-70`; `employer.js:138`; `db.js:76` | api :171; api: "account deletion…" :231 | — |
| Profile required to apply (409 `profile_required`) | VERIFIED | `me.js:56-57`; `app.js:314-320`; `lite.js:224` | api :115-117 | — |
| One application per person per job | VERIFIED | `db.js:83` UNIQUE; `me.js:62-64` | api :111-112 | Apply response hard-codes `status:"new"` even when the row is further along (probe) |
| Re-apply after a withdrawal reopens the same row as `new` with a fresh snapshot | PARTIAL | `me.js:65-67` | none | Undocumented; no audit row; `created_at` kept (probe) |
| Pipeline statuses new → shortlisted → interview → hired / rejected, transitions checked (`MOVES`) | VERIFIED | `employer.js:6-12,150-154`; `db.js:74`; `app-employer.js:4,172` | api :174-182; campus, events, insights, plans helpers | — |
| Backward moves (shortlisted→new, interview→shortlisted, rejected→shortlisted/new) | PARTIAL | `employer.js:8-10` | none (probe: →new 200, 0 texts) | Undocumented; →new sends no text, →shortlisted re-sends the "shortlisted" text |
| Withdraw (refused once hired) | VERIFIED | `me.js:91-98`; `app-seeker.js:82,85-89` | api :113-114, :183; security test 2 (404), test 3 | Server allows withdrawing rejected/withdrawn rows repeatedly, each writing an audit row (probe) |
| SMS to the seeker on shortlisted / interview / hired / rejected in the account language | VERIFIED | `server/notify.js:6-14,36-55`; `employer.js:155-158` | api :175-179 (English only); security test 1 (export has the text) | Arabic templates untested; two of four Arabic templates are MSA, not dialect; Arabic texts span 2 UCS-2 segments with sample values (probe) |
| Notifications queued in DB first (`queued` → `sent`/`failed`); failed texts counted for admins | PARTIAL | `notify.js:45-51`; `admin.js:29`; `insights.js:53,77` | security test 1 (stored row) | Failure branch and `failedTexts` never asserted |
| Status texts obey SMS guards (prefixes, caps) and are recorded `failed: blocked` | PARTIAL | `notify.js:41-47` | none | — |
| Seeker's applications list (status, channel label, date, "Listing closed", withdraw) | VERIFIED | `me.js:80-89`; `app-seeker.js:64-89` | api :114, :182; demo :69-72 | Client rendering untested |
| Application state in `GET /api/me` drives the Applied button | PARTIAL | `me.js:18-19,25`; `app.js:241-246,338` | none | — |
| Employer applicant list: snapshot, phone, channel, cvLang, note, hire flags, verified-student badge, movedBy/noteBy; withdrawn hidden | VERIFIED | `employer.js:132-143`; `app-employer.js:150-180` | api :168-173; team :94,98-99; campus :129; security test 2 | — |
| Employer opens the resume in the language sent and can switch | PARTIAL | `app-employer.js:189-200,261-264` | e2e :231 (not run) | — |
| Call and WhatsApp buttons in the pipeline | PARTIAL | `app-employer.js:170-171`; `employer.js:139` | api :172 (server) | — |
| Private notes (1000 chars); hiring managers may note, not move | VERIFIED | `employer.js:149-154`; `plans.js:17,32` | team :95-96; api :176 | Note-only edits write no audit row and accept non-strings (`[object Object]` stored, probe) |
| Who moved whom / who wrote the note | VERIFIED | `employer.js:141,153-154`; `db.js:288-289` | team :97-99 | — |
| Hired is terminal: no employer move out, no seeker withdraw, admin confirms by phone | VERIFIED | `employer.js:11`; `me.js:94`; `admin.js:104-129` | api :183-192; plans :98-101 | No route anywhere reverts a hire (probe) |
| Lite: apply (web/WhatsApp/call/email) and Applied tab | PARTIAL | `lite.js:197-243,244-252,602-603` | lite :121-123; contact :79; lite :89-90 | WhatsApp/call/email POST branches untested; no withdraw in Lite |
| Demo listings accept applications; WhatsApp allowed but no number returned | VERIFIED | `me.js:60,74`; `app.js:245,333` | api :107-110 | — |
| Deletion anonymises applications, keeps the hire | VERIFIED | `me.js:153`; `employer.js:138-139` | api: "account deletion erases personal data but keeps the hire on record" :229-232 | — |
| Export includes applications with the snapshot sent and every text | VERIFIED | `me.js:112-115,129-130` | security test 1 | — |
| Audit: `application.created` (first only), `application.withdrawn`, `application.moved` (status changes), `hire.confirmed` | PARTIAL | `me.js:71,96`; `employer.js:156`; `admin.js:110` | api: "audit log records who did what" :240 (moved, hire.confirmed) | created/withdrawn never asserted |
| Public applicant count per listing (withdrawn excluded) | PARTIAL | `serialize.js:25,33-44` | none | — |
| IDOR protection on applications/withdraw; junk input | VERIFIED | `employer.js:20,147`; `me.js:92` | security test 2 :121-128; test 3 | — |

## Area 4 · Resume, tailoring, translation editor, Claude features, CV import (brief B)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| One resume per person from the profile, Arabic or English, no versions | VERIFIED | `engine.js:651-690` (:652 `target = "general"`); `validate.js:53-55`; `core.js:15` | import: "names: the resume shows the name in its language without anyone typing it"; lite :132-134 | — |
| Print / Save as PDF / copy as WhatsApp text; Lite "Send as text on WhatsApp" and "Save as PDF" | PARTIAL | `app-resume.js:46-47,150-156`; `engine.js:740-752`; `lite.js:303-307` | lite :134 (wa.me text) | Full-app print/copy untested |
| "Tailor my resume for this job": focus, never a version | PARTIAL | `app.js:257`; `boot.js:197`; `app-resume.js:13,43,82,119`; `validate.js:53` | e2e :267-271 only (not run) | Job-keyword reordering, `moved`, `ckReordered` unreachable since `target` is forced (dead code) |
| Resume checks: bullet lint with one-tap fixes/undo, basics, coverage chips, rules panel | PARTIAL | `engine.js:429-438,539-548,578-603,691-719`; `app-resume.js:84,92-103,157-174` | none | — |
| Claude wording suggestions `POST /api/resume/suggest`: own bullets only, published job required, fact-guarded server and client | VERIFIED | `server/routes/resume.js:44-63`; `engine.js:720-738`; `app-resume.js:118-143` | api: "resume suggestions: own bullets only, and the fact guard filters Claude's output" :206-224; security test 11 :294-305; test 3 :154 | Only `gNumber` branch asserted. Request `role`/`current` fields reach the prompt unchecked (probe: injected phone and name in `role` → prompt); SECURITY.md:205 "never gets the name or phone (tested)" holds for translation only |
| Fact guard shared by browser and server | VERIFIED | `engine.js:549-575`; `core.js:15`; `resume.js:56-61`; `app-resume.js:131-135` | api :206-224 | `gInflate/gBorrowed/gName/gLong` untested |
| Manual translation editor: pairs stored in the profile, pruned, "keep as is", per-language name | VERIFIED | `app-resume.js:207-260`; `engine.js:634-648`; `validate.js:56-70` | security: "8 · translation: Claude never sees the name or phone…" :253-258 | — |
| "Translate with Claude" `POST /api/resume/translate`: untranslated lines only, batched (60 / 8,000 chars), fact-checked | VERIFIED | `resume.js:8,65-105`; `engine.js:626-633` | security test 8 :228-264; test 2 :131; test 3 :154 | README.md:95 "drafts every missing line" omits the batch limit |
| On-device name transliteration | VERIFIED | `engine.js:759-898` | import: "names: common Syrian names both ways…" :19-29; import :31-38; lite :133 | — |
| CV import on the device: PDF (own parser), .docx, plain text; fills only empty fields | VERIFIED | `cv-import.js:6,53-59,206-348,378-431`; `engine.js:1065-1133`; `test/fixtures/*` (6 files) | import: 4 tests :40-94 | Plain-text import undocumented (README.md:9 "PDF or Word") |
| Importer makes no network calls | VERIFIED | `cv-import.js` (no network API) | import: "reading resumes: files we can't read say why, and nothing is ever sent anywhere" :76 | Static assertion |
| AI on only with `ANTHROPIC_API_KEY` (`/api/config.ai`, 503 `ai_unavailable`) | PARTIAL | `config.js:60`; `public.js:36`; `resume.js:13`; `app-resume.js:106,139,238,245,276` | api :261 (key present) | No-key path untested (probe: `ai:false`, 503) |
| Daily AI caps (site 300, person 30) counted before the call | VERIFIED | `guard.js:33-34`; `resume.js:15,24`; `config.js:62-63` | security test 11 :295-304 | Site cap untested |
| Hourly AI limit 10/person (suggestions + translations together) | PARTIAL | `resume.js:14`; `http.js:100-111` | none | Consumed before validation: 404/422 answers burn the quota (probe) |
| Upstream error handling (429 → `rate_limited`, non-2xx → `ai_error`, bad JSON → `ai_bad_json`, 90 s timeout, 4,000 max_tokens); logs without personal data | PARTIAL | `resume.js:27-41` | none (probe confirmed each branch, no personal data in `[ai]` log) | — |
| Lite resume page (both languages, progress bar, WhatsApp text, Save as PDF script, link to full site) | VERIFIED | `lite.js:287-315` | lite :132-134 | `/#/resume` upload link is JavaScript-only |
| Resume attached to applications (language default, missing-line count, employer switch) | VERIFIED | `app.js:434-462`; `me.js:61-73`; `employer.js:138`; `app-employer.js:222-226,269-271` | api :107-108, :165-169; lite :122 | — |
| Import shortcut inside onboarding (quiet card, no review sheet) | PARTIAL | `cv-import.js:355-356,393-398` | e2e :84 only | Undocumented |
| Stop buttons, batch "more remain" note, Claude questions list, skipped-suggestions list | PARTIAL | `app-resume.js:110-116,187,196,243`; `resume.js:86` | none | Stop discards client-side only; the call still counts |
| Claude never receives the name or phone | PARTIAL | `engine.js:634-644,720-738`; `resume.js:90-105` | security test 8 :250 (translate only) | Suggestion prompt not covered; `role` field unchecked (see above) |
| `trPrivacy` key collision: traffic tab shows the resume privacy sentence | PARTIAL | `i18n4.js:78 vs :907`, `:1066 vs :1893`; `app-traffic.js:62`; `app-resume.js:246,254` | none | 17 EN / 18 AR keys defined twice with different values (probe `dupkeys-4.mjs`) |

## Area 5 · Recruiter candidate search, opt-in, invitations, block (brief B, D)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| "Let recruiters find me" switch, off by default, seekers with a profile | VERIFIED | `server/routes/recruit.js:40-46,152-159`; `validate.js:59`; `app-recruit.js:37-38,213-220`; `lite.js:268-269,282-285` | recruit: "recruiters: anyone can choose to be found, only after opting in, and only by checked employers" :63-66,84-85; lite :119 | Flag also writable via `PUT /api/me/profile` with no audit row (probe) |
| Candidate search only for verified companies and hire-level roles | VERIFIED | `recruit.js:32-39,58`; `plans.js:17` | recruit :80-82; team :91; security test 2 :131 | — |
| Search returns opted-in, non-deleted seekers not blocking the company; ≤ 60 cards from the 1000 most recently updated | VERIFIED | `recruit.js:61-64,78` | recruit :63,68-69,84-85,126,128 | — |
| Filters: stage, level, faculty, university, governorate, year, free text, verified only, event attendees | PARTIAL | `recruit.js:59-60,74-81`; `events.js:159-163`; `app-recruit.js:85-93,250-256` | recruit :75-79; campus :117-118; events :105-111 | `fac/uni/gov/year` untested; Arabic-Indic digits in `year` disable the filter (probe); Lite exposes stage/level/fac/gov/q only |
| Candidate card: first name + last initial, education, status, year, level, place, languages, ≤8 skills, ≤3 roles, badge, invite count; never phone/email | VERIFIED | `recruit.js:12-31` | recruit :70-74; lite :158; campus :118 | — |
| Invite to a published job (no duplicate, not if applied) | VERIFIED | `recruit.js:85-103,120-122` | recruit: "invitations: checks, replies, contact details only after a yes, blocking and deletion" :96-100; plans :63,73; events :114 | — |
| Invite to an employer-typed event (title, date ≤ 366 days, place and/or https link) | VERIFIED | `recruit.js:104-115` | recruit :101-103; lite :160-163 | Full app never renders `ev.link`: link-only invitations show no place and no link (probe) |
| Invitation wording checks (fee, gendered) | PARTIAL | `recruit.js:116-118`; `core.js:15` | recruit :102; lite :160-161 | `invite_bias` branch untested |
| At most 3 open invitations per company per candidate | VERIFIED | `recruit.js:92-93` | recruit :119-120 | — |
| Monthly allowance by plan: Free 5 / Pro 50 / Enterprise unlimited (UTC month) | PARTIAL | `plans.js:8-10,24-25`; `recruit.js:94-95` | plans: "plans: hiring stays free, invitations have a monthly allowance, and plans lift it" :71-76 | Enterprise `null` untested; withdrawn invitations still count (probe) |
| Per-company 40/day in-memory limit | PARTIAL | `recruit.js:119`; `http.js:100-109` | none | Undocumented |
| SMS to the invitee (`invite_job`/`invite_event`) | VERIFIED | `recruit.js:123`; `notify.js:16-17,32-33` | recruit :98 | Employer-typed title (≤120 chars) travels in the text; ~3 UCS-2 segments worst case |
| Employer's sent list; full name and phone only after an event "yes" | VERIFIED | `recruit.js:127-139`; `app-recruit.js:192-206` | recruit :113-118; lite :166 | D-03: no role check, hiring managers read it |
| Withdraw an open invitation; vanishes from the inbox | VERIFIED | `recruit.js:141-149,165` | recruit :121-123 | D-03: no role check; Lite withdraw form untested |
| Candidate inbox; opening marks seen; `invitesNew` badge | VERIFIED | `recruit.js:161-174`; `me.js:21`; `app.js:101,105`; `boot.js:248` | recruit :104-108; demo :70,74 | — |
| Accept / decline (owner only, while open) | VERIFIED | `recruit.js:176-186` | recruit :110-112; lite :128-131; plans :93 | — |
| Accepting a job invitation leads into applying (app panel; Lite redirect) | UNVERIFIED | `app-recruit.js:222-237`; `lite.js:276-278` | none (lite answers an event invitation) | Client behaviour; e2e not run |
| Block a company: hidden from it, cannot invite, open invitations declined | VERIFIED | `recruit.js:52,63,188-196`; `app-recruit.js:49-50,239-248` | recruit :124-128 | No unblock route or UI anywhere; no block in Lite |
| Deletion removes invitations and blocks; owner deletion withdraws the company's open invitations | PARTIAL | `me.js:145,151,157` | recruit :129-131 (seeker side) | Employer side untested |
| Export covers opt-in flag and invitations received | PARTIAL | `me.js:101-132` | none | Blocked companies absent from the export (probe) |
| Dashboard "Find candidates" / "Invitations sent" gating (verified + hire role) | UNVERIFIED | `app-employer.js:40`; `app-recruit.js:73-78`; `lite.js:499-501,529-535` | lite :151,155 (Lite only) | Client gating untested |
| Events integration: confirmed company's "See who's coming" filters to opted-in attendees | VERIFIED | `events.js:159-163`; `recruit.js:81`; `app-events.js:165` | events: "events: companies attend, meet signed-up candidates…" :105-111 | — |
| Verified-student badge and `verified=1` filter | VERIFIED | `recruit.js:30,80`; `app-recruit.js:116` | campus :117-118 | Lite card has no badge |
| Lite recruiter pages (candidates, invite form, sent, withdraw) and seeker Recruiters tab | PARTIAL | `lite.js:254-285,536-598,603-610` | lite :119,127-131; lite: "lite: a recruiter signs up, gets verified, then finds and invites a candidate" :140-169 | D-04 fixed in Stage 3; «جهات التوظيف» register in LT (`lite.js:50,58,66-67,75`); invite lookup capped at the first 60 unfiltered rows (candidate found through a filter cannot be invited, probe) |
| Audit for every change (`invitation.sent/withdrawn/accepted/declined`, `recruit.opened/closed`, `recruiter.blocked`) | PARTIAL | `recruit.js:122,147,157,184,194` | none asserts them | Opt-in via `PUT /api/me/profile` unaudited |
| i18n parity for recruit strings (92 `rc*` keys) | VERIFIED | `i18n4.js` (probe `i18n-recruit.mjs`: 0 missing, 0 placeholder mismatch, 0 «جهات التوظيف» in the app) | none (no parity test) | — |

## Area 6 · Employer company page, verification, posting checks, review, close/reopen (brief D)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Company page create/edit (bilingual name, sector, category, governorate, regNo, contact, apply channels, website, about) | VERIFIED | `server/routes/employer.js:39-61`; `validate.js:81-95`; `app-employer.js:61-93`; `lite.js:505-535` | api: "employer: company verification gates listings; posting checks run on the server" :125-129; team :109; lite :145-150; contact :67-73 | — |
| Required fields reported as `missing` | VERIFIED | `validate.js:96-107`; `employer.js:34,60,67-68` | api :126-127; contact :70 | — |
| Submit for verification (draft/rejected → pending; suspended refused) | VERIFIED | `employer.js:63-74`; `lite.js:532` | api :130-131; lite :148-151 | Not in matrix test 3 |
| Registration number unique: 409 `company_exists` → ask to join | PARTIAL | `employer.js:40-46`; `app-team.js:49-66` | team: "teams: asking to join, duplicate companies, admins, transfer, leaving and removal" :109-110 | Check runs only when the caller has no company: an existing company can edit its regNo to another's (probe); sample companies' `regNo:"demo"` collide (probe → Chevron named) |
| Ask to join (search verified companies, request, managers texted, withdraw; accept/decline invitation) | VERIFIED | `team.js:89-119`; `employer.js:33-35`; `app-team.js:49-66,78-83` | team :111-117, :80-81 | — |
| Identity edits (name/regNo) on a verified company → pending; listings leave the board | VERIFIED | `employer.js:53-57`; `public.js:7-9` | api: "edits send live listings and renamed companies back to review" :200-203 | Undocumented in README/PRODUCT |
| Create a listing as draft, optionally submit | VERIFIED | `employer.js:85-95`; `validate.js:109-123` | api :132-134; security :65; team :85-87 | — |
| Posting checks on submit: title, governorate, pay > 0, a language, summary | PARTIAL | `validate.js:126-136`; `employer.js:76-83` | none asserts `incomplete` for a listing | Free-text `place` is optional (README.md:15 says "pay and place") |
| Fee-asking wording blocks on submit (shared engine) | VERIFIED | `engine.js:269-270,289-296`; `validate.js:133-135`; `employer.js:80` | api: "admin: verification needs sanctions screening…" :148-149 | D-05, D-06: bypass via edit-while-pending and edit-while-closed |
| Gendered wording flagged to the reviewer | VERIFIED | `engine.js:267-268,280-288`; `validate.js:135`; `app-admin.js:59` | api :150-153 | — |
| Live checks in the browser while typing | PARTIAL | `app-employer.js:142,160-172` | e2e :178 only | Lint shows 4 rows; server also needs title/language/summary |
| Returnee badge tick | VERIFIED | `validate.js:118`; `app-employer.js:138` | diaspora: "returnees: employers can say they welcome Syrians coming home…" :115-117 | D-13: `seedDemo` forces `returnees:true` on every multinational company's jobs at each start |
| Target universities + programme dates (`unis`, `progStart/End`), faculty targets | VERIFIED | `validate.js:117-118`; `serialize.js:20`; `app-employer.js:135-140` | campus: "universities: employers see verified students, partner…" :123-126 | — |
| Apply channels on the company page | VERIFIED | `validate.js:88-92,102-105`; `serialize.js:5-8` | contact :67-81 | — |
| Every listing reviewed: submit → pending; admin approve (company verified) / reject with note | VERIFIED | `employer.js:76-83,107-113`; `admin.js:64-89` | api :135, :152-161; security :59-68 helper | No employer "withdraw from review" |
| Edits to a live/rejected listing → draft, off the board | VERIFIED | `employer.js:97-105` | api :196-199 | Since Stage 3 an edit while pending or closed is a draft again too, and the sponsorship ends with the edit (D-05, D-06, D-29 fixed) |
| Close a published listing | PARTIAL | `employer.js:114-121` | security test 2 :125 (cross-tenant 404 only) | No success-path test; not in matrix test 3 |
| Reopen a closed listing (published if it had been, else draft; company verified) | PARTIAL | `employer.js:122-130` | security :125 (404 only) | Stage 3: an edited closed listing is a draft, so reopen answers bad_state and the text goes through review (D-06 fixed); closing clears the sponsored slot (D-29 fixed) |
| Admin company verification with screening checkbox; reject/suspend with note | PARTIAL | `admin.js:40-62`; `app-admin.js:49-50,86-90` | api :143-147; security test 3 (reject fuzz) | `suspend` has no test anywhere; `reject` only fuzzed |
| Employer dashboard (status pill, submit, listings with flags/notes/postedBy, role-gated actions) | PARTIAL | `app-employer.js:30-58`; `employer.js:24-37` | team :85,117; api :202 | Client untested; `jobs@company.com` placeholder (`app-employer.js:81`, R6); hex fallback colour |
| Role gating of employer actions on the server (billing/manage/hire/view) | VERIFIED | `plans.js:16-17,32`; `employer.js:40,64,88,98,108,115,123,133,151` | team: "teams: seats on every plan, invitations by text, and roles enforced on the server" :85-96 | — |
| Audit for employer and review actions | PARTIAL | `employer.js:51,57,72,82,92,102,119,128`; `admin.js:54,78,87` | api: "audit log records who did what" (company.verified, job.approved); team :100-101; plans :138 | Many actions never asserted; note-only edits and sponsor-off write nothing (D-28) |
| Lite recruiter sign-up `/hire` → `/lite/hire` → company form | VERIFIED | `app.js:107`; `lite.js:486-535,608` | lite :144-154; lite :92 | `company_exists` is a dead end in Lite (no ask-to-join page) |
| Owner deletion closes listings, withdraws invitations, suspends company, strips contact | VERIFIED | `me.js:154-160` | security test 1 :108-111 | `applyPhone`/`applyEmail` are left in `companies.data` (probe) |
| Undocumented listing fields (openings, level, mode, anyFaculty, noDegree, support, lists, contact, tags) | PARTIAL | `validate.js:112-122`; `app-employer.js:96-144` | api :52-54 (set, not asserted) | D-15 (sample `contact` names real people at real organisations); D-30 |
| Employer "University partner" request + `partners` in `GET /api/employer` | VERIFIED | `campus.js:139`; `employer.js:36`; `app-campus.js:70-76` | campus :119-122 | — |
| Arabic-Indic digits in `pay` rejected by the server | PARTIAL | `validate.js:6,111`; `engine.js:297` (browser converts first) | none | Direct API callers only (probe) |

## Area 7 · Plans, sponsored listings, placement fee, programmes, billing, card payments, analytics, reports (brief E)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Plan tiers Free/Pro/Enterprise with limits (invites 5/50/∞, sponsored 0/2/10, seats 3/10/50, analytics, reports, fee Free only); expiry at `plan_until` | VERIFIED | `server/plans.js:7-11,22`; `db.js:152-153` | plans: all 4 tests; team :69,77,131 | Enterprise 10-sponsored and unlimited invites untested |
| Sponsor on (manage role, verified, published, plan limit, 30 days) and automatic expiry; public `sponsored` flag | VERIFIED | `employer.js:183-191`; `plans.js:26`; `serialize.js:19` | plans: "plans: sponsored listings are for paid plans, limited, labelled, and expire" :118-127 | `SPONSOR_DAYS` exported but the route hard-codes 30 |
| Sponsored lift and label (top 2, fit ≥ 60, signed-in seeker, not Saved; app and Lite) | PARTIAL | `app.js:177-183,189,255`; `lite.js:169-170,183` | none | See area 2 |
| Sponsorship switched off | PARTIAL | `employer.js:186` | none | Stage 3: `job.unsponsored` audit row when it was sponsored (D-28 fixed); closing, editing or rejecting clears `sponsored_until` (D-29 fixed) |
| Team seats by plan | VERIFIED | `plans.js:27`; `team.js:20,27,37,53` | team :69,75-77,130-131 | — |
| Monthly invitation allowance | VERIFIED | `plans.js:24-25`; `recruit.js:94-95` | plans :73-76 | — |
| Hiring free on every plan | VERIFIED | `employer.js:85-161` (no plan gates); `plans.js:1-3` | plans :100 | — |
| Placement fee: Free only, middle of the pay range, accepted invitation before applying, once on admin confirmation | VERIFIED | `admin.js:108,113-119`; `plans.js:8,45` | plans: "plans: a placement fee applies only when a Free employer hires someone it found through search" :98-101 | Any accepted invitation counts, including an event invitation or another job's (probe A5); analytics' `fromSearch` uses the narrower rule (`employer.js:196`) |
| Donor programmes: create, tag a hire, USD `placement` charge, billing summary | VERIFIED | `admin.js:121-126,141,146,165-170`; `db.js:164-169` | plans :103-112 | Stage 3: the programme charge is neither counted as due nor listed on the employer's plan page (D-08 fixed) |
| Upgrade request (owner, verified; wallet/bank/cash/usd; one open; `SHG-<co>-<id>`) | VERIFIED | `employer.js:173-181`; `plans.js:20,47`; `db.js:185-193` | plans :78-83; team :90; payments :92 | — |
| Admin billing data (companies with plan, open requests, due charges, programmes) | VERIFIED | `admin.js:137-147` | plans :83,104; insights :74 | — |
| Admin sets plan and length (0..36 months), optional SYP invoice charge; closes requests | VERIFIED | `admin.js:148-158` | plans :75,77,108,119,135; team :76,130; insights :73 | `months` 0 → paid plan with no end date (probe); undocumented |
| Admin marks a charge paid/void | VERIFIED | `admin.js:159-164` | plans :105-106; insights :74 | `void` untested; paid→void→paid allowed with no state check (probe) |
| Employer plan page data (summary, 100 charges, open request, isOwner) | VERIFIED | `employer.js:166-172`; `plans.js:39-43` | plans; payments | Charges carry SYP only: a USD card receipt shows "—" (probe B); any team role reads charges |
| Prices from `PLAN_PRO_PRICE`/`PLAN_ENTERPRISE_PRICE`, "Contact us for pricing" when unset, card monthly price when card on | PARTIAL | `config.js:57`; `plans.js:42`; `app-plans.js:43` | none | Free text shown in both UI languages (R9) |
| Card checkout (owner, verified, provider on, plan, months 1/3/12; payment row; session; audit `plan.checkout`) | VERIFIED | `server/payments.js:67-79`; `employer.js:222-225`; `db.js:194-208` | payments: "card payments: off until a provider and prices are set"; "card payments: pay on the provider's page, and the signed result switches the plan on" | — |
| Signed callback `/pay/callback/<provider>`: provider match, constant-time signature, amount/currency match, applied once | VERIFIED | `payments.js:24,31,81-93,104-107`; `app.js:109` | payments: "card payments: forged, altered and repeated results change nothing" :107-117 | Outside the API rate limiter |
| `/pay/return` display-only redirect | VERIFIED | `payments.js:100-103` | payments :86-87 | Redirect bypasses security headers |
| Test provider page `/pay/test/<session>`; refused in production | VERIFIED | `payments.js:26-32,50,108-121`; `config.js:76` | payments :83,86,94,97; "card payments: the test payment page is refused in production" :121-122 | English-only, hex colours (dev only) |
| QNB Syria adapter | MISSING | `payments.js:33-47` (`ready = false`, TODO) | payments :120-123 (lockdown only) | Documented as not written (README.md:335; brief E); owner decision D4 |
| Plan activation after a paid card result (same plan extends; otherwise starts now; closes requests; paid charge; audit `plan.card_paid`) | VERIFIED | `payments.js:57-66` | payments :89-98 | Switching plan mid-term discards the remaining time (undocumented) |
| Payment status for own company | VERIFIED | `payments.js:124-125`; `employer.js:226` | payments :84,88,98,112 | No team-role check |
| Card option exposed only with a ready provider and both prices (`/api/config.card`) | VERIFIED | `payments.js:53-54`; `public.js:36` | payments :71,78 | Unknown `PAY_PROVIDER` silently disables cards with no log (probe) |
| Production lockdown: `PAY_PROVIDER=test` refused; provider needs both monthly prices | VERIFIED | `config.js:76-77` | payments :121-123 | — |
| Employer analytics (totals, per-job rows; Pro+ adds whatsapp, fromSearch, medianDaysToHire) | VERIFIED | `employer.js:193-204` | plans: "plans: analytics for everyone, full analytics and reports with paid plans" :132-136; demo :77 | — |
| Placements report (Enterprise, manage): no names | VERIFIED | `employer.js:205-210` | plans :134,137 | Row content not asserted |
| Compliance report (Enterprise) with sanctions-screened column | PARTIAL | `employer.js:211-217`; `admin.js:54,58-59` | plans :138 | Stage 3: the verification audit row carries `screened: true`, so the column says yes (D-07 fixed) |
| CSV download of reports in the browser | PARTIAL | `app-plans.js:74-79,88` | none | — |
| Employer UI: plan card, Plans page, pay-method flow, reports buttons, charges; Sponsor/Stop buttons; payment-result polling | PARTIAL | `app-plans.js:9-63,21-39`; `app-employer.js:40,53-55` | e2e :349-371 only | Copy `payP_usd` "invoiced by our US company" (`i18n4.js:584/1570`): no entity exists (R6) |
| Admin Billing tab UI | PARTIAL | `app-plans.js:92-110`; `app-admin.js:15,94` | e2e :242-243 only | — |
| Audit for billing actions (`plan.requested`, `job.sponsored`, `company.plan`, `charge.*`, `programme.created`, `plan.checkout`, `plan.card_paid`, `hire.confirmed`) | PARTIAL | `employer.js:179,191`; `admin.js:110,156,163,169`; `payments.js:65,77` | none asserts them | Un-sponsoring and fee/placement charge creation have no entry of their own |
| Insights money breakdown | VERIFIED | `insights.js:36,52,75-76` | insights :81 | — |
| Privacy notice covers plans/invoices/payments; export/deletion for employers | PARTIAL | `legal.js:18,46`; `me.js:118-122,136-160` | none | Export omits plan, requests, charges, payments (probe C) |
| Plans, billing, analytics in Lite | MISSING | `server/lite.js` (only the sponsored lines :169-170,183) | none | Not claimed by docs |

## Area 8 · Teams (brief F)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Four roles with server-side levels (billing/manage/hire/view) | VERIFIED | `plans.js:16-17,30-33`; enforced `employer.js:40…206`, `recruit.js:38`, `campus.js:140`, `events.js:151`, `team.js:25-125` | team: "teams: seats on every plan, invitations by text, and roles enforced on the server" :85-99; team: "teams: asking to join, duplicate companies, admins, transfer, leaving and removal" :119-122 | — |
| Invite by name, phone, role with validation and seat check | VERIFIED | `server/routes/team.js:32-46` | team :70-75 | `invalid_phone` and `phone_taken` branches untested. D-10: no `verified` check → unlimited branded texts from a draft company |
| Invitation text (`team_invite`, dialect) | VERIFIED | `team.js:17-18,44`; `notify.js:20-21` | team :73 | `{by}` and `{co}` are inviter-typed free text in the SMS (D-10) |
| Acceptance on sign-in (invited number → employer; pending shown; accept joins) | VERIFIED | `auth.js:84-85`; `employer.js:33-35`; `team.js:90-97`; `app-team.js:51-52,78` | team :79-83 | — |
| Decline an invitation | PARTIAL | `team.js:98-101`; `app-team.js:52,79` | none | Audited but absent from the activity log (no `ta_` key) |
| Ask to join (search verified companies, request, managers texted) | VERIFIED | `team.js:104-119` | team :111-114 | Request text carries the requester's free-text name verbatim (probe) |
| Withdraw a join request | PARTIAL | `team.js:98-101`; `app-team.js:54,79` | none | — |
| Approve a request with a role (admin role owner-only; seat check) | VERIFIED | `team.js:47-57` | team :115-117 | — |
| Decline a request | PARTIAL | `team.js:50` | none | — |
| Duplicate registration number → `company_exists` | VERIFIED | `employer.js:41-45` | team :107-110 | See area 6 gap |
| Change a teammate's role (only owner touches admins) | PARTIAL | `team.js:58-65`; `app-team.js:17,23,74` | none (`PUT /api/employer/team/:phone` has no test) | — |
| Cancel an open invitation | PARTIAL | `team.js:66-72`; `app-team.js:25` | none | Admins can cancel an admin's invitation (server) while the client hides it |
| Remove a teammate; access ends at once; only owner removes an admin | VERIFIED | `team.js:66-72`; `plans.js:29` | team :121,128 | Removed people appear by raw phone in `postedBy`/activity (probe) |
| Leave (owner cannot) | VERIFIED | `team.js:73-76` | team :126-127 | — |
| Transfer ownership (owner-only, to active member; old owner → admin) | VERIFIED | `team.js:77-87` | team :122-125 | Both owners then display under the company contact name (`plans.js:36`, probe) |
| Seat limits 3/10/50 counting owner + active + invited | VERIFIED | `plans.js:8-10,27`; `team.js:20,37,53` | team :69,75,77,131 | — |
| Team page (`#/company/team`) | PARTIAL | `app-team.js:10-40`; `app-employer.js:21` | none | Only link is on the plan card, rendered for verified companies only; heading uses legacy `tmAdd` "Add a recruiter" (duplicate key) |
| Team activity log (owners and admins) | VERIFIED | `team.js:121-132`; `app-team.js:41-47` | team :100-102 | LABEL `invite.sent` never matches `invitation.sent`; declined/withdrawn absent; LIMIT 150 before filtering |
| Who did what (`postedBy`, mine filter, `movedBy/noteBy`) | VERIFIED | `employer.js:27,141,153-154`; `db.js:287-289` | team :85,99 | — |
| No-company screen (invitation / waiting / find-and-join / create) | PARTIAL | `app-team.js:49-66` | team :80 (API) | UI untested |
| Texts to the other side (`team_request`, `team_approved`, `team_declined`) | PARTIAL | `team.js:50,55,117`; `notify.js:22-25` | team :113 | approved/declined untested |
| Every team change audited | VERIFIED | `team.js:43,50,55,64,71,75,85,96,100,116` | team :101 (`team.joined` only) | — |
| One phone in one company; seekers/admins/other owners refused | PARTIAL | `db.js:163`; `team.js:39-41` | none | `ADMIN_PHONES` number without an account can be invited and never accept (probe) |
| Admins can invite admins (contradicts README.md:380 "only the owner manages other admins") | PARTIAL | `team.js:32-46` (no owner check) | team :119 asserts 200 for an admin inviting an admin | — |
| Demo team (Lina admin, Karim hiring manager, Fadi's request) | PARTIAL | `demo.js:124-127` | none in demo tests | — |
| Deletion removes memberships | PARTIAL | `me.js:150,155-160` | none for a teammate | Members of a deleted owner's suspended company: UNVERIFIED by run |
| Insights `teamMembers`/`withTeams` | PARTIAL | `insights.js:68-69` | none | — |
| Teams in Lite | MISSING | `server/lite.js` (no team/membership route) | none | By design (brief C); README.md:13 silent |

## Area 9 · Campus and student verification (brief G)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Career-office accounts created by an admin (university, optional faculty, name, phone) | VERIFIED | `server/routes/campus.js:152-161`; `db.js:209-215,238-251` | campus: "universities: students verify themselves with their university email, and offices see names only for verified students" :72; campus :112; events :127 | `ADMIN_PHONES` number can be added as an office and becomes admin at sign-in (probe) |
| Office sign-in and role routing (`university`; `/api/me.campusOffice`; `#/campus`; no self-registration) | VERIFIED | `auth.js:85,134-137`; `me.js:14`; `boot.js:166,248`; `lite.js:319` | campus :72,96; demo :79 | Client routing untested |
| Portal totals (students, verified, applying, interns hired, hires, employers) scoped to the office | VERIFIED | `campus.js:91-101` | campus :92,133 | `stats.applying` never asserted |
| Verified-students list: names only for verified students, scoped (faculty filter) | VERIFIED | `campus.js:30,102-107` | campus :92; demo :80 | Faculty-scoped offices untested; LIMIT 300 before the faculty filter |
| Consent before verification; withdraw at any time | PARTIAL | `app-campus.js:60,67`; `i18n4.js:237/1223`; `legal.js:22,114`; `campus.js:84-88` | none (`DELETE /api/me/verify-student` untested) | — |
| Student-email-domain management by the office (public webmail refused, normalised, unique, subdomains) | PARTIAL | `campus.js:34-38,117-127`; `db.js:290-297` | campus :77-80,115 | `DELETE /api/campus/domains/:domain` untested; overlapping domains across universities accepted (probe F) |
| Admin domain management | PARTIAL | `campus.js:128-129` | campus :79,105 | DELETE untested |
| Student verification by university email: 6-digit code, 15 min, hashed, 5 codes/day, one account per address, profile university's domains, 503 without email service | VERIFIED | `campus.js:39-65`; `alerts.js:10-16`; `config.js:58`; `db.js:298-311` | campus :76,81-85,98-100; campus: "universities: without an email service, sending refuses clearly rather than failing silently" :103-108; campus :116 | Failed email send still counts toward the 5/day budget (probe E) |
| Confirm the code: 5 tries lock, expired → 410, university must match | VERIFIED | `campus.js:66-83`; `db.js:312-314` | campus :86-90,116 | Arabic-Indic digits rejected (`campus.js:71` strips with `\D`, probe C2) |
| Verification tied to the profile's university | VERIFIED | `campus.js:10-11,14-21`; `me.js:23` | campus :94 | — |
| Badge on candidate cards + verified-only filter | VERIFIED | `recruit.js:30,80` | campus :117-118 | — |
| Badge on applications | VERIFIED | `employer.js:140` | campus :129 | — |
| Student's verification card on the profile; `studentVerify` in `/api/me` | VERIFIED | `app-campus.js:55-68`; `me.js:23` | campus :94; demo :68 | — |
| Employer partnership request (verified company, manage role; idempotent; re-request after decline) | VERIFIED | `campus.js:138-146`; `employer.js:36` | campus :119,122 | Re-request after decline untested |
| Office approves/declines partners (own university; 404 otherwise) | PARTIAL | `campus.js:130-136,108-109` | campus :120-122 | Decline untested; any decision other than `yes` is a decline |
| "University partner" badge on listings | VERIFIED | `public.js:11-21`; `app.js:255` | campus :125-126 | — |
| Internship programmes aimed at universities; office sees applicants from its students | VERIFIED | `validate.js:118`; `campus.js:110-114` | campus :123-128 | LIMIT 300 on all published jobs before the filter |
| Office Events tab | VERIFIED | `app-campus.js:4,7,28`; `events.js:20-23,43` | events: "events: a career office runs events only at its own university" :125-134; demo :81-83 | — |
| Admin list of offices and office removal | PARTIAL | `campus.js:149-151,162-165` | none | D-11: removed office keeps the `university` role (can still list/publish events); phone can't be reused |
| Export and deletion cover student verification | PARTIAL | `me.js:126,147-148` | campus :97 | D-22: office self-deletion leaves `campus_offices`; export has no `campusOffice`; `email_sends` rows kept; `email_codes` never swept (probe D1) |
| Audit for every campus action | PARTIAL | `campus.js:63,81,87,122,125,134,145,160,164` | none asserts them | — |
| Demo career office (fictional domain, two verified students, partners) | VERIFIED | `demo.js:14,133-141,179,181` | demo :79-83,95 | — |
| Insights campus block | PARTIAL | `insights.js:25,55,59,70-73,78` | none | — |
| Text to the student when verified/declined | MISSING | `notify.js:26-29` templates with no caller | none | Leftover of the removed manual flow |
| Manual verification requests approved by the office | MISSING | no `/api/campus/verify` route; `app-campus.js:41` posts to it | campus :93 asserts `D.requests === undefined` | README.md:310, SECURITY.md:407-408 still describe it |
| Privacy notice describes email verification and what the office sees | VERIFIED | `legal.js:22,114` | none (wording is owner/lawyer territory) | — |

## Area 10 · Events, tickets, check-in (brief H)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Organisers: admin and career offices (own university only) | VERIFIED | `server/routes/events.js:20-24,43,86`; `auth.js:134-137` | events: "events: a career office runs events only at its own university" :125-134; events :93 | — |
| Bilingual event data (title/place/about en+ar) and type | VERIFIED | `events.js:10,14,36-37,44`; `app-events.js:68-77` | events :65,133 | Only one language of the title is required (README.md:357 says both) |
| Syria-time start (fixed +03:00), optional end, no new events > 1 h in the past | VERIFIED | `events.js:15-16,38-40`; `app-events.js:7-9` | events :64,69 | `endsLocal` untested |
| Optional governorate, host, link, description | PARTIAL | `events.js:41,44`; `app-events.js:54` | none | — |
| Capacity (0 = no limit, max 5000), spots left, `event_full` | VERIFIED | `events.js:33,45,67` | events: "events: sign up for a ticket, and organisers check people in by code or QR" :71,79-81 | — |
| Publish / draft / edit / cancel | PARTIAL | `events.js:91,97,51,55,148`; `app-events.js:78,100-101` | events :70-71,133 | Draft and cancelled untested; cancelling sends no text and the page then answers 404 to ticket holders (probe) |
| Attending companies ask from the dashboard (verified, hire role) | VERIFIED | `events.js:150-157`; `app-events.js:170-181` | events: "events: companies attend, meet signed-up candidates…" :104; demo :78 | — |
| Organisers confirm/decline/remove companies; admin adds verified companies directly | PARTIAL | `events.js:107,110-116`; `app-events.js:113-115` | events :107-108 | declined/removed/direct add untested; picker capped at 300 |
| Public event list and page (upcoming published, companies, my RSVP) | VERIFIED | `events.js:49-58`; `app-events.js:25-58` | events :81-82,108 | Listing window 6 h vs RSVP window 3 h after start |
| RSVP → 6-character ticket (unambiguous alphabet, unique per event; repeat returns same; profile required; cancel frees the place) | VERIFIED | `events.js:11-12,61-76`; `db.js:271-281` | events :73-80 | — |
| Ticket also by SMS (dialect) | VERIFIED | `events.js:73-74`; `notify.js:18-19` | events :76 | — |
| QR code on the ticket (`SHG-EV-<event>-<code>`, vendored MIT lib, lazy) | PARTIAL | `app-events.js:59-62`; `app.js:92-94`; `public/js/vendor/qrcode.js:1-16` | e2e :386-391 only | No separate licence file in `public/js/vendor/` |
| Cancel my RSVP (not after check-in) | VERIFIED | `events.js:77-80`; `app-events.js:47` | events :80 | No audit row (RSVP has one) |
| My tickets `GET /api/me/events` | PARTIAL | `events.js:81-82` | events :83; demo :71 | No client screen calls it |
| Check-in by typed code (case-insensitive, QR content, wrong event, unknown, cancelled, repeat) | VERIFIED | `events.js:117-129`; `app-events.js:126-135` | events :85-92,112 | — |
| Check-in by camera QR scan; `Permissions-Policy: camera=(self)` | PARTIAL | `app-events.js:105,125,154-159`; `http.js:68` | none (header untested) | — |
| After-event report: totals only (registered, cancelled, checked in; by university/faculty; per company invitations/applications/interviews/hires among attendees) | VERIFIED | `events.js:130-142`; `app-events.js:107-111` | events :119-122; demo :82-83 | Per-company window starts 7 days before the event |
| Report as spreadsheet (CSV) | PARTIAL | `app-events.js:160-163`; `app-plans.js:74-79` | none | Hard-coded English labels and raw lookup keys (R9) |
| Attending companies see only opted-in attendees, only once confirmed | VERIFIED | `events.js:160-163`; `recruit.js:81` | events :105-111 | — |
| Seekers find events (Recruiters-page teaser, `#/events`) | PARTIAL | `app-recruit.js:36`; `app-events.js:14-24`; `boot.js:195` | none | — |
| Organiser screens (admin Events tab, office Events tab, `#/organize/:id`) | PARTIAL | `app-admin.js:7,17`; `app-campus.js:4,7,28`; `app-events.js:64-118` | none | Governorate label shows the raw key `coGovL` (`app-events.js:73`); validation errors show the generic server error (`err_invalid` missing) |
| Audit for event actions (`event.created/updated/company_*/checkin/rsvp/company_requested`) | PARTIAL | `events.js:72,93,99,115,128,156` | none asserts them | — |
| Tickets in export and deleted with the account | PARTIAL | `me.js:127,149`; `db.js:273` | events :94 (deletion) | Export field untested |
| Privacy note before signing up (`evShare`, legal.js) | PARTIAL | `legal.js:21`; `i18n4.js:381/1367/2000`; `app-events.js:50` | none | Cancelled sign-ups stay in the organiser's people list with name (`events.js:103`) |
| Demo events (two upcoming at Homs, one Damascus, one past with report) | VERIFIED | `demo.js:143-161,172-175,183-184` | demo :71,78,81-83,92,95 | Venue "Four Seasons conference hall" names a real hotel (`demo.js:151`, R6, dev only) |
| Insights events breakdown | PARTIAL | `insights.js:38,72-73` | none | — |
| Cross-role access on event routes | PARTIAL | `events.js:61,77,81,85-130,145,150` | events :93,111,131 | None of the 14 routes in the security matrix |
| Events in Lite | MISSING | `server/lite.js` (no events page) | none | By design (brief C; owner decision D7) |

## Area 11 · Admin, insights, traffic, system, audit API (brief I)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Company verification requires the screening checkbox; who/when recorded | VERIFIED | `server/routes/admin.js:54,57-59`; `app-admin.js:3,46-47,86-88` | api: "admin: verification needs sanctions screening; review publishes listings" :146-147 | No state machine: a never-submitted draft or a suspended company can be verified directly (probe) |
| Company reject (note required) | PARTIAL | `admin.js:49-50,61` | security test 3 (junk only) | Never asserted |
| Company suspend (note required; listings leave the board) | PARTIAL | `admin.js:62`; `public.js:9,16` | none | Sessions not revoked; jobs stay `published` in the DB (probe); not in matrix |
| Listing approve (pending listings of verified companies) | VERIFIED | `admin.js:64-79` | api :152-161; api :198-199; helpers in 8 suites | Stage 3: approve re-runs `checkJob` and answers 422 fee_requested (D-05 fixed) |
| Listing reject (note) and gender flags shown | PARTIAL | `admin.js:81-89`; `app-admin.js:59` | api :153-154 (`note_required` only) | Status `rejected`/`review_note`/audit never asserted |
| Hire confirmation by phone → confirmed-hires metric; fee/programme charge once | VERIFIED | `admin.js:104-129` | api: "pipeline…" :184-192; plans :98-112; insights :72; campus; events | Repeat confirm rewrites `hire_confirmed_by` and adds a second audit row (probe) |
| Hires list (pending/confirmed, employer call button, programme picker) | PARTIAL | `admin.js:92-103`; `app-admin.js:67-69,75,93,95` | api :184-186; security test 3 | Confirmed-state list never asserted |
| Admin overview API (counts, queues, 8-week series) and nav badge | PARTIAL | `admin.js:10-38`; `boot.js:237-240`; `app.js:101` | api :187-192,232; security test 2 :131,133 | `drawOverview` (8-week chart) never called (`app-admin.js:20,23-37`); `counts` do not exclude demo-listing applications |
| Audit log written for privileged actions; API only, no screen | PARTIAL | `app.js:36-37`; `db.js:93-102`; `admin.js:131-134` | api: "audit log records who did what"; security :157,174-175 | `limit` 1..200 only; no filters/pagination; no client reads it (grep `admin/audit` in `public/` → none) |
| Billing tab data | VERIFIED | `admin.js:137-147`; `app-plans.js:92-101` | plans :83,104; insights :74 | — |
| Admin sets plan/length; closes requests; optional charge | VERIFIED | `admin.js:148-158` | plans; team; insights | `months` 0 → no expiry |
| Mark charge paid/void | VERIFIED | `admin.js:159-164` | plans :105; insights :74 | — |
| Programmes with per-placement USD rate | VERIFIED | `admin.js:121-126,165-170` | plans :103-105 | Cannot be edited/retired |
| Campus accounts and domains (admin side) | PARTIAL | `campus.js:128-129,149-165` | campus :72,79,105,112; events :127 | GET list and both DELETE routes untested |
| Events tab (admin as organiser) | VERIFIED | `events.js:85-142`; `app-admin.js:17` | events :69-93,100-119,128-133; demo :81-82 | PUT/GET single event as admin untested (office only) |
| Insights API (7/30/90/365, attention queue, 12-week series, breakdowns, sample excluded unless `sample=1`) | VERIFIED | `server/routes/insights.js:9-82` | insights: "insights: the team sees how the platform is doing, in totals only, without sample data" :75-90 | — |
| Insights client (metrics, attention, sparklines, breakdowns, CSV) | PARTIAL | `app-insights.js:4-63`; `app-admin.js:20` | none | — |
| Traffic beacon `POST /api/t` (bots/previews skipped, DNT/GPC honoured, 400/visitor/day, UTM, numbers folded, no IP, daily visitor HMAC) | VERIFIED | `server/traffic.js:33,36-60,143`; `app-traffic.js:5-22` | traffic: "traffic: page views counted privately; crawlers and do-not-track left out; link previews counted as shares" :68-72,77-80 | — |
| Lite pages counted by the server; link previews as shares | VERIFIED | `app.js:99,111`; `traffic.js:63-74` | traffic :73-75,81,88,90 | `/lite/pow.js` counted as a page view `/lite/powjs` (probe) |
| Browser error beacon `POST /api/t/error` (20/visitor/day) | VERIFIED | `traffic.js:75-80,144`; `app-traffic.js:23-24` | traffic :76,91 | DNT/GPC not honoured here (probe: pageviews 0, client_errors 1) |
| Traffic report API (now, totals, visits, series, pages, sources, campaigns, shares, devices, browsers, systems, connections, languages, variants, roles, countries, speed, funnel, errors) | VERIFIED | `traffic.js:95-126,145` | traffic :82-92 | Reads up to 300,000 rows into memory per view |
| Traffic retention 180 days | VERIFIED | `retention.js:5,14-15`; `legal.js:20/112` | traffic :95-96 | — |
| System health API (uptime, memory, DB size, last backup, requests, slowest, failures, rows, texts, prod flag) | VERIFIED | `traffic.js:81-93,127-140`; `app.js:106` | traffic :82,93-94 | `lastBackup` looks in `dirname(DB_PATH)/../backups`, not where `npm run backup` writes in Docker (`scripts/backup.js:9`) |
| Traffic and System client tabs with CSV | PARTIAL | `app-traffic.js:26-94`; `app-admin.js:18-19` | none | `trPrivacy` key collision shows the resume privacy sentence (`i18n4.js:78 vs :907`) |
| Admin-only guards on every route of the area | PARTIAL | `auth.js:134-137`; `admin.js:7`; `insights.js:8`; `traffic.js:142`; `campus.js:27` | security test 2 :131-133; insights :75; traffic :82; events :93 | Probe: every probed admin route → [guest 401, seeker 403, university 403]; coverage gap only (24 of the area's 32 routes outside the matrix) |
| Area strings in both languages | PARTIAL | `i18n4.js` (probe: 250 keys present, 0 placeholder mismatches) | none | Stage 3: `err_not_hired`, `err_bad_plan` and seven more added (D-21 fixed) |
| Failed texts surfaced to admins | PARTIAL | `insights.js:53`; `app-insights.js:25`; `admin.js:29` | none | — |
| Admin editing of listings | MISSING | `admin.js` has only approve (:71) and reject (:81) | none | Documented as absent (README.md:252; backlog P2-2) |
| Admin audit-log screen | MISSING | `app-admin.js:7` tabs have no audit entry; no client reference to `admin/audit` | none | Documented as absent (README.md:241; backlog P1-3) |

## Area 12 · Shaghilni Lite (brief C)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Page frame (header, role tab bar, footer, flash, language switch) | VERIFIED | `server/lite.js:131-146` | lite: "lite: small pages that work without JavaScript, in Arabic or English" :74 | — |
| Size budget and caching (first visit < 15 KB; fingerprinted immutable CSS + sprite; gzip) | VERIFIED | `lite.js:619,623-626`; `lite-assets.js:4,6`; `http.js:218-219` | lite :76-82 | Measured: first visit 5,452 B; pages 727–2,650 B (641–2,517 B over 62 loads in Stage 2). The per-page ratchet is 3,072 B since Stage 2 (A-21, `lite.test.js:82`); it was 6,000 B |
| No JavaScript on content pages; CSP on Lite | VERIFIED | `lite.js:145`; `http.js:197-215` | lite :75,94-95 | Resume page loads a one-line print script (`lite.js:307,315`) |
| Signed per-browser form token (`lt` cookie, HMAC, timing-safe, Origin/Sec-Fetch-Site refusal) | VERIFIED | `lite.js:104,147,629-630,645-648,654-655` | lite: "lite: a job seeker signs in, builds a profile…" :104-105 | — |
| In-process handler calls (same guards, validation, limits, audit) | VERIFIED | `lite.js:120-128`; `app.js:59` | lite :116-117,122,131,165 | — |
| Language (`?lang=` → `ll` cookie → Accept-Language → Arabic) | VERIFIED | `lite.js:631-633,140,142` | lite :74,85-86 | — |
| Job board (search, type chips, governorate, returnees, saved, fit pill, pay, tiles) | VERIFIED | `lite.js:161-190` | lite :83,87,125-126,179-181 | Governorate filter hides remote jobs (D-26) |
| Pagination (12/page, clamp 1–50) | PARTIAL | `lite.js:165,171,187` | none | — |
| Sponsored lift/label in Lite | PARTIAL | `lite.js:169-170,183` | none | Inline hex pill colours |
| Job page (fields, apply buttons per channel, applied notice, 404) | VERIFIED | `lite.js:191-210` | lite :84; contact :82-83 | — |
| Quick apply from Lite | VERIFIED | `lite.js:218-225` | lite :121-122 | — |
| WhatsApp / call / email apply from Lite | PARTIAL | `lite.js:203-206,226-239` | contact :82-83 (buttons only) | Result pages unasserted |
| Save / unsave | VERIFIED | `lite.js:158,211-217` | lite :124-125 | — |
| Applied tab | VERIFIED | `lite.js:244-253` | lite :89-90,123 | — |
| Recruiters tab (switch, invitations, yes/no) | VERIFIED | `lite.js:254-286` | lite :119,128-131 | — |
| Block a company from Lite | MISSING | `lite.js:258,265` (yes/no only) | none | README.md:11 promises blocking in general |
| Resume as text (chips, paper, progress bar, WhatsApp text, Save as PDF, link to full site) | VERIFIED | `lite.js:287-315`; `lite-assets.js:7-8` | lite :132-135 | — |
| Profile: completeness meter, 5 steps, per-field errors, Skip, Outside Syria | VERIFIED | `lite.js:316-380,403-423` | lite :103,107-118; lite: "lite: people abroad…" :174-178 | — |
| Experience entries add/edit/delete | PARTIAL | `lite.js:349-363,424-445` | lite :109-111 (add) | edit/delete untested |
| Job alerts from Lite (create from the board, list, delete) | VERIFIED | `lite.js:188,381-402`; `alerts.js:55-75` | lite :182-189 | No channel choice/edit: email if the profile has one, else SMS (`lite.js:393`) |
| Alert digests link to Lite pages | VERIFIED | `alerts.js:21,33` | diaspora :100 | — |
| Sign-in (phone + consent, PoW fields, `/lite/pow.js`, code step, change number, role, next=) | PARTIAL | `lite.js:91-101,446-483`; `auth.js:29-46` | lite :91,93-94; helper :47-53 | All tests run with `powBits: 0`; with the default 14 a no-JS form posts an empty nonce → "Refresh the page and try again." (probe); consent refusal untested |
| Sign out | VERIFIED | `lite.js:484` | lite :136-137 | — |
| Gates (signed-out → sign-in card; no profile → create profile) | VERIFIED | `lite.js:154-157,245,255,288,317,320` | lite :89-90,103,137 | — |
| Return-path safety (`safeNext`) | PARTIAL | `lite.js:116` | none | — |
| `/hire` redirect | VERIFIED | `app.js:107` | lite :92 | Redirect carries no security headers |
| Recruiter landing `/lite/hire` (guest) | VERIFIED | `lite.js:487-493,144` | lite: "lite: a recruiter signs up…" :144-145 | — |
| Company form (save draft / submit) and status card | PARTIAL | `lite.js:494-518,526-535` | lite :146-151 | Save-for-later and draft/verified/rejected texts untested; `suspended` falls to the pending text |
| Employer tab bar; verified employers get candidates/sent/links; plan line | PARTIAL | `lite.js:132,136,162,192,499-501` | lite :151-153 | Plan line untested; career offices get the seeker tab bar |
| Seeker/admin numbers on `/lite/hire` get a note; roles never changed | VERIFIED | `lite.js:495-496`; `auth.js:85-87` | lite :166-168 | — |
| Candidate search (verified employers; filters; cards without contact details) | VERIFIED | `lite.js:519-525,538-554` | lite :154,157-158 | Stage 3: `edu_student` has a label in both languages (D-04 fixed) |
| Invite a candidate (job or event; errors; fee refused) | VERIFIED | `lite.js:555-582` | lite :159-165; policy-lite (U-016) | Job-kind untested; the lookup is by id since Stage 2 (U-016), no longer the first 60 unfiltered rows |
| Invitations sent (phone after event yes; withdraw) | PARTIAL | `lite.js:583-599` | lite :164 | Withdraw and phone reveal untested |
| Legal links in footer and consent box | VERIFIED (Stage 3) | `lite.js:144,450` | none | Stage 3: footer and consent box link to `/lite/privacy` and `/lite/terms`, server-rendered from the same `LEGAL` object (D-12 fixed); 2.0–4.3 KB gzipped a page |
| Flash messages after redirects | PARTIAL | `lite.js:612,634,143` | none | Language switch keeps `?done=` so the flash repeats |
| 404 page | VERIFIED | `lite.js:638-639` | lite :88 | — |
| HEAD answered like GET | PARTIAL | `lite.js:638`; `http.js:223` | none | — |
| Rate limits shared with the API | PARTIAL | `lite.js:637,643` | none | — |
| Form body limit 64 KB → 413 | VERIFIED (Stage 2) | `lite.js` readForm | policy-lite (64 KB test) | Fixed in Stage 2 (U-165): the reader stops buffering and the 413 page is sent with `connection: close`, as the JSON API does |
| Lite GET pages counted by traffic | VERIFIED | `app.js:111`; `traffic.js:63-73` | traffic :75-78,90 | — |
| Demo hint on the sign-in page | PARTIAL | `demo.js:193-194`; `lite.js:456` | none | Promises "code is shown on screen" regardless of `OTP_DEV_ECHO`; «جهات التوظيف» |
| LT string table (189/189, fallback LT → STR → STR.en → key) | PARTIAL | `lite.js:15-82,102` | lite :96 (prefix check on four pages) | 19 keys shadow STR; outside STR parity |
| "Slow connection? Shaghilni Lite" link in the full app | PARTIAL | `public/index.html:17`; `boot.js:273-277` | e2e :409 only | — |
| Events, career-office portal, teams, job posting, plans, resume upload/translation not in Lite (links to the full site) | VERIFIED | `lite.js:601-611,307,327,499-501,318,495-496` | none | Matches brief C |
| Hard-coded colours in Lite; pine icon 2.79:1 on the dark card | PARTIAL | `lite.js:151-152,183,264,268,324-325,490,502,549`; `lite-assets.js:3` | none | R10; contrast below 3:1 for UI parts (probe maths) |

## Area 13 · Security headers, CSRF, rate limits, caps, retention, export, deletion, legal, lockdown (brief A, J)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| Security headers on every `send()` (nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy camera=(self), COOP, CORP, CSP) | VERIFIED | `server/http.js:64-77,82` | api: "static client: security headers, fingerprinted gzipped assets, SPA routes" :246-249; security test 12 :342; lite :95 | `/hire` 302 and `/pay/return` 303 bypass `send()` (no headers, probe A); Permissions-Policy untested |
| Strict CSP (no inline scripts, no other origins, frame-ancestors none) | VERIFIED | `http.js:72-76`; `scripts/security-check.js:57-59` | api :247-248,254; security :341; security test 13 :354-359 | `style-src 'unsafe-inline'` (`http.js:73`); docs call it strict without saying so |
| HSTS in production only | VERIFIED | `app.js:104` | security :225 | — |
| CSRF header on every non-GET `/api` | VERIFIED | `app.js:57-59` | api :71; security :334,336 | — |
| Origin check against `BASE_URL` on writes | VERIFIED | `app.js:60-61`; `config.js:36,75` | security :331-333 | Runs whenever `BASE_URL` is set (not only in production as SECURITY.md:312 says) |
| No CORS to any origin | VERIFIED | no `access-control-*` in `server/` | security :335-339 | — |
| Lite form token + Sec-Fetch-Site/Origin check; same limits | VERIFIED | `lite.js:104,629-630,637,643-648` | lite :104-105 | — |
| API rate limit per address (`API_RATE_LIMIT` 600/min) | VERIFIED | `http.js:100-110`; `app.js:56`; `config.js:64` | security test 11 :295,312-314 | Single process memory (documented) |
| Write rate limit (`WRITE_RATE_LIMIT` 240/min) | PARTIAL | `app.js:62`; `lite.js:643`; `config.js:65` | none (probe: limit 2 → [200,200,429,429]) | — |
| Sign-in code limits (3/number/15 min; 30/address/h) | PARTIAL | `auth.js:49,54-55` | api :87-88; security :216-217 (per number) | Per-address untested |
| Verify limits (5 attempts; 60/address/h) | PARTIAL | `auth.js:73,76` | api :89-92 | Per-address untested |
| PoW issue limit 60/address/10 min | PARTIAL | `auth.js:30` | none | — |
| SMS allowlist; site daily cap; intl daily cap | VERIFIED | `guard.js:12-34`; `config.js:49-50,59`; `auth.js:53,56-57`; `notify.js:42-44` | security :307-311; diaspora :63-70 | — |
| AI caps (10/h memory, 30/day person, 300/day site, counted before the call; 4,000 max tokens) | PARTIAL | `resume.js:12-16,24,30`; `config.js:62-63` | security :295,303-304 | Site cap and hourly limiter untested |
| Daily counters survive restarts (`usage` table) | VERIFIED | `db.js:115-120`; `guard.js:33-34` | security test 11 | — |
| Retention sweep at start-up and hourly (OTPs 24 h, sessions, texts 90 d, usage 60 d, traffic 180 d) | VERIFIED | `retention.js:5,7-17`; `index.js:12-13`; `app.js:118` | security test 1 :99-104; traffic :96 | `email_codes` (hold the student's address) and `email_sends` never swept (probe D1); usage sweep untested |
| Account export `GET /api/me/export` (JSON attachment) | PARTIAL | `me.js:101-133`; `app-seeker.js:7,35-46` | security test 1 :91-98; test 2 :129; diaspora :110 | Omits plan/charges/payments/requests, own team membership, invitations sent, partners, blocked companies, `campus_offices` (probe C); SECURITY.md:44 says "everything" |
| Account deletion `DELETE /api/me` (erase personal data, keep anonymous records, close listings, sign out; admin refused; hold-to-delete UI) | PARTIAL | `me.js:136-167`; `app-seeker.js:8,47-54`; `motion.js:226-229` | api: "account deletion…" :226-236; security :105-111; recruit :129; events :94; campus :97 | D-22 (`campus_offices` row kept); `applyPhone`/`applyEmail` kept in `companies.data`; `email_sends` kept; `admin_cannot_delete` has no string and no test |
| Privacy notice and terms (`LEGAL` object) at `/#/privacy`, `/#/terms`, linked from welcome, sign-in, profile | PARTIAL | `legal.js:6-208`; `boot.js:199`; `app.js:135`; `app-account.js:5-9,57,61`; `app-seeker.js:24` | e2e D :427-436 only (not run) | D-12 for Lite |
| Legal placeholders from `LEGAL_NAME`/`CONTACT_EMAIL`/`SESSION_DAYS`; date from `TERMS_VERSION` | PARTIAL | `legal.js:193,198`; `public.js:36`; `config.js:22`; `i18n4.js:909-910/1895-1896` | security :79-80 (`termsVersion` only) | Substitution untested |
| Consent wording and `TERMS_VERSION` recording | VERIFIED | `i18n4.js:908/1894`; `auth.js:89,93-94,100-104` | security test 1 :70-81 | — |
| Production lockdown: pepper ≥ 32, https `BASE_URL` | VERIFIED | `config.js:72-75` | security test 10 :279-285 | — |
| Production lockdown: `PAY_PROVIDER=test` refused; prices required | VERIFIED | `config.js:76-77`; `payments.js:50` | payments :120-123 | — |
| Production lockdown: no code echo, no dev pepper, Secure cookies, no demo accounts/route | VERIFIED | `config.js:40-41`; `auth.js:21`; `demo.js:17,189-190` | security :220-224; demo :102-107 | — |
| Production warnings (empty `ADMIN_PHONES`, console SMS, empty `CONTACT_EMAIL`, `OTP_DEV_ECHO`, empty prefixes, .env mode) | PARTIAL | `config.js:78-83`; `security-check.js:72-94` | security :286-291 (scanner equivalents) | `console.warn` output never asserted |
| Sample listings (`SEED_DEMO`) gated off in production | VERIFIED (Stage 1) | `config.js:68` `seedDemo: !prod && …`; `seed.js` `countDemo`; `index.js` start-up warning; `routes/insights.js` attention fields | security test 16; insights "sample data left in a production database"; security test 14 | D-01 fixed in Stage 1 (S1-1) |
| Settings scanner audits the environment as production | VERIFIED | `security-check.js:72-95,98-124` | security test 10, test 13; BASELINE runs | Live check never run |
| Phone masking in logs | PARTIAL | `guard.js:4`; `auth.js:64`; `notify.js:51`; `campus.js:13,18,20` | none | `app.js:78` logs the raw path on a 500 (team routes carry `%2B963…` in the path, probe); console provider |
| Errors do not leak internals (500 → `server_error`) | VERIFIED | `app.js:73-79` | security: "4 · errors don't leak internals" :184-195 | — |
| Body limit 256 KB, JSON only, 413 before close, 405 | VERIFIED | `http.js:29,45-62`; `app.js:66,75` | security :176-179; api :260 | — |
| Client address behind a proxy (`TRUST_PROXY`) | PARTIAL | `http.js:95-98`; `config.js:69`; `app.js:54`; `lite.js:627`; `traffic.js:67` | none | — |
| Payment callback outside `/api` (signature instead of CSRF); `/pay/return` display-only | VERIFIED | `app.js:108-109`; `payments.js:81-93,100-102` | payments :75,102 | — |
| Traffic beacons capped per visitor per day (400 views, 20 errors) | UNVERIFIED | `traffic.js:44,54,77` | cap assertions not located in traffic tests | — |
| Privacy notice says "the only cookie keeps you signed in" | PARTIAL | `legal.js:26/118`; `lite.js:630,632` (`lt`, `ll` cookies) | none | Needs `LEGAL_PROPOSALS.md` (R9/R13); SECURITY.md:55 same claim |
| Privacy notice's visit-count bullet omits stored `country` and `role` | PARTIAL | `legal.js:20`; `traffic.js:43,59`; `db.js:345-346` | none | R13 |
| Notice says codes/IPs "deleted within 24 hours"; sweep is hourly after 24 h (≤ ~25 h) | PARTIAL | `legal.js:52/144`; `retention.js:10`; `index.js:13` | none | — |

## Area 14 · i18n, RTL, design-system conformance, accessibility, theme (brief B)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| `STR.en`/`STR.ar` parity (1,658 keys each after Stage 3, same placeholders, no empty Arabic) | PARTIAL | `i18n.js:6-7`; `i18n3.js:2,15`; `demo.js:3,10` (+23 keys at runtime); probe: 0 one-sided keys, 0 placeholder mismatches, 0 empty, 8 Arabic values without Arabic letters | none (import.test.js:12 only loads the files) | 17 EN / 18 AR keys defined twice with different values (`trPrivacy`, `tmAdd`, `err_phone_region`, `err_bad_code`, `err_code_expired`, …); D-04 `edu_student` and `coGovL` missing |
| Plural forms as CLDR objects rendered by `tn()` | PARTIAL | `engine.js:27-38,40`; `i18n3.js:5,18` | none | Numbers always `en-US` (`engine.js:19`) |
| `t()` lookup with English fallback then the key itself | PARTIAL | `engine.js:18,39,318` | none | Raw key shown on a miss (`coGovL`, `edu_student`) |
| Language switch (header, settings, localStorage + `PUT /api/me/lang`, re-render) | PARTIAL | `index.html:29`; `app.js:108-109`; `boot.js:22-32,67-68,250`; `me.js:28-33`; `db.js:11` | security test 3 (junk) | Happy path untested; device language overrides the account on every load |
| Pre-paint theme/language (`theme.js` fingerprinted in `<head>`) | PARTIAL | `theme.js:2-9`; `index.html:12`; `assets.js:20,25,32` | api :252-253 (app.js/css only) | — |
| RTL: direction follows language; logical properties; `[dir=rtl]` overrides for transforms/masks | PARTIAL | `index.html:2`; `theme.js:7`; `boot.js:26,256`; `app.css` (only `:462-463` text-align and `:822-823` radius are physical) | none | No ratchet test (P1-1) |
| Lite language handling and LT parity (189/189) | VERIFIED | `lite.js:15-82,102,140,142,631-633` | lite :74,85-86,147 | — |
| Theme system/light/dark (data-theme + prefers-color-scheme, theme-color meta, View Transitions, OS tracking) | PARTIAL | `engine.js:25`; `boot.js:3-21,69-70,216-218`; `app.css:127-148`; `index.html:6-8` | none | Lite has OS preference only |
| Design tokens: `:root` light, night values for dark, match DESIGN.md | PARTIAL | `app.css:107-148` = DESIGN.md front matter | none | 28 hex colours outside the token block; `--on-accent` hard-coded white on tiles (`app.css:284`) |
| 12 px floor and Ink Floor | PARTIAL | `app.css` (smallest px 12px; no text in `--ink-4`) | none | Resume preview scales with `cqw` to ≈10 px (`app.css:523-529`) |
| Single 24 px stroke icon set, `aria-hidden`, all names resolve | PARTIAL | `engine.js:61-105`; `app.js:21-44` | none | Emoji in the job header (`app.js:255`, `lookups.js:78-80`); `ICON.home` defined twice |
| No card inside a card / no side stripes | UNVERIFIED | `app.css:895-899` flattens nested boxes; no `border-left` | none | Needs a browser pass |
| Type scale (22/20/17/15/12) | PARTIAL | `app.css:157,191,251,309,335,371,432,462-467,609,665` | none | DESIGN.md:41 Display 28px vs `.h-display` 32px (`app.css:465`); many half-pixel sizes |
| Accessibility: skip link, focus ring, sr-only, labelled nav/dialogs, inert background, focus restore, live regions, aria states | PARTIAL | `index.html:18,33,37-40`; `app.css:167-173`; `motion.js:37,55-57,132`; `app.js:99-107,161,192,322` | lite :110,179 (Lite aria) | No automated accessibility test; no `forced-colors`; event list date only in an `aria-hidden` span (`app-events.js:11`) |
| Keyboard: Escape, `/`, arrows and j/k, Space/Enter hold, Enter advances | PARTIAL | `boot.js:118-144`; `motion.js:8-9,35,60,113,122`; `app.js:214-219` | none | — |
| Motion respects `prefers-reduced-motion`; hover on fine pointers only | PARTIAL | `motion.js:13,60,122,171,229`; `app.css:570,629-637,774,806` | none | — |
| Self-hosted IBM Plex Sans Arabic (4 weights, 3 subsets), preloaded, no third-party origin | PARTIAL | `app.css:1-98`; `index.html:13`; `app.js:88-90`; `public/fonts/` (12 woff2 + OFL.txt) | e2e :437-438 only (not run) | e2e still whitelists Google Fonts origins (`browser-flow.mjs:33,40`) |
| Server-side language for texts (14 templates en/ar), sign-in SMS, digests; export includes language | PARTIAL | `notify.js:6-34,39-40`; `auth.js:61-62`; `alerts.js:29-40`; `me.js:105` | api :179 (one English template) | Mixed register: interview and rejected templates are MSA |
| Error codes → sentences (`err_<code>`) | PARTIAL | `api.js:20-26` | none | Stage 3: all 89 server codes have a sentence in both languages; `test/i18n.test.js` fails on a new code without one (D-21 fixed) |
| Arabic register: MSA base with Syrian-dialect override block (40 keys) | PARTIAL | `i18n4.js:1981-2024`; `notify.js:8,19,21,27` | none | Needs native review (`docs/agent/ARABIC_REVIEW.md` does not exist yet) |
| Dates/numbers: Syria time with `ar-SY`/`en-GB`; numbers `en-US` | PARTIAL | `app-events.js:7-9`; `app-plans.js:35,46,100`; `engine.js:19,234-241` | none | Currency words built in code, not STR (`engine.js:238-240`) |
| Bilingual document shell (title, description, noscript, Lite link, brand word) | PARTIAL | `index.html:9-10,17,41`; `app.js:112-116` | api :243 (serving only) | — |
| XSS-safe rendering (escaping `html` template, one `innerHTML` sink, scanner rule) | VERIFIED | `engine.js:12-17`; `boot.js:223`; `security-check.js:53` | security test 13 | — |
| WCAG AA contrast in light and dark (PRODUCT.md "40 screens") | UNVERIFIED | tokens `app.css:111-115,128-132` | none | No report, screenshots or test in the repo |
| Lite look-alike of the full app | PARTIAL | `lite-assets.js:3` (own palette) vs `app.css:111-131` | lite :74 (tab bar) | Colours close, not the tokens (`#0f6e56` vs `#0E6B46`); favicon `#0D5C3A` |
| i18n parity test and CSS ratchets | VERIFIED (Stage 2) | `test/i18n.test.js`; `test/ratchets.test.js`; `test/ratchets.json` | i18n; ratchets (5 tests) | Counts may only go down: 24 hex, 1 named, 11 rgb(), 4 var() fallbacks outside the token block; 4 cqw sizes under 12 px; 2 physical properties; 5 hex in `public/js/app*.js` (the 10 in `lookups.js` and 2 in `boot.js` are outside the scan); 11 hex in `lite.js`, 16 in `lite-assets.js` outside its `:root` blocks; 3 glyph icons |

## Area 15 · Tests, scripts, seeding, demo accounts, Docker, deploy, docs (brief J)

| Feature | Status | Evidence | Tests | Notes or gap |
|---|---|---|---|---|
| `npm test`: node:test over 15 files, in-memory databases | VERIFIED | `package.json:13`; every file opens `:memory:` | 60 tests (api 11, security 12, import 6, lite 4, payments 4, plans 4, campus 3, demo 3, diaspora 3, events 3, recruit 2, team 2, contact 1, insights 1, traffic 1); BASELINE: 60 pass | README.md:230 / SECURITY.md:8 say "34 test groups" |
| Central security matrix (test 2 cross-role, test 3 junk input) | PARTIAL | `test/security.test.js:114-139,141-182,152-160` | security tests 2 and 3 | 35 entries = 34 distinct routes of 109; test 2 touches 19 routes; 68 routes in neither (see ROUTES.md) |
| Browser e2e (`npm run test:e2e`, Puppeteer: seeker phone/ar, employer, admin, legal browsers + Lite no-JS page) | UNVERIFIED | `package.json:14`; `test/e2e/browser-flow.mjs:1-447` (79 lines with `check(`, 80 call sites; 4 `actor(` browsers) | not run (puppeteer absent; network forbidden in Stage 0) | README.md:236 / SECURITY.md:32 say "54 checks", "three browsers"; stale Google Fonts allowance (`:33,40`); dead path `/home/claude/mvp` (`:299`) |
| Test fixtures: six synthetic resumes | VERIFIED | `test/fixtures/*` | import :40-68 | — |
| Security scanner (secrets, risky patterns, settings audit, `--env file`, `--url`, exit 1 on FAIL) | PARTIAL | `scripts/security-check.js:26-144`; `package.json:17` | security test 10 :278-292; test 13 :351-359; test 9 :275 | `liveCheck` never run; `SEED_DEMO` unset in production is only a WARN (`:93`); `--env file` works (probe) |
| Production lockdown in `loadConfig` | VERIFIED | `config.js:72-84` | security :278-292, :220-225; payments :120 | — |
| Backup script (`VACUUM INTO`, `backups/shaghilni-<UTC stamp>.db`) | PARTIAL | `scripts/backup.js:1-16`; `package.json:15` | none (probe: 380,928 B file written) | Missing DB file → 0-byte DB created and a 4,096 B "backup", exit 0; requires the full production env (`loadConfig`); folder differs from System tab's lookup in Docker |
| `npm run demo:remove` (deletes `is_demo` rows, audit `demo.removed`, never re-seeds) | PARTIAL | `scripts/remove-demo.js:1-15`; `seed.js:10`; `db.js:72,89,124,128` | none | Crashes with `FOREIGN KEY constraint failed` whenever demo-account invitations exist (default dev DB, probe A); docs never say to purge first |
| Sample listings seeding (`SEED_DEMO`: 17 companies / 18 of 19 listings as verified/published `is_demo`, the posting checks applied, contact persons dropped; once; excluded from metrics; labelled) | VERIFIED (Stage 3: D-02, D-13, D-15 fixed) | `seed.js:8-38`; `config.js:68`; `index.js:10`; `seed/demo.json`; `admin.js:23-25,43,67`; `insights.js:12-17`; `app.js:273,333` | api: "public board lists the seeded demo jobs"; insights | D-01 (no production gate); D-13 (`seed.js:36` rewrites real listings every start); D-02 (`pay:null` listing); D-15 (invented employees); companies marked `screened_at`/`verified_at` nobody screened, all `regNo:"demo"` |
| Demo accounts (4 sign-in-able + 9 fictional users, companies, listings, invitations, team, events; `POST /api/auth/demo`; `/api/config.demo`; Lite hint; dev only) | VERIFIED | `demo.js:14-17,38-163,189-200`; `config.js:52`; `app.js:30,122-123`; `public/js/demo.js` | demo: "demo accounts: four accounts with real-looking activity, ready to sign in to"; demo: "demo accounts: never in production…" | Seeding pushes ~26 texts to demo numbers through the real `sms` dependency (probe); not transactional; `Syrian Arab Red Crescent` and `Four Seasons` named (`demo.js:87,151`, R6) |
| Demo purge (`npm run demo-accounts:purge`) | VERIFIED | `demo.js:40,165-186`; `scripts/demo-accounts.js:11-14` | demo: "demo accounts: the purge removes them and everything they made…" | 66 audit rows by demo actors remain |
| Demo uninstall (R17) | PARTIAL | `scripts/demo-accounts.js:15-25`; guarded hooks in `app-account.js:55`, `app.js:121`, `boot.js:59`, `public.js:36`, `lite.js:456`, `insights.js:13`, `traffic.js:96` | none in repo (rehearsed on a scratch copy: edits applied, `node --check` ok, `test/api.test.js` 11/11) | Full suite after uninstall not run; README demo bullets outside the markers survive (`README.md:349,363,388`) |
| Dockerfile (node:22-alpine, production env, `/data` volume, `node` user, healthcheck, CMD) and `.dockerignore` | PARTIAL | `Dockerfile:1-15`; `.dockerignore:1-9` | none (image not built) | Seeds sample data on first start (D-01); `wget` presence UNVERIFIED; backup folder under root-owned `/app` while running as `node` (UNVERIFIED runtime) |
| Deploy notes (Render/Railway, VPS with proxy, `BASE_URL`, `TRUST_PROXY`) | PARTIAL | `README.md:103-141`; `config.js:36,69` | none | Environment block omits `SEED_DEMO=false` (D-01) and `PAY_*` |
| Server entry (`index.js`: config → db → seed → app; hourly sweep and alert timers; signal handling; banner) | PARTIAL | `index.js:1-24` | none start it (`cleanup` and `runAlerts` tested via `createApp`) | — |
| `.env.example` and `.env` loading | PARTIAL | `.env.example:1-78`; `config.js:8-18,28` | none (`skipDotEnv` everywhere) | D-14 (copying it yields dev mode on a public host); D-18; D-20; comment says three demo accounts (:67) |
| `GET /api/health` | VERIFIED | `public.js:35`; `Dockerfile:14` | security :313 | Counts toward the API rate limit |
| `GET /api/config` | VERIFIED | `public.js:36` | api :261; demo :65,96,105; payments :71,78; security :79,273 | — |
| Documentation set (README, SECURITY, PRODUCT with marker, DESIGN front matter, screenshots, docs/agent) | PARTIAL | `PRODUCT.md:3` marker; `DESIGN.md:1`; `docs/screenshots/*` | none (claims) | See `docs/agent/DOC_DRIFT.md` |
| Continuous integration | VERIFIED (Stage 2) | `.github/workflows/ci.yml` (tests and scanner on Node 22.13.0 / 22 / 24; manual e2e job) | GitHub runs 37360113885 (PR #2) and 37360175869 (`main`) green on all three versions; the e2e job is manual and has not run (`docs/LAUNCH.md` A7, A8, B2) | P0-2 written in Stage 1 (S1-3); branch protection is the owner's (D5) |
| Lite demo hint | PARTIAL | `demo.js:193-194`; `lite.js:456-457` | none | See area 12 |

## Brief corrections

Items of `<verified_facts>` and `<features>` that the maps contradict or refine. The repo wins.

| # | Brief says | Reality | Evidence |
|---|---|---|---|
| VF1 | `npm test` ~17 s | ~10 s here (`duration_ms 10264`); counts confirmed | `docs/agent/BASELINE.md` |
| VF2 | Scanner: no env → FAIL; fake env → 0 failed, 1 WARN | Confirmed. Also: `--env <file>` works; `PAY_PROVIDER=test` → FAIL; `SEED_DEMO` unset → only an extra WARN | map 15 runs; `scripts/security-check.js:93` |
| VF3 | `seedDemo` has no production gate; 17/19; real names | Confirmed, and more: `Dockerfile:3,8` seeds by default; `server/seed.js:36` rewrites every multinational company's listings to `returnees:true` on every start, demo or not (D-13); one sample listing has `pay:null` (D-02); sample companies get `screened_at`/`verified_at` (`seed.js:17`) and `regNo:"demo"` (`seed.js:16`); each listing names an invented employee at a real organisation (D-15) | `server/seed.js:16-17,24,36`; probes exp-15a/e |
| VF4 | "about 30 of the 109" routes in the matrix | Exactly 34 distinct routes in test 3 (35 entries; audit listed twice); test 2 touches 19 routes, 7 of them not in test 3; 41 of 109 are touched by tests 2 or 3, 68 by neither. Absent families confirmed, plus `/api/employer/companies/*`, `/membership`, `/activity`, `/partners`, `/api/auth/logout`, `GET /api/me`, `/api/config`, `/api/health`, `/api/auth/demo`, admin `suspend`/`GET jobs`/`billing`/`plan`/`charges`/`programmes`, job `close`/`reopen`, `DELETE /api/me` | `test/security.test.js:114-139,152-160`; ROUTES.md |
| VF5 | 1,646 keys each, in sync, no test | Confirmed, with: 17 EN / 18 AR keys defined twice with different values (`i18n4.js:78/907 trPrivacy`, `:262/666 tmAdd`, `:748/911 err_phone_region`, `:256/927`, `:258/929`); 8 Arabic values with no Arabic letters; `edu_student` and `coGovL` missing in both (D-04); 9 server error codes without `err_*` (D-21); `demo.js` adds 23 keys at runtime; Lite's 189 LT keys live outside STR | maps 1, 4, 8, 10, 12, 14 probes |
| VF7 | Only TODOs in `server/payments.js` | Confirmed | BASELINE |
| VF8 | Docs contradict themselves (listed items) | Confirmed, plus: README "Not built yet" also wrongly lists "Telegram and SMS job alerts" (SMS digests exist, `server/alerts.js:38-41`) and "Resume file uploads" (on-device import exists); SECURITY.md:41 says 26 and 28 September while `TERMS_VERSION` is `2026-10-04`; README.md:236 / SECURITY.md:32 "54 checks", "three browsers" vs 79 lines (80 call sites) and four browsers | DOC_DRIFT.md |
| VF9 | Verified absent: audit screen, listing editing, Telegram, public resume links, Lite events/campus/teams; Lite legal links JS-only | All confirmed. Refinements: Lite also lacks block (`lite.js:258,265`), plans/billing, job posting, alert channel choice; `GET /api/me/events` exists but no client screen uses it; public resume links absent but `engine.js:177` builds a `shaghilni.sy/cv/<slug>` string (D-20); manual office verification is absent though README.md:310 and SECURITY.md:407-408 describe it | maps 5, 7, 9, 10, 11, 12 |
| VF11 | Known by design: in-memory limits, one process | Confirmed for the limiter (`http.js:100-110`); the proof-of-work used-list is also in memory (`auth.js:27`): a solved challenge is reusable after a restart within 5 minutes (probe) | map 1 |
| A | "Codes stored as salted hashes" | `sha256(OTP_PEPPER:phone:code)`: keyed with the pepper, no random per-code salt | `server/auth.js:19` |
| A | "about 19 diaspora countries" | Exactly 19 (`DIAL` has 20 entries incl. Syria); `+1` labelled United States only | `public/js/lookups.js:136-137` |
| B | Filters "for type (including internship), governorate, 'for returnees', remote" | Only Internship is a type chip; full-time/part-time/contract are not filterable; "remote" is a governorate option, not a filter | `public/js/app.js:20`; `engine.js:210-224` |
| B | "Sponsored listings … always labelled 'Sponsored'" | Labelled only when lifted (≤2, fit ≥ 60, signed-in seeker, not Saved); otherwise unlabelled | `public/js/app.js:176-183,189,255`; `lite.js:169-170,183` |
| B | "an SMS on each employer move" | No text on a move to `new` (no template); backward moves to `shortlisted` re-send the shortlisted text | `server/notify.js:7,38`; `employer.js:8-10,158` |
| B | "Claude wording suggestions only for saved bullet points (10 per hour per person)" | A published job must be chosen (404 otherwise); the 10/hour counter is shared with translation; each bullet's `role`/`current` travel unchecked | `server/routes/resume.js:14,46-53` |
| B | "Job alerts … up to 5 saved searches; counts; a digest at most about once a day" | Confirmed; D-26: a governorate alert never matches remote listings | `server/alerts.js:61`, `engine.js:1143` |
| C | "no JavaScript beyond the sign-in check" | A one-line print script also loads on the resume page; with the default `OTP_POW_BITS=14` signing in needs the script (no-JS form → `pow_required`) | `server/lite.js:145,307,315,451,462-465` |
| C | "about 2–3 KB a page after (a test checks)" | Measured max 2,650 B; the test ratchet was 6,000 B, now 3,072 B (Stage 2, A-21) | `test/lite.test.js:82`; map 12 sizes |
| D | "pay and place required" | Pay and governorate (plus title, a language, a summary); free-text `place` is optional | `server/validate.js:126-136` |
| D | "edits go back for review" | Only for published and rejected listings; edits while pending or closed are kept without re-check (D-05, D-06) | `server/routes/employer.js` edit: every edit is a draft again since Stage 3 (D-05, D-06 fixed) |
| D | "registration number unique (otherwise 'ask to join')" | Checked only when the caller has no company yet; an existing company may edit its number to another's | `server/routes/employer.js:40-46` |
| E | "Placement fee … only for a hire invited through candidate search" | Any accepted invitation from the company counts (event or another job) | `server/routes/admin.js:113-119` |
| E | "placement and compliance spreadsheet reports Enterprise" | Compliance report's sanctions column is always empty (D-07) | `admin.js` setCompany audit data; D-07 fixed in Stage 3 |
| F | "every permission enforced on the server" | Admins can invite admins (README says owner only); any employer account, verified or not, can send team invitations by text (D-10) | `server/routes/team.js:14,32-46` |
| G | "Career-office accounts … removable" | Removal leaves a sign-in-able `university` account (D-11) | `server/routes/campus.js:162-165` |
| H | "An event has a bilingual title" | At least one language suffices; end time, governorate and link also exist | `server/routes/events.js:36-45` |
| I | "Audit log recorded for admin, employer, hire, plan, payment, team and campus actions" | Switching sponsorship off (D-28), note-only applicant edits, re-applications and the opt-in via `PUT /api/me/profile` write nothing | `employer.js:155,186`; `me.js:65-67`; `validate.js:59` |
| I | "Insights … 12-week series" and README "8-week trend" | Insights 12 weeks is live; the overview's 8-week chart is dead code | `insights.js:32-35`; `app-admin.js:20,23-37` |
| J | "deploy notes for Render, Railway and a VPS" | The environment block omits `SEED_DEMO=false`, so following it seeds sample data (D-01) | `README.md:115-127` |
| Architecture | "db.js schema + migrations (~30 tables)" | 31 tables on a fresh database (35 `CREATE TABLE` statements, two of them the rebuild temporaries `users_new`, `applications_new`); `MIGRATIONS` has 15 entries | `server/db.js`; probe: `openDb(':memory:')` then `SELECT name FROM sqlite_master WHERE type='table'` → 31 rows, `PRAGMA user_version` → 15 |

## Confirmed absent

| Item | Evidence | Claimed where |
|---|---|---|
| Admin audit-log screen | `public/js/app-admin.js:7` tab list; no client reference to `admin/audit` | README.md:241 says so; backlog P1-3 |
| Admin editing of listings | `server/routes/admin.js` mutates listings only at :71 (approve) and :81 (reject) | README.md:252 says so; backlog P2-2 |
| Telegram alerts | no code (grep `telegram` → none) | README.md:247 says so |
| Public resume links | no route; `engine.js:177` builds a display string `shaghilni.sy/cv/<slug>` (D-20) | README.md:249 says so |
| Lite pages for events, career offices, teams | `server/lite.js:601-611` route table | Brief C; README.md:13 silent on teams |
| Lite: block a company, plans/billing/analytics, job posting, alert channel choice or edit, withdraw an application, privacy/terms pages | `lite.js:258,265` (yes/no only); no plan/jobs/alerts-edit routes; `:144,450` link to `/#/…` | README.md:11 (block, general); D-12 |
| Server-rendered legal pages (`/lite/privacy`, `/lite/terms`) | not in `lite.js:601-611` | Backlog P1-2 |
| QNB Syria payment adapter | `server/payments.js:33-47` `ready = false` | README.md:335; brief E |
| Continuous integration | `.github/workflows/ci.yml` added in Stage 1 (S1-3); two GitHub runs green in Stage 2 | closed in Stage 2 |
| i18n parity test; CSS ratchets (`test/ratchets.json`) | no such tests | Backlog P1-1 |
| Production gate for `seedDemo` | `server/config.js:68` now `!prod && …` (Stage 1, S1-1) | closed in Stage 1 |
| Admin role revocation | `server/auth.js:99` promotes only | D-17 |
| Re-consent prompt for a changed `TERMS_VERSION` while signed in | no client comparison of `termsVersion` | SECURITY.md:42 implies acceptance per version |
| Manual student-verification approval by the office (`/api/campus/verify`) | no route; `app-campus.js:41` dead action; `campus.test.js:93` asserts `requests === undefined` | README.md:310; SECURITY.md:407-408 still describe it |
| Text to a student when verified/declined | `notify.js:26-29` templates have no caller | i18n `tCpVerified` promises it |
| Unblock a company (seeker) | no route or UI; only `recruiter_blocks` insert and account-deletion delete | — |
| Edit or retire a donor programme | `programmes.active` never written; no route | — |
| Any route that reverts a hire | `admin.js` has only confirm-hire; `MOVES.hired = []` | — |
| "My tickets" screen | `GET /api/me/events` exists; no client file calls it | — |
| Admin overview 8-week chart | `drawOverview` never called | README.md:17 describes it |
| `forced-colors` / high-contrast handling; automated accessibility test | grep `prefers-contrast|forced-colors` → none; no a11y test | PRODUCT.md:99 (TalkBack still to do) |
| Browser e2e run, Docker build, live-site scanner | not possible here (no network, no Docker) | UNVERIFIED, not absent |
