# LEGAL_PROPOSALS · proposed changes to the privacy notice and terms (R9, R13)

Agents never edit the wording in `public/js/legal.js`. Each proposal below is for the owner and a lawyer to accept, change or reject. Once accepted, the change is a four-file change (R13): `public/js/legal.js`, `server/retention.js` where a period changes, `TERMS_VERSION` in `server/config.js`, and `SECURITY.md`, in one commit, with the Arabic logged in `docs/agent/ARABIC_REVIEW.md`. The Arabic drafts here are the agent's; they need a native reviewer as well as the lawyer.

Found in Stage 0 (2026-10-05); LP-4 and LP-5 added in Stage 4 (2026-10-06). LP-1 to LP-5 all wait for the owner and a lawyer; none is applied. The notice's structure: `public/js/legal.js:7-98` English, `:99-190` Arabic.

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
| Proposed Arabic (draft, insert after «والوقت الذي استغرقه تحميل الصفحة», the phrase at `public/js/legal.js:112`) | «، وما إذا كنت مسجّل الدخول ونوع حسابك، والبلد الذي جاء منه اتصالك عندما يعمل الموقع خلف شبكة توزيع محتوى» |
| Alternative | Stop storing the role and the country (`server/traffic.js`), which loses the visit-to-hire funnel by account type and the country breakdown. A product decision for the owner. |
| Impact | `TERMS_VERSION` bump; SECURITY.md "Traffic counting" unchanged (it already says what is counted in general terms; add the two fields if the lawyer prefers). |

## LP-3 · "Deleted within 24 hours" versus an hourly sweep

| Field | Content |
|---|---|
| Where | `public/js/legal.js:52` (English), `:144` (Arabic), "How long we keep it" |
| Current English | "Sign-in codes and the internet addresses stored with them: deleted within 24 hours." |
| Current Arabic | «رموز الدخول وعناوين الإنترنت المحفوظة معها: تُحذف خلال 24 ساعة.» |
| Why | `server/retention.js:5,10` deletes codes older than 24 hours, and the sweep runs at start-up and then every hour (`server/index.js:13-14`), so a code can live up to about 25 hours. |
| Recommended fix (code, no wording change) | Set `RETENTION.otpHours` to 23 in `server/retention.js`, so every code is gone within the 24 hours the notice promises. Update SECURITY.md item 1 ("after 24 hours" becomes "after 23 hours, always within the 24 the notice promises"). Codes themselves expire after 10 minutes, so nothing functional changes. No `TERMS_VERSION` bump. Scheduled for Stage 3 if the owner agrees. |
| Alternative (wording) | "deleted after 24 hours (the deletion runs every hour, so within 25 hours at most)" / «تُحذف بعد 24 ساعة (يجري الحذف كل ساعة، فلا تتجاوز 25 ساعة)» with a `TERMS_VERSION` bump. |

## LP-4 · The profile bullet omits the email address employers receive (Stage 4, security re-review finding D-55)

| Field | Content |
|---|---|
| Where | `public/js/legal.js:14` (English), `:106` (Arabic), privacy notice, "What we collect" |
| Current English | "If you look for work: the profile you write, in one or both languages (name, governorate, languages, education, experience, skills, certificates and job preferences), the jobs you save, and your applications and their status." |
| Current Arabic | «إن كنت تبحث عن عمل: الملف الذي تكتبه بلغة واحدة أو باللغتين (الاسم والمحافظة واللغات والتعليم والخبرات والمهارات والشهادات وتفضيلات العمل)، والوظائف التي تحفظها، وطلباتك وحالتها.» |
| Why | The profile also holds an email address if the person gives one (`server/validate.js` sanitizeProfile), asked for in the full app's wizard and in Lite; it is copied into the snapshot every employer the person applies to receives. The "Who can see" bullet speaks of "profile, phone number and resume", and only the job-alerts bullet mentions an email. |
| Proposed English | "…(name, email address if you give one, governorate, languages, education, experience, skills, certificates and job preferences)…" |
| Proposed Arabic (draft) | «…(الاسم والبريد الإلكتروني إن أضفته والمحافظة واللغات والتعليم والخبرات والمهارات والشهادات وتفضيلات العمل)…» |
| Alternative | Leave the email out of the snapshot sent to employers (`server/routes/me.js` apply), which changes what employers see: a product decision. |
| Impact | `TERMS_VERSION` bump. |

## LP-5 · "How long we keep it" does not list university email codes (Stage 4, U-035)

| Field | Content |
|---|---|
| Where | `public/js/legal.js:52` (English), `:144` (Arabic), "How long we keep it" |
| Current English | "Sign-in codes and the internet addresses stored with them: deleted within 24 hours." |
| Why | Since Stage 4 the hourly sweep also deletes university email codes, with the address typed for them, after 24 hours, and clears the address of a withdrawn student verification (`server/retention.js`, A-47). The notice already says the verified address is kept only so it verifies one account, so this keeps less than promised; the line simply does not say so. |
| Proposed English | "Sign-in codes and the internet addresses stored with them, and university email codes with the address typed for them: deleted within 24 hours." |
| Proposed Arabic (draft) | «رموز الدخول وعناوين الإنترنت المحفوظة معها، ورموز التحقق من البريد الجامعي مع العنوان المكتوب لها: تُحذف خلال 24 ساعة.» |
| Impact | `TERMS_VERSION` bump if accepted; best taken together with LP-3, which concerns the same line. |

## Not proposals, but for the lawyer's list

- The notice says the company page's contact details are removed when an employer deletes their account; the code now clears the application phone number and email too (Stage 4, U-053). No wording change.
- Email verification codes, which hold the typed university address, are swept after 24 hours since Stage 4 (U-035); LP-5 proposes the matching line.
- Lite's consent box linked to pages that need JavaScript (D-12); Stage 3 added server-rendered copies of the same wording at `/lite/privacy` and `/lite/terms`. No wording change.
- A governing-law clause: the owner's decision D6 (`docs/agent/QUESTIONS.md`).
