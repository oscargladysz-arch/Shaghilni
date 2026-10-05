# QUESTIONS · owner decisions only (R20) · Stage 0 gate (2026-10-05)

Only decisions the brief reserves for the owner (`BRIEF.md:173-181`, D1–D7) plus one new decision Stage 0 surfaced that only the owner can make (Q8). Everything else was decided and recorded in `docs/agent/ASSUMPTIONS.md`. Each question: options, the facts that bear on it (file:line or a Stage 0 run), a recommendation, and what is blocked until it is answered ("nothing" unless something truly is). Most urgent first.

## Q8 · Push target for Stage 0 (new; blocks `GO 1`)

| Field | Content |
|---|---|
| Question | Which branch name should the Stage 0 work be pushed to, and when? |
| Options | (a) push `stage-0/ground-truth` (the brief's name) to origin; (b) push to the harness branch `claude/sharp-fermat-k8d0qs`, which already exists on origin; (c) no push: the owner pulls from this environment another way. |
| Facts | Local branch is `stage-0/ground-truth` with one commit `9683221` on top of `main` (`git log --oneline main..HEAD`); the synthesis files are still uncommitted at the time of writing (`git status --short` → `?? docs/agent/{DEFECTS,DOC_DRIFT,ROUTES,STATE}.md`) and will be committed at the gate. `claude/sharp-fermat-k8d0qs` exists locally and on origin and is identical to `main` (`git branch -a`; `BASELINE.md:82`). R18: never push unless told (`BRIEF.md:39`). The brief says the owner merges each stage into `main` before the next `GO`; if `main` does not contain the previous stage the next stage must stop (`BRIEF.md:236`). |
| Recommendation | (a): push `stage-0/ground-truth` once the gate commit exists; keep the harness branch untouched. |
| Blocked until answered | **`GO 1`** (Stage 1 cannot start until `main` contains Stage 0, which needs a push or an equivalent hand-over). Nothing else. |

## D1 · Sample data (17 companies / 19 listings under real organisations' names)

| Field | Content |
|---|---|
| Question | (i) Remove the sample data before launch, or replace the real names with fictional ones so the development demo and screenshots stay usable? (ii) May a staging server that runs with `NODE_ENV=production` ever show sample data? |
| Options (i) | **Remove**: delete or empty `seed/demo.json`; development loses the 19 listings; `npm run demo:remove` stays for old databases. **Replace** (backlog P2-5): rewrite the 17 company names, the 19 invented named employees, and `server/demo.js:87,151`; development demo and screenshots keep working. **Keep as is, gated**: P0-1's gate alone; real names remain in development and in any staging run that is not `NODE_ENV=production`. |
| Options (ii) | **Never** (P0-1's gate as planned: `seedDemo` is false whenever `NODE_ENV=production`). **Only after Replace**, via an explicit second opt-in variable that is logged at start and that the scanner warns about; never the default. **Yes, now** (would mean weakening P0-1: not recommended). |
| Facts | `seed/demo.json` holds 17 companies and 19 jobs; names include Chevron, ConocoPhillips, Deloitte, Al Jazeera, Syriatel, UNDP Syria, Syrian Arab Red Crescent, Bank of Syria and Overseas, Latakia University (`node -e` count in this session; `BASELINE.md:68`). Every listing names an invented employee with title and recruiting claim at the real organisation, served to guests via `GET /api/jobs` (D-15, `server/seed.js:22`, `server/serialize.js:23`, `public/js/app.js:271,359`). One listing has `pay: null` and is published as "Unpaid" (D-02, `seed/demo.json` jobs[15]). Seeding also rewrites real multinational employers' listings to `returnees:true` on every start (D-13, `server/seed.js:34-38`). Companies are inserted as `verified` with `screened_at` nobody set (`server/seed.js:17`). **Dockerfile seeding fact:** `Dockerfile:3` `ENV NODE_ENV=production …`, `Dockerfile:8` `COPY seed ./seed`, no `SEED_DEMO`; `.dockerignore` has no `seed` line; `server/config.js:68` `seedDemo: e.SEED_DEMO !== "false"` has no production check; `server/index.js:10` `if (cfg.seedDemo) seedDemo(db)`; so a fresh container seeds 17 "verified" real-name companies on first start (D-01 run: `[seed] 17 demo companies and 19 demo jobs added` … `(production, …)`, `DEFECTS.md:70`). The scanner only WARNs (`scripts/security-check.js:93`). PRODUCT.md:83 says the sample listings must be removed before launch; `README.md:154` says "decide whether to keep" (`DOC_DRIFT.md:35`). Demo accounts (`server/demo.js`) are already blocked in production (`server/demo.js:17`) and also name a real organisation and a real hotel (`demo.js:87,151`). **Interaction with P0-1:** the planned gate is `seedDemo: !prod && e.SEED_DEMO !== "false"` (`DEFECTS.md` D-01 "Minimal fix"); `prod` is `NODE_ENV === "production"` (`server/config.js:30-31`). A staging server as the brief defines it (also `NODE_ENV=production`) therefore never seeds, whatever (ii) decides, unless a later additive opt-in is built. P0-1 does not edit `seed/demo.json` (`BRIEF.md:190`). |
| Recommendation | (i) **Replace** (P2-5) after launch integrity ships, so the development demo, the Lite demo hint and the screenshots stay usable without naming real organisations; until then the P0-1 hard gate keeps the set out of production and Stage 3 strips the invented employees at insert (`ASSUMPTIONS.md` A-15). (ii) **Never**, until Replace is done; then, only if staging truly needs listings, an explicit logged opt-in. Reason: R6 and R8 ("every employer checked") are both false the moment a real-name "verified" company appears anywhere a third party can see it. |
| Blocked until answered | P2-5 only, and the Stage 3 default for D-15 (strip `contact` at insert, A-15). P0-1, D-02 and D-13 proceed regardless. |

## D2 · Real plan prices

| Field | Content |
|---|---|
| Question | What are the Pro and Enterprise prices for manual billing (`PLAN_PRO_PRICE`, `PLAN_ENTERPRISE_PRICE`) and for card payments (`PLAN_PRO_MONTHLY`, `PLAN_ENTERPRISE_MONTHLY`)? |
| Options | Set all four before launch; set the two free-text prices only (card stays off); leave unset ("Contact us for pricing"). |
| Facts | `PLAN_PRO_PRICE`/`PLAN_ENTERPRISE_PRICE` are single free-text strings shown verbatim in both UI languages (`server/config.js:57`; `server/plans.js:42`; `public/js/app-plans.js:43`; U-122 UNVERIFIED by a verifier, code cited). When unset and card payments are off the page says "Contact us for pricing" (`public/js/i18n4.js:618/1604`). With a card provider set, production refuses to start unless both monthly prices are set (`server/config.js:77`; `test/payments.test.js:120-123`). Charges are shown in SYP only; a USD card receipt shows "—" (U-024, UNVERIFIED). No price exists anywhere in the repo (R6). |
| Recommendation | Decide the two free-text prices (one Arabic-friendly string, e.g. amount + "SYP a month") before launch and leave card prices for D4. |
| Blocked until answered | Nothing in code. A `docs/LAUNCH.md` row (owner). |

## D3 · SMS provider for Syrian networks (`textbee` vs `twilio`)

| Field | Content |
|---|---|
| Question | Which provider delivers reliably to Syrian mobile networks, and which `SMS_ALLOWED_PREFIXES` list should production use? |
| Options | `textbee` (Android-phone gateway, `TEXTBEE_API_KEY`); `twilio`; test both on real Syrian numbers first (P3). |
| Facts | Providers are `console | textbee | twilio` (`server/sms.js:3-26`); `console` prints the full number and code and is the default even in production, where the lockdown only warns and the scanner FAILs it (`server/config.js:44,79`; `STATE.md` area 1). Default allow-list is Syria plus 19 diaspora codes (`server/config.js:49`); the shipped `.env.example:30` narrows it to `+963` (D-18, fixed in Stage 1). Daily caps: 1,000 site, 150 international (`server/config.js:59,50`). Arabic texts are UCS-2: 12 of 15 notification templates run to two segments with realistic names (U-005, UNVERIFIED); the sign-in text fits one (`DEFECTS.md` area 1 checked-ok). Twilio geographic permissions must cover every country in the allow-list, not Syria only (`DOC_DRIFT.md:104`). |
| Recommendation | Cannot be decided from code. Run the P3 test on Syrian networks with both providers before choosing; keep the diaspora default unless cost forces a narrower list. |
| Blocked until answered | Nothing in code. Launch (`docs/LAUNCH.md` row, owner + provider). |

## D4 · Syrian entity / local partner, SYP collection, QNB developer documents

| Field | Content |
|---|---|
| Question | Which legal entity receives Syrian pounds and issues invoices, what goes into `LEGAL_NAME`, and when can QNB Syria's developer documents and sandbox credentials be supplied? |
| Options | Name the entity and set `LEGAL_NAME`; keep manual billing only (wallet, bank transfer, cash) and leave cards off; supply QNB documents → `GO P2-4`. |
| Facts | QNB adapter is not written: `server/payments.js:33-47` `ready = false`, `createSession()`/`verify()` TODO (`BASELINE.md:72`). `settle()` calls `verify()` synchronously (`payments.js:83-84`); an async verify would break every callback (U-129, UNVERIFIED) — the Stage 2 contract doc records this. `LEGAL_NAME` is a setting shown in the notice and terms (`server/config.js:66`); unset, the documents say "Shaghilni" (`scripts/security-check.js:90`). User-visible copy and README say invoices come from "our US company" (`public/js/i18n4.js:584/1570`; `README.md:293`) while the brief says no entity exists (R6; `DOC_DRIFT.md:168`). Stage 1 rewrites the README line; Stage 3 (S3-13) the UI strings. |
| Recommendation | Launch with manual billing only (already built and tested, `test/plans.test.js`), set `LEGAL_NAME` to the real registered name once it exists, and schedule P2-4 only when QNB's documents are in hand. Never guess the protocol (brief P2-4). |
| Blocked until answered | P2-4 only. |

## D5 · Branch protection and review flow for `main`

| Field | Content |
|---|---|
| Question | What protection should `main` carry, and who merges stage branches? |
| Options | Require the P0-2 CI to pass plus one review before merge; CI only; none. |
| Facts | No `.github/` directory today (`BASELINE.md:71`), so no CI and no protection rules can exist yet; P0-2 adds the workflow (PR + push to `main`, Node 22.13.0 / 22 / 24). Agents never commit to `main`, never push or open PRs unless told (R18). The brief has the owner merge each stage into `main` (`BRIEF.md:236`). |
| Recommendation | Require the CI check green and one review (the owner) on `main`; disallow force-push; the owner merges each stage branch after its gate. |
| Blocked until answered | Nothing. P0-2 proceeds; the owner applies the rules on GitHub after the first green run. |

## D6 · Lawyer review of `public/js/legal.js`; named person responsible for personal data

| Field | Content |
|---|---|
| Question | Who reviews the privacy notice and terms under Syrian law (including a governing-law clause), and who is the named person responsible for personal data? |
| Options | Lawyer review before launch (P3); review after launch with a `TERMS_VERSION` bump; no review (not recommended). |
| Facts | Both documents exist in both languages (`public/js/legal.js:6-191`), shown at `/#/privacy` and `/#/terms` (`public/js/boot.js:199`; `public/js/app.js:135`), consent recorded with `TERMS_VERSION = "2026-10-04"` (`server/config.js:22`; `server/auth.js:89-104`). Whether a governing-law clause exists in `legal.js`: UNVERIFIED (not read by this writer). Stage 0 found three places where the notice and the code disagree, to be written up as proposals, never edited by agents (R9): "the only cookie keeps you signed in" (`legal.js:26/118`) while Lite sets `lt` and `ll` cookies (`server/lite.js:630,632`); the visit-count bullet (`legal.js:20`) omits stored country and role (`server/traffic.js:43,59`; `server/db.js:345-346`); "deleted within 24 hours" (`legal.js:52/144`) versus an hourly sweep after 24 h, so up to ~25 h (`server/retention.js:10`; `server/index.js:13`). A privacy change is a four-file change (R13): `legal.js`, `server/retention.js`, `TERMS_VERSION`, `SECURITY.md`. Lite users cannot open the text they consent to until P1-2 ships (D-12). Re-acceptance of a newer `TERMS_VERSION` is never prompted while signed in (`STATE.md` area 1; U-065). |
| Recommendation | Lawyer review before launch, with `docs/agent/LEGAL_PROPOSALS.md` (created in Stage 1) as the agenda; name the data-protection person in `CONTACT_EMAIL`'s mailbox owner and in `docs/LAUNCH.md`. |
| Blocked until answered | Nothing in code: P1-2 renders the current wording verbatim; agents only propose. Launch. |

## D7 · Telegram alerts, public resume links, Lite pages for events

| Field | Content |
|---|---|
| Question | Are any of these wanted at all? |
| Options | None for launch (design notes only, P2-3); one or more → scoped `GO P2-3` then a later stage; drop them from the docs. |
| Facts | All three are absent (`STATE.md` "Confirmed absent": no `telegram` in code; no resume-link route, only a dead `cv: "shaghilni.sy/cv/" + slug` string at `public/js/engine.js:177` (D-20); Lite route table `server/lite.js:601-611` has no events page). README lists them as not built (`README.md:245-254`). `GET /api/me/events` exists with no client screen (`server/routes/events.js:81-82`). Public resume links would need a consent model (brief P2-3 "consent!"). Lite pages for events would add weight to a 15 KB / ~3 KB budget (R11). Telegram would be a new outbound channel next to SMS and email with its own allow-list and caps (`server/guard.js`). |
| Recommendation | None for launch. Keep them in README's "Not built yet" (Stage 1 corrects that list, `DOC_DRIFT.md:52`) and write the P2-3 design notes only on `GO P2-3`. |
| Blocked until answered | Nothing. P2-3's scope only. |
