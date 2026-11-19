import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';
import { AbortedError } from '../../engine/engineClient';
import { DEFAULT_LEVEL, DifficultyLevel, getLevel } from '../../engine/levels';
import { Evaluation, toEvaluation } from '../../engine/evaluation';
import { getCaptured, getMaterialBalance, getResult, toUci } from '../../game/gameLogic';
import {
  buildPgn,
  fenFromHash,
  GameRecord,
  loadSavedState,
  parseGameText,
  recordOf,
  replay,
  saveState,
  shareUrl,
  START_FEN,
} from '../../game/gameIO';
import { PIECE_SETS, PieceSet } from '../../types/chess/chess';
import { BOARD_THEME_CHOICES, BoardThemeChoice, resolveBoardTheme } from '../../components/chess/boardThemes';
import { useEngine } from './useEngine';

/** The engine's move is held back at least this long so it doesn't snap onto the board. */
const MIN_THINK_MS = 400;

/** Hints use a fixed, fairly strong search whatever the opponent's level. */
const HINT_SEARCH = { maxDepth: 6, moveTime: 1500, noise: 0 };
/** Analysis runs on every position, so it trades a little depth for speed. */
const ANALYSIS_SEARCH = { maxDepth: 10, moveTime: 900, noise: 0 };
const ANALYSIS_KEY = 'chess3d_analysis';

export interface Analysis {
  /** The position this applies to, so a stale result is never shown. */
  fen: string;
  evaluation: Evaluation | null;
  bestMove: { from: Square; to: Square } | null;
}

export interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
}

export interface NewGameOptions {
  color?: Color;
  difficulty?: DifficultyLevel;
  pieceSet?: PieceSet;
  /** Start from this game instead of the initial position. */
  record?: GameRecord;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new AbortedError());
    });
  });

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

interface InitialState {
  game: Chess;
  startFen: string;
  playerColor: Color;
  difficulty: DifficultyLevel;
  pieceSet: PieceSet;
  boardTheme: BoardThemeChoice;
}

/** A shared position in the URL wins; otherwise resume the saved game; otherwise a fresh one. */
const loadInitialState = (): InitialState => {
  const saved = loadSavedState(storage());
  const difficulty = saved ? getLevel(saved.difficulty) : DEFAULT_LEVEL;
  const pieceSet = PIECE_SETS.find((s) => s.id === saved?.pieceSet)?.id ?? 'classic';
  const boardTheme = BOARD_THEME_CHOICES.find((t) => t.id === saved?.boardTheme)?.id ?? 'auto';

  const sharedFen = typeof window !== 'undefined' ? fenFromHash(window.location.hash) : null;
  if (sharedFen) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    const game = new Chess(sharedFen);
    // You play the side to move in a shared position.
    return { game, startFen: sharedFen, playerColor: game.turn(), difficulty, pieceSet, boardTheme };
  }
  if (saved) {
    return {
      game: replay(saved),
      startFen: saved.startFen,
      playerColor: saved.playerColor,
      difficulty,
      pieceSet,
      boardTheme,
    };
  }
  return { game: new Chess(), startFen: START_FEN, playerColor: 'w', difficulty, pieceSet, boardTheme };
};

/**
 * Game state for one human-vs-engine game.
 *
 * A single chess.js instance is the source of truth. `version` is bumped
 * after every change so React re-renders; everything else (history, result,
 * captures, whose turn) is derived from the instance rather than stored twice.
 */
