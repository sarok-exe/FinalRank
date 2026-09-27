FinalRank ♟️

🌐 **Languages / اللغات:** [English](README.md) | [العربية](#-finalrank--باللغة-العربية)

**A free, open-source chess analysis platform.** Deep Stockfish analysis, move-by-move classifications, plain-English explanations of every mistake, training puzzles, and a full chess toolbox — all in your browser. No subscriptions. No ads. No locked features.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sarok_ibnx)

> 🎥 **Demo:** *screen recording of the live coach reacting to moves — drop it here*

---

## 🤔 Why not just use Lichess?

Fair question. Lichess is great — and it's free, so we can't compete on price. We compete on analysis: deep Stockfish runs in your browser, every move gets a classification, and every mistake gets a plain-English explanation.

| | **FinalRank** | **Lichess** | **Chess.com** |
|---|---|---|---|
| **Move-by-move feedback** | ✅ Every move graded and explained, better move offered | ❌ Post-game review only | ❌ Post-game review only |
| **Price** | Free forever | Free (donation-based) | Free tier + paid premium |
| **Open source** | ✅ Apache 2.0 | ✅ AGPL | ❌ Closed source |
| **Deep analysis** | Free, up to depth 18 | Available | Requires paid subscription |
| **Engine location** | In-browser (offline-capable) | Server-side | Server-side |
| **Account** | Guest login, no account needed | Account optional | Account required |
| **Import** | Chess.com **and** Lichess | Chess.com and Lichess | Lichess only (limited) |
| **Ads** | None | None | Ads on free tier |

---

## ✨ Features

### 🎓 Move-by-Move Feedback
- **Every move gets graded** as it happens: brilliant, best, inaccuracy, mistake, blunder.
- **Plain-English explanations** — why a move was bad, what you should have played instead.
- **"Try the better move"** — one click replays the improved line so you feel the difference.
- **Optional AI coach** — bring your own API key (OpenAI-compatible) for LLM-powered notes. Your key stays in your browser.

### 📥 Game Import
- **Chess.com import** — pull up to 50 of your recent games straight from your Chess.com account, or link your account for one-click access.
- **Lichess import** — import up to 50 games from Lichess too.
- **PGN paste** — paste any game in standard PGN format and analyze it instantly.
- **Auto-analyze** — imported matches can be analyzed the moment they load.

### 🧠 Engine Analysis (Stockfish, in your browser)
- **Stockfish 18 Lite** bundled as WebAssembly — runs locally on your device, no server, no waiting.
- **Adjustable depth** from 6 to 18 — from a quick skim to deep analysis.
- **Parallel workers (1–8x)** — faster results on powerful machines.
- **MultiPV** — see multiple best lines, not just the top one.
- **Opening book detection** — know when you're in known theory.
- **FEN caching + engine warm-up** — repeated positions analyze faster.
- **Works offline** — the engine runs on your device.

### 🏷️ Move Classifications
Every move is graded with a rich classification system powered by expected-points-loss logic:

`Brilliant` · `Best` · `Excellent` · `Good` · `Book` · `Inaccuracy` · `Mistake` · `Blunder` · `Missed Win` · `Critical` · `Forced` · `Free Piece` · `Sharp` · `Threat` · `Take Back` · `Checkmate` · `Resign` · `Draw` · `Winner`

Each move gets a clear badge on the board so you instantly see where you gained or lost the game.

### 🔮 What-If / Hypothesis Mode
Explore alternative lines on the board and watch the evaluation change in real time.

### 📊 Post-Game Report
- Accuracy scores for both players.
- Evaluation (eval) chart showing the flow of the game.
- Classification pie charts for your mistake breakdown.
- Full move log with every classification.

### 🎯 Training & Puzzles
- A steady stream of Lichess-sourced puzzles.
- Rating filter so puzzles match your level.
- Hints, retry, and skip.
- A streak flame with tiers that rewards consistent daily practice.

### 🛠️ Play & Tools
- **Play vs. Computer** — face the Stockfish engine at your chosen strength.
- **Local multiplayer** — play a friend on the same device.
- **Full chess clock** with all the time controls you'd expect.
- **Post-match analysis** — jump straight into a full breakdown with re-analysis at different strengths.

