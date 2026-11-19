# Chess 3D — Improvement Plan

_Drafted 19 Nov 2026 from a full read of the codebase plus a run of the dev server (desktop and 375px mobile). Offline support is out of scope: this is an online app._

## Where things stand

A compact React 19 + Vite + react-three-fiber app (~2,300 lines of source). Three procedurally lathed piece sets, chess.js for rules, and a hand-written minimax AI. It type-checks cleanly, has no dependency vulnerabilities, and looks good at first glance. The main problems are underneath.

### Most important findings

| #   | Finding                                                                                                                                                                                                                                                                                                                        | Evidence                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | **The AI freezes the browser.** Minimax runs synchronously on the main thread, using chess.js `move`/`undo`, with `game.moves()` called inside every evaluation. On Master (depth 6) the tab stayed unresponsive for more than 3 minutes after 1.e4, and a reload couldn't get through. Hard and Expert also stall noticeably. | `useStockfish.ts:193-223, 315-326`                   |
| 2   | **AI turns can't be cancelled.** The effect cleanup is empty (`return () => {}`), so `cancelled` never becomes true. If you start a New Game or change sides while the AI is thinking, the old search still plays its move on the new board. Changing difficulty mid-think also orphans a promise that never resolves.         | `useChessGame.ts:223-225`, `useStockfish.ts:305-307` |
| 3   | **Changing "Play as" mid-game hands your pieces to the AI.** `computerColor` changes straight away, so the effect fires and the engine moves for your side.                                                                                                                                                                    | `useChessGame.ts:30, 131`                            |
| 4   | **Captured pieces go in the wrong columns when you play Black.** The columns are hard-wired as white = Computer and black = You.                                                                                                                                                                                               | `GamePanel.tsx:136-142`                              |
| 5   | **Most draw messages never show.** `isDraw()` is true for stalemate, repetition and insufficient material, so those later branches can't be reached and every draw just says "Draw!". The 50-move rule isn't named at all.                                                                                                     | `useChessGame.ts:39-47`                              |
| 6   | **Promotion always gives a queen.** There's no way to underpromote.                                                                                                                                                                                                                                                            | `useChessGame.ts:75`                                 |
| 7   | **Castling doesn't animate the rook.** Piece tracking only follows `lastMove.from→to`, so the rook is removed and recreated instead of sliding.                                                                                                                                                                                | `ChessBoard3D.tsx:114-163`                           |
| 8   | **The board doesn't fit the viewport.** The camera is a fixed `[0,7.7,7.7]` with fov 45. At 800px wide the a and h files are cut off. At phone width only about 5 files are visible.                                                                                                                                           | screenshots                                          |
| 9   | **Selecting a piece causes a frame hitch.** A `<pointLight>` is mounted on the selected piece, and adding or removing a light forces every material's shader to recompile.                                                                                                                                                     | `ChessPiece*3D.tsx` (selection light)                |
| 10  | **Low-contrast visuals.** White pieces sit on near-white light squares. Move dots are tiny (r=0.12) and pale green, so they are hard to see. There are no rank and file labels.                                                                                                                                                | screenshots, `ChessBoard3D.tsx:27-32, 222-235`       |
| 11  | **Dead and broken styling.** The classes `text-foreground`, `text-muted-foreground` and `scrollbar-thin` don't exist in the Tailwind config (shadcn leftovers). The `.scrollbar-custom` class is defined but never used. Header buttons in dark mode look disabled at mobile size.                                             | `CapturedPieces.tsx`, `MoveHistory.tsx`, `index.css` |
| 12  | **Repo hygiene.** There's a stray `nul` file (a Windows `where` error output) and `.DS_Store` files. A stale `dist/` sits on disk. The engine is called `useStockfish` but isn't Stockfish. `difficulty.depth`/`moveTime`/`elo` are defined but unused.                                                                        | repo root, `types/chess/chess.ts`                    |
| 13  | **Fragile runtime dependency and a big bundle.** `<Environment preset="city">` downloads an HDR from a third-party CDN (raw.githack) on every load. The whole app ships as one 1.35 MB JS chunk.                                                                                                                               | `App.tsx:123`, `dist/assets`                         |
| 14  | **No safety net.** There are no tests, no linter, no formatter and no CI. The three piece-set files (~1,500 lines) copy the same wrapper, spring and selection logic.                                                                                                                                                          | —                                                    |

