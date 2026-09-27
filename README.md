# FinalRank ♟️

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