### 🎨 Customizable Board
- **13 board themes** to match your style.
- **Premove support** — queue your next move while your opponent thinks.
- **Arrows & highlights** to annotate lines.
- **Keyboard shortcuts** for fast navigation.
- **Focus / fullscreen mode** to eliminate distractions.
- **Live evaluation bar** alongside the board.

### 👥 Community & Profiles
- Community leaderboard with estimated ratings.
- Public user profiles with games and stats.
- Share games with shareable URLs, download PGNs, or copy FEN positions.
- **Google sign-in** or instant **guest login** — no friction to get started.

### 📱 Local-First & Offline-Friendly
- Games and favorites cached on your device for instant loading.
- Service worker keeps the app working offline.
- The engine runs locally, so analysis works even without a connection.
- Smart batched syncing keeps your data safe across devices.

### 🔒 Privacy-First
- **100% free** — no subscriptions, no paywalls, no premium tiers.
- **Open source** — the entire codebase is public under the Apache 2.0 license.
- **Runs in your browser** — heavy analysis happens on your own device, not on a server that tracks you.

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS 4** + **Motion** for animations
- **chess.js** + **react-chessboard** for board logic
- **Stockfish 18 Lite** (WebAssembly) for engine analysis
- **Firebase** (Auth + Firestore) for accounts and cloud sync
- **Supabase** for profile sync
- **Turso (libSQL)** for server-side data via Cloudflare Pages Functions
- **Zustand** for state management

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Create your .env from the template (see .env.example)
cp .env.example .env

# Start the dev server
npm run dev        # http://localhost:3000

# Lint
npm run lint

