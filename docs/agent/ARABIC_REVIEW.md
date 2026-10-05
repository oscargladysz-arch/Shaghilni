# ARABIC_REVIEW · new or changed Arabic strings for a native speaker (R9)

Every Arabic string an agent added or changed, in the order it was added. House register: Modern Standard base, everyday Syrian (Shaami) words where the formal sounds stiff; text messages in Syrian dialect; legal text formal (`PRODUCT.md`, "Arabic register"). A native reviewer ticks the last column or writes the replacement; the agent then applies it in a `copy:` commit.

| # | Key | File | English | Arabic | Shown where | Register | Reviewed |
|---|---|---|---|---|---|---|---|
| 1 | `insSampleRows` | `public/js/i18n4.js` (STR.ar, after `insFailedTexts`) | Sample data is still in this database (companies: {c}, listings: {j}). Remove it before real employers arrive: npm run demo:remove | ما زالت قاعدة البيانات تحتوي على بيانات تجريبية (شركات: {c}، إعلانات: {j}). احذفها قبل وصول الشركات الحقيقية: npm run demo:remove | Admin → Insights → "Needs attention" card, only when a production database still holds sample rows (Stage 1, D-01) | formal admin note; the counts sit in parentheses so no plural agreement is needed (the Stage 1 review flagged the first draft's «{c} شركة تجريبية» form); «بيانات تجريبية» should match the board badge wording (`m_demo`) | ☐ |
| 2 | `ta_job_unsponsored` | `public/js/i18n4.js` (STR.ar, after `ta_job_sponsored`) | {who} stopped sponsoring a job | أوقف {who} تمويل وظيفة | Team activity log (`#/company/activity`), one row per switch-off | Everyday; matches `ta_job_sponsored` (موّل) | |
