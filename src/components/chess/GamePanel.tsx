import { Color } from 'chess.js';
import { Cpu, User, Loader2, Undo2, Lightbulb, Plus, ArrowLeftRight } from 'lucide-react';
import { DIFFICULTY_LEVELS, getLevel } from '../../engine/levels';
import { PIECE_SETS, PieceSet } from '../../types/chess/chess';
import type { ChessGame } from '../../hooks/chess/useChessGame';
import { buttonClass, labelClass, selectClass } from '../ui/styles';
import { CapturedPieces } from './CapturedPieces';
import { MoveHistory } from './MoveHistory';
import { MaterialBar } from './MaterialBar';
import { EvalBar } from './EvalBar';
import { BOARD_THEME_CHOICES, BoardThemeChoice } from './boardThemes';

interface GamePanelProps {
  chess: ChessGame;
  onNewGame: () => void;
  onImportExport: () => void;
  /** The mobile sheet already shows status in its header. */
  hideStatus?: boolean;
}

/** One-line game status, shared by the side panel and the mobile sheet. */
export function GameStatus({ chess }: { chess: ChessGame }) {
  const { turn, playerColor, isThinking, isGameOver, inCheck, result, isViewing, viewPly, viewMove } = chess;

  if (isViewing) {
    return (
      <div className="flex items-center gap-2 p-2 border border-info text-info bg-info/10 text-xs uppercase font-bold">
        <span>Reviewing {viewPly === 0 ? 'start' : `move ${Math.ceil(viewPly! / 2)}`}</span>
        <button className="ml-auto underline uppercase" onClick={() => viewMove(null)}>
          Back to live
        </button>
      </div>
    );
  }
  if (isGameOver && result) {
    return (
      <div
        className={`p-2 text-center text-xs uppercase font-bold border ${
          result.winner === null
            ? 'border-info text-info bg-info/10'
            : result.winner === playerColor
              ? 'border-ok text-ok bg-ok/10'
              : 'border-bad text-bad bg-bad/10'
        }`}
      >
        {result.text}
      </div>
    );
  }
  const yourTurn = turn === playerColor;
  return (
    <div
      className={`flex items-center gap-2 p-2 border text-xs uppercase font-bold transition-colors ${
        inCheck
          ? 'border-warn text-warn bg-warn/10'
          : yourTurn
            ? 'border-ok text-ok bg-ok/10'
            : 'border-fg/30'
      }`}
    >
      {yourTurn ? <User className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
      <span>
        {yourTurn ? 'Your turn' : 'Computer thinking…'}
        {inCheck && ' — check!'}
      </span>
      {isThinking && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" aria-hidden />}
    </div>
  );
}

/** Undo and hint, shared by the side panel and the mobile sheet. */
export function QuickActions({ chess }: { chess: ChessGame }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button className={buttonClass} onClick={chess.undo} disabled={!chess.canUndo}>
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </button>
      <button
        className={buttonClass}
        onClick={chess.requestHint}
        disabled={!chess.canHint || chess.isHinting}
      >
        {chess.isHinting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5" />
        )}
        Hint
      </button>
    </div>
  );
}

export const GamePanel = ({ chess, onNewGame, onImportExport, hideStatus }: GamePanelProps) => {
  const { playerColor, difficulty, setDifficulty, pieceSet, setPieceSet, captured, materialBalance } = chess;

  const computerColor: Color = playerColor === 'w' ? 'b' : 'w';
  const playerLead = playerColor === 'w' ? materialBalance : -materialBalance;

  return (
    <div className="flex flex-col gap-4 font-label-mono text-fg">
      {!hideStatus && <GameStatus chess={chess} />}
      <QuickActions chess={chess} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <label htmlFor="difficulty" className={labelClass}>
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty.id}
            onChange={(e) => setDifficulty(getLevel(e.target.value))}
            className={selectClass}
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} (~{level.elo})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="piece-set" className={labelClass}>
            Piece set
          </label>
          <select
            id="piece-set"
            value={pieceSet}
            onChange={(e) => setPieceSet(e.target.value as PieceSet)}
            className={selectClass}
          >
            {PIECE_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="board-theme" className={labelClass}>
            Board
          </label>
          <select
            id="board-theme"
            value={chess.boardThemeChoice}
            onChange={(e) => chess.setBoardThemeChoice(e.target.value as BoardThemeChoice)}
            className={selectClass}
          >
            {BOARD_THEME_CHOICES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === 'auto' ? `Auto (${chess.boardTheme.name})` : t.name}
              </option>
            ))}
          </select>
        </div>
        <p className="col-span-2 text-xs uppercase text-muted">
          You play {playerColor === 'w' ? 'White' : 'Black'}. Difficulty changes apply from the next move.
        </p>
      </div>

      {/* Captured pieces: each column lists what that side has taken */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={labelClass}>Analysis</h3>
          <label className="flex items-center gap-2 text-xs uppercase cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-current"
              checked={chess.analysisOn}
              onChange={(e) => chess.setAnalysisOn(e.target.checked)}
            />
            Show eval &amp; best move
          </label>
        </div>
        {chess.analysisOn && (
          <EvalBar
            evaluation={chess.analysis?.evaluation ?? null}
            playerColor={playerColor}
            paused={chess.analysisPaused}
          />
        )}
        <h3 className={labelClass}>Material</h3>
        <MaterialBar lead={playerLead} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs uppercase text-muted">
              <User className="h-3 w-3" /> You
            </div>
            <CapturedPieces pieces={captured[playerColor]} color={computerColor} advantage={playerLead} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs uppercase text-muted">
              <Cpu className="h-3 w-3" /> Computer
            </div>
            <CapturedPieces pieces={captured[computerColor]} color={playerColor} advantage={-playerLead} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className={labelClass}>Moves</h3>
        <MoveHistory moves={chess.history} viewPly={chess.viewPly} onView={chess.viewMove} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onNewGame} className={buttonClass}>
          <Plus className="h-3.5 w-3.5" /> New game
        </button>
        <button onClick={onImportExport} className={buttonClass}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> PGN / FEN
        </button>
      </div>

      <details className="text-xs uppercase text-muted border-t border-fg/20 pt-3">
        <summary className="cursor-pointer">Controls &amp; shortcuts</summary>
        <ul className="mt-2 space-y-1 normal-case">
          <li>Click a piece then a square, or drag the piece.</li>
          <li>Drag empty space to orbit, scroll or pinch to zoom.</li>
          <li>Board focused: arrow keys move the cursor, Enter selects or moves, Esc cancels.</li>
          <li>Elsewhere: ← / → step through moves, Home / End jump to start / live.</li>
        </ul>
      </details>
    </div>
  );
};
