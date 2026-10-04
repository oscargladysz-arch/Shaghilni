/* =====================================================================
   Shaghilni v2 — data
   Pay is stored in NEW Syrian pounds (the 2026 redenomination removed two
   zeros: 1 new SYP = 100 old). Dollar figures are derived, never stored.
   ===================================================================== */

const RATE = { syp: 122, stamp: { en: "July 2026", ar: "تموز 2026" } };

const GOV = {
  damascus:  { en: "Damascus",       ar: "دمشق" },
  rifdimashq:{ en: "Rural Damascus", ar: "ريف دمشق" },
  aleppo:    { en: "Aleppo",         ar: "حلب" },
  homs:      { en: "Homs",           ar: "حمص" },
  hama:      { en: "Hama",           ar: "حماة" },
  latakia:   { en: "Latakia",        ar: "اللاذقية" },
  tartus:    { en: "Tartus",         ar: "طرطوس" },
  idlib:     { en: "Idlib",          ar: "إدلب" },
  deirezzor: { en: "Deir ez-Zor",    ar: "دير الزور" },
  raqqa:     { en: "Raqqa",          ar: "الرقة" },
  hasakah:   { en: "Al-Hasakah",     ar: "الحسكة" },
  daraa:     { en: "Daraa",          ar: "درعا" },
  sweida:    { en: "As-Suwayda",     ar: "السويداء" },
  quneitra:  { en: "Quneitra",       ar: "القنيطرة" },
  remote:    { en: "Remote",         ar: "عن بُعد" }
};
const GOV_ORDER = ["damascus","rifdimashq","aleppo","homs","hama","latakia","tartus","idlib",
  "deirezzor","raqqa","hasakah","daraa","sweida","quneitra","remote"];

/* governorates within a daily commute of each other */
const NEAR = {
  homs:["hama","tartus"], hama:["homs","idlib"], damascus:["rifdimashq","quneitra","daraa"],
  rifdimashq:["damascus","quneitra","daraa","sweida"], aleppo:["idlib"], idlib:["aleppo","hama"],
  latakia:["tartus"], tartus:["latakia","homs"], deirezzor:["raqqa","hasakah"],
  raqqa:["deirezzor","aleppo"], hasakah:["deirezzor"], daraa:["damascus","rifdimashq","sweida","quneitra"],
  sweida:["daraa","rifdimashq"], quneitra:["damascus","rifdimashq","daraa"]
};

/* Post-2024 names: Al-Baath → Homs University, Tishreen → Latakia University */
const UNI = {
  damascus: { en: "Damascus University",        ar: "جامعة دمشق" },
  aleppo:   { en: "University of Aleppo",       ar: "جامعة حلب" },
  homs:     { en: "Homs University",            ar: "جامعة حمص" },
  latakia:  { en: "Latakia University",         ar: "جامعة اللاذقية" },
  furat:    { en: "Al-Furat University",        ar: "جامعة الفرات" },
  hama:     { en: "Hama University",            ar: "جامعة حماة" },
  hiast:    { en: "HIAST",                      ar: "المعهد العالي للعلوم التطبيقية والتكنولوجيا" },
  hiba:     { en: "HIBA",                       ar: "المعهد العالي لإدارة الأعمال" },
  svu:      { en: "Syrian Virtual University",  ar: "الجامعة الافتراضية السورية" },
  aleppoti: { en: "Aleppo Technical Institute", ar: "المعهد التقاني في حلب" }
};
const UNI_ORDER = ["damascus","aleppo","homs","latakia","furat","hama","hiast","hiba","svu","aleppoti"];

const FAC = {
  petroleum:    { en: "Petroleum Engineering",     ar: "هندسة النفط" },
  chemical:     { en: "Chemical Engineering",      ar: "الهندسة الكيميائية" },
  geology:      { en: "Geology",                   ar: "الجيولوجيا" },
  civil:        { en: "Civil Engineering",         ar: "الهندسة المدنية" },
  mechanical:   { en: "Mechanical Engineering",    ar: "الهندسة الميكانيكية" },
  electrical:   { en: "Electrical Engineering",    ar: "الهندسة الكهربائية" },
  telecom:      { en: "Telecommunications",        ar: "الاتصالات" },
  informatics:  { en: "Informatics Engineering",   ar: "الهندسة المعلوماتية" },
  industrial:   { en: "Industrial Engineering",    ar: "الهندسة الصناعية" },
  environmental:{ en: "Environmental Engineering", ar: "الهندسة البيئية" },
  economics:    { en: "Economics",                 ar: "الاقتصاد" },
  business:     { en: "Business Administration",   ar: "إدارة الأعمال" },
  media:        { en: "Media",                     ar: "الإعلام" },
  arts:         { en: "Arts and Humanities",       ar: "الآداب والعلوم الإنسانية" },
  nursing:      { en: "Nursing",                   ar: "التمريض" },
  publichealth: { en: "Public Health",             ar: "الصحة العامة" },
  pharmacy:     { en: "Pharmacy",                  ar: "الصيدلة" },
  marine:       { en: "Marine Sciences",           ar: "العلوم البحرية" },
  chemistry:    { en: "Chemistry",                 ar: "الكيمياء" },
  biology:      { en: "Biology",                   ar: "علم الأحياء" }
};
const RELATED = { petroleum: ["chemical","geology","mechanical","industrial","environmental","civil"] };

