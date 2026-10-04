/* ---------- privacy notice and terms of use ----------
   DRAFTS written to match what this code actually does. Have a lawyer review both before launch
   (see SECURITY.md, item 1). If you change what data is collected, who receives it or how long it is kept,
   change these texts and TERMS_VERSION in server/config.js together. Retention periods must match
   server/retention.js. {name}, {contact} and {days} come from LEGAL_NAME, CONTACT_EMAIL and SESSION_DAYS. */
const LEGAL = {
  en: {
    privacy: {
      title: "Privacy notice",
      intro: "{name} runs Shaghilni (“we”), a job board for Syria. This notice explains what information we collect, why, who can see it and how long we keep it. For questions or requests, contact {contact}.",
      sections: [
        { h: "What we collect", ul: [
          "Your mobile number, your language and when you signed in. We need these to create your account and send you sign-in codes.",
          "If you look for work: the profile you write, in one or both languages (name, governorate, languages, education, experience, skills, certificates and job preferences), the jobs you save, and your applications and their status.",
          "Whether you let recruiters find you, and the invitations you receive and your answers.",
          "Where you live: your governorate, or your country if you live outside Syria.",
          "Job alerts you set up: what you searched for, and whether you want to hear by email, by text or only in the app.",
          "If you recruit: your company's plan, its invoices and payments, and your team. People on a company's team see each other's names, phone numbers and roles, and owners and admins see a record of who did what (posting jobs, moving applicants, writing notes, managing the team).",
          "Sponsored listings: we use your Shaghilni profile to decide whether a sponsored job fits you well enough to show it first. Employers never see who was shown their listing.",
          "Visit counts: when you open pages on Shaghilni, our own server counts which page it was (never what you type), the link that brought you, your type of device, browser, language, connection speed and how long the page took to load. We don't use tracking cookies or third-party trackers, and we don't store your IP address: a code that changes every day lets us count visitors for one day only. If your browser asks not to be tracked, we don't count you. Visit counts are deleted after 180 days.",
          "If you sign up for an event: the organiser (Shaghilni, or your university's career office) sees your name, university and faculty, to check you in. Companies attending can find you only if you've switched on “Let recruiters find me”. Event reports show only totals, never names.",
          "If you verify yourself with your university email: we send a code to that address through our email-sending service, and keep the address so it can verify only one account. Your university's career office can then see your name, faculty, year, and your applications and hires on Shaghilni. You can remove this at any time. Career offices see only totals, not names, for other students of their university.",
          "If you upload a resume to fill in your profile, the file is read on your device and never sent to us. We keep only the details you choose to add.",
          "If you hire: your company's details (name, registration number, contact person, WhatsApp number, website and description), your listings, and the private notes you write about applicants.",
          "For security: the internet (IP) address of each sign-in request, and the type of browser for each signed-in session.",
          "We don't use advertising or tracking cookies. The only cookie keeps you signed in."] },
        { h: "Why we use it", ul: [
          "To sign you in, run your account, and show listings and how well they fit your profile.",
          "To send your application to the employer you choose, and to text you when an employer moves it forward.",
          "To check employers before their listings go live, including screening against sanctions lists, and to keep scams, fees and discrimination off the board.",
          "To keep the service secure, with rate limits, fraud checks and a record of admin and employer actions.",
          "To count confirmed hires and other totals. These counts don't identify you."] },
        { h: "Who can see your information", ul: [
          "Employers see your profile, phone number and resume only for jobs you apply to, and they see the version you had when you applied.",
          "If you switch on “Let recruiters find me”, checked employers can see your first name and last initial, your education, governorate, experience level, recent job titles, skills and languages, and invite you to apply or to an event. They see your phone number only if you apply or say yes to an event. You can switch it off at any time.",
          "Other job seekers never see your profile.",
          "Our small team can see account information when needed to verify employers, confirm hires, answer your requests or investigate abuse.",
          "We don't sell your information and we don't show you ads.",
          "We may disclose information when the law requires it. Where the law allows, we'll tell you."] },
        { h: "Service providers, and storage outside Syria",
          p: ["A few providers handle data on our behalf. Some of them are outside Syria, so your information may be stored or processed in other countries:"],
          ul: [
            "Our hosting provider stores the database and runs the site.",
            "Our text-message provider receives your number and the text of each message we send you.",
            "If you choose job alerts by email, our email-sending service receives your email address and the jobs we tell you about.",
            "If your company pays by card, our bank's payment service takes the card details on its own secure page. We never see or store card numbers; we keep only the amount, the date and the bank's reference.",
            "Anthropic receives only the text you ask it to work on, and only when you ask: your experience bullet points and the job's description for wording suggestions, or the text of your resume (job titles, workplaces, bullet points, education details, skills and certificates) for a translation. It never receives your name or phone number, and under its commercial terms it doesn't use this data to train its models.",
            "When you apply by WhatsApp, your message goes through WhatsApp under WhatsApp's own terms."],
          after: ["This site's code and fonts come from our own server. We don't load anything from advertising or analytics companies."] },
        { h: "How long we keep it", ul: [
          "Your account and profile: until you delete them.",
          "Sign-in codes and the internet addresses stored with them: deleted within 24 hours.",
          "Signed-in sessions: until you sign out, or after {days} days.",
          "Records of the text messages we sent you: 90 days.",
          "Backups: kept for a limited time, then deleted.",
          "When you delete your account, we erase your profile, saved jobs, sessions and message records straight away. We keep only an anonymous record that an application or hire happened, so our totals stay accurate. Employers can no longer see your application on Shaghilni, but we can't delete copies they made themselves, such as WhatsApp messages."] },
        { h: "Your choices", ul: [
          "See and download everything we hold about your account: Profile, then Download my data.",
          "Correct your details at any time by editing your profile.",
          "Withdraw an application from Applications.",
          "Delete your account: Profile, then hold the delete button.",
          "For anything else, contact {contact}."] },
        { h: "Security", p: ["Sign-in codes are stored only in scrambled (hashed) form and expire after 10 minutes. The site uses an encrypted connection, and only a few people can reach the admin tools. No system is perfectly secure. If a breach puts your information at risk, we'll tell you and the relevant authorities as the law requires."] },
        { h: "Age", p: ["Shaghilni is for people aged 18 or older."] },
        { h: "Changes", p: ["When we change this notice, we update the date at the top. If a change is important, we'll ask you to accept it the next time you sign in."] }
      ]
    },
    terms: {
      title: "Terms of use",
      intro: "These terms apply when you use Shaghilni, which is run by {name}. By creating an account, you agree to them. For questions, contact {contact}.",
      sections: [
        { h: "What Shaghilni is", p: ["Shaghilni is a job board that connects people looking for work with employers in Syria. We check employers and listings, but we are not a party to any job offer or employment contract, and we don't employ anyone through the site."] },
        { h: "Your account", ul: [
          "You must be 18 or older.",
          "Use your own mobile number and keep your sign-in codes private. One account per person.",
          "Give accurate information and keep it up to date.",
          "If you hire, you must be allowed to act for the company you add."] },
        { h: "Applying is free, and nobody may ask you for money", p: ["Job seekers never pay to use Shaghilni. Employers must never ask candidates for money for any reason, including application, training, deposits, uniforms or visas. If an employer asks you to pay, don't pay. Tell us and we'll act."] },
        { h: "Rules for employers", ul: [
          "Post only real jobs you are hiring for, with the real pay and place of work.",
          "Don't exclude people because of gender, religion, sect, ethnicity, origin or disability, unless the law requires it for that job.",
          "Follow Syrian labour law and pay what you promise.",
          "Use applicants' information only to consider them for the job they applied to. Don't share it or use it for anything else, and delete it when you no longer need it.",
          "We verify your company before your listings go live, including checks against sanctions lists, and we review every listing and every edit.",
          "Invite people only to real jobs and to events that are free for them, and use candidate search for nothing else."] },
        { h: "Rules for everyone", p: ["Don't:"], ul: [
          "create fake accounts or listings, or pretend to be someone else;",
          "copy listings or profiles in bulk, or use bots or scripts on the site;",
          "send spam, or contact people for reasons unrelated to a job;",
          "try to break, overload or get around the site's security."] },
        { h: "Our decisions", p: ["We may refuse, pause or remove a listing or an account that breaks these terms or puts people at risk. We may also report illegal activity to the authorities. We'll tell you why when we can."] },
        { h: "The resume helper", p: ["Wording suggestions and translations are optional. Suggestions only rephrase what you wrote, and translations only put it into the other language. Check everything before you send it: you are responsible for what your resume says, in both languages."] },
        { h: "No guarantees", p: ["We work to keep the board honest, but we can't promise that you'll find a job or a candidate, or that every employer or applicant is who they say they are. The service is provided as it is. As far as the law allows, we aren't responsible for dealings between employers and job seekers, or for indirect losses."] },
        { h: "Ending your use", p: ["You can delete your account at any time from your profile. If you break these terms, we may close your account."] },
        { h: "Changes", p: ["We may update these terms. We'll change the date at the top and ask you to accept important changes the next time you sign in."] }
      ]
    }
  },
  ar: {
    privacy: {
      title: "إشعار الخصوصية",
      intro: "تدير {name} منصة شغّلني («نحن»)، وهي منصة وظائف في سوريا. يوضح هذا الإشعار المعلومات التي نجمعها، ولماذا، ومن يطّلع عليها، وكم من الوقت نحتفظ بها. للأسئلة والطلبات تواصل مع {contact}.",
      sections: [
        { h: "ما نجمعه", ul: [
          "رقم موبايلك ولغتك وأوقات دخولك. نحتاجها لإنشاء حسابك وإرسال رموز الدخول إليك.",
          "إن كنت تبحث عن عمل: الملف الذي تكتبه بلغة واحدة أو باللغتين (الاسم والمحافظة واللغات والتعليم والخبرات والمهارات والشهادات وتفضيلات العمل)، والوظائف التي تحفظها، وطلباتك وحالتها.",
          "ما إذا سمحت لجهات التوظيف بالعثور عليك، والدعوات التي تصلك وردودك عليها.",
          "مكان إقامتك: محافظتك، أو بلدك إن كنت تعيش خارج سوريا.",
          "تنبيهات الوظائف التي تنشئها: ما بحثت عنه، وهل تريد أن نخبرك بالبريد الإلكتروني أو برسالة نصية أو في التطبيق فقط.",
          "إن كنت جهة توظيف: باقة شركتك وفواتيرها ومدفوعاتها، وفريقك. يرى أعضاء فريق الشركة أسماء بعضهم وأرقام هواتفهم وأدوارهم، ويرى المالك والمشرفون سجلاً بمن فعل ماذا (نشر الوظائف، ونقل المتقدمين، وكتابة الملاحظات، وإدارة الفريق).",
          "الإعلانات المموّلة: نستخدم ملفك على شغّلني لنقرر إن كانت وظيفة مموّلة تناسبك بما يكفي لنعرضها أولاً. لا يرى أصحاب العمل من عُرض عليه إعلانهم.",
          "عدّ الزيارات: عندما تفتح صفحات شغّلني، يعدّ خادمنا الصفحة التي فتحتها (وليس ما تكتبه أبداً)، والرابط الذي أوصلك إليها، ونوع جهازك ومتصفحك ولغتك وسرعة اتصالك والوقت الذي استغرقه تحميل الصفحة. لا نستخدم ملفات تعريف ارتباط للتتبع ولا أدوات تتبع من جهات أخرى، ولا نخزّن عنوان IP الخاص بك: يتيح لنا رمز يتغير كل يوم عدّ الزوار ليوم واحد فقط. إن طلب متصفحك عدم تتبعه فلا نعدّك. تُحذف بيانات عدّ الزيارات بعد 180 يوماً.",
          "إن سجّلت في فعالية: يرى المنظّم (شغّلني، أو مكتب التوظيف في جامعتك) اسمك وجامعتك وكليتك ليسجّل حضورك. ولا تجدك الشركات المشاركة إلا إن فعّلت «اسمح لجهات التوظيف بالعثور عليّ». تُظهر تقارير الفعاليات أرقاماً إجمالية فقط، دون أسماء.",
          "إن وثّقت نفسك ببريدك الجامعي: نرسل رمزاً إلى ذلك العنوان عبر خدمة إرسال البريد لدينا، ونحتفظ بالعنوان كي لا يوثّق إلا حساباً واحداً. يستطيع مكتب التوظيف في جامعتك بعدها رؤية اسمك وكليتك وسنتك الدراسية وطلباتك وتعييناتك على شغّلني. يمكنك إزالة ذلك في أي وقت. لا ترى مكاتب التوظيف إلا أرقاماً إجمالية، دون أسماء، لبقية طلاب جامعتها.",
          "إن رفعت سيرة ذاتية لملء ملفك، تُقرأ على جهازك ولا تُرسل إلينا أبداً. نحتفظ فقط بالتفاصيل التي تختار إضافتها.",
          "إن كنت توظّف: بيانات شركتك (الاسم ورقم السجل التجاري والشخص المسؤول ورقم واتساب والموقع الإلكتروني والوصف)، وإعلاناتك، والملاحظات الخاصة التي تكتبها عن المتقدمين.",
          "لأغراض الأمان: عنوان الإنترنت (IP) لكل طلب دخول، ونوع المتصفح لكل جلسة دخول.",
          "لا نستخدم ملفات تعريف الارتباط (الكوكيز) للإعلانات أو التتبع. الملف الوحيد الذي نستخدمه يُبقيك مسجّلاً الدخول."] },
        { h: "لماذا نستخدمها", ul: [
          "لتسجيل دخولك وإدارة حسابك، وعرض الإعلانات ومدى ملاءمتها لملفك.",
          "لإرسال طلبك إلى صاحب العمل الذي تختاره، وإرسال رسالة نصية إليك عندما يتقدّم طلبك.",
          "للتحقق من أصحاب العمل قبل نشر إعلاناتهم، بما في ذلك مطابقتهم مع قوائم العقوبات، ولإبعاد الاحتيال والرسوم والتمييز عن المنصة.",
          "لحماية الخدمة، عبر حدود الاستخدام وكشف الاحتيال وسجلّ بإجراءات الإدارة وأصحاب العمل.",
          "لإحصاء التوظيفات المؤكدة وغيرها من المجاميع، وهي أرقام لا تكشف هويتك."] },
        { h: "من يطّلع على معلوماتك", ul: [
          "يرى صاحب العمل ملفك ورقمك وسيرتك الذاتية فقط في الوظائف التي تتقدّم إليها، وبالصيغة التي كانت لديك لحظة التقديم.",
          "إن فعّلت «اسمح لجهات التوظيف بالعثور عليّ»، يمكن لأصحاب العمل الموثّقين رؤية اسمك الأول والحرف الأول من اسم عائلتك، وتعليمك ومحافظتك ومستوى خبرتك وآخر مسمياتك الوظيفية ومهاراتك ولغاتك، ودعوتك للتقديم أو لحضور فعالية. لا يرون رقم هاتفك إلا إذا قدّمت أو وافقت على حضور فعالية. يمكنك إيقاف ذلك في أي وقت.",
          "لا يرى الباحثون الآخرون عن عمل ملفك أبداً.",
          "يمكن لفريقنا الصغير الاطلاع على بيانات الحساب عند الحاجة للتحقق من أصحاب العمل أو تأكيد التوظيفات أو الرد على طلباتك أو التحقيق في إساءة الاستخدام.",
          "لا نبيع معلوماتك ولا نعرض عليك إعلانات.",
          "قد نفصح عن معلومات إذا ألزمنا القانون بذلك، وسنخبرك حيث يسمح القانون."] },
        { h: "مزوّدو الخدمة، والحفظ خارج سوريا",
          p: ["يعالج عدد قليل من مزوّدي الخدمة البيانات نيابة عنا، وبعضهم خارج سوريا، لذا قد تُحفظ معلوماتك أو تُعالَج في بلدان أخرى:"],
          ul: [
            "مزوّد الاستضافة، ويحفظ قاعدة البيانات ويشغّل الموقع.",
            "مزوّد الرسائل النصية، ويتلقى رقمك ونص كل رسالة نرسلها إليك.",
            "خدمة إرسال البريد الإلكتروني، إن اخترت تلقي تنبيهات الوظائف بالبريد، وتتلقى عنوان بريدك والوظائف التي نخبرك بها.",
            "خدمة الدفع لدى مصرفنا، إن دفعت شركتك ببطاقة، وتتلقى بيانات البطاقة على صفحتها الآمنة. لا نرى أرقام البطاقات ولا نخزّنها، ونحتفظ فقط بالمبلغ والتاريخ ورقم مرجع المصرف.",
            "شركة Anthropic، وتتلقى فقط النص الذي تطلب منها العمل عليه، وعندما تطلب ذلك فقط: نقاط خبرتك ووصف الوظيفة لاقتراحات الصياغة، أو نص سيرتك الذاتية (المسميات الوظيفية وأماكن العمل ونقاط الخبرة وتفاصيل التعليم والمهارات والشهادات) للترجمة. لا تتلقى اسمك أو رقمك أبداً، ولا تستخدم هذه البيانات لتدريب نماذجها وفق شروطها التجارية.",
            "عندما تتقدّم عبر واتساب، تمر رسالتك عبر واتساب وفق شروطه الخاصة."],
          after: ["تأتي شيفرة هذا الموقع وخطوطه من خادمنا، ولا نحمّل أي شيء من شركات الإعلانات أو التحليلات."] },
        { h: "مدة الاحتفاظ", ul: [
          "حسابك وملفك: حتى تحذفهما.",
          "رموز الدخول وعناوين الإنترنت المحفوظة معها: تُحذف خلال 24 ساعة.",
          "جلسات الدخول: حتى تسجّل الخروج، أو بعد {days} يوماً.",
          "سجلات الرسائل النصية التي أرسلناها إليك: 90 يوماً.",
          "النسخ الاحتياطية: تُحفظ لفترة محدودة ثم تُحذف.",
          "عندما تحذف حسابك نمحو فوراً ملفك ووظائفك المحفوظة وجلساتك وسجلات رسائلك، ونُبقي فقط سجلاً مجهول الهوية بأن طلباً أو توظيفاً قد حدث، لتبقى أرقامنا دقيقة. لن يعود أصحاب العمل قادرين على رؤية طلبك على شغّلني، لكن لا يمكننا حذف النسخ التي احتفظوا بها بأنفسهم، مثل رسائل واتساب."] },
        { h: "خياراتك", ul: [
          "اطّلع على كل ما نحتفظ به عن حسابك ونزّله: من «ملفي» اختر «تنزيل بياناتي».",
          "صحّح بياناتك في أي وقت بتعديل ملفك.",
          "اسحب أي طلب من قسم «طلباتي».",
          "احذف حسابك: من «ملفي» اضغط مطوّلاً على زر الحذف.",
          "لأي طلب آخر تواصل مع {contact}."] },
        { h: "الأمان", p: ["لا نحفظ رموز الدخول إلا بصيغة مشفّرة لا يمكن عكسها، وتنتهي صلاحيتها بعد 10 دقائق. يعمل الموقع عبر اتصال مشفّر، ولا يصل إلى أدوات الإدارة إلا عدد قليل من الأشخاص. لا يوجد نظام آمن تماماً، وإذا عرّض اختراقٌ معلوماتك للخطر فسنخبرك ونبلغ الجهات المختصة وفق ما يقتضيه القانون."] },
        { h: "العمر", p: ["شغّلني مخصص لمن بلغوا 18 عاماً أو أكثر."] },
        { h: "التغييرات", p: ["عندما نعدّل هذا الإشعار نحدّث التاريخ في أعلى الصفحة. وإذا كان التعديل مهماً نطلب موافقتك عليه عند دخولك التالي."] }
      ]
    },
    terms: {
      title: "شروط الاستخدام",
      intro: "تنطبق هذه الشروط عند استخدامك شغّلني التي تديرها {name}. بإنشائك حساباً فإنك توافق عليها. للأسئلة تواصل مع {contact}.",
      sections: [
        { h: "ما هي شغّلني", p: ["شغّلني منصة وظائف تصل الباحثين عن عمل بأصحاب العمل في سوريا. نتحقق من أصحاب العمل والإعلانات، لكننا لسنا طرفاً في أي عرض عمل أو عقد عمل، ولا نوظّف أحداً عبر المنصة."] },
        { h: "حسابك", ul: [
          "يجب أن يكون عمرك 18 عاماً أو أكثر.",
          "استخدم رقم موبايلك الخاص، وحافظ على سرية رموز الدخول. حساب واحد لكل شخص.",
          "قدّم معلومات صحيحة وحدّثها باستمرار.",
          "إن كنت توظّف، فيجب أن تكون مخوّلاً بالتصرف باسم الشركة التي تضيفها."] },
        { h: "التقديم مجاني، ولا يحق لأحد أن يطلب منك مالاً", p: ["لا يدفع الباحثون عن عمل أي مبلغ لاستخدام شغّلني. ولا يجوز لصاحب العمل أن يطلب من المتقدمين مالاً لأي سبب، سواء رسوم تقديم أو تدريب أو تأمين أو زيّ عمل أو تأشيرة. إذا طلب منك صاحب عمل أن تدفع فلا تدفع، وأخبرنا لنتصرّف."] },
        { h: "قواعد أصحاب العمل", ul: [
          "انشر فقط وظائف حقيقية توظّف لها فعلاً، بالأجر ومكان العمل الحقيقيين.",
          "لا تستبعد أحداً بسبب الجنس أو الدين أو الطائفة أو العِرق أو الأصل أو الإعاقة، ما لم يفرض القانون ذلك لتلك الوظيفة.",
          "التزم بقانون العمل السوري، وادفع ما تعد به.",
          "استخدم معلومات المتقدمين فقط للنظر في طلباتهم للوظيفة التي تقدّموا إليها. لا تشاركها ولا تستخدمها لأي غرض آخر، واحذفها عندما لا تعود بحاجة إليها.",
          "نتحقق من شركتك قبل نشر إعلاناتها، بما في ذلك مطابقتها مع قوائم العقوبات، ونراجع كل إعلان وكل تعديل.",
          "ادعُ الناس فقط إلى وظائف حقيقية وفعاليات مجانية لهم، ولا تستخدم البحث عن المرشحين لأي غرض آخر."] },
        { h: "قواعد للجميع", p: ["يُمنع:"], ul: [
          "إنشاء حسابات أو إعلانات وهمية، أو انتحال شخصية أحد؛",
          "نسخ الإعلانات أو الملفات بكميات كبيرة، أو استخدام البرامج الآلية على الموقع؛",
          "إرسال الرسائل المزعجة، أو التواصل مع الناس لأسباب لا علاقة لها بالعمل؛",
          "محاولة تعطيل الموقع أو إغراقه بالطلبات أو الالتفاف على حمايته."] },
        { h: "قراراتنا", p: ["يحق لنا رفض أي إعلان أو حساب يخالف هذه الشروط أو يعرّض الناس للخطر، أو إيقافه أو حذفه، وقد نبلغ الجهات المختصة عن أي نشاط غير قانوني. وسنوضح لك السبب متى أمكن."] },
        { h: "مساعد السيرة الذاتية", p: ["اقتراحات الصياغة والترجمة اختيارية؛ فالاقتراحات تعيد صياغة ما كتبته فقط، والترجمة تنقله إلى اللغة الأخرى فقط. راجع كل شيء قبل الإرسال، فأنت مسؤول عما تتضمنه سيرتك الذاتية باللغتين."] },
        { h: "لا ضمانات", p: ["نعمل على إبقاء المنصة نزيهة، لكننا لا نستطيع أن نعدك بأنك ستجد عملاً أو مرشحاً، أو بأن كل صاحب عمل أو متقدم هو فعلاً من يدّعي. تُقدَّم الخدمة كما هي. وفي الحدود التي يسمح بها القانون، لسنا مسؤولين عن التعاملات بين أصحاب العمل والباحثين عن عمل، ولا عن الخسائر غير المباشرة."] },
        { h: "إنهاء استخدامك", p: ["يمكنك حذف حسابك في أي وقت من ملفك. وإذا خالفت هذه الشروط فقد نغلق حسابك."] },
        { h: "التغييرات", p: ["قد نحدّث هذه الشروط، وسنغيّر التاريخ في أعلى الصفحة ونطلب موافقتك على التغييرات المهمة عند دخولك التالي."] }
      ]
    }
  }
};
function legalDate() {
  const [y, m, d] = String(S.cfg.termsVersion || "2026-09-25").split("-").map(Number);
  return `${d} ${MONTHS[S.lang][m - 1]} ${y}`;
}
function legalHTML(doc) {
  const key = doc === "terms" ? "terms" : "privacy", D = (LEGAL[S.lang] || LEGAL.en)[key];
  const vars = { name: S.cfg.legalName || t("legalNameDefault"), contact: S.cfg.contactEmail || t("legalNoContact"), days: S.cfg.sessionDays || 30 };
  const f = s => fill(s, vars);
  const other = key === "terms" ? ["privacy", "privacyTitle"] : ["terms", "termsTitle"];
  return html`<div class="page scroll"><article class="page-in legal">
${backLink("#/", "navJobs")}
<h1 class="lh-title">${D.title}</h1><p class="lh-sub">${t("legalUpdated", { date: legalDate() })}</p>
<p class="intro">${f(D.intro)}</p>
${D.sections.map(s => html`<section><h2>${s.h}</h2>${(s.p || []).map(x => html`<p>${f(x)}</p>`)}${s.ul ? html`<ul>${s.ul.map(x => html`<li>${f(x)}</li>`)}</ul>` : ""}${(s.after || []).map(x => html`<p>${f(x)}</p>`)}</section>`)}
<p class="fine"><button class="link" type="button" data-act="go" data-to="#/${other[0]}">${t(other[1])}</button></p>
</article></div>`;
}