# Production build
npm run build
Environment VariablesVariablePurposeVITE_FIREBASE_API_KEYFirebase web API keyVITE_FIREBASE_AUTH_DOMAINFirebase auth domainVITE_FIREBASE_PROJECT_IDFirebase project IDVITE_FIREBASE_STORAGE_BUCKETFirebase storage bucketVITE_FIREBASE_MESSAGING_SENDER_IDFirebase messaging sender IDVITE_FIREBASE_APP_IDFirebase app IDVITE_SUPABASE_URLSupabase project URLVITE_SUPABASE_ANON_KEYSupabase anon (publishable) keyTURSO_DATABASE_URLTurso DB URL (server-side only — never VITE_-prefixed)TURSO_AUTH_TOKENTurso auth token (server-side only — never VITE_-prefixed)Security note: VITE_-prefixed variables are inlined into the public client bundle. Turso credentials are deliberately not VITE_-prefixed — they are only used server-side by the Cloudflare Pages Functions and the puzzle sync script.☁️ DeploymentFirebase HostingBashfirebase login
npm run build
firebase deploy
Cloudflare Pages FunctionsThe server-side API (/api/*) runs as Cloudflare Pages Functions. Set the following secrets in the Cloudflare Pages dashboard:TURSO_DATABASE_URLTURSO_AUTH_TOKENLICHESS_API_TOKEN (optional, for puzzle pool refills)Important: the Turso secrets must not be VITE_-prefixed. VITE_-prefixed variables are inlined into the public client bundle, so a VITE_TURSO_* secret would ship the database credential to every visitor if ever referenced via import.meta.env. The functions read TURSO_* first and fall back to VITE_TURSO_* for backward compatibility — rename existing secrets to the unprefixed names.🔐 SecurityTurso credentials are never exposed to the client — all database access is proxied through server-side Cloudflare Pages Functions using context.env secrets.Analysis cache is stored locally on-device (localStorage), not in a shared database.Firestore rules are user-scoped: users can only read/write their own documents.Supabase uses Row-Level Security with per-user policies.A strict Content-Security-Policy is shipped with the app.📄 LicenseApache License 2.0 — free to use, modify, and share.☕ Support the ProjectFinalRank is 100% free and open source. If it helps you improve your chess, consider supporting the project:Donations help cover database costs, enable server-side analysis options on Cloudflare, and fund a proper domain for the site.🙏 CreditsStockfish — the strongest open-source chess engineLichess — puzzle database and game importChess.com — game importchess.js — chess logic♟️ FinalRank (باللغة العربية)🌐 اللغات / Languages: العربية | Englishمنصة مفتوحة المصدر ومجانية لتحليل الشطرنج. تحليل عميق باستخدام محرك Stockfish، تقييم ونقد كل حركة، شرح مبسط لكل خطأ، ألغاز تدريبية، وأدوات شطرنج كاملة — كل ذلك مباشرة داخل متصفحك. بدون اشتراكات، بدون إعلانات، وبدون ميزات مدفوعة.🤔 لماذا لا نستخدم Lichess فقط؟سؤال في محله. موقع Lichess ممتاز وهو مجاني بالكامل، لذا لا نتنافس على السعر، بل نتنافس على جودة وطريقة التحليل: يعمل محرك Stockfish بعمق داخل متصفحك، وتصنف كل حركة، مع تقديم شرح ملائم باللغة الطبيعية لكل خطأ.الميزةFinalRankLichessChess.comتقييم الحركة خطوة بخطوة✅ تقييم وشرح كل حركة واقتراح نقلة أفضل❌ مراجعة بعد نهاية المباراة فقط❌ مراجعة بعد نهاية المباراة فقطالسعرمجاني للأبدمجاني (يعتمد على التبرعات)خطة مجانية + اشتراك مدفوعمصدر مفتوح✅ ترخيص Apache 2.0✅ ترخيص AGPL❌ مغلق المصدرالتحليل العميقمجاني حتى عمق 18متوفريتطلب اشتراكاً مدفوعاًموقع محرك التحليلداخل المتصفح (يعمل بدون إنترنت)على السيرفرعلى السيرفرالحساب الشخصيتسجيل كضيف بدون الحاجة لحسابالحساب اختياريالحساب إجبارياستيراد المبارياتمن Chess.com و Lichessمن Chess.com و Lichessمن Lichess فقط (بشكل محدود)الإعلاناتلا يوجدلا يوجدإعلانات في النسخة المجانية✨ المميزات🎓 تقييم ونقد النقلات حركة بحركةتقييم كل نقلة فور حدوثها: عبقرية (brilliant)، الأفضل (best)، غير دقيقة (inaccuracy)، خطأ (mistake)، خطأ فادح (blunder).شرح مبسط: يوضح سبب كون النقلة سيئة وما كان يجب عليك لعبه بدلاً منها.تجربة النقلة الأفضل: بنقرة واحدة يمكنك إعادة تشغيل السلسلة المحسنة لاستشعار الفارق.مدرب ذكاء اصطناعي اختياري: يمكنك إضافة مفتاح API الخاص بك (متوافق مع OpenAI) للحصول على ملاحظات ذكية من النماذج اللغوية. مفتاحك يظل محفوظاً في متصفحك فقط.📥 استيراد المبارياتاستيراد من Chess.com: سحب حتى 50 مباراة حديثة مباشرة من حسابك، أو ربط حسابك بضغطة زر.استيراد من Lichess: استيراد حتى 50 مباراة من Lichess أيضاً.لصق صيغة PGN: لصق أي مباراة بصيغة PGN القياسية وتحليلها فوراً.تحليل تلقائي: تحليل المباريات المستوردة بمجرد تحميلها.🧠 تحليل المحرك (Stockfish داخل المتصفح)Stockfish 18 Lite مدمج بتقنية WebAssembly — يعمل محلياً على جهازك دون الحاجة لسيرفر ودون انتظار.عمق قابل للتعديل من 6 إلى 18 — بداية من القراءة السريعة وحتى التحليل العميق.معالجة متوازية (1–8x) — نتائج أسرع على الأجهزة القوية.MultiPV: عرض عدة مسارات رئيسية ممتازة بدلاً من المسار الأول فقط.التعرف على كتاب الافتتاحيات: معرفة ما إذا كنت تلعب ضمن النظريات المعروفة.تخزين FEN وتجهيز المحرك: إمكانية تحليل الوضعيات المكررة بشكل أسرع.يعمل بدون إنترنت: يعمل المحرك بالكامل على جهازك.🏷️ تصنيفات النقلاتتُقيم كل حركة باستخدام نظام تصنيف غني يعتمد على منطق فقدان النقاط المتوقعة:عبقرية · الأفضل · ممتازة · جيدة · افتتاحية · غير دقيقة · خطأ · خطأ فادح · فرصة فوز ضائعة · حاسمة · إجبارية · قطعة مجانية · حادة · تهديد · تراجع · كش مات · انسحاب · تعادل · فائزتحصل كل حركة على شارة واضحة على اللوحة لتكتشف فوراً أين كسبت أو خسرت المباراة.🔮 وضع "ماذا لو" / وضع الفرضياتاستكشف مسارات بديلة على اللوحة وشاهد تغير التقييم في الوقت الفعلي.📊 تقرير ما بعد المباراةدرجات الدقة لكلا اللاعبين.رسم بياني للتقييم (eval) يوضح سير المباراة.رسوم بيانية دائرية لتصنيف أخطائك.سجل كامل لجميع النقلات مع تصنيف كل نقلة.🎯 التدريب والألغازتدفق مستمر للألغاز المأخوذة من Lichess.تصفية الألغاز بناءً على التقييم لتناسب مستواك.تلميحات، إعادة المحاولة، والتخطي.نظام الحفاظ على الأداء اليومي (Streak) بمستويات تشجع على الاستمرار.🛠️ اللعب والأدواتاللعب ضد الكمبيوتر: مواجهة محرك Stockfish بالمستوى الذي تختاره.لعب محلي متعدد اللاعبين: اللعب مع صديق على نفس الجهاز.ساعة شطرنج كاملة: تحتوي على جميع خيارات التوقيت المتوقعة.تحليل ما بعد المباراة: الانتقال المباشر للتحليل الكامل مع إمكانية إعادة التحليل بقوة مختلفة.🎨 تخصيص اللوحة13 ثيم/مظهر للوحة لتناسب ذوقك.دعم النقل المسبق (Premove): تجهيز نقلتك أثناء تفكير منافسك.أسهم وتظليل لتوضيح المسارات والخطط.اختصارات لوحة المفاتيح للتنقل السريع.وضع التركيز / الشاشة الكاملة لإلغاء التشتيت.شريط تقييم مباشر بجانب اللوحة.👥 المجتمع والملفات الشخصيةقائمة متصدرين للمجتمع مع التقييمات التقديرية.ملفات شخصية عامة تعرض المباريات والإحصائيات.مشاركة المباريات عبر روابط خاصة، أو تحميل ملفات PGN، أو نسخ وضعيات FEN.تسجيل الدخول عبر Google أو الدخول كضيف فوراً بدون أي تعقيد.📱 أولوية المعالجة المحلية ودعم العمل بدون إنترنتحفظ المباريات والمفضلات مؤقتاً على جهازك لتحميلها فوراً.استخدام Service Worker لإبقاء التطبيق شغالاً بدون اتصال بالإنترنت.يعمل المحرك محلياً، مما يعني أن التحليل يعمل حتى بدون إنترنت.مزامنة ذكية دفعة واحدة للحفاظ على أمان بياناتك عبر الأجهزة.🔒 الخصوصية أولاًمجاني 100%: لا اشتراكات، لا جدران دفع، ولا ميزات مدفوعة.مصدر مفتوح: الكود المصدري بالكامل متاح للجميع تحت ترخيص Apache 2.0.يعمل في متصفحك: عمليات التحليل الثقيلة تتم على جهازك الشخصي، وليس على سيرفر يتتبع بياناتك.🛠️ تقنيات المشروع (Tech Stack)React 19 + TypeScript + Vite 6Tailwind CSS 4 + Motion للتحريك والمؤثراتchess.js + react-chessboard لمنطق الشطرنج واللوحةStockfish 18 Lite (WebAssembly) لمحرك التحليلFirebase (Auth + Firestore) للحسابات والمزامنة السحابيةSupabase لمزامنة الملف الشخصيTurso (libSQL) للبيانات من جانب السيرفر عبر Cloudflare Pages FunctionsZustand لإدارة حالة التطبيق (State Management)🚀 بدء التشغيلBash# تثبيت الحزم والمكتبات
npm install

# إنشاء ملف البيئة .env من القالب (راجع .env.example)
cp .env.example .env

# تشغيل سيرفر التطوير
npm run dev        # http://localhost:3000

# فحص الكود (Lint)
npm run lint

# بناء نسخة الإنتاج
npm run build
متغيرات البيئة (Environment Variables)المتغيرالغرضVITE_FIREBASE_API_KEYمفتاح Firebase Web APIVITE_FIREBASE_AUTH_DOMAINنطاق مصادقة FirebaseVITE_FIREBASE_PROJECT_IDمعرف مشروع FirebaseVITE_FIREBASE_STORAGE_BUCKETمساحة تخزين FirebaseVITE_FIREBASE_MESSAGING_SENDER_IDمعرف مرسل رسائل FirebaseVITE_FIREBASE_APP_IDمعرف تطبيق FirebaseVITE_SUPABASE_URLرابط مشروع SupabaseVITE_SUPABASE_ANON_KEYالمفتاح العام (Anon) لـ SupabaseTURSO_DATABASE_URLرابط قاعدة بيانات Turso (لجانب السيرفر فقط — لا تضع بادئة VITE_)TURSO_AUTH_TOKENرمز مصادقة Turso (لجانب السيرفر فقط — لا تضع بادئة VITE_)ملاحظة أمنية: المتغيرات التي تبدأ بـ VITE_ تُضمّن علناً داخل حزمة العميل (Client Bundle). بيانات اعتماد Turso لا تحتوي على البادئة VITE_ عمداً — فهي تُستخدم فقط من جانب السيرفر عبر Cloudflare Pages Functions وسكربت مزامنة الألغاز.☁️ النشر (Deployment)استضافة FirebaseBashfirebase login
npm run build
firebase deploy
Cloudflare Pages Functionsواجهة برمجة التطبيقات من جانب السيرفر (/api/*) تعمل كـ Cloudflare Pages Functions. يرجى ضبط الأسرار التالية في لوحة تحكم Cloudflare Pages:TURSO_DATABASE_URLTURSO_AUTH_TOKENLICHESS_API_TOKEN (اختياري، لإعادة ملء بنك الألغاز)هام: أسرار Turso يجب ألا تحتوي على البادئة VITE_. لأن المتغيرات التي تبدأ بـ VITE_ تظهر علناً للمستخدمين، مما قد يتسبب في تسريب بيانات قاعدة البيانات إذا تم استدعاؤها عبر import.meta.env. تقرأ الدوال المتغيرات باسم TURSO_* أولاً ثم تعود لـ VITE_TURSO_* للتوافق مع الإصدارات السابقة — يرجى إعادة تسمية الأسرار وتجريدها من البادئة.🔐 الأمانبيانات اعتماد Turso لا تظهر أبداً للمستخدم النهائي — يتم الوصول لقاعدة البيانات عبر وكيل سيرفر Cloudflare Pages Functions باستخدام أسرار context.env.يُحفظ التخزين المؤقت للتحليل محلياً على الجهاز (localStorage)، وليس في قاعدة بيانات مشتركة.قواعد Firestore مخصصة لكل مستخدم: يستطيع المستخدمون قراءة وكتابة مستنداتهم الخاصة فقط.يطبق Supabase أماناً على مستوى الصفوف (Row-Level Security) بسياسات لكل مستخدم.يتم إرسال سياسة أمان محتوى صارمة (Content-Security-Policy) مع التطبيق.📄 الترخيصرخصة Apache 2.0 — مجاني للاستخدام، التعديل، والمشاركة.☕ دعم المشروعمشروع FinalRank مجاني ومفتوح المصدر بنسبة 100%. إذا ساعدك المشروع على تحسين مستواك في الشطرنج، يمكنك دعمه من هنا:تساعد التبرعات في تغطية تكاليف قواعد البيانات، وتفعيل خيارات التحليل من جانب السيرفر على Cloudflare، وتمويل شراء دومين/نطاق خاص بالموقع.🙏 شكر وتقديرStockfish — أقوى محرك شطرنج مفتوح المصدر.Lichess — قاعدة بيانات الألغاز واستيراد المباريات.Chess.com — استيراد المباريات.chess.js — منطق وقواعد الشطرنج.
