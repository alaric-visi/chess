# Chess 3D

An interactive, self-contained 3D chess web application built with **React 19**, **TypeScript**, **Three.js** (`@react-three/fiber`, `@react-three/drei`, `@react-spring/three`), **chess.js**, and **Tailwind CSS**. It renders procedural 3D chess sets in WebGL and runs an in-browser chess AI opponent with six difficulty levels—requiring no backend server or external 3D model assets.

## Features

- **Interactive 3D Board & Camera**: Orbit, pan, and zoom around the board with constrained polar angles and distance limits, soft PCF shadows (`2048×2048` shadow map), and HDR environment lighting.
- **3 Procedural 3D Piece Sets**: Switch live between **Classic**, **Sci-Fi**, and **Fantasy** piece geometries, all generated procedurally in Three.js.
- **Spring-Animated Piece Movement**: Persistent piece identity tracking across FEN updates enables smooth `@react-spring/three` transitions when pieces move.
- **In-Browser AI Opponent**: Six difficulty tiers (**Beginner** through **Master**) powered by a heuristic scorer at lower levels and **Minimax with alpha-beta pruning** at Medium and above.
- **Full Chess Rules**: Legal move highlighting, castling, en passant, pawn promotion (auto-queen), check/checkmate, stalemate, threefold repetition, and insufficient material detection via `chess.js`.
- **Play as White or Black**: Side selection, captured-piece tracking, algebraic (SAN) move history, light/dark theme persistence (`localStorage`), fullscreen mode, and a responsive mobile controls drawer.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI Framework | React 19, TypeScript 5.9 |
| Build Tool | Vite 6 |
| 3D Rendering | Three.js (`three`), `@react-three/fiber`, `@react-three/drei` |
| 3D Animation | `@react-spring/three` |
| Chess Logic | `chess.js` |
| Styling & Icons | Tailwind CSS 3, `lucide-react` |

---

## Project Structure

```text
src/
├── App.tsx                                  # Top-level layout, R3F <Canvas>, lighting, camera, theme & fullscreen controls
├── main.tsx                                 # React entry point
├── index.css                                # Tailwind base styles and custom theme tokens
├── types/chess/
│   └── chess.ts                             # GameState, DifficultyLevel, DIFFICULTY_LEVELS, square coordinate helpers
├── hooks/chess/
│   ├── useChessGame.ts                      # Game lifecycle, chess.js instance, move execution, AI turn orchestration
│   └── useStockfish.ts                      # Client-side AI engine (heuristic + minimax/alpha-beta search)
└── components/chess/
    ├── ChessBoard3D.tsx                     # 8x8 board mesh, highlights, persistent piece tracking, set switcher
    ├── ChessPiece3D.tsx                     # Procedural Classic 3D piece geometries
    ├── ChessPieceSciFi3D.tsx                # Procedural Sci-Fi 3D piece geometries
    ├── ChessPieceFantasy3D.tsx              # Procedural Fantasy 3D piece geometries
    ├── GamePanel.tsx                        # Difficulty, color, piece-set controls, game status, New Game action
    ├── MoveHistory.tsx                      # Scrollable SAN move list
    └── CapturedPieces.tsx                   # Captured material display for both sides
```

---

## Architecture & Implementation Details

### 1. 3D Scene & Rendering Pipeline (`App.tsx`, `ChessBoard3D.tsx`)

- **Canvas & Camera**: `App.tsx` mounts a full-viewport `@react-three/fiber` `<Canvas shadows>` with antialiasing, a `PerspectiveCamera` (`fov: 45`, initial position `[0, 7.7, 7.7]`), and `OrbitControls` (`minDistance: 6`, `maxDistance: 25`, `maxPolarAngle: Math.PI / 2.1`).
- **Lighting**: Combines `<Environment preset="city" />`, ambient light (`0.7`), a primary shadow-casting directional light at `[10, 15, 10]` (`2048×2048` shadow map), a secondary fill directional light at `[-8, 10, -8]`, and an overhead point light at `[0, 12, 0]`.
- **Piece Identity & Animation**: Rather than re-mounting piece meshes on every FEN change, `ChessBoard3D.tsx` maintains a `trackedPieces` array with persistent IDs (`${color}${type}${initialSquare}`). On each board update, pieces are matched to their new target `(x, z)` coordinates so `@react-spring/three` can animate moves smoothly across squares.
- **Square Highlights**: Distinct colors indicate the active selection (`#BACA44`), last move (`#F5F682` / `#BACA44`), and legal destination squares on the `#EEEED2` / `#769656` board.

### 2. Game State & Rules (`useChessGame.ts`)

- Holds a `chess.js` `Chess` instance in a `useRef` and synchronizes reactive UI state (`fen`, `turn`, `selectedSquare`, `validMoves`, `lastMove`, `isThinking`, `gameOver`, `result`) via `syncGameState()`.
- Guards player input so clicks are only processed when it is the human player's turn, the game is not over, and the AI is not currently computing.
- Tracks captured pieces per side and triggers AI move calculation asynchronously whenever it becomes the computer's turn.

### 3. Client-Side AI Engine (`useStockfish.ts`)

`useStockfish` provides a self-contained TypeScript chess engine (no external Stockfish WASM binary or worker required) with six difficulty presets defined in `src/types/chess/chess.ts`:

| Difficulty | Skill Level | Target ELO | Engine Mode | Search Depth |
| --- | --- | --- | --- | --- |
| Beginner | 1 | 800 | Heuristic (`getSimpleAIMove`) | — |
| Easy | 5 | 1200 | Heuristic (`getSimpleAIMove`) | — |
| Medium | 10 | 1600 | Minimax + Alpha-Beta | 3 ply |
| Hard | 15 | 2000 | Minimax + Alpha-Beta | 4 ply |
| Expert | 18 | 2400 | Minimax + Alpha-Beta | 5 ply |
| Master | 20 | 2800 | Minimax + Alpha-Beta | 6 ply |

- **Heuristic Mode (Beginner / Easy)**: Scores legal moves using capture value, center-square control (`d4`, `d5`, `e4`, `e5`), minor-piece development, check bonuses, and immediate checkmate detection, then samples from top candidates with difficulty-scaled randomness.
- **Minimax + Alpha-Beta Pruning (Medium – Master)**:
  - **Move Ordering (`orderMoves`)**: Prioritizes captures via **MVV-LVA** (Most Valuable Victim – Least Valuable Attacker), pawn promotions, and checks to maximize alpha-beta cutoffs.
  - **Static Evaluation (`evaluateBoard`)**: Evaluates checkmate (`±100000`), draws/stalemate (`0`), material balance (`P=100`, `N=320`, `B=330`, `R=500`, `Q=900`, `K=20000`), color-mirrored piece-square tables (`PAWN_TABLE`, `KNIGHT_TABLE`, `BISHOP_TABLE`, `ROOK_TABLE`, `QUEEN_TABLE`, `KING_MIDDLE_TABLE`), and legal-move mobility.

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

- Node.js 18+ and npm

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
```

## Deployment

`npm run build` runs `tsc --noEmit && vite build` and outputs static assets to `dist/`, ready to host on any static hosting provider (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).