export const useChessGame = () => {
  const [initial] = useState(loadInitialState);
  const game = initial.game;
  const engine = useEngine();
  const hintEngine = useEngine();
  const analysisEngine = useEngine();

  const [version, setVersion] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [startFen, setStartFen] = useState(initial.startFen);
  const [playerColor, setPlayerColor] = useState<Color>(initial.playerColor);
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(initial.difficulty);
  const [pieceSet, setPieceSet] = useState<PieceSet>(initial.pieceSet);
  const [boardThemeChoice, setBoardThemeChoice] = useState<BoardThemeChoice>(initial.boardTheme);
  const boardTheme = useMemo(
    () => resolveBoardTheme(boardThemeChoice, pieceSet),
    [boardThemeChoice, pieceSet],
  );
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);
  const [isHinting, setIsHinting] = useState(false);
  /** Ply being reviewed (0 = start position), or null when showing the live game. */
  const [viewPly, setViewPly] = useState<number | null>(null);

  // Read by the engine when a search starts, so changing difficulty mid-game
  // applies from the engine's next move without restarting the current one.
  const difficultyRef = useRef(difficulty);
  const setDifficulty = useCallback((level: DifficultyLevel) => {
    difficultyRef.current = level;
    setDifficultyState(level);
  }, []);

  /** Call after every change to the chess instance. */
  const touch = useCallback(() => {
    setVersion((v) => v + 1);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setHint(null);
    setViewPly(null);
  }, []);

  // Everything below is derived from the chess instance at this version.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => game.history({ verbose: true }), [game, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => getResult(game), [game, version]);
  const captured = useMemo(() => getCaptured(history), [history]);
  const materialBalance = useMemo(() => getMaterialBalance(history), [history]);
  const lastMove: Move | null = history.at(-1) ?? null;
  const fen = game.fen();
  const turn = game.turn();
  const isGameOver = result !== null;
  const isViewing = viewPly !== null;
  const isPlayerTurn = turn === playerColor && !isGameOver && !isThinking;
  const inCheck = game.inCheck();

  // What the board shows: the live game, or a past position under review.
  const displayFen = viewPly === null ? fen : viewPly === 0 ? startFen : history[viewPly - 1].after;
  const displayLastMove = viewPly === null ? lastMove : viewPly === 0 ? null : history[viewPly - 1];

  // Persist the game and settings so a refresh resumes where you left off.
  useEffect(() => {
    saveState(storage(), {
      ...recordOf(game, startFen),
      playerColor,
      difficulty: difficulty.id,
      pieceSet,
      boardTheme: boardThemeChoice,
    });
  }, [game, version, startFen, playerColor, difficulty, pieceSet, boardThemeChoice]);

  const legalTargets = useMemo(
    () => (selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, selectedSquare, version],
  );
  const validMoves = useMemo(() => [...new Set(legalTargets.map((m) => m.to))], [legalTargets]);

  const applyMove = useCallback(
    (move: { from: string; to: string; promotion?: string }): boolean => {
      try {
        game.move(move);
      } catch {
        return false;
      }
      touch();
      return true;
    },
    [game, touch],
  );

  /**
   * Attempts the player's move from -> to. Opens the promotion picker when
   * needed. Returns false if the move isn't legal.
   */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion || isViewing) return false;
      const candidates = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
      if (candidates.length === 0) return false;
      if (candidates.some((m) => m.promotion)) {
        setSelectedSquare(from);
        setPendingPromotion({ from, to, color: playerColor });
        return true;
      }
      return applyMove({ from, to });
    },
    [isPlayerTurn, pendingPromotion, isViewing, game, playerColor, applyMove],
  );

  /** Whether the player may pick up the piece on this square right now. */
  const canSelect = useCallback(
    (square: Square) =>
      isPlayerTurn && !pendingPromotion && !isViewing && game.get(square)?.color === playerColor,
    [isPlayerTurn, pendingPromotion, isViewing, game, playerColor],
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (isViewing) {
        setViewPly(null); // clicking the board returns to the live game
        return;
      }
      if (!isPlayerTurn || pendingPromotion) return;
      if (selectedSquare && validMoves.includes(square)) {
        tryMove(selectedSquare, square);
        return;
      }
      setSelectedSquare(canSelect(square) && square !== selectedSquare ? square : null);
    },
    [isViewing, isPlayerTurn, pendingPromotion, selectedSquare, validMoves, tryMove, canSelect],
  );

  const selectSquare = useCallback(
    (square: Square | null) => setSelectedSquare(square && canSelect(square) ? square : null),
    [canSelect],
  );

  const choosePromotion = useCallback(
    (piece: PieceSymbol) => {
      if (!pendingPromotion) return;
      applyMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
    },
    [pendingPromotion, applyMove],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    setSelectedSquare(null);
  }, []);

  /** Starts a fresh game. Any search in progress is cancelled by the engine effect's cleanup. */
  const newGame = useCallback(
    (opts: NewGameOptions = {}) => {
      const record = opts.record ?? { startFen: START_FEN, moves: [] };
      const fresh = replay(record);
      game.load(record.startFen);
      for (const m of fresh.history({ verbose: true })) game.move(m.san);
      setStartFen(record.startFen);
      setPlayerColor(opts.color ?? playerColor);
      if (opts.difficulty) setDifficulty(opts.difficulty);
      if (opts.pieceSet) setPieceSet(opts.pieceSet);
      setGameId((id) => id + 1);
      touch();
    },
    [game, playerColor, setDifficulty, touch],
  );

  // Takeback: undo the player's last move and the engine's reply to it.
  const canUndo = !pendingPromotion && history.some((m) => m.color === playerColor);
  const undo = useCallback(() => {
    if (!canUndo) return;
    let undonePlayerMove = false;
    while (game.history().length > 0 && !undonePlayerMove) {
      const m = game.undo();
      if (m?.color === playerColor) undonePlayerMove = true;
    }
    touch();
  }, [canUndo, game, playerColor, touch]);

  // Hint: ask a separate engine for the best move, shown as an arrow.
  const canHint = isPlayerTurn && !isViewing && !pendingPromotion;
  const requestHint = useCallback(() => {
    if (!canHint || isHinting) return;
    setIsHinting(true);
    hintEngine
      .search(startFen, history.map(toUci), HINT_SEARCH)
      .then(({ bestMove }) => {
        if (bestMove) {
          setHint({ from: bestMove.slice(0, 2) as Square, to: bestMove.slice(2, 4) as Square });
        }
      })
      .catch((e) => {
        if (!(e instanceof AbortedError)) console.error('Hint failed:', e);
      })
      .finally(() => setIsHinting(false));
  }, [canHint, isHinting, hintEngine, startFen, history]);

  // A move or new game makes any hint in flight stale.
  useEffect(() => () => hintEngine.cancel(), [hintEngine, version]);

  // Reviewing past positions.
  const viewMove = useCallback(
    (ply: number | null) => {
      if (ply === null || ply >= history.length) setViewPly(null);
      else setViewPly(Math.max(0, ply));
      setSelectedSquare(null);
    },
    [history.length],
  );
  const stepView = useCallback(
    (delta: number) => viewMove((viewPly ?? history.length) + delta),
    [viewMove, viewPly, history.length],
  );

  // Analysis: evaluate whatever position is on the board and suggest the best
  // move. Paused while the computer is thinking so the two don't compete for CPU.
  const [analysisOn, setAnalysisOnState] = useState(() => {
    try {
      return localStorage.getItem(ANALYSIS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setAnalysisOn = useCallback((on: boolean) => {
    setAnalysisOnState(on);
    try {
      localStorage.setItem(ANALYSIS_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const analysisPly = viewPly ?? history.length;
  const analysisPaused = !isViewing && isThinking;
  useEffect(() => {
    if (!analysisOn || analysisPaused) return;
    const position = new Chess(displayFen);
    if (position.isGameOver()) return;
    const controller = new AbortController();
    const moves = history.slice(0, analysisPly).map(toUci);
    analysisEngine
      .search(startFen, moves, ANALYSIS_SEARCH, controller.signal)
      .then(({ bestMove, score, depth }) => {
        setAnalysis({
          fen: displayFen,
          // A forced reply returns without searching, so it has no score to show.
          evaluation: depth > 0 ? toEvaluation(score, position.turn()) : null,
          bestMove: bestMove
            ? { from: bestMove.slice(0, 2) as Square, to: bestMove.slice(2, 4) as Square }
            : null,
        });
      })
      .catch((e) => {
        if (!(e instanceof AbortedError)) console.error('Analysis failed:', e);
      });
    return () => controller.abort();
  }, [analysisOn, analysisPaused, displayFen, analysisPly, history, startFen, analysisEngine]);
  const currentAnalysis = analysisOn && analysis?.fen === displayFen ? analysis : null;

  // Import / export.
  const opponentName = `Computer (${difficulty.name})`;
  const getPgn = useCallback(
    () => buildPgn(recordOf(game, startFen), { playerColor, opponent: opponentName, result }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, startFen, playerColor, opponentName, result, version],
  );
  const getShareUrl = useCallback(() => shareUrl(window.location.href, displayFen), [displayFen]);

  /** Loads a pasted FEN or PGN. Returns an error message, or null on success. */
  const importGame = useCallback(
    (text: string, color?: Color): string | null => {
      const parsed = parseGameText(text);
      if ('error' in parsed) return parsed.error;
      const sideToMove = replay(parsed).turn();
      newGame({ record: parsed, color: color ?? sideToMove });
      return null;
    },
    [newGame],
  );

  // Engine turn. Re-runs whenever the position, game or sides change; the
  // cleanup aborts the search (terminating the worker) so a stale move can
  // never land on a newer board.
  useEffect(() => {
    if (game.isGameOver() || game.turn() === playerColor) return;

    const controller = new AbortController();
    const { signal } = controller;
    const level = difficultyRef.current;
    const moves = game.history({ verbose: true }).map(toUci);
    const startedAt = performance.now();
    setIsThinking(true);

    const playFallback = () => {
      const legal = game.moves({ verbose: true });
      if (legal.length > 0) applyMove(legal[Math.floor(Math.random() * legal.length)]);
    };

    engine
      .search(
        startFen,
        moves,
        { maxDepth: level.maxDepth, moveTime: level.moveTime, noise: level.noise },
        signal,
      )
      .then(async ({ bestMove }) => {
        await wait(Math.max(0, MIN_THINK_MS - (performance.now() - startedAt)), signal);
        const ok = bestMove
          ? applyMove({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] })
          : false;
        if (!ok) playFallback();
      })
      .catch((e) => {
        if (e instanceof AbortedError) return;
        console.error('Engine error, playing a random legal move instead:', e);
        playFallback();
      })
      .finally(() => {
        if (!signal.aborted) setIsThinking(false);
      });

    return () => {
      controller.abort();
      setIsThinking(false);
    };
  }, [game, engine, version, gameId, playerColor, startFen, applyMove]);

  return {
    game,
    fen,
    displayFen,
    displayLastMove,
    turn,
    history,
    lastMove,
    result,
    isGameOver,
    inCheck,
    captured,
    materialBalance,
    selectedSquare,
    validMoves,
    handleSquareClick,
    selectSquare,
    canSelect,
    tryMove,
    pendingPromotion,
    choosePromotion,
    cancelPromotion,
    newGame,
    undo,
    canUndo,
    hint,
    requestHint,
    canHint,
    isHinting,
    viewPly,
    isViewing,
    analysisOn,
    setAnalysisOn,
    analysis: currentAnalysis,
    analysisPaused: analysisOn && analysisPaused,
    viewMove,
    stepView,
    getPgn,
    getShareUrl,
    importGame,
    difficulty,
    setDifficulty,
    playerColor,
    isThinking,
    isPlayerTurn,
    pieceSet,
    setPieceSet,
    boardTheme,
    boardThemeChoice,
    setBoardThemeChoice,
    gameId,
  };
};

export type ChessGame = ReturnType<typeof useChessGame>;
