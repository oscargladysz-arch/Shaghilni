# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Job seekers come first, all of them equally.** When a decision has to favour one group, it favours job seekers, and no group of job seekers is favoured over another:

- university students looking for internships and first jobs;
- graduates and workers looking for full-time, part-time and shift work across Syria's governorates;
- Syrians abroad, looking at work in Syria or thinking about coming home.

They mostly use cheap Android phones, often on slow or expensive mobile data, and sign in with their mobile number. Many have no resume and no network; students often have no work history at all. Their job: find work that's real, see what it pays, apply quickly, and know what happened to each application.

**Employers** (Syrian businesses, organisations and NGOs, and international companies entering Syria) post jobs, manage applicants, search for candidates who chose to be found, run internship programmes, attend events, and record hires. Companies entering Syria and NGOs are the paying core; Syrian small businesses are not expected to pay much.

**University career offices** list their student email domains (students then verify themselves by email), approve employer partners, see how their students are doing, and run campus events.

**The Shaghilni team** verifies every company (including sanctions screening), reviews every listing, confirms hires, handles billing by hand, and organises events with business councils.

## Product Purpose

Shaghilni (Arabic for "employ me", شغّلني) is a verified job and internship platform for Syria. It exists because hiring in Syria runs largely on Facebook groups, Instagram and WhatsApp, where employers are unchecked, pay is rarely shown, applications vanish, and connections (wasta) decide too much.

Success means confirmed hires: people hired, verified by the Shaghilni team, through jobs that were real and showed their pay.

## Positioning

**Campus first: "Handshake for Syria", with the full job board behind it.** Universities bring verified students, companies entering Syria run internship programmes and campus events through Shaghilni, and students join free. The open job board for every job seeker sits behind that and grows from it.

What a neighbouring product couldn't truthfully copy:

- every employer verified (with sanctions screening) and every listing reviewed by a person before it's published, and reviewed again after any edit, whatever state the listing was in;
- the pay shown on every listing, always;
- confirmed-hire data, and official university partnerships with verified student identities.

## Operating Context

- Most people use the app in Arabic on a phone. It opens in Arabic, right to left, and switches to English at any time.
- Sign-in is a six-digit code by text message; there are no passwords.
- Shaghilni Lite serves the same platform as small server-rendered pages for slow or expensive connections (under 15 KB on the first visit, about 1–3 KB a page after that, no JavaScript beyond the sign-in check and an optional one-line *Save as PDF* script on the resume page).
- WhatsApp is how many Syrians already apply and talk about jobs; applying by WhatsApp (and, where a company chooses, by phone call or email) is supported alongside quick apply.
- Employers include international companies and NGOs who need records they can show compliance teams and donors.
- Campus events (careers days, internship fairs) and talent sessions with business councils are part of how employers and students meet.
- Payments are handled by hand for now: Syrian businesses pay in Syrian pounds (mobile wallet, bank transfer or cash with a receipt), international organisations in US dollars, invoiced with a reference number.

## Capabilities and Constraints

