import { useState, useRef, useEffect, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Square } from 'chess.js';
import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  Maximize,
  Minimize,
  Moon,
  Plus,
  Rotate3d,
  Sun,
  Volume2,
  VolumeX,
  Grid3x3,
} from 'lucide-react';
import { BoardArrow, ChessBoard3D } from './components/chess/ChessBoard3D';
import { preloadPieceSets } from './components/chess/pieceSetLoaders';
import { CameraRig, CameraView } from './components/chess/CameraRig';
import { SceneLighting } from './components/chess/SceneLighting';
import {
  CheckNudge,
  Confetti,
  ContextLossWatcher,
  DevSceneHandle,
  SceneReady,
} from './components/chess/SceneEffects';
import { BoardNotice } from './components/chess/BoardNotice';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SceneLoader } from './components/chess/SceneLoader';
import { GamePanel, GameStatus, QuickActions } from './components/chess/GamePanel';
import { PromotionPicker } from './components/chess/PromotionPicker';
import { NewGameDialog } from './components/chess/NewGameDialog';
import { GameOverDialog } from './components/chess/GameOverDialog';
import { ImportExportDialog } from './components/chess/ImportExportDialog';
import { iconButtonClass } from './components/ui/styles';
import { useChessGame } from './hooks/chess/useChessGame';
import { soundForMove, useSounds } from './hooks/useSounds';
import { describeMove, describeSquare } from './game/gameLogic';

const FILES = 'abcdefgh';

const readTheme = () => {
  try {
    const saved = localStorage.getItem('chess3d_theme');
    if (saved) return saved === 'dark';
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));

