# FinalRank ♟️

**A completely free & open-source chess analysis platform** — deep Stockfish engine analysis, AI coaching, move-by-move classifications, training puzzles, and a full chess toolbox, all running in your browser. No subscriptions. No ads. No locked features.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sarok_ibnx)

---

## ✨ Features

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

### 🎓 AI Coach
An AI Coach panel explains your mistakes in **plain English** — why a move was bad, what you should have played instead, and a "try the better move" replay of the improved line.

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

## 🆚 vs Chess.com & Lichess

| | **FinalRank** | **Chess.com** | **Lichess** |
|---|---|---|---|
| **Price** | Free forever | Free tier + paid premium (deep analysis locked behind Diamond) | Free (donation-based) |
| **Open source** | ✅ Apache 2.0 | ❌ Closed source | ✅ AGPL |
| **Deep analysis** | Free, up to depth 18 | Requires paid subscription | Available |
| **Engine location** | In-browser (runs on YOUR device, offline) | Server-side | Server-side |
| **Ads** | None | Ads on free tier | None |
| **Account** | Guest login, no account needed | Account required for most features | Account optional |
| **Import** | Chess.com **and** Lichess | Lichess only (limited) | Chess.com and Lichess |
| **AI Coach** | Plain-English explanations | Limited free analysis | Basic game review |
| **Architecture** | Local-first, offline-capable | Cloud-dependent | Cloud-dependent |

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
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `TURSO_DATABASE_URL` | Turso DB URL (server-side only — **never** `VITE_`-prefixed) |
| `TURSO_AUTH_TOKEN` | Turso auth token (server-side only — **never** `VITE_`-prefixed) |

> **Security note:** `VITE_`-prefixed variables are inlined into the public client bundle. Turso credentials are deliberately **not** `VITE_`-prefixed — they are only used server-side by the Cloudflare Pages Functions and the puzzle sync script.

---

## ☁️ Deployment

### Firebase Hosting

```bash
firebase login
npm run build
firebase deploy
```

### Cloudflare Pages Functions

The server-side API (`/api/*`) runs as Cloudflare Pages Functions. Set the following secrets in the Cloudflare Pages dashboard:

- `VITE_TURSO_DATABASE_URL`
- `VITE_TURSO_AUTH_TOKEN`
- `LICHESS_API_TOKEN` (optional, for puzzle pool refills)

---

## 🔐 Security

- Turso credentials are **never** exposed to the client — all database access is proxied through server-side Cloudflare Pages Functions using `context.env` secrets.
- Analysis cache is stored locally on-device (localStorage), not in a shared database.
- Firestore rules are user-scoped: users can only read/write their own documents.
- Supabase uses Row-Level Security with per-user policies.
- A strict Content-Security-Policy is shipped with the app.

---

## 📄 License

[Apache License 2.0](LICENSE) — free to use, modify, and share.

---

## ☕ Support the Project

FinalRank is 100% free and open source. If it helps you improve your chess, consider supporting the project:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sarok_ibnx)

Donations help cover database costs, enable server-side analysis options on Cloudflare, and fund a proper domain for the site.

---

## 🙏 Credits

- [Stockfish](https://stockfishchess.org/) — the strongest open-source chess engine
- [Lichess](https://lichess.org/) — puzzle database and game import
- [Chess.com](https://www.chess.com/) — game import
- [chess.js](https://github.com/jhlywa/chess.js) — chess logic
