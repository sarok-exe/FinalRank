# Handoff — Chess.com Avatars & Analysis Layout Redesign

## Changes Made

### 1. Chess.com Player Avatar Extraction
- **`src/types.ts`**: Added optional `avatar?: string` to `ChessGame.white` and `ChessGame.black` player objects
- **`src/lib/chessCom.ts`**: Added `fetchChessComPlayerAvatar(username)` and `fetchAvatarsForGames(games)` — fetches avatar URLs from `https://api.chess.com/pub/player/{username}` with deduplication and parallel requests
- **`src/stores/gameStore.ts`**: `importChessComGames` now calls `fetchAvatarsForGames` after loading games from Chess.com

### 2. Layout Restructure (Regular Mode)
- **`src/pages/Analysis.tsx`**:
  - Moved game info card (result, date, player names, accuracy %) from the left column into the right column, positioned between the legendary achievement banner and the move log
  - Right column container changed from fixed `h-[580px]` to `h-auto min-h-[400px]`
  - Move log max-height adjusted from `max-h-[380px]` to `max-h-[420px]`
  - Legendary achievement banner stays above the game info card

### 3. Focus Mode Players Panel
- **`src/pages/Analysis.tsx`**:
  - New `#focus-players-panel` — vertical card showing Black (avatar → name → accuracy) → VS → White (avatar → name → accuracy) → Result/date
  - Uses `flex flex-row justify-center items-center gap-6` layout (both focus-only and focus+fullscreen)
  - `items-center` prevents panel from stretching to match board height

### 4. Avatar Sizing & Styling
- **Regular mode** (game-info-card in right column): `w-[44px] h-[44px] rounded-[10px]`
- **Focus mode** (players panel): `w-[34px] h-[34px] rounded-[10px]`
- Fallback placeholders match these sizes with `rounded-[10px]`
- Bottom player (Black) in regular mode gets `mt-[3px]`
- Bottom player (White) in focus mode gets `mt-[10px]`
- Player names in focus mode: `text-sm` (14px)

### 5. Eval Bar — No Flipping
- **`src/pages/Analysis.tsx`**: `flipped={false}` — eval bar always shows White's perspective regardless of board orientation

## Files Modified
| File | Changes |
|------|---------|
| `src/types.ts` | Added `avatar?: string` to player type |
| `src/lib/chessCom.ts` | Added avatar fetch functions |
| `src/stores/gameStore.ts` | Call avatars on Chess.com import |
| `src/pages/Analysis.tsx` | Layout restructure, focus panel, eval fix |




add leaderboard 
add elo counter 
add pyments methods 