const CAT = {
  multinational: { en: "Multinational",   ar: "شركة عالمية",       emoji: "🌐" },
  domestic:      { en: "Syrian business", ar: "شركة سورية",        emoji: "🇸🇾" },
  public:        { en: "NGO and public",  ar: "منظمات وقطاع عام",  emoji: "🤝" }
};
const SECTOR = { energy:"#0D5C3A", food:"#8A5638", prof:"#3B4C63", media:"#6E3238", aid:"#1F5F57",
  build:"#6B5A33", tech:"#3F3A63", trade:"#5C4A3C", finance:"#24513F", edu:"#2B4F6E" };
const TYPE = {
  full:     { en: "Full-time",  ar: "دوام كامل" },
  part:     { en: "Part-time",  ar: "دوام جزئي" },
  intern:   { en: "Internship", ar: "تدريب" },
  contract: { en: "Contract",   ar: "عقد محدد المدة" }
};
const LEVEL = {
  student: { en: "For students",         ar: "للطلاب" },
  entry:   { en: "No experience needed", ar: "بدون خبرة" },
  junior:  { en: "1–3 years",            ar: "1–3 سنوات" },
  mid:     { en: "4–8 years",            ar: "4–8 سنوات" }
};
const MODE = {
  onsite: { en: "On site", ar: "في الموقع" },
  hybrid: { en: "Hybrid",  ar: "هجين" },
  remote: { en: "Remote",  ar: "عن بُعد" }
};
const LANGS = {
  ar: { en: "Arabic",  ar: "العربية" },  en: { en: "English", ar: "الإنكليزية" },
  fr: { en: "French",  ar: "الفرنسية" }, tr: { en: "Turkish", ar: "التركية" },
  ku: { en: "Kurdish", ar: "الكردية" },  de: { en: "German",  ar: "الألمانية" },
  ru: { en: "Russian", ar: "الروسية" }
};

/* Fields of interest a person can pick during onboarding */
const INTERESTS = {
  energy:      { en: "Engineering and energy",  ar: "الهندسة والطاقة" },
  business:    { en: "Business and finance",    ar: "الأعمال والمال" },
  tech:        { en: "Technology",              ar: "التكنولوجيا" },
  health:      { en: "Healthcare",              ar: "الرعاية الصحية" },
  media:       { en: "Media",                   ar: "الإعلام" },
  hospitality: { en: "Hospitality and retail",  ar: "الضيافة والمبيعات" },
  trades:      { en: "Trades and manufacturing", ar: "المهن والصناعة" },
  ngo:         { en: "NGOs and public sector",  ar: "المنظمات والقطاع العام" },
  edu:         { en: "Education and research",  ar: "التعليم والبحث" },
  logistics:   { en: "Logistics and driving",   ar: "النقل والخدمات اللوجستية" }
};

/* The demo student. Everything below is what he "told us": the resume helper
   may choose, order and re-phrase it, never add to it. relocate is false so
   the published match scores stay as documented. */

/* Jobs are loaded from the API at runtime (see prepJobs in engine.js). */
const JOBS = [];

/* Where Syrians abroad live, for "Outside Syria" in profiles. */
const COUNTRY = { de: { en: "Germany", ar: "ألمانيا" }, tr: { en: "Turkey", ar: "تركيا" }, lb: { en: "Lebanon", ar: "لبنان" }, jo: { en: "Jordan", ar: "الأردن" }, iq: { en: "Iraq", ar: "العراق" },
  eg: { en: "Egypt", ar: "مصر" }, ae: { en: "United Arab Emirates", ar: "الإمارات" }, sa: { en: "Saudi Arabia", ar: "السعودية" }, qa: { en: "Qatar", ar: "قطر" }, kw: { en: "Kuwait", ar: "الكويت" },
  se: { en: "Sweden", ar: "السويد" }, nl: { en: "Netherlands", ar: "هولندا" }, at: { en: "Austria", ar: "النمسا" }, dk: { en: "Denmark", ar: "الدنمارك" }, no: { en: "Norway", ar: "النرويج" },
  fr: { en: "France", ar: "فرنسا" }, be: { en: "Belgium", ar: "بلجيكا" }, gb: { en: "United Kingdom", ar: "المملكة المتحدة" }, us: { en: "United States", ar: "الولايات المتحدة" },
  ca: { en: "Canada", ar: "كندا" }, other: { en: "Another country", ar: "بلد آخر" } };
/* Dialling codes offered at sign-in: Syria first, then where most Syrians abroad live. */
const DIAL = [["963", "sy"], ["49", "de"], ["90", "tr"], ["961", "lb"], ["962", "jo"], ["964", "iq"], ["20", "eg"], ["971", "ae"], ["966", "sa"], ["974", "qa"], ["965", "kw"],
  ["46", "se"], ["31", "nl"], ["43", "at"], ["45", "dk"], ["47", "no"], ["33", "fr"], ["32", "be"], ["44", "gb"], ["1", "us"]];