### Scope

This plan covers standard chess only. The Remorse Chess variant mentioned in the README is out of scope, and so is offline support.

Engine approach: Phase 1 moves the existing TS engine into a Web Worker behind an `Engine` interface. That fixes the freeze with no new dependencies. Phase 4 can then swap in Stockfish behind the same interface.

---

## Status

- **Phase 0: done.** ESLint, Prettier, Vitest (30 unit tests) and Playwright smoke tests are in place, and `npm run check` passes.
- **Phase 1: done.** The engine runs in a worker and can be cancelled. Game state has a single source of truth, results are named, captures are correct when playing Black, sides are locked mid-game, there is a promotion picker, and castling and en passant animate. Not done yet: a measured Elo calibration of the levels.
- **Phase 2: done, except premoves** (marked optional; not built). Added:
  - camera framing that fits any screen, reset view, and a top-down view
  - a mobile bottom sheet
  - drag-and-drop moves, clearer move markers and a check highlight
  - undo and hints
  - move-history review
  - new-game, game-over and PGN/FEN dialogs, plus share links
  - saving the game and settings across reloads
  - keyboard play, screen-reader announcements and reduced motion
  - synthesized sounds
- Also fixed in Phase 2: the board had been drawn mirrored since the original code (a-file on White's right, h1 dark).
- Not verified by ear or by eye: the sounds, and how reduced motion looks. Both are wired up and raise no errors.
- **Phase 3: done.** Added:
  - five board themes (Wood, Tournament, Marble, Glass, Stone), drawn into textures in code; Auto pairs Classic with Wood, Sci-Fi with Glass and Fantasy with Stone
  - coordinates on the frame
  - separate last-move and selection tints
  - a studio lighting rig with a rim light, replacing the third-party HDR download, so the app now makes no external requests
  - a selection glow disc in place of the point light, which removes the selection stutter
  - captured pieces sink away, knights hop in an arc, a small camera shake on check, the mated king topples, and confetti when you win
  - colour tokens that pass WCAG AA in both themes, no text smaller than 12px, and no theme flash on load
  - a material bar
  - a "Setting up the board…" loader
- Not done from Phase 3: drei `ContactShadows`, because it re-renders the scene every frame. The Classic set already has per-piece contact shadows, and the real shadow map covers the rest.
- **Phase 4: done, except the Stockfish backend (needs a licence decision, below) and the library upgrades.** Measured in headless Chromium on the GPU, at the starting position:

  |                                         | Before            | After                                                                                                                     |
  | --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
  | Frames rendered while idle (2 s)        | 120               | **0**                                                                                                                     |
  | Triangles per frame (incl. shadow pass) | 910k              | **444k**                                                                                                                  |
  | Distinct materials                      | 150               | **11**                                                                                                                    |
  | Distinct geometries                     | 121               | **25**                                                                                                                    |
  | App code, gzip                          | one 398 kB bundle | **23 kB** app + cached vendor chunks (three 190, r3f 90, react 69, misc 24); Sci-Fi/Fantasy load on demand (~2.5 kB each) |

  Also added:
  - rendering on demand, with lower resolution while orbiting
  - an error boundary with a "3D view unavailable" notice
  - a notice and automatic recovery when the browser resets the graphics context
  - error reporting that only goes out if `VITE_ERROR_ENDPOINT` is set
  - an analysis mode (evaluation bar and best-move arrow)
  - `e2e/perf.spec.ts`, which fails if these numbers regress

- **Stockfish: not now** (decided 19 Nov 2026). It's GPL-3.0, and shipping it would put the distributed app under GPL terms; the repository has no licence yet. The `Engine` interface is ready if this is revisited.
- **Added on request: Forest and Underwater** piece sets, each with a paired board (Forest moss, Seabed sand and caustics).
  - They are built from the shared `pieceGeometry.ts` helpers and loaded lazily.
  - While adding them I also fixed piece facing: since the Phase 2 board-orientation fix, knights and the other "front" details had been facing their own player.
- **Upgrades (deferred):**
  - TypeScript 7 is blocked: `typescript-eslint` 8.73 supports TypeScript below 6.1 only.
  - Tailwind 4's upgrade tool needs a clean git tree, so commit first.
  - Vite 7 needs Node 20.19+; this machine has 20.18.

## Phase 0 — Foundations (small, do first)

Goal: a clean, safe base to change things on.

- Delete `nul`. Make sure `.DS_Store` and `dist/` stay untracked.
- Add ESLint (typescript-eslint, react-hooks, react-refresh) and Prettier. Turn on `noUnusedLocals`/`noUnusedParameters`.
- Add Vitest + React Testing Library. Write the first tests on pure logic: game-over/result text, captured-piece derivation, square↔position mapping.
- Add Playwright with a single smoke test: the app loads, a canvas is present, and a move can be made through a test hook.
- Add npm scripts `lint`, `test`, `test:e2e` and `typecheck`.
- Move the shared types (`PieceSet`, `EngineMove`) into `src/types` and remove the inline string unions.

**Done when** `npm run lint && npm test && npm run build` passes locally.

## Phase 1 — Correctness and engine responsiveness (highest user impact)

Goal: the game never freezes and never makes an illegal or unexpected move.

- **Engine in a Web Worker.** Define an `Engine` interface: `init`, `search(fen, opts) → {bestMove, eval, pv}`, `stop()`. Move the minimax into `src/engine/worker.ts` and use iterative deepening with a **time budget** (the currently unused `moveTime`) instead of fixed depth. The UI stays at 60 fps whatever the level.
- **Engine performance.** Drop the per-node `game.moves()` mobility call. Add quiescence search for captures so it stops hanging pieces at the horizon. Add a transposition table (Zobrist), and add an endgame king table. Rename `useStockfish` to `useEngine`.
- **Cancellation.** Real effect cleanup. Use a search ID or AbortController so `newGame`, a side switch or a difficulty change stops the running search and throws away stale results.
- **Single source of truth.** Rebuild the game state as a reducer around one `Chess` instance. Derive captured pieces, the move list and the result from `history()` instead of keeping parallel state. That fixes finding 4 and makes undo trivial.
- **Side or difficulty change.** Lock "Play as" during a game (or make it start a new game, after confirming). Allow difficulty to change mid-game but apply it from the next move.
- **Correct results.** Check stalemate, threefold repetition, insufficient material and the 50-move rule _before_ the generic draw. Record who won and how.
- **Promotion picker.** A small overlay offering Q/R/B/N.
- **Castling and en passant animation.** Match pieces by diffing the board using the verbose move (`flags`, `from`/`to`, rook squares) instead of `lastMove` alone.

**Done when** Master depth no longer blocks input (measured by no long tasks over 50 ms in Playwright), and there are unit tests for cancellation, results and captures as Black.

## Phase 2 — Core UX (make it a pleasant chess app)

Goal: on par with the basics players expect.

- **Responsive camera framing.** Compute the camera distance from the aspect ratio so all 8 files always fit, with a fixed default and a "reset view" button. Add a 2D/top-down toggle for people who want to concentrate.
- **Mobile layout.** Board on top and a collapsible bottom sheet for the panel (not a full-screen cover). Bigger touch targets. Put New Game in the mobile header.
- **Move input.** Drag-and-drop pieces as well as click-click. Make the hit area the whole square. Bigger, clearer move hints (dots for quiet moves, corner or ring markers for captures). Highlight the king in check.
- **Premoves** (optional) while the AI is thinking.
- **Undo / takeback** and a **hint** button (ask the engine for one move and show an arrow).
- **History navigation.** Click a move to view that position (read-only), use ←/→ keys, and return to live. Highlight the current move and auto-scroll the list.
- **Game-over flow.** A dismissible result card ("View board", "Rematch", "New game", "Copy PGN"). The board must not be locked behind a blur.
- **New-game dialog.** Colour (white/black/random), difficulty with an Elo hint, and piece set, chosen in one place before the game starts.
- **Persistence (online, per browser).** Keep the current game (FEN plus history), settings and theme in `localStorage` so a refresh doesn't lose the game.
- **Import/export.** PGN and FEN copy/paste, and a shareable position link via URL hash.
- **Accessibility.** Keyboard play (move a focus square with the arrow keys, Enter to select or move). An ARIA live region that announces moves ("Knight to f3, check"). A visible focus ring. Respect `prefers-reduced-motion` for the piece hover and slide animations. Real `<label for>` associations.
- **Sound.** Move, capture, check and game-end sounds, with a mute toggle.

## Phase 3 — Visual polish

Goal: a distinctive look that reads clearly at a glance.

- **Board readability.** Add coordinates around the frame (they rotate with player colour). Tune the light-square colour and the piece materials so white pieces stand out from light squares, with a subtle rim light or darker light squares. Use a separate last-move tint from the selection tint.
- **Board themes** alongside the piece sets: wood, marble and the current green. Pair the defaults to each piece set (sci-fi with a dark glass board, fantasy with stone).
- **Lighting and environment.** Self-host a small (≤1k) HDR or use a baked `Lightformer` rig, so there's no third-party CDN fetch at runtime. Replace the selection point light with an emissive or outline effect (no shader recompiles). Use contact shadows under pieces.
- **Motion.** A capture animation (the piece lifts and fades or sinks), an arc trajectory for knight moves, a subtle camera nudge on check, and a celebration on mate.
- **UI design system.** Turn the brutalist mono style into tokens (colour, spacing, type scale). Raise the 9–10px text to at least 12px. Fix the dead classes. Make sure the dark-mode buttons pass contrast. Add a material-balance bar (+3) next to the captured pieces.
- **Loading state.** A branded loader while the scene and assets warm up, instead of a black canvas.

## Phase 4 — Technical depth and performance

Goal: fast loading, smooth rendering and maintainable 3D code.

- **Deduplicate piece sets.** Write one `AnimatedPiece` wrapper (spring, selection, events) and give each set only a `PIECE_MAP` and materials. Share materials per colour per set, and merge static sub-meshes to cut draw calls.
- **Code splitting.** Lazy-load each piece set and the engine worker. Use `manualChunks` for three, drei and react. Target an initial JS payload under 500 KB gzip.
- **Render on demand.** Use `frameloop="demand"` and invalidate on animation, selection or camera change. Set `dpr` to [1, 2] and use `PerformanceMonitor` to step quality down (shadow map size, environment) on weak GPUs. This saves battery on laptops and phones.
- **Optional Stockfish backend.** Run `stockfish.wasm` in a worker behind the same `Engine` interface, using real `Skill Level`/`UCI_Elo`. Show an evaluation bar and a "best move" arrow for analysis.
- **Observability.** An error boundary around the Canvas (a WebGL context-loss fallback with a reload prompt) and lightweight error reporting.
- **Upgrade track.** Tailwind 4 and TypeScript 7 are out. Schedule these upgrades once tests exist, not before.

## Phase 5 — Online features (depends on product direction)

Treat it as a separate project once Phases 1–2 are solid.

- An authoritative room server (WebSocket) running chess.js. The client gets a `useMultiplayerGame` hook behind the same reducer interface.
- Lobby or invite link, clocks (with increment), resign, draw offer, rematch, and reconnect handling.
- Accounts, ratings and game archive if wanted. That needs backend and storage decisions first.

---

## Suggested order and sizing

| Phase                  | Rough size    | Why this order                                                                   |
| ---------------------- | ------------- | -------------------------------------------------------------------------------- |
| 0 Foundations          | ~0.5 day      | Every later change needs tests and lint                                          |
| 1 Correctness & engine | 2–3 days      | Fixes the freeze and the real bugs players hit                                   |
| 2 Core UX              | 4–6 days      | Most of the visible value: fit-to-screen, drag, undo, history, persistence, a11y |
| 3 Visual polish        | 3–4 days      | Easier once the layout and interaction are settled                               |
| 4 Tech depth           | 3–5 days      | Performance and Stockfish build on the Phase 1 engine interface                  |
| 5 Online               | project-sized | Needs backend decisions                                                          |

Each phase ships on its own and leaves the app working. Within a phase, the bullets are roughly in priority order.
