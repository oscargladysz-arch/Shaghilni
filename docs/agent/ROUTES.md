# ROUTES · every HTTP endpoint · Stage 0 ground truth (2026-10-05)

Source of the 109 JSON routes: `scratchpad/stage0/routes-grep.txt` (grep of `r.get|post|put|delete` over `server/`), cross-checked against the 15 area maps and `server/app.js`, `server/payments.js`, `server/lite.js`. Guards and audit calls are code read at the cited lines; "tests that hit it" are test files and line numbers from the maps. Commit `9683221` (code = `b8425b2`).

Column meanings:

| Column | Meaning |
|---|---|
| Guard | What the route requires before the handler runs. `seeker/employer/admin/university` = `auth.need(role)` (`server/auth.js:134-137`: 401 `login_required` without a session, 403 `forbidden` for another role). `need()` = any signed-in role. Team-role levels are `plans.allow` (`server/plans.js:17`: billing = owner; manage = owner, admin; hire = + recruiter; view = all). Every non-GET `/api` call also needs `x-shaghilni: 1`, an Origin equal to `BASE_URL` when both are set, and passes the write rate limit (`server/app.js:57-63`) |
| Matrix | Membership in the hard-coded security matrix: **3** = in the junk-input list (`test/security.test.js:152-160`, 35 entries, 34 distinct routes); **2** = asserted in the cross-role/IDOR test (`test/security.test.js:114-139`); **—** = neither |
| Audit | `audit()` calls on the handler's path (`server/app.js:36-37` inserts into `audit`) |

