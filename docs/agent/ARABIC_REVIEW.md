# ARABIC_REVIEW · new or changed Arabic strings for a native speaker (R9)

Every Arabic string an agent added or changed, in the order it was added. House register: Modern Standard base, everyday Syrian (Shaami) words where the formal sounds stiff; text messages in Syrian dialect; legal text formal (`PRODUCT.md`, "Arabic register"). A native reviewer ticks the last column or writes the replacement; the agent then applies it in a `copy:` commit.

| # | Key | File | English | Arabic | Shown where | Register | Reviewed |
|---|---|---|---|---|---|---|---|
| 1 | `insSampleRows` | `public/js/i18n4.js` (STR.ar, after `insFailedTexts`) | {c} sample companies and {j} sample listings are still in this database. Remove them before real employers arrive: npm run demo:remove | ما زالت قاعدة البيانات تحتوي على {c} شركة تجريبية و{j} إعلان تجريبي. احذفها قبل وصول الشركات الحقيقية: npm run demo:remove | Admin → Insights → "Needs attention" card, only when a production database still holds sample rows (Stage 1, D-01) | formal admin note; «شركة تجريبية» / «إعلان تجريبي» follow the existing "demo" wording of the board badge (check consistency with `m_demo`) | ☐ |
