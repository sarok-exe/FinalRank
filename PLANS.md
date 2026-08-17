# FinalRank — Plans & Feature Log

Working convention: every planned idea goes here BEFORE work starts; every shipped
feature is moved to "Implemented" (with commit hash) as soon as it lands. This file
is the single source of truth for what we want and what we have.

## In Progress (current batch)

- (batch shipped; next ideas land here first.)

## Implemented

- 2026-08-17 (27d8bcd) Local-first persistence, engine caching, board cleanup,
  exploration fix. Data: localStore.ts device cache (favorites + games in
  localStorage), Firestore 3s probe skips when blocked by ad-blockers, saves
  never hang/fail, Profile + Recent Games render instantly from device.
  Engine: Cache API + blob-URL worker for stockfish (no re-download), 62
  classification icons precached at startup. Board: black border replaced with
  surface-matching frame, drag markers use move-trail color (no black lines).
  Exploration: key prop on Chessboard prevents piece confusion during
  hypothesis mode transitions. PVC premove verified working end-to-end.

- 2026-08-16 (faf1a57) Post-match analysis, board unification, favorites data
  fixes. Board: classification symbol parallel to the piece (corner, visible
  during the slide, arrives together with the move; min(26px,36%)). Analysis:
  opens in Regular mode by default; ?post=1 flow auto-analyzes the match and
  shows options — Play new match / Re-analyze (Weaker d8 / Same d15 / Stronger
  d18). Tools: Analyze button after the match (vs Computer + vs Player) with a
  "this will finish the match" confirmation when mid-game, reuses the import
  pipeline; PvP board size now matches the Player vs Computer board. Data:
  favorites persist (setDoc merge — no more userSaved clobbering), save errors
  surface instead of fake success, unfavorite keeps the game in the library,
  Profile gains a Recent Games list + tab re-fetch, games list falls back to
  Turso when Firestore is unavailable.

- 2026-08-16 (88d3291) Board: classification badge above pieces, latched badge
  (no more disappearing icons), symbols +20%. Analysis: removed duplicated
  elements (tab bar, game-info-card, big heart, engine subtitle), inline report +
  favorites, flexible engine panel, gold winner treatment, analyzed pill on both
  pages, centered mode toggle, board always returns to the start position when
  analysis completes.
- (f2de540) Instant favorite, badge clipping fix, free-move analysis in Regular,
  what-if removal in Advanced.
- (a795bd5) Analysis page Regular/Advanced split.
- (058a564) Rewind-on-analyze — pieces return to start in lockstep with progress.
- (e5f4bd4) Analysis restructure — two-tab layout, heart button, what-if at board
  bottom.
- (49941c1) Fixed page freeze after analyzing — throttled engine progress updates.
- (ec46ddf) Board core: flicker fix, drag legal-square rings, symbol clipping.
- (a5bac53) Premove everywhere + chess.com-inspired theme.
- (747dc49) Settings, dead-code cleanup, refresh fixes.

## Future plans (with time)

- A real second engine (stronger/weaker binaries) — re-analysis "on another
  engine" currently maps to depth presets because only Stockfish 18 Lite exists.
- Anonymous → Google account linking so saved games survive the identity switch.
- Possibly: classification symbol attached to the moving piece (travels with it
  mid-slide) as a future option.
- More post-match analysis options as they come up.