**Stage 2 status.** The "In security matrix (tests 2/3)?" column below is the Stage 0 record. Since Stage 2 every JSON route has a row in `test/policy/route-policy.js` (109 rows; `test/policy-completeness.test.js` fails when a route has no row), and the generated tests derive from those rows: `test/policy-access.test.js` (every route × every excluded role), `test/policy-idor.test.js` (B against A's ids; a removed office), `test/policy-junk.test.js` (hostile input on every POST, PUT and DELETE). Two rows state the product rule where the code was wider and the code was fixed in Stage 2: `GET /api/employer/invitations` and `POST /api/employer/invitations/:id/withdraw` now need the hire level (D-03); the events organiser guard now refuses a university account without an office row (D-11).

## JSON routes (`/api/*`, 109)

### Sign-in and public (`server/routes/public.js`, `server/demo.js`) · 9

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/auth/challenge` | none; 60 per address per 10 min (`auth.js:30`) | `server/routes/public.js:25` | security :152 (test 3), :273 (test 9), :319-330 (test 12) | 3 | none | PoW challenge, HMAC with `OTP_PEPPER`, 5-min TTL |
| POST | `/api/auth/code` | none; PoW when `OTP_POW_BITS>0`; 30/address/h, 3/number/15 min; allowlist; daily caps | `server/routes/public.js:26` | api :72-75,86-88; security :216-222,307-311; every suite's login helper (14 files) | 3 | none | Failed send still consumes quotas (`auth.js:57-60` before :63) |
| POST | `/api/auth/verify` | none; valid code; 60/address/h; 5 attempts; `terms_required` for new accounts | `server/routes/public.js:27` | api :76-85,89-92; security :70-81,211-215; all login helpers | 3 | `user.created` `auth.js:97`; `terms.accepted` `auth.js:103` | Admin promotion `auth.js:99`, never demotion (D-17) |
| POST | `/api/auth/logout` | none (guests get 200) | `server/routes/public.js:28` | security :204-206; lite :136 (via `/lite/signout`) | — | none | — |
| GET | `/api/jobs` | none | `server/routes/public.js:29` | api :59,157-161,197,203; security :135-136,187,273,335-339; plans :121,126; diaspora :78,116; campus :125; contact :72 | 2 | none | `LIMIT 500` (D-27); board leak check in test 2 |
| GET | `/api/jobs/:id` | none (published + verified company only) | `server/routes/public.js:30` | api :64-65; security :152 (junk ids) | 3 | none | — |
| GET | `/api/health` | none | `server/routes/public.js:35` | security :313 (test 11) | — | none | Docker healthcheck; counts toward the API limit |
| GET | `/api/config` | none | `server/routes/public.js:36` | api :261; security :79,273; demo :65,96,105; payments :71,78 | — | none | `ai, dev, demo, card, legalName, contactEmail, termsVersion, sessionDays` |
| POST | `/api/auth/demo` | none; registered only when `demoOn(cfg)` (never in production) | `server/demo.js:195` | demo :66,104 | — | none (startSession only) | Development only |

### Job seeker account (`server/routes/me.js`) · 10

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/me` | none (guest → `{user:null}`) | `server/routes/me.js:11` | api :83-84,104,106,228; diaspora :74,77,98; campus, demo, events, recruit, security suites | — | none | Role payloads: profile/saved/applications/invitesNew/studentVerify/campusOffice |
| PUT | `/api/me/lang` | `need()` | `server/routes/me.js:28` | security :152 (test 3 only) | 3 | none | Persistence never asserted |
| PUT | `/api/me/profile` | seeker | `server/routes/me.js:35` | api :96-101,124; security :131 (403), :152, :234,255; 11 suites' set-up | 2+3 | none | Also writes the recruit opt-in flag with no audit (`validate.js:59`) |
| POST | `/api/me/saved/:jobId` | seeker; listing must be published | `server/routes/me.js:42` | api :103-104; security :153 (as `:id`) | 3 | none | — |
| DELETE | `/api/me/saved/:jobId` | seeker | `server/routes/me.js:48` | api :105-106; security :153 | 3 | none | Idempotent |
| POST | `/api/jobs/:id/apply` | seeker; published job of a verified company; profile required; channel enabled unless demo | `server/routes/me.js:53` | api :107-117,165; security :88,120,131,153; contact; campus :127; events :115; insights :69; plans :94,110; team :93; lite :121 | 2+3 | `application.created` `me.js:71` (first application only) | Re-apply after withdraw (`me.js:65-67`) writes none |
| GET | `/api/me/applications` | seeker | `server/routes/me.js:80` | api :114,182; security :128,133,202,206; demo :69,72 | 2 | none | — |
| POST | `/api/me/applications/:id/withdraw` | seeker; own application; not hired | `server/routes/me.js:91` | api :113,183; security :127,153; recruit | 2+3 | `application.withdrawn` `me.js:96` (every call, even repeated) | Rejected/withdrawn rows can be withdrawn again |
| GET | `/api/me/export` | `need()` | `server/routes/me.js:101` | security :91-98,129,133; diaspora :110 | 2 | none | Export gaps: see STATE area 13 |
| DELETE | `/api/me` | `need()`; admin → 409 `admin_cannot_delete` | `server/routes/me.js:136` | api :227; security :105,108; campus :97; events :94; recruit :129 | — | `user.deleted` `me.js:164` | Leaves `campus_offices` (D-22), `applyPhone/applyEmail`, `email_sends` |

### Resume AI (`server/routes/resume.js`) · 2

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| POST | `/api/resume/suggest` | seeker; AI gate (key, 10/h, daily caps); published job; own bullets | `server/routes/resume.js:44` | api :208,218; security :154,303-304 | 3 | none (counted in `usage`) | `role`/`current` from the body reach the prompt unchecked; not in test 2 |
| POST | `/api/resume/translate` | seeker; AI gate | `server/routes/resume.js:67` | security :131 (403), :154, :245,260,262 | 2+3 | none | — |

### Job alerts (`server/alerts.js`) · 5

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/me/alerts` | seeker (`alerts.js:48`) | `server/alerts.js:51` | diaspora :89 (employer 403), :96,105 | — | none | — |
| POST | `/api/me/alerts` | seeker; ≤5; no duplicate | `server/alerts.js:60` | diaspora :90-93,106-107; lite :182 (via `/lite/alerts`) | — | `alert.created` `alerts.js:66` | — |
| PUT | `/api/me/alerts/:id` | seeker; own alert | `server/alerts.js:69` | none | — | none | Unused by Lite; no test |
| DELETE | `/api/me/alerts/:id` | seeker; own alert | `server/alerts.js:73` | diaspora :108-109; lite :188 | — | none | — |
| POST | `/api/me/alerts/seen` | seeker | `server/alerts.js:76` | diaspora :105 | — | none | — |

### Recruiters and invitations (`server/routes/recruit.js`) · 8

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/employer/students` | employer + company `verified` + hire role (`recruit.js:38`); `?event=` needs a confirmed attendance; `?id=` narrows to one card (Lite's invitation form, U-016) | `server/routes/recruit.js:57` | recruit :63-85,126,128; team :91; campus :117-118; events :105-111; security :131 (403), :158; lite :157 | 2+3 | none | ≤60 cards of the 1000 most recent profiles |
| POST | `/api/employer/students/:id/invite` | same as search; target findable; caps (3 open, 40/day, monthly plan quota) | `server/routes/recruit.js:85` | recruit :86,96-103,119-120,127; plans :63,73-76,91; events :114; lite :127,160-163; security :158 | 3 | `invitation.sent` `recruit.js:122` | — |
| GET | `/api/employer/invitations` | employer + company `verified` only (`verified()`, no role check) | `server/routes/recruit.js:127` | recruit :113,121; lite :166; security :158 | 3 | none | D-03: hiring managers read full name + phone after an event yes |
| POST | `/api/employer/invitations/:id/withdraw` | employer + company `verified`; own company; open only; no role check | `server/routes/recruit.js:141` | recruit :122; security :159 | 3 | `invitation.withdrawn` `recruit.js:147` | D-03 |
| PUT | `/api/me/recruit` | seeker + profile | `server/routes/recruit.js:152` | recruit :64-66,84; plans :64; campus :113-114; events :101; insights :66; lite :119,142; security :131 (403), :159 | 2+3 | `recruit.opened`/`recruit.closed` `recruit.js:157` | — |
| GET | `/api/me/invitations` | seeker + profile | `server/routes/recruit.js:161` | recruit :83,105,123-124; plans :92; demo :70,74; lite :128; security :131 (403), :159 | 2+3 | none (side effect: `sent` → `seen` `recruit.js:166`) | — |
| POST | `/api/me/invitations/:id/respond` | seeker + profile; own; open | `server/routes/recruit.js:176` | recruit :110-112; plans :93; lite :130; security :160 | 3 | `invitation.accepted`/`declined` `recruit.js:184` | — |
| POST | `/api/me/invitations/:id/block` | seeker + profile; own invitation | `server/routes/recruit.js:188` | recruit :125; security :160 | 3 | `recruiter.blocked` `recruit.js:194` | No unblock route |

### Employer: company, listings, pipeline (`server/routes/employer.js`) · 10

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/employer` | employer (any team role) | `server/routes/employer.js:30` | api :202; team :80,82,117,125,127-128; campus :122; security :131 (403), :133 (401); plans, events, insights, traffic, demo, contact helpers; lite via in-process | 2 | none | — |
| PUT | `/api/employer/company` | employer; manage role when a company exists; duplicate regNo check only when none | `server/routes/employer.js:39` | api :125,128,200; team :52,88,109; contact :69,71; security :61,154; lite :148; 9 other suites' helpers | 3 | `company.created` :51 / `company.updated` {reverify} :57 | Existing company may change regNo to another's |
| POST | `/api/employer/company/submit` | employer; manage; company complete; not suspended | `server/routes/employer.js:63` | api :127,130; lite :148-150; helpers in 12 suites | — | `company.submitted` :72 | — |
| POST | `/api/employer/jobs` | employer; company exists; hire role | `server/routes/employer.js:85` | api :132; team :40,57,85,87; campus :123; diaspora :115; security :65,154; 8 helpers | 3 | `job.created` :92; `job.submitted` :82 when `submit:true` | — |
| PUT | `/api/employer/jobs/:id` | employer; own company's job (404); hire | `server/routes/employer.js:97` | api :148,150,155,196; security :124 (404), :154 | 2+3 | `job.updated` {from,to} :102; `job.submitted` when `submit:true` | D-05: pending stays pending unchecked; D-06: closed stays closed |
| POST | `/api/employer/jobs/:id/submit` | employer; hire; draft or rejected; company verified; `checkJob` | `server/routes/employer.js:107` | api :135,198; security :125 (404), :154 | 2+3 | `job.submitted` {flags} :82 | Only place the fee block fails a request |
| POST | `/api/employer/jobs/:id/close` | employer; hire; published only | `server/routes/employer.js:114` | security :125 (404 only) | 2 | `job.closed` :119 | No success-path test; D-29 (sponsored slot kept) |
| POST | `/api/employer/jobs/:id/reopen` | employer; hire; closed only; company verified | `server/routes/employer.js:122` | security :125 (404 only) | 2 | `job.reopened` :128 | D-06: republishes edited text without review |
| GET | `/api/employer/jobs/:id/applications` | employer; own job; view role | `server/routes/employer.js:132` | api :168,229; team :94,98; contact :78,81; campus :129; plans :95; security :121 (404), :155 | 2+3 | none | — |
| PUT | `/api/employer/applications/:id` | employer; own company's application; hire for a status move, view for a note | `server/routes/employer.js:145` | api :174-181; team :95-97; security :89,122 (404), :155; campus :131; events :117; insights :71; plans :65 | 2+3 | `application.moved` {from,to} :156 only when status changes | Note-only edits write none and accept non-strings |

### Employer: plans, sponsoring, analytics, payments (`server/routes/employer.js`) · 7

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/employer/plan` | employer; company required (409 `company_not_verified` when none); any team role | `server/routes/employer.js:166` | plans :77,82,84,102,106; payments :85,89,95,98,108,112,116 | — | none | Charges visible to every role; SYP amounts only; D-08 |
| POST | `/api/employer/plan/request` | employer; company verified; billing (owner) | `server/routes/employer.js:173` | plans :78-81; team :90 (403); payments :79 | — | `plan.requested` :179 | — |
| POST | `/api/employer/jobs/:id/sponsor` | employer; own job; manage; verified; published; plan limit | `server/routes/employer.js:183` | plans :118-127 | — | `job.sponsored` {until} :191 on; **none** when `on:false` (:186) | D-28 |
| GET | `/api/employer/analytics` | employer; verified; view | `server/routes/employer.js:193` | plans :132,136; demo :77 | — | none | — |
| GET | `/api/employer/reports/:kind` | employer; verified; manage; plan feature `reports`; kind ∈ placements\|compliance | `server/routes/employer.js:205` | plans :134,137,138 | — | none | D-07 (sanctions column empty) |
| POST | `/api/employer/plan/checkout` | employer; verified; billing; provider ready and prices set | `server/routes/employer.js:222` | payments :72,80-81,94,97,99 (seeker 403),104,113 | — | `plan.checkout` `server/payments.js:77` | — |
| GET | `/api/employer/payments/:id` | employer; verified; payment scoped to the company (`payments.js:124`); no team-role check | `server/routes/employer.js:226` | payments :84,88,98,112 | — | none | — |

### Teams (`server/routes/team.js`) · 11

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/employer/team` | employer + view; requests only for manage | `server/routes/team.js:24` | team :68-69,77,115,131 | — | none | Phones and last-login of teammates visible to every role |
| POST | `/api/employer/team` | employer + manage; seat check; company status **not** checked (`team.js:14`) | `server/routes/team.js:32` | team :70-75,89,119 | — | `team.invited` {role} :43 | D-10; admins may invite admins (:32-46 has no owner check) |
| POST | `/api/employer/team/requests/:phone` | employer + manage; role admin only by the owner (:52) | `server/routes/team.js:47` | team :116 (approve) | — | `team.request_approved` :55 / `team.request_declined` :50 | Decline branch untested; phone in the path reaches the error log on a 500 (`app.js:78`) |
| PUT | `/api/employer/team/:phone` | employer + manage; non-owner cannot touch admin (:62) | `server/routes/team.js:58` | **none** | — | `team.role_changed` {from,to} :64 | Only route of the family with no test at all |
| DELETE | `/api/employer/team/:phone` | employer + manage; non-owner cannot remove an active admin (:69) | `server/routes/team.js:66` | team :121 (403), :128 | — | `team.invite_cancelled` (invited) / `team.removed` :71 | A pending request deleted here is logged as `removed`, no text |
| POST | `/api/employer/team/leave` | employer + active company; owner refused | `server/routes/team.js:73` | team :126-127 | — | `team.left` :75 | — |
| POST | `/api/employer/team/transfer` | employer + billing (owner); target active member | `server/routes/team.js:77` | team :122 (403), :124 | — | `team.ownership_transferred` :85 | Old owner's member name becomes the company contact name (`plans.js:36`) |
| POST | `/api/employer/membership/:answer` | employer without a company; pending invited/requested row; `accept\|decline\|cancel` | `server/routes/team.js:90` | team :81,83,120 (accept only) | — | `team.joined` {role} :96; `team.invite_declined` / `team.request_withdrawn` :100 | decline/cancel untested |
| GET | `/api/employer/companies/search` | employer (any, even without a company); `q` ≥ 2 chars; verified only | `server/routes/team.js:104` | team :111 | — | none | LIMIT 400 before the name filter |
| POST | `/api/employer/companies/:id/join` | employer; no company; no pending row; target verified | `server/routes/team.js:110` | team :112,114 | — | `team.requested` :116 | Requester's free-text name goes verbatim into the managers' SMS |
| GET | `/api/employer/activity` | employer + manage | `server/routes/team.js:124` | team :100 (200), :102 (403) | — | none | LIMIT 150 before the LABEL filter |

### Universities and student verification (`server/routes/campus.js`) · 13

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| POST | `/api/me/verify-student` | seeker; profile with a university; email service configured | `server/routes/campus.js:40` | campus :76,81-85,98-100,107,116 | — | `student.email_code_sent` {uni} :63 | Failed send still counts toward 5/day |
| POST | `/api/me/verify-student/confirm` | seeker | `server/routes/campus.js:66` | campus :86-90,116 | — | `student.verified_by_email` {uni} :81 | Arabic-Indic digits → `bad_code` (`:71`) |
| DELETE | `/api/me/verify-student` | seeker | `server/routes/campus.js:84` | **none** | — | `student.verify_withdrawn` :87 | — |
| GET | `/api/campus` | university + office row (403 `no_office`) | `server/routes/campus.js:91` | campus :91,96,120,128,133; demo :79 | — | none | — |
| POST | `/api/campus/domains` | university + office | `server/routes/campus.js:126` | campus :77-78,80,115 | — | `campus.domain_added` {uni, domain} :122 | — |
| DELETE | `/api/campus/domains/:domain` | university + office (own university) | `server/routes/campus.js:127` | **none** | — | `campus.domain_removed` :125 | — |
| POST | `/api/admin/campus/domains` | admin; `core.UNI` check | `server/routes/campus.js:128` | campus :79,105 | — | `campus.domain_added` :122 | — |
| DELETE | `/api/admin/campus/domains/:uni/:domain` | admin | `server/routes/campus.js:129` | **none** | — | `campus.domain_removed` :125 | — |
| POST | `/api/campus/partners/:companyId` | university + office; UPDATE scoped to own university (404) | `server/routes/campus.js:130` | campus :121 | — | `partner.approved`/`partner.declined` {uni} :134 | Any decision other than `yes` declines |
| POST | `/api/employer/partners` | employer; company verified; manage | `server/routes/campus.js:139` | campus :119 | — | `partner.requested` {uni} :145 | — |
| GET | `/api/admin/campus` | admin | `server/routes/campus.js:149` | **none** | — | none | — |
| POST | `/api/admin/campus` | admin | `server/routes/campus.js:152` | campus :72,112; events :127 | — | `campus.office_added` {uni, faculty} :160 | `ADMIN_PHONES` number accepted (becomes admin at sign-in) |
| DELETE | `/api/admin/campus/:userId` | admin | `server/routes/campus.js:162` | **none** | — | `campus.office_removed` :164 | D-11: users row keeps role `university` |

### Events (`server/routes/events.js`) · 14

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/events` | none (optional session; `mine` for seekers) | `server/routes/events.js:49` | events :81 | — | none | Published, `starts_at > now − 6 h`, LIMIT 100 |
| GET | `/api/events/:id` | none (404 unless published or manageable) | `server/routes/events.js:54` | events :82,87,92,108,112 | — | none | 404 to ticket holders once cancelled |
| POST | `/api/events/:id/rsvp` | seeker; published; not over (3 h); profile; capacity | `server/routes/events.js:61` | events :73,75,77-80,103 | — | `event.rsvp` :72 | Ticket also by SMS |
| DELETE | `/api/events/:id/rsvp` | seeker; not after check-in | `server/routes/events.js:77` | events :80 | — | none | — |
| GET | `/api/me/events` | seeker | `server/routes/events.js:81` | events :83; demo :71 | — | none | No client screen uses it |
| GET | `/api/organize/events` | `auth.need("admin","university")`; office scoped to own uni | `server/routes/events.js:85` | events :93 (seeker 403), :132; demo :81 | — | none | — |
| POST | `/api/organize/events` | organiser; office's uni forced | `server/routes/events.js:90` | events :69-70,100,128,130 | — | `event.created` {status} :93 | — |
| PUT | `/api/organize/events/:id` | organiser + manage() (admin, or office of `e.uni`) | `server/routes/events.js:95` | events :133 (office) | — | `event.updated` {status} :99 | Cancelling notifies nobody |
| GET | `/api/organize/events/:id` | organiser + manage() | `server/routes/events.js:101` | events :131 (403 only) | — | none | 200 body (people list) untested |
| POST | `/api/organize/events/:id/companies` | organiser + manage(); company verified | `server/routes/events.js:110` | events :107 | — | `event.company_<status>` {company} :115 | Admin picker LIMIT 300 (`:107`) |
| POST | `/api/organize/events/:id/checkin` | organiser + manage() | `server/routes/events.js:117` | events :85-86,88-89,91,112 | — | `event.checkin` :128 (not on repeat) | — |
| GET | `/api/organize/events/:id/report` | organiser + manage() | `server/routes/events.js:130` | events :119; demo :82 | — | none | Totals only |
| GET | `/api/employer/events` | employer + company verified | `server/routes/events.js:145` | demo :78 | — | none | — |
| POST | `/api/employer/events/:id/attend` | employer + verified + hire role; event published; re-ask only after decline | `server/routes/events.js:150` | events :104 | — | `event.company_requested` {company} :156 | — |

### Admin (`server/routes/admin.js`, `server/routes/insights.js`) · 16

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/admin/overview` | admin | `server/routes/admin.js:10` | api :142,187,190,232; security :131 (403), :133 (401) | 2 | none | `counts` include demo-listing applications; client uses `queues` only |
| GET | `/api/admin/companies` | admin | `server/routes/admin.js:40` | api :143; security :63,131 (403), :155 (`?status=%27;drop`); helpers in 12 suites | 2+3 | none | — |
| POST | `/api/admin/companies/:id/verify` | admin; `screened === true` | `server/routes/admin.js:57` | api :146-147; security :64,155; helpers in 12 suites | 3 | `company.verified` {note} :54 | No state check: a draft or suspended company can be verified (probe); `screened` not stored in the audit data (D-07) |
| POST | `/api/admin/companies/:id/reject` | admin; note required | `server/routes/admin.js:61` | security :156 (junk only) | 3 | `company.rejected` {note} :54 | Never asserted |
| POST | `/api/admin/companies/:id/suspend` | admin; note required | `server/routes/admin.js:62` | **none** | — | `company.suspended` {note} :54 | Sessions not revoked; listings stay `published` in the DB |
| GET | `/api/admin/jobs` | admin | `server/routes/admin.js:64` | api :152 | — | none | Pending queue, `is_demo = 0` |
| POST | `/api/admin/jobs/:id/approve` | admin; pending; company verified | `server/routes/admin.js:71` | api :156,199; security :66,156; helpers in 8 suites | 3 | `job.approved` :78 | Does not re-run `checkJob` (D-05) |
| POST | `/api/admin/jobs/:id/reject` | admin; note required | `server/routes/admin.js:81` | api :154 (`note_required` only); security :156 | 3 | `job.rejected` {note} :87 | — |
| GET | `/api/admin/hires` | admin; `?state=confirmed` | `server/routes/admin.js:92` | api :184; security :157 (`?state=%00`) | 3 | none | LIMIT 200 |
| POST | `/api/admin/applications/:id/confirm-hire` | admin; application `hired` | `server/routes/admin.js:104` | api :189; insights :72; plans :98-112; campus; events; security :156 | 3 | `hire.confirmed` {note} :110 (also on repeat calls) | Fee/programme charges gated by `first` (:108); charge rows carry no audit of their own (D-08 context) |
| GET | `/api/admin/audit` | admin; `limit` 1..200 | `server/routes/admin.js:131` | api :239; security :157 (limit=-5, abc), :174-175 | 3 | none | No filters or pagination; no screen |
| GET | `/api/admin/billing` | admin | `server/routes/admin.js:137` | plans :83,104; insights :74 | — | none | — |
| POST | `/api/admin/companies/:id/plan` | admin; plan ∈ free\|pro\|enterprise; months 0..36 | `server/routes/admin.js:148` | plans :75,108,119,135; team :76,130; insights :73 | — | `company.plan` {plan, months, amountSyp} :156 | `months` 0 → no expiry |
| POST | `/api/admin/charges/:id/:what` | admin; `paid\|void` else 404 | `server/routes/admin.js:159` | plans :105; insights :74 | — | `charge.paid`/`charge.void` :163 | No state check (paid→void→paid) |
| POST | `/api/admin/programmes` | admin; name ≤120; rate 0..100000 | `server/routes/admin.js:165` | plans :103 | — | `programme.created` {rate} :169 | No edit/retire route |
| GET | `/api/admin/insights` | admin; `days` ∈ 7\|30\|90\|365; `sample=1` | `server/routes/insights.js:9` | insights :75 (403), :76,88,90 | — | none | — |

### Traffic (`server/traffic.js`) · 4

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| POST | `/api/t` | none (CSRF header + write limit); bots/previews/DNT skipped; 400 views/visitor/day | `server/traffic.js:143` | traffic :68-72 | — | none | No IP stored; daily-rotating visitor HMAC |
| POST | `/api/t/error` | none; 20/visitor/day | `server/traffic.js:144` | traffic :76 | — | none | DNT/GPC not honoured (`traffic.js:77`) |
| GET | `/api/admin/traffic` | admin; `days` ∈ 1\|7\|30\|90\|365 | `server/traffic.js:145` | traffic :82 (403), :83-92 | — | none | Reads ≤300,000 rows into memory |
| GET | `/api/admin/system` | admin | `server/traffic.js:146` | traffic :82 (403), :93-94 | — | none | `lastBackup` scans `dirname(DB_PATH)/../backups` |

## Endpoints outside the JSON router

### `server/app.js` (dispatch and static files)

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET/ANY | `/hire`, `/hire/` → 302 `/lite/hire` | none | `server/app.js:107` | lite :92 | — | none | `res.writeHead` bypasses `send()`: no security headers (probe) |
| ANY | `/pay/*` → `payments.handle` | per endpoint below | `server/app.js:109` | payments | — | — | Not under `/api`: no CSRF header, no API rate limiter |
| ANY | `/lite`, `/lite/*` → `lite()` | per Lite route below; Lite GETs counted by traffic (`:111`) | `server/app.js:110-112` | lite | — | — | `/lite/pow.js` is counted as a page view |
| ANY | `/api/*` → router; 405 for non-GET/HEAD elsewhere | router | `server/app.js:114-115` | api :260; security :176-179 | — | — | — |
| GET | `/assets/app.<hash>.js`, `/assets/app.<hash>.css`, `/assets/theme.<hash>.js` (immutable, gzipped); other `/assets/*` → 404 | none | `server/app.js:86-87,98` (built `server/assets.js:22-27`) | api :252-258 | — | none | `theme.js` asset untested |
| GET | `/fonts/[a-z0-9-]+.woff2` | none; regex path; 404 when missing | `server/app.js:88-90` | none (e2e :437, not run) | — | none | 30-day cache |
| GET | `/vendor/qrcode.js` | none | `server/app.js:92-94` | none (e2e :386-391, not run) | — | none | Gzipped once; MIT header in file |
| GET | `/favicon.svg` | none | `server/app.js:96` | none | — | none | fill `#0D5C3A` (not a token) |
| GET | `/robots.txt` | none | `server/app.js:97` | none | — | none | `User-agent: *` / `Allow: /` |
| GET | `/` and any other path → `index.html` shell | none; link previews counted (`:99`) | `server/app.js:99-100` | api :243-262 | — | none | `cache-control: no-cache` |

### `server/payments.js` (`handle()` at :98)

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/pay/return?p=<id>` → 303 `/#/company/plan/paid/<id>` | none | `server/payments.js:100-102` | payments :86-87 | — | none | Display-only; `writeHead` bypasses security headers |
| POST | `/pay/callback/:provider` | provider must match `cfg`; `verify()` signature (constant time); payment by `provider_ref`; amount and currency match; applied once; body ≤ 64 KB | `server/payments.js:104-106` (settle :81-93) | payments :107,111-112,115-117 | — | `plan.card_paid` `payments.js:65` on a verified paid result; failed/cancelled results: UNVERIFIED whether audited | Outside the API rate limiter |
| GET | `/pay/test/:session` (32 hex) | only when provider is `test` (never in production, `config.js:76`); 404 for unknown session | `server/payments.js:108,117-120` | payments :83 | — | none | English-only page with hex colours (dev only) |
| POST | `/pay/test/:session` | test provider only; `result=paid\|cancelled` self-signed → `settle()` → 303 `/pay/return` | `server/payments.js:111-115` | payments :67 (helper), :86,94,97 | — | via `settle()` → `plan.card_paid` on paid | — |
| ANY | other `/pay/*` → 404 | none | `server/payments.js:122` | none | — | none | — |

### `server/lite.js` (route table `ROUTES` at :601-610; dispatcher :620-660)

All Lite POSTs require the signed per-browser token (`lt` cookie + `csrf` field, `lite.js:645-648`), refuse cross-site requests (`:645`), and share the API's `a:`/`w:` rate limits (`:637,643`). Handlers call the JSON routes in-process (`call()`, `:120-127`), so the JSON route's guard and audit apply. Lite's own gate is listed; "via API" names the in-process route.

| Method | Path | Guard | File:line | Tests that hit it | Matrix | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/lite` | none; employers redirected to `/lite/hire` | `server/lite.js:602` (jobsPage :161) | lite :72-87,120,125-126,179-181; traffic :75 | — | none | 12 per page; pages 1–50 |
| GET | `/lite/job/:id` | none; employers redirected | `server/lite.js:602` (jobPage :191) | lite :84; contact :82 | — | none | — |
| POST | `/lite/job/:id/apply` | seeker with profile; via `POST /api/jobs/:id/apply` | `server/lite.js:602` (applyPost :218) | lite :121 | — | via API `application.created` | WhatsApp/call/email branches untested |
| POST | `/lite/job/:id/save` | seeker; via `POST`/`DELETE /api/me/saved/:jobId` | `server/lite.js:602` (savePost :211) | lite :124 | — | none | — |
| GET | `/lite/applications` | seeker (guest → gate; other roles → `/lite`); via `GET /api/me/applications` | `server/lite.js:603` (appsPage :244) | lite :89-90,123 | — | none | — |
| GET | `/lite/recruiters` | seeker; via `GET /api/me/invitations` | `server/lite.js:603` (recruitersPage :254) | lite :128 | — | none (invitations marked seen) | No block action |
| GET | `/lite/resume` (`?cv=en\|ar`) | seeker | `server/lite.js:603` (resumePage :287) | lite :132-135 | — | none | Loads `/lite/p.<hash>.js` |
| GET | `/lite/me` | signed in (gate); employer → `/lite/hire`; university/admin get a note | `server/lite.js:604` (mePage :316) | lite :103,118,137,186 | — | none | — |
| GET | `/lite/profile?step=1-5` | seeker | `server/lite.js:604` (profilePage :403) | lite :112,114,174-175 | — | none | Education dropdown shows raw `edu_student` (D-04) |
| POST | `/lite/profile` | seeker; via `PUT /api/me/profile` | `server/lite.js:604` (profilePost :410) | lite :107-108,113,115,176 | — | none | — |
| POST | `/lite/profile/exp` | seeker; via `PUT /api/me/profile` | `server/lite.js:604` (expPost :424) | lite :109,111 | — | none | Edit path untested |
| POST | `/lite/profile/exp/delete` | seeker; via `PUT /api/me/profile` | `server/lite.js:604` (expDelete :438) | **none** | — | none | — |
| POST | `/lite/alerts` | seeker; via `POST /api/me/alerts` | `server/lite.js:605` (alertPost :388) | lite :182 | — | via API `alert.created` | Channel chosen by the server (email if profile has one, else sms) |
| POST | `/lite/alerts/:id/delete` | seeker; via `DELETE /api/me/alerts/:id` | `server/lite.js:605` (alertDelete :397) | lite :188 | — | none | — |
| POST | `/lite/invite/:id` | signed in; via `POST /api/me/invitations/:id/respond` | `server/lite.js:606` (invitePost :272) | lite :130 | — | via API `invitation.accepted/declined` | — |
| POST | `/lite/recruit` | signed in; via `PUT /api/me/recruit` | `server/lite.js:606` (recruitPost :282) | lite :104-105 (403 cases), :119 | — | via API `recruit.opened/closed` | — |
| GET | `/lite/signin` | none; signed-in users redirected | `server/lite.js:607` (signinPage :453) | lite :48 (helper), :93-95 | — | none | Loads `/lite/pow.js`; D-23 (`pattern="[0-9]{6}"`); D-24 (one PoW challenge per GET) |
| POST | `/lite/signin` | none; consent box required (:462); via `POST /api/auth/code` | `server/lite.js:607` (signinPost :459) | lite :49 (helper used at :102,145,166,173) | — | none | No-JS form with `OTP_POW_BITS>0` → `pow_required` (probe) |
| POST | `/lite/signin/code` | none; via `POST /api/auth/verify` with `accept:true` always (:475) | `server/lite.js:607` (codePost :472) | lite :52 (helper) | — | via API `user.created`, `terms.accepted` | Consent tick not carried to this step |
| POST | `/lite/signout` | form token only; via `POST /api/auth/logout` | `server/lite.js:607` (signoutPost :484) | lite :136 | — | none | — |
| GET | `/lite/hire` | none; content by role | `server/lite.js:608` (hirePage :487) | lite :144,151,167 | — | none | `suspended` shows the pending text |
| GET | `/lite/hire/company` | employer (employerGate :519-525); via `GET /api/employer` | `server/lite.js:608` (companyPage :526) | lite :146 | — | none | — |
| POST | `/lite/hire/company` | employer; via `PUT /api/employer/company` (+ `POST …/submit` when `submit=1`) | `server/lite.js:608` (companyPost :527) | lite :148 | — | via API `company.created/updated/submitted` | `company_exists` is a dead end in Lite |
| GET | `/lite/candidates` | verified employer (employerGate(ctx, true)); via `GET /api/employer/students` | `server/lite.js:609` (candidatesPage :538) | lite :154,157,168 | — | none | — |
| GET | `/lite/candidates/sent` | verified employer; via `GET /api/employer/invitations` | `server/lite.js:609` (sentPage :583) | lite :164 | — | none | D-03 applies (no role check in the API) |
| GET | `/lite/candidates/:id/invite` | verified employer; candidate must be in the first 60 unfiltered rows (:568) | `server/lite.js:609` (invitePage :569) | lite :159 | — | none | 404 for a candidate found only through a filter (probe) |
| POST | `/lite/candidates/:id/invite` | verified employer; via `POST /api/employer/students/:id/invite` | `server/lite.js:610` (inviteSend :575) | lite :160,162 | — | via API `invitation.sent` | — |
| POST | `/lite/invitations/:id/withdraw` | verified employer; via `POST /api/employer/invitations/:id/withdraw` | `server/lite.js:610` (withdrawPost :594) | **none** | — | via API `invitation.withdrawn` | — |
| GET | `/lite/pow.js` | none; `cache-control: public, max-age=86400` (not fingerprinted) | `server/lite.js:623` | lite :91 | — | none | Counted as a page view |
| GET | `/lite/s.<hash>.css` | none; immutable | `server/lite.js:624` (hash `lite-assets.js:4`) | lite :77-79 | — | none | — |
| GET | `/lite/i.<hash>.svg` | none; immutable | `server/lite.js:625` (hash `lite-assets.js:6`) | lite :77-79 | — | none | — |
| GET | `/lite/p.<hash>.js` | none; immutable | `server/lite.js:626` (hash `lite-assets.js:8`) | **none** (only the tag is checked, lite :135) | — | none | One-line "Save as PDF" script |
| ANY | other `/lite/*` → 404 page (HEAD falls back to the GET route) | none | `server/lite.js:638-639` | lite :88 | — | none | — |

## Counts

| What | Count | Detail |
|---|---|---|
| JSON routes registered | **109** | routes/* 99 + `server/traffic.js` 4 + `server/alerts.js` 5 + `server/demo.js` 1 |
| In the junk-input matrix (test 3) | **34** distinct routes (35 entries; `GET /api/admin/audit` twice) | `test/security.test.js:152-160` |
| Asserted in the cross-role/IDOR test (test 2) | **19** routes, 7 of them not in test 3 (`GET /api/jobs`, `GET /api/employer`, `GET /api/admin/overview`, `GET /api/me/applications`, `GET /api/me/export`, `POST …/jobs/:id/close`, `POST …/jobs/:id/reopen`) | `test/security.test.js:114-139` |
| Touched by test 2 or 3 | **41** | — |
| In neither test 2 nor 3 | **68** | listed below by family |
| Non-router endpoints | `/hire` 1 · static 6 patterns · `/pay/*` 4 (+404) · Lite 28 routes + 4 shared files (+404) | none of them can be in the matrix (it lists JSON routes only) |
| State-changing JSON routes with no audit write | **16** | listed below; privileged ones flagged |

### Routes in neither test 2 nor 3 (68), by family

| Family | Routes |
|---|---|
| Sign-in and public (6) | `POST /api/auth/logout`, `GET /api/health`, `GET /api/config`, `POST /api/auth/demo`, `GET /api/me`, `DELETE /api/me` |
| Job alerts (5) | `GET/POST /api/me/alerts`, `PUT/DELETE /api/me/alerts/:id`, `POST /api/me/alerts/seen` |
| Employer company (1) | `POST /api/employer/company/submit` |
| Employer plans and payments (7) | `GET /api/employer/plan`, `POST /api/employer/plan/request`, `POST /api/employer/jobs/:id/sponsor`, `GET /api/employer/analytics`, `GET /api/employer/reports/:kind`, `POST /api/employer/plan/checkout`, `GET /api/employer/payments/:id` |
| Teams (11) | `GET/POST /api/employer/team`, `POST /api/employer/team/requests/:phone`, `PUT/DELETE /api/employer/team/:phone`, `POST /api/employer/team/leave`, `POST /api/employer/team/transfer`, `POST /api/employer/membership/:answer`, `GET /api/employer/companies/search`, `POST /api/employer/companies/:id/join`, `GET /api/employer/activity` |
| Universities (13) | `POST/DELETE /api/me/verify-student`, `POST /api/me/verify-student/confirm`, `GET /api/campus`, `POST /api/campus/domains`, `DELETE /api/campus/domains/:domain`, `POST /api/admin/campus/domains`, `DELETE /api/admin/campus/domains/:uni/:domain`, `POST /api/campus/partners/:companyId`, `POST /api/employer/partners`, `GET/POST /api/admin/campus`, `DELETE /api/admin/campus/:userId` |
| Events (14) | `GET /api/events`, `GET /api/events/:id`, `POST/DELETE /api/events/:id/rsvp`, `GET /api/me/events`, `GET/POST /api/organize/events`, `GET/PUT /api/organize/events/:id`, `POST /api/organize/events/:id/companies`, `POST /api/organize/events/:id/checkin`, `GET /api/organize/events/:id/report`, `GET /api/employer/events`, `POST /api/employer/events/:id/attend` |
| Admin (7) | `POST /api/admin/companies/:id/suspend`, `GET /api/admin/jobs`, `GET /api/admin/billing`, `POST /api/admin/companies/:id/plan`, `POST /api/admin/charges/:id/:what`, `POST /api/admin/programmes`, `GET /api/admin/insights` |
| Traffic (4) | `POST /api/t`, `POST /api/t/error`, `GET /api/admin/traffic`, `GET /api/admin/system` |

Routes with **no test at all** (any file): `PUT /api/me/alerts/:id`, `PUT /api/employer/team/:phone`, `DELETE /api/me/verify-student`, `DELETE /api/campus/domains/:domain`, `DELETE /api/admin/campus/domains/:uni/:domain`, `GET /api/admin/campus`, `DELETE /api/admin/campus/:userId`, `POST /api/admin/companies/:id/suspend` (8 JSON routes); Lite: `POST /lite/profile/exp/delete`, `POST /lite/invitations/:id/withdraw`, `GET /lite/p.<hash>.js`; static: `/fonts/*`, `/vendor/qrcode.js`, `/favicon.svg`, `/robots.txt`.

### State-changing JSON routes with no audit write

| Route | Privileged? | Notes |
|---|---|---|
| `POST /api/auth/code` | no | writes `otps`, bumps caps |
| `POST /api/auth/logout` | no | deletes the session |
| `PUT /api/me/lang` | no | — |
| `PUT /api/me/profile` | **flag** | writes the consent-like recruit opt-in (`recruit.open`) with no `recruit.opened/closed` row, unlike `PUT /api/me/recruit` (`validate.js:59`; probe C0-C3) |
| `POST /api/me/saved/:jobId`, `DELETE /api/me/saved/:jobId` | no | — |
| `PUT /api/me/alerts/:id`, `DELETE /api/me/alerts/:id`, `POST /api/me/alerts/seen` | no | create is audited; change/delete are not |
| `DELETE /api/events/:id/rsvp` | no | RSVP is audited, cancellation is not |
| `POST /api/t`, `POST /api/t/error` | no | beacons |
| `POST /api/auth/demo` | no (dev only) | session only |
| `POST /api/employer/jobs/:id/sponsor` with `on:false` | **flag** | privileged (manage role, money-related); returns before the audit call (`employer.js:186` vs `:191`) — D-28; SECURITY.md:388 says every sponsorship change is logged |
| `PUT /api/employer/applications/:id` note-only | **flag** | employer action on an applicant's record with no row (`employer.js:155`); README.md:199 says employer actions are recorded |
| `POST /api/jobs/:id/apply` re-apply branch | no | second application after a withdrawal (`me.js:65-67`) writes nothing; first does |
| `GET /api/me/invitations` | no | not a write route, but has the side effect `sent → seen` (`recruit.js:166`) |

Partially audited: `POST /api/admin/applications/:id/confirm-hire` writes `hire.confirmed` but the `hire_fee`/`placement` charge rows it creates (`admin.js:118,124`) have no entry of their own; `POST /pay/callback/:provider` writes `plan.card_paid` only for a verified paid result (failed/cancelled: UNVERIFIED).
