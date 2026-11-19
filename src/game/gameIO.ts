import { Chess, Color, DEFAULT_POSITION, validateFen } from 'chess.js';
import type { GameResult } from './gameLogic';
import { toUci } from './gameLogic';

export const START_FEN = DEFAULT_POSITION;

/** A game as a start position plus the UCI moves played from it. */
export interface GameRecord {
  startFen: string;
  moves: string[];
}

/** Replays a record into a fresh chess.js instance. Throws if a move is illegal. */
export const replay = ({ startFen, moves }: GameRecord): Chess => {
  const game = new Chess(startFen);
  for (const uci of moves) {
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return game;
};

export const recordOf = (game: Chess, startFen: string): GameRecord => ({
  startFen,
  moves: game.history({ verbose: true }).map(toUci),
});

/**
 * Reads pasted text as either a FEN position or a PGN game.
 * Returns the game as a record, or an error message to show the user.
 */
export const parseGameText = (text: string): GameRecord | { error: string } => {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Paste a FEN position or a PGN game.' };

  // A FEN is a single line of six space-separated fields with no move numbers.
  if (!trimmed.includes('\n') && !/\d+\./.test(trimmed)) {
    const check = validateFen(trimmed);
    if (!check.ok) return { error: `That FEN isn't valid: ${check.error}` };
    return { startFen: trimmed, moves: [] };
  }

  try {
    const game = new Chess();
    game.loadPgn(trimmed);
    const startFen = game.getHeaders().FEN || START_FEN;
    return recordOf(game, startFen);
  } catch (e) {
    return { error: `That PGN couldn't be read${e instanceof Error ? `: ${e.message}` : '.'}` };
  }
};

const RESULT_TAG = (result: GameResult | null): string => {
  if (!result) return '*';
  if (result.winner === 'w') return '1-0';
  if (result.winner === 'b') return '0-1';
  return '1/2-1/2';
};

/** Exports the game as PGN with the standard tags filled in. */
export const buildPgn = (
  record: GameRecord,
  opts: { playerColor: Color; opponent: string; result: GameResult | null; date?: Date },
): string => {
  const game = new Chess(record.startFen);
  const date = opts.date ?? new Date();
  game.setHeader('Event', 'Chess 3D');
  game.setHeader('Site', 'Chess 3D');
  game.setHeader('Date', date.toISOString().slice(0, 10).replace(/-/g, '.'));
  game.setHeader('White', opts.playerColor === 'w' ? 'You' : opts.opponent);
  game.setHeader('Black', opts.playerColor === 'b' ? 'You' : opts.opponent);
  if (record.startFen !== START_FEN) {
    game.setHeader('SetUp', '1');
    game.setHeader('FEN', record.startFen);
  }
  for (const uci of record.moves) {
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  game.setHeader('Result', RESULT_TAG(opts.result));
  return game.pgn();
};

// ---------------------------------------------------------------------------
// Persistence: the current game and settings survive a page refresh.
// ---------------------------------------------------------------------------

export interface SavedState extends GameRecord {
  playerColor: Color;
  difficulty: string;
  pieceSet: string;
  /** 'auto' or a board theme id; optional so older saves still load. */
  boardTheme?: string;
}

const STORAGE_KEY = 'chess3d_game_v1';

export const loadSavedState = (storage: Pick<Storage, 'getItem'> | undefined): SavedState | null => {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedState>;
    if (
      typeof data.startFen !== 'string' ||
      !Array.isArray(data.moves) ||
      (data.playerColor !== 'w' && data.playerColor !== 'b')
    ) {
      return null;
    }
    replay(data as GameRecord); // reject saves that no longer replay
    return {
      startFen: data.startFen,
      moves: data.moves,
      playerColor: data.playerColor,
      difficulty: String(data.difficulty ?? ''),
      pieceSet: String(data.pieceSet ?? ''),
      boardTheme: String(data.boardTheme ?? 'auto'),
    };
  } catch {
    return null;
  }
};

export const saveState = (storage: Pick<Storage, 'setItem'> | undefined, state: SavedState): void => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the game just won't survive a refresh.
  }
};

// ---------------------------------------------------------------------------
// Share links: a position travels in the URL hash, e.g. #fen=<encoded FEN>.
// ---------------------------------------------------------------------------

export const fenFromHash = (hash: string): string | null => {
  const match = /^#?fen=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    const fen = decodeURIComponent(match[1]);
    return validateFen(fen).ok ? fen : null;
  } catch {
    return null;
  }
};

export const shareUrl = (base: string, fen: string): string =>
  `${base.split('#')[0]}#fen=${encodeURIComponent(fen)}`;