**Built and working:** bilingual job board with fit scores and filters (including internships and jobs welcoming returnees); job alerts; quick apply with one resume in Arabic or English, or apply by WhatsApp, phone call or email where the company allows it; application tracking with text updates; one resume per person, built from the profile, with "Tailor my resume for this job" focusing the checks on a job without creating a separate version; recruiter search and invitations (only for people who switch on "Let recruiters find me"); students verified by their university email, and university career offices; employer plans (Free, Pro, Enterprise), sponsored listings, placement fees for hires found through search, analytics, reports; company teams with roles (owner, admin, recruiter, hiring manager), invitations, requests to join and a record of who did what (3 people on Free, 10 on Pro, 50 on Enterprise); events with tickets, QR check-in and reports; card payments through a hosted bank page (QNB Syria's adapter still to be completed); account export and deletion; a removable demo with fictional accounts.

**Technical constraints:** Node.js 22.13+ with no dependencies, SQLite in one file through `node:sqlite`, a vanilla-JS single-page app plus the server-rendered Lite pages. Data is stored and processed outside Syria, with consent.

**Product rules:**

- Job seekers never pay for anything, and nothing a job seeker can buy moves them up the queue.
- Pay is required on every listing; listings asking applicants for fees are blocked.
- Recruiters and universities see a person's details only when that person has opted in.
- There is one resume per person; tailoring never creates versions.

**Terms to keep consistent:** owner, admin, recruiter, hiring manager; Shaghilni Lite; verified (company, student); confirmed hire; career office; internship programme; sponsored listing; Free, Pro, Enterprise; placement fee; "Let recruiters find me"; "Tailor my resume for this job".

**Open decisions:**

- Real plan prices (the app shows "Contact us for pricing" until set).
- Which Syrian universities give students email addresses, and their domains; students at universities without one can't be verified yet.
- Which text-message provider delivers reliably to Syrian networks.
- The Syrian entity or local partner for receiving Syrian pounds.
- Lawyer review of the privacy notice and terms (Syria's Law No. 12 of 2024 and US law).

## Brand Commitments

- The name is **Shaghilni** in English and **شغّلني** in Arabic.
- **Arabic register:** Standard Arabic as the base of the app, with everyday Syrian (Shaami) words wherever the formal ones sound stiff: navigation, prompts, buttons and messages (for example الشركات rather than جهات التوظيف, «خلّي الشركات تلاقيني», «عم دوّر على شغل»). The privacy notice and terms stay formal. Text messages and outreach (social posts, invitations, messages to friends and partners) are in Syrian dialect.
- The promises in the copy are literal and must stay true: free for job seekers, every employer checked, the pay shown on every job, no fees and no middleman.

## Evidence on Hand

- **No real users, employers, hires, testimonials, letters of intent or university agreements exist yet.** Future work must not invent any.
- <!-- demo-accounts:start -->The demo accounts (`server/demo.js`: Omar, Rania, Yasmin Trading, Qasioun Advisory, the Homs University career office) are fictional, apart from two place and organisation names still to be replaced. <!-- demo-accounts:end -->The sample job listings in `seed/demo.json` (loaded by `server/seed.js`, which skips the one without pay and never loads the invented contact person each listing carries in the file) use real organisations' names and invented employees; they are never seeded in production and must never reach a public server.
- Market research gathered so far: competitors (WorkLink, jobs.sy, job.sy, the labour ministry's platform, Job Gate); WorkLink's own H1 2026 report that only 19 of 2,573 vacancies showed pay; the state of payments in Syria (mobile wallets, cards just returning); and the active business councils (US-Syria, Syria Britain and others).
- Materials: business plan, pitch deck, white paper, infographics in English and Arabic, the launch checklist, and share collages, all built from the working MVP.

## Product Principles

1. **Free and fair for every job seeker.** Nothing a job seeker can buy moves them up the queue, because paying to be seen first would recreate wasta.
2. **Trust before volume.** Every employer checked, every listing reviewed, the pay always shown. A smaller board of real jobs beats a big board of doubtful ones.
3. **Built for the phone and connection people actually have.** Arabic first, cheap Android phones, slow and expensive data, text messages, Lite.
4. **Outcomes over activity.** Confirmed hires are the measure, for job seekers, employers, universities and donors.
5. **Consent decides who sees what.** Recruiters, universities and event organisers see a person's details only when that person chose it.

## Accessibility & Inclusion

- Arabic, right to left, by default, with full English; both are first-class.
- Text at least 12 px everywhere except the scaled resume preview, which is a page thumbnail; text colours come from tokens chosen for WCAG AA in light and dark mode. The contrast check on 40 screens was done by hand and is not recorded in this repository.
- Built to work with a keyboard and screen readers (skip link, focus rings, ARIA names and live regions); `test/a11y.test.js` checks a few of these statically (dialog names, the filter-count contrast, the event date for screen readers, the spinner under reduced motion); there is no browser-based accessibility test, and testing with TalkBack on real Android phones is still to do.
- Lite works without JavaScript and in a few kilobytes a page, for slow and expensive connections.
