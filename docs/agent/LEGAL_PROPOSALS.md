# LEGAL_PROPOSALS · proposed changes to the privacy notice and terms (R9, R13)

Agents never edit the wording in `public/js/legal.js`. Each proposal below is for the owner and a lawyer to accept, change or reject. Once accepted, the change is a four-file change (R13): `public/js/legal.js`, `server/retention.js` where a period changes, `TERMS_VERSION` in `server/config.js`, and `SECURITY.md`, in one commit, with the Arabic logged in `docs/agent/ARABIC_REVIEW.md`. The Arabic drafts here are the agent's; they need a native reviewer as well as the lawyer.

Found in Stage 0 (2026-10-05). The notice's structure: `public/js/legal.js:6-100` English, `:101-191` Arabic.

## LP-1 · The cookie sentence is not true for Shaghilni Lite

| Field | Content |
|---|---|
| Where | `public/js/legal.js:26` (English), `:118` (Arabic), privacy notice, "What we collect" |
| Current English | "We don't use advertising or tracking cookies. The only cookie keeps you signed in." |
| Current Arabic | «لا نستخدم ملفات تعريف الارتباط (الكوكيز) للإعلانات أو التتبع. الملف الوحيد الذي نستخدمه يُبقيك مسجّلاً الدخول.» |
| Why | Shaghilni Lite sets a form-protection cookie `lt` on every visit (HttpOnly, one year, a random token that signs its forms; no personal data) and, when a language is chosen with `?lang=`, a language cookie `ll` (`server/lite.js:630,632`). The full app sets only the session cookie. SECURITY.md item 1 now says so; the notice does not. |
| Proposed English | "We don't use advertising or tracking cookies. The full app uses one cookie, which keeps you signed in. Shaghilni Lite also sets a cookie that protects its forms against forgery (it holds no personal data) and, if you choose a language, one that remembers it." |
| Proposed Arabic (draft) | «لا نستخدم ملفات تعريف الارتباط (الكوكيز) للإعلانات أو التتبع. يستخدم التطبيق الكامل ملفاً واحداً يُبقيك مسجّلاً الدخول. وتستخدم نسخة شغّلني الخفيفة أيضاً ملفاً يحمي نماذجها من التزوير (لا يحوي أي بيانات شخصية)، وملفاً يتذكّر اللغة إذا اخترتها.» |
| Alternative | None in code: the form-protection cookie is Lite's defence against forged posts (SECURITY.md item 2) and cannot be dropped. |
| Impact | `TERMS_VERSION` bump; SECURITY.md item 1 already describes the cookies. |

## LP-2 · The visit-count bullet omits two stored fields

| Field | Content |
|---|---|
| Where | `public/js/legal.js:20` (English), `:112` (Arabic), privacy notice, "What we collect" |
| Current English (excerpt) | "…our own server counts which page it was (never what you type), the link that brought you, your type of device, browser, language, connection speed and how long the page took to load. We don't use tracking cookies or third-party trackers, and we don't store your IP address…" |
| Why | Each page view also stores whether the visitor was signed in and as which kind of account (seeker, employer, career office, admin), and the connection's country when the site runs behind a network that sends `CF-IPCountry` (`server/traffic.js:43,59`; `server/db.js:345-346`). Both are reported only as totals (`GET /api/admin/traffic`). |
| Proposed English (insert after "how long the page took to load") | "…, whether you were signed in and with what kind of account, and the country your connection came from when the site runs behind a content-delivery network, …" |
| Proposed Arabic (draft, insert after «والمدة التي استغرقها تحميل الصفحة») | «، وما إذا كنت مسجّل الدخول ونوع حسابك، والبلد الذي جاء منه اتصالك عندما يعمل الموقع خلف شبكة توزيع محتوى» |
| Alternative | Stop storing the role and the country (`server/traffic.js`), which loses the visit-to-hire funnel by account type and the country breakdown. A product decision for the owner. |
| Impact | `TERMS_VERSION` bump; SECURITY.md "Traffic counting" unchanged (it already says what is counted in general terms; add the two fields if the lawyer prefers). |

## LP-3 · "Deleted within 24 hours" versus an hourly sweep

| Field | Content |
|---|---|
| Where | `public/js/legal.js:52` (English), `:144` (Arabic), "How long we keep it" |
| Current English | "Sign-in codes and the internet addresses stored with them: deleted within 24 hours." |
| Current Arabic | «رموز الدخول وعناوين الإنترنت المحفوظة معها: تُحذف خلال 24 ساعة.» |
| Why | `server/retention.js:5,10` deletes codes older than 24 hours, and the sweep runs at start-up and then every hour (`server/index.js:13`), so a code can live up to about 25 hours. |
| Recommended fix (code, no wording change) | Set `RETENTION.otpHours` to 23 in `server/retention.js`, so every code is gone within the 24 hours the notice promises. Update SECURITY.md item 1 ("after 24 hours" becomes "after 23 hours, always within the 24 the notice promises"). Codes themselves expire after 10 minutes, so nothing functional changes. No `TERMS_VERSION` bump. Scheduled for Stage 3 if the owner agrees. |
| Alternative (wording) | "deleted after 24 hours (the deletion runs every hour, so within 25 hours at most)" / «تُحذف بعد 24 ساعة (يجري الحذف كل ساعة، فلا تتجاوز 25 ساعة)» with a `TERMS_VERSION` bump. |

## Not proposals, but for the lawyer's list

- The notice says the company page's contact details are removed when an employer deletes their account; the code clears the contact name and WhatsApp number but not the application phone number and email (`server/routes/me.js:159-160`; `docs/agent/DEFECTS.md`). The fix is in code (Stage 3), not in the wording.
- Email verification codes, which hold the typed university address, are never swept (`docs/agent/DEFECTS.md`). The fix is a retention rule (code) plus a line in "How long we keep it".
- Lite's consent box links to pages that need JavaScript (D-12). Stage 3 adds server-rendered copies of the same wording; no wording change.
- A governing-law clause: the owner's decision D6 (`docs/agent/QUESTIONS.md`).