export default function App() {
  const chess = useChessGame();
  const { result, pendingPromotion, choosePromotion, cancelPromotion, playerColor } = chess;
  const { muted, setMuted, playSound } = useSounds();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isDark, setIsDark] = useState(readTheme);
  const [view, setView] = useState<CameraView>('angled');
  const [cameraReset, setCameraReset] = useState(0);
  const [dialog, setDialog] = useState<'new' | 'io' | null>(null);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [cursor, setCursor] = useState<Square | null>(null);
  const [boardFocused, setBoardFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [winCount, setWinCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Lets end-to-end tests drive the game without clicking into the 3D canvas.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __chess?: typeof chess }).__chess = chess;
  });

  // Fetch the other piece sets once the page has settled.
  useEffect(() => {
    if (!sceneReady) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => preloadPieceSets());
  }, [sceneReady]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('chess3d_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  // Sounds and screen-reader announcements for each new move, and for the result.
  const lastSeen = useRef({ gameId: chess.gameId, plies: chess.history.length });
  useEffect(() => {
    const prev = lastSeen.current;
    lastSeen.current = { gameId: chess.gameId, plies: chess.history.length };
    if (prev.gameId !== chess.gameId || chess.history.length !== prev.plies + 1 || !chess.lastMove) return;
    let text = describeMove(chess.lastMove);
    if (chess.result) {
      text += `. ${chess.result.text}`;
      playSound('end');
      if (chess.result.winner === playerColor) setWinCount((n) => n + 1);
    } else {
      playSound(soundForMove(chess.lastMove));
      if (chess.inCheck) setCheckCount((n) => n + 1);
    }
    setAnnouncement(text);
  }, [
    chess.gameId,
    chess.history.length,
    chess.lastMove,
    chess.result,
    chess.inCheck,
    playerColor,
    playSound,
  ]);

  // Show the result once per finished game.
  useEffect(() => {
    if (result) setGameOverOpen(true);
  }, [result, chess.gameId]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void containerRef.current?.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  // Global shortcuts for reviewing moves (when not typing and no dialog is open).
  const modalOpen = dialog !== null || gameOverOpen || !!pendingPromotion;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      // When the board has focus the arrow keys drive its cursor instead.
      if (e.key === 'ArrowLeft' && !boardFocused) chess.stepView(-1);
      else if (e.key === 'ArrowRight' && !boardFocused) chess.stepView(1);
      else if (e.key === 'Home') chess.viewMove(0);
      else if (e.key === 'End') chess.viewMove(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, boardFocused, chess]);

  // Keyboard play on the focused board. "Up" always points away from the player.
  const onBoardKeyDown = (e: ReactKeyboardEvent) => {
    const start: Square = playerColor === 'w' ? 'e2' : 'e7';
    const current = cursor ?? start;
    const sign = playerColor === 'w' ? 1 : -1;
    const step = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (step) {
      e.preventDefault();
      const file = Math.min(7, Math.max(0, FILES.indexOf(current[0]) + step[0] * sign));
      const rank = Math.min(8, Math.max(1, Number(current[1]) + step[1] * sign));
      const next = `${FILES[file]}${rank}` as Square;
      setCursor(next);
      setAnnouncement(describeSquare(chess.game, next));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!cursor) {
        setCursor(start);
        return;
      }
      chess.handleSquareClick(cursor);
    } else if (e.key === 'Escape') {
      chess.selectSquare(null);
    }
  };

  // Hint arrow in amber; the analysis's best move in teal (skipped when it's the same move).
  const boardArrows: BoardArrow[] = [];
  if (chess.hint) boardArrows.push({ ...chess.hint, color: '#F59E0B' });
  const best = chess.analysis?.bestMove;
  if (best && !(chess.hint && best.from === chess.hint.from && best.to === chess.hint.to)) {
    boardArrows.push({ ...best, color: '#14B8A6' });
  }

  const panelProps = {
    chess,
    onNewGame: () => setDialog('new'),
    onImportExport: () => setDialog('io'),
  };

  return (
    <div ref={containerRef} className="w-screen h-[100dvh] bg-bg flex flex-col overflow-hidden text-fg">
      {/* Header */}
      <header className="flex-none flex items-center justify-between gap-2 px-4 md:px-8 py-3 border-b border-fg/20">
        <h1 className="font-label-mono text-xs font-bold uppercase tracking-widest px-2 py-1 border border-fg">
          Chess 3D
        </h1>
        <nav className="flex items-center gap-1.5 md:gap-2" aria-label="Game and view controls">
          <button
            className={iconButtonClass}
            onClick={() => setDialog('new')}
            aria-label="New game"
            title="New game"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className={iconButtonClass}
            onClick={() => setView((v) => (v === 'angled' ? 'top' : 'angled'))}
            aria-label={view === 'angled' ? 'Top-down view' : '3D view'}
            title={view === 'angled' ? 'Top-down view' : '3D view'}
          >
            {view === 'angled' ? <Grid3x3 className="h-4 w-4" /> : <Rotate3d className="h-4 w-4" />}
          </button>
          <button
            className={iconButtonClass}
            onClick={() => setCameraReset((n) => n + 1)}
            aria-label="Reset view"
            title="Reset view"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            className={iconButtonClass}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-pressed={muted}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            className={iconButtonClass}
            onClick={() => setIsDark((d) => !d)}
            aria-label={isDark ? 'Light theme' : 'Dark theme'}
            title={isDark ? 'Light theme' : 'Dark theme'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            className={`${iconButtonClass} hidden md:inline-flex`}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Board */}
        <div
          className="flex-1 relative min-w-0 min-h-[35vh] md:min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
          tabIndex={0}
          role="application"
          aria-label="Chess board"
          aria-describedby="board-help"
          onKeyDown={onBoardKeyDown}
          onFocus={() => {
            setBoardFocused(true);
            setCursor((c) => c ?? (playerColor === 'w' ? 'e2' : 'e7'));
          }}
          onBlur={() => setBoardFocused(false)}
        >
          <p id="board-help" className="sr-only">
            Arrow keys move the cursor, Enter selects a piece or makes a move, Escape cancels.
          </p>
          <ErrorBoundary
            fallback={() => (
              <BoardNotice title="3D view unavailable" reload>
                <p>Your browser couldn&apos;t start 3D graphics, so the board can&apos;t be shown.</p>
                <p>Turning on hardware acceleration in your browser settings usually fixes this.</p>
              </BoardNotice>
            )}
          >
            <Canvas
              shadows
              className="w-full h-full"
              style={{ position: 'absolute', inset: 0 }}
              gl={{ antialias: true, alpha: true }}
              // Render only when something changes; animations request frames
              // while they run. Saves battery and keeps fans quiet when idle.
              frameloop="demand"
              dpr={[1, 2]}
              // While orbiting, drop resolution temporarily to stay smooth.
              performance={{ min: 0.6 }}
            >
              <AdaptiveDpr />
              <PerspectiveCamera makeDefault fov={45} />
              <OrbitControls
                regress
                makeDefault
                enablePan={false}
                minDistance={5}
                maxDistance={30}
                maxPolarAngle={Math.PI / 2.1}
              />
              <CameraRig view={view} resetToken={cameraReset} />

              <SceneLighting />
              <DevSceneHandle />
              <ContextLossWatcher onChange={setContextLost} />
              <SceneReady onReady={() => setSceneReady(true)} />
              <CheckNudge trigger={checkCount} />
              <Confetti trigger={winCount} />

              <ChessBoard3D
                fen={chess.displayFen}
                lastMove={chess.displayLastMove}
                selectedSquare={chess.selectedSquare}
                validMoves={chess.validMoves}
                playerColor={playerColor}
                pieceSet={chess.pieceSet}
                theme={chess.boardTheme}
                arrows={boardArrows}
                cursor={boardFocused ? cursor : null}
                canSelect={chess.canSelect}
                onSquareClick={chess.handleSquareClick}
                onSelect={chess.selectSquare}
                onDrop={chess.tryMove}
              />
            </Canvas>
          </ErrorBoundary>
          {contextLost && (
            <BoardNotice title="Graphics paused" reload>
              <p>The browser reset the 3D graphics. The board should come back on its own in a moment.</p>
              <p>If it doesn&apos;t, reload. Your game is saved.</p>
            </BoardNotice>
          )}
          <SceneLoader visible={!sceneReady} />

          {pendingPromotion && (
            <PromotionPicker
              color={pendingPromotion.color}
              onChoose={choosePromotion}
              onCancel={cancelPromotion}
            />
          )}
        </div>

        {/* Desktop side panel */}
        <aside className="hidden md:block md:w-80 lg:w-96 flex-none border-l border-fg/20 overflow-y-auto p-4 scrollbar-custom">
          <GamePanel {...panelProps} />
        </aside>

        {/* Mobile bottom sheet */}
        <section className="md:hidden flex-none border-t border-fg/20 bg-bg" aria-label="Game panel">
          <div className="flex items-stretch gap-2 p-3">
            <div className="flex-1 min-w-0">
              <GameStatus chess={chess} />
            </div>
            <button
              className={iconButtonClass}
              onClick={() => setSheetOpen((o) => !o)}
              aria-expanded={sheetOpen}
              aria-controls="mobile-panel"
              aria-label={sheetOpen ? 'Hide game panel' : 'Show game panel'}
            >
              {sheetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
          {sheetOpen ? (
            <div id="mobile-panel" className="max-h-[40vh] overflow-y-auto overscroll-contain px-3 pb-4">
              <GamePanel {...panelProps} hideStatus />
            </div>
          ) : (
            <div className="px-3 pb-3">
              <QuickActions chess={chess} />
            </div>
          )}
        </section>
      </main>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {dialog === 'new' && (
        <NewGameDialog
          defaults={{ color: playerColor, difficulty: chess.difficulty, pieceSet: chess.pieceSet }}
          onStart={chess.newGame}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'io' && (
        <ImportExportDialog
          getPgn={chess.getPgn}
          fen={chess.displayFen}
          getShareUrl={chess.getShareUrl}
          onImport={chess.importGame}
          onClose={() => setDialog(null)}
        />
      )}
      {gameOverOpen && result && (
        <GameOverDialog
          result={result}
          playerColor={playerColor}
          onRematch={() => chess.newGame()}
          onNewGame={() => setDialog('new')}
          getPgn={chess.getPgn}
          onClose={() => setGameOverOpen(false)}
        />
      )}
    </div>
  );
}
