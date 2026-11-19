# Chess 3D

> **Play Live:** **[https://archive.mikehiggins.me.uk/notes/board-games/chess/](https://archive.mikehiggins.me.uk/notes/board-games/chess/)**

An interactive, self-contained 3D chess web application built with **React 19**, **TypeScript**, **Three.js** (`@react-three/fiber`, `@react-three/drei`, `@react-spring/three`), **chess.js**, and **Tailwind CSS**. It renders procedural 3D chess sets in WebGL and runs an in-browser chess AI opponent with six difficulty levels—requiring no backend server or external 3D model assets.

## Features

- **Board themes**: Wood, Tournament, Marble, Glass, Stone, Forest (moss) and Seabed (rippled sand and water caustics). The textures are generated in code, and Auto pairs each piece set with a board that suits it. Coordinates are drawn on the frame.
- **Studio lighting with no downloads**: An environment map built from drei `Lightformer`s plus a rim light, so the app loads with no third-party requests.
- **Motion**: Captured pieces sink away, knights hop, a checkmated king topples, the camera shakes slightly on check, and confetti falls when you win. All of it is turned off when the OS asks for reduced motion.
- **Analysis mode**: An optional evaluation bar and best-move arrow for the live game or any position you're reviewing. It runs in its own Web Worker and pauses while the computer thinks.
- **Light on the machine**: The 3D view renders only when something changes (zero frames while idle), the pieces share materials and geometries, and the code is split so the app itself is about 23 kB gzip.
- **Resilient**: If WebGL is unavailable the board area explains why and the rest of the app keeps working. If the browser resets the GPU context, a notice appears and the scene recovers by itself.
- **Interactive 3D Board & Camera**: Orbit, pan, and zoom around the board with constrained polar angles and distance limits, and shadows from a `2048×2048` shadow map.
- **5 Procedural 3D Piece Sets**: Switch live between **Classic**, **Sci-Fi**, **Fantasy**, **Forest** and **Underwater**, all generated procedurally in Three.js.
  - **Forest**: acorn pawns, tree-stump rooks, stag-head knights with leafy antlers, pine-tree bishops, a blossom-tree queen and a great-oak king. Birch and spring leaves against walnut and autumn leaves.
  - **Underwater**: jellyfish pawns, coral turrets, seahorse knights, conch-shell bishops, an octopus queen and a trident king. Iridescent pearl against deep navy, with glowing accents.
- **Spring-Animated Piece Movement**: Persistent piece identity tracking enables smooth `@react-spring/three` transitions, including the rook when castling and the pawn when promoting.
- **In-Browser AI Opponent**: Six difficulty tiers (**Beginner** through **Master**). A negamax/alpha-beta engine runs in a **Web Worker**, so the page never freezes while it thinks.
- **Full Chess Rules**: Legal move highlighting, castling, en passant, pawn promotion with a piece picker, and named results for checkmate, stalemate, threefold repetition, insufficient material and the fifty-move rule.
- **Play as White or Black**: Side selection, captured-piece tracking, algebraic (SAN) move history, light/dark theme persistence (`localStorage`), fullscreen mode, and a responsive mobile controls drawer.

- **Play your way**: Drag pieces or click to move. Undo takes back your move and the reply. Hints show the engine's suggestion as an arrow. Click any move in the history (or use ← / →) to review earlier positions.
- **New game, result and import/export dialogs**: Choose White, Black or Random. When a game ends you can rematch, copy the PGN or close the result to study the board. You can paste a FEN or PGN to play from it, or copy a link that opens the current position.
- **Picks up where you left off**: The current game, settings, theme and mute state are saved in the browser.
- **Fits any screen**: The camera frames the whole board at any aspect ratio. There is a top-down view and a reset-view button, and on phones the panel becomes a bottom sheet.
- **Accessible**: Keyboard play on the focused board (arrow keys, Enter, Esc). Moves are announced to screen readers. The app respects reduced-motion settings and shows visible focus outlines.
- **Sound**: Short synthesized move, capture, check, castle and game-end sounds, with a mute toggle.

---

## Tech Stack

| Layer           | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| UI Framework    | React 19, TypeScript 5.9                                      |
| Build Tool      | Vite 6                                                        |
| 3D Rendering    | Three.js (`three`), `@react-three/fiber`, `@react-three/drei` |
| 3D Animation    | `@react-spring/three`                                         |
| Chess Logic     | `chess.js`                                                    |
| Styling & Icons | Tailwind CSS 3, `lucide-react`                                |

---

## Project Structure

```text
src/
├── App.tsx                         # Layout, canvas, header controls, mobile sheet, keyboard, sounds, dialogs
├── main.tsx                        # React entry point
├── index.css                       # Tailwind base styles
├── types/chess/chess.ts            # PieceSet type and list
├── engine/
│   ├── search.ts                   # Negamax engine: iterative deepening, alpha-beta, TT, quiescence
│   ├── fastBoard.ts                # Fast make/unmake adapter over chess.js internals (chess.js pinned)
│   ├── levels.ts                   # Difficulty levels (depth, time budget, noise)
│   ├── engine.worker.ts            # Web Worker entry that runs search()
│   └── engineClient.ts             # Promise API for the worker, with instant cancellation
├── game/
│   ├── gameLogic.ts                # Results, captures, material balance, spoken move descriptions
│   ├── gameIO.ts                   # FEN/PGN import and export, saved state, share links
│   └── pieceTracking.ts            # Keeps 3D piece identities across moves for animation
├── hooks/
│   ├── chess/useChessGame.ts       # Game state, input, undo, hints, review, import/export, engine turns
│   ├── chess/useEngine.ts          # One engine worker per mounted game
│   ├── useSounds.ts                # Synthesized move sounds with a persisted mute toggle
│   └── usePrefersReducedMotion.ts  # Tracks the OS reduced-motion setting
├── utils/clipboard.ts              # Copy to clipboard with a fallback
└── components/
    ├── ui/Modal.tsx, ui/styles.ts  # Accessible dialog and shared button and form styles
    └── chess/
        ├── ChessBoard3D.tsx        # Board surface, overlays, captured-piece ghosts, pointer and drag input
        ├── boardThemes.ts          # Board themes and procedural board, frame and glow textures
        ├── SceneLighting.tsx       # Lightformer environment, key light and rim light
        ├── SceneEffects.tsx        # First-frame signal, check camera shake, win confetti
        ├── SceneLoader.tsx         # "Setting up the board…" overlay
        ├── MaterialBar.tsx         # Material balance meter
        ├── CameraRig.tsx           # Fits the camera to the viewport; angled and top-down views
        ├── AnimatedPiece.tsx       # Shared piece motion: springs, knight arc, drag, glow, topple
        ├── ChessPiece3D.tsx        # Procedural Classic pieces
        ├── ChessPieceSciFi3D.tsx   # Procedural Sci-Fi pieces
        ├── ChessPieceFantasy3D.tsx # Procedural Fantasy pieces
        ├── ChessPieceForest3D.tsx  # Procedural Forest pieces
        ├── ChessPieceUnderwater3D.tsx # Procedural Underwater pieces
        ├── pieceGeometry.ts        # Cached lathe, extrude and tube builders for piece sets
        ├── pieceSetLoaders.ts      # Lazy loaders for the non-Classic sets
        ├── GamePanel.tsx           # Status, undo/hint, settings, captures, moves
        ├── MoveHistory.tsx         # Clickable move list with review controls
        ├── NewGameDialog.tsx, GameOverDialog.tsx, ImportExportDialog.tsx, PromotionPicker.tsx
        └── CapturedPieces.tsx      # Captured material with material lead
e2e/smoke.spec.ts                   # Playwright end-to-end tests
docs/IMPROVEMENT_PLAN.md            # Phased roadmap
```

---

## Architecture & Implementation Details

### 1. 3D Scene & Rendering Pipeline (`App.tsx`, `ChessBoard3D.tsx`)

- **Canvas & Camera**: `App.tsx` mounts a `@react-three/fiber` `<Canvas shadows>` with a `PerspectiveCamera` (`fov: 45`) and `OrbitControls`. `CameraRig.tsx` works out the camera distance from the viewport's aspect ratio so the whole board always fits, and switches between the angled and top-down views.
- **Input**: `ChessBoard3D.tsx` handles pointer events itself. It casts the pointer ray onto the board plane to find the square, so a press on any part of a square counts. Pressing your own piece selects it and turns off orbiting while you drag; releasing over a square plays the move. A press that barely moves counts as a click.
- **Lighting** (`SceneLighting.tsx`): A 256px environment map baked once from virtual softboxes (drei `Lightformer`), a shadow-casting key light, low ambient light and a cool rim light from behind. Nothing is fetched over the network.
- **Board surface** (`boardThemes.ts`): Each theme draws its 64 squares (wood grain, marble veins, stone speckle, glass edges) into one canvas texture on a single plane. The frame texture carries the coordinates, drawn for the player's side. Last move, selection, check, move markers and the keyboard cursor are transparent overlays.
- **Styling**: Colours are CSS-variable tokens (`bg`, `fg`, `muted`, `surface`, `ok`, `warn`, `bad`, `info`) defined in `index.css` and mapped in `tailwind.config.js`. Every token meets WCAG AA contrast in both themes.
- **Piece Identity & Animation**: `game/pieceTracking.ts` gives each piece a persistent ID and applies each move to those pieces (captures, en passant, castling rook, promotion), so `@react-spring/three` animates them between squares. Any other position change, such as a new game, rebuilds the set.
- **Square Highlights**: Distinct colors indicate the active selection (`#BACA44`), last move (`#F5F682` / `#BACA44`), and legal destination squares on the `#EEEED2` / `#769656` board.

### Rendering performance

- **On demand**: `<Canvas frameloop="demand">`. Animations (piece springs, the knight arc, selection bob, capture ghosts, confetti, the check shake) call `invalidate()` only while they run, so an idle board renders no frames. While orbiting, `AdaptiveDpr` and `OrbitControls regress` lower the resolution.
- **Shared resources**: `sharedResources.ts` and `Shared.tsx` hand out one material and one geometry per distinct definition, attached as `<primitive>` objects, which React Three Fiber never disposes.
- **Budgets**: `e2e/perf.spec.ts` checks for zero idle frames, fewer than 600k triangles, at most 20 materials and at most 40 geometries.
- **Bundles**: `vite.config.ts` splits three, react-three/spring and react into long-cached chunks; the Sci-Fi and Fantasy sets are lazy-loaded and preloaded when the browser is idle.

### Error handling

- `ErrorBoundary` around the canvas shows a "3D view unavailable" notice. `ContextLossWatcher` shows "Graphics paused" while the WebGL context is lost.
- `utils/errorReporting.ts` logs uncaught errors and rejections. If the build sets `VITE_ERROR_ENDPOINT`, it also posts a small JSON report (message, stack, path, time; no game or user data) with `navigator.sendBeacon`, skipping duplicates and sending at most 10 per page load.

### 2. Game State & Rules (`useChessGame.ts`, `game/`)

- A single `chess.js` instance is the source of truth. A `version` counter triggers re-renders, and history, result, captures and material balance are all derived from the instance rather than stored separately.
- Player input is accepted only on the player's turn. Promotions open a picker. "Play as" can only change before the first move or after the game ends, and difficulty changes apply from the engine's next move.

### 3. AI Engine (`src/engine/`)

The engine runs in a Web Worker. Each search is a negamax alpha-beta search with iterative deepening under a time budget, a transposition table keyed on the Zobrist hash, quiescence search on captures and promotions, MVV-LVA move ordering, and piece-square tables with a separate endgame king table. The full move list is sent with each request so the engine sees repetitions.

Cancelling a search (new game, switching sides, unmounting) terminates the worker immediately, so a stale move can never land on a new board. A fresh worker starts for the next search.

For speed the search uses chess.js's internal move generator through `fastBoard.ts`, about 25 times faster than the public API. chess.js is pinned to an exact version, and `fastBoard.test.ts` checks the adapter against perft counts and the public API.

| Difficulty | Approx. Elo | Max depth | Time budget | Root noise |
| ---------- | ----------- | --------- | ----------- | ---------- |
| Beginner   | 600         | 1         | 0.3 s       | ±250 cp    |
| Easy       | 900         | 2         | 0.5 s       | ±120 cp    |
| Medium     | 1200        | 3         | 0.8 s       | ±40 cp     |
| Hard       | 1500        | 5         | 1.5 s       | —          |
| Expert     | 1700        | 8         | 2.5 s       | —          |
| Master     | 1900        | 20        | 4 s         | —          |

The weaker levels score every root move and add random noise before choosing, so they make human-like mistakes but never miss a forced mate. The Elo numbers are rough hints, not measured ratings.

---

## How to Adapt This Engine (for Remorse Chess)

Because this project uses `chess.js` for board representation and a **pure TypeScript AI** in `src/hooks/chess/useStockfish.ts` (rather than an external Stockfish WASM binary), you have full control over both rule enforcement and AI decision-making.

### Recommended Adaptation Pattern

1. **Create a Shared Variant Rule Module** (e.g., `src/rules/remorseChess.ts`):
   - Centralize all Remorse Chess rule logic in one place so the UI and AI stay in sync.
   - If Remorse Chess builds on standard piece movement (e.g., filtering legal moves, post-move penalties, undo/regret mechanics, or custom win conditions), wrap `chess.js` methods (`getLegalMoves(game, variantState)`, `applyVariantMove(game, move, variantState)`, `getVariantGameOver(game, variantState)`).
   - If Remorse Chess alters how pieces move or changes check/pin legality, implement custom move generation and board state transitions here instead of delegating to `game.moves()`.
2. **Extend Game State (`src/types/chess/chess.ts` & `src/hooks/chess/useChessGame.ts`)**:
   - Add any variant-specific fields (e.g., remorse tokens, pending penalty/undo state, turn modifiers) to `GameState`.
   - Route `handleSquareClick` and `syncGameState` in `useChessGame.ts` through your shared rule module instead of calling `game.moves()` / `game.move()` directly.
3. **Update the AI Search & Evaluation (`src/hooks/chess/useStockfish.ts`)**:
   - Replace `game.moves({ verbose: true })` and `game.move()` / `game.undo()` inside `minimax`, `orderMoves`, `getBestMoveWithMinimax`, and `getSimpleAIMove` with your variant rule module's move generation and state transitions.
   - Update `evaluateBoard` so the static evaluation accounts for Remorse Chess incentives, penalties, and win/loss states.
4. **Surface Variant UI (`src/components/chess/ChessBoard3D.tsx` & `GamePanel.tsx`)**:
   - Pass any new square highlights or action prompts (such as remorse/undo triggers or restricted squares) into `ChessBoard3D` and `GamePanel`.

---

## How to Make This Two-Player (Online Multiplayer)

To support two players competing over the internet, separate **game state authority** from the local client and synchronize moves over a real-time connection.

### 1. Real-Time Transport & Room Backend

- Use a lightweight WebSocket backend—such as **Node.js (`ws` / `Socket.IO`)**, **PartyKit**, **Cloudflare Durable Objects**, or **Supabase Realtime**—to manage game rooms identified by a shareable `roomId` (e.g., `?room=abc123`).
- Keep the server **authoritative**: run `chess.js` (and any Remorse Chess rule module) on the server per room so it:
  - Assigns connecting players to White (`w`) and Black (`b`).
  - Validates every incoming move against the current room state.
  - Rejects out-of-turn or illegal moves and broadcasts the updated `fen`, `lastMove`, `moveHistory`, and `capturedPieces` to both clients.

### 2. Client Networking Hook (`src/hooks/chess/useMultiplayerGame.ts`)

- Implement a `useMultiplayerGame(roomId)` hook with the same return shape as `useChessGame.ts` (`gameState`, `game`, `moveHistory`, `capturedPieces`, `handleSquareClick`, `newGame`, `playerColor`, `isPlayerTurn`).
- In online mode, disable the local `useStockfish` AI turn trigger.
- When `handleSquareClick` completes a legal move locally, emit `{ type: 'move', from, to, promotion }` to the server.
- When a `state` message arrives from the server, update `gameRef.current.load(fen)` and call `syncGameState()`. Because `ChessBoard3D.tsx` tracks pieces by persistent IDs across FEN changes, opponent moves will automatically animate smoothly with `@react-spring/three`.

### 3. UI & Session Controls (`src/App.tsx` & `GamePanel.tsx`)

- Add a mode toggle (**vs AI** / **Online 2P**) and a **Create / Join Room** control with a copyable invite URL.
- Display connection status (waiting for opponent, connected, opponent disconnected) and optional multiplayer actions such as **Offer Draw**, **Resign**, and **Rematch**.

---

## Local Development

### Prerequisites

- Node.js 20.19+ (or 22.13+) and npm

### Setup & Commands

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Type-check and build production bundle to dist/
npm run build

# Preview production build locally
npm run preview

# Type-check, lint and run unit tests
npm run check

# End-to-end smoke tests (first run: npx playwright install chromium)
npm run test:e2e

# Format with Prettier
npm run format
```

## Deployment

`npm run build` runs `tsc --noEmit && vite build` and outputs static assets to `dist/`, ready to host on any static hosting provider (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).
