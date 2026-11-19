import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';

export type ResultReason =
  'checkmate' | 'stalemate' | 'threefold-repetition' | 'insufficient-material' | 'fifty-move-rule';

export interface GameResult {
  /** Null for a draw. */
  winner: Color | null;
  reason: ResultReason;
  /** Short human-readable summary, e.g. "White wins by checkmate". */
  text: string;
}

const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

/**
 * Works out why the game ended. The specific draw checks run before any
 * generic "is draw" check, so the reason is always named.
 */
export const getResult = (game: Chess): GameResult | null => {
  if (game.isCheckmate()) {
    const winner: Color = game.turn() === 'w' ? 'b' : 'w';
    return { winner, reason: 'checkmate', text: `${colorName(winner)} wins by checkmate` };
  }
  if (game.isStalemate()) return { winner: null, reason: 'stalemate', text: 'Draw by stalemate' };
  if (game.isInsufficientMaterial()) {
    return { winner: null, reason: 'insufficient-material', text: 'Draw by insufficient material' };
  }
  if (game.isThreefoldRepetition()) {
    return { winner: null, reason: 'threefold-repetition', text: 'Draw by threefold repetition' };
  }
  if (game.isDrawByFiftyMoves()) {
    return { winner: null, reason: 'fifty-move-rule', text: 'Draw by the fifty-move rule' };
  }
  return null;
};

export type CapturedBy = Record<Color, PieceSymbol[]>;

/** Pieces each side has captured, derived from the move history (en passant included). */
export const getCaptured = (history: Move[]): CapturedBy => {
  const captured: CapturedBy = { w: [], b: [] };
  for (const m of history) {
    if (m.captured) captured[m.color].push(m.captured);
  }
  return captured;
};

const MATERIAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material balance in pawns from White's point of view, from captures and promotions. */
export const getMaterialBalance = (history: Move[]): number => {
  let balance = 0;
  for (const m of history) {
    const sign = m.color === 'w' ? 1 : -1;
    if (m.captured) balance += sign * MATERIAL[m.captured];
    if (m.promotion) balance += sign * (MATERIAL[m.promotion] - MATERIAL.p);
  }
  return balance;
};

export const toUci = (m: Pick<Move, 'from' | 'to' | 'promotion'>): string =>
  m.from + m.to + (m.promotion ?? '');

const PIECE_NAMES: Record<PieceSymbol, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

/** Plain-English move for screen readers, e.g. "White knight g1 to f3, check". */
export const describeMove = (m: Move): string => {
  const side = colorName(m.color);
  let text: string;
  if (m.isKingsideCastle()) text = `${side} castles kingside`;
  else if (m.isQueensideCastle()) text = `${side} castles queenside`;
  else {
    text = `${side} ${PIECE_NAMES[m.piece]} ${m.from} to ${m.to}`;
    if (m.captured) text += `, takes ${PIECE_NAMES[m.captured]}`;
    if (m.isEnPassant()) text += ' en passant';
    if (m.promotion) text += `, promotes to ${PIECE_NAMES[m.promotion]}`;
  }
  if (m.san.endsWith('#')) text += ', checkmate';
  else if (m.san.endsWith('+')) text += ', check';
  return text;
};

/** Describes a square's contents for the keyboard cursor, e.g. "e4, white pawn" or "e5, empty". */
export const describeSquare = (game: Chess, square: Square): string => {
  const p = game.get(square);
  return p ? `${square}, ${colorName(p.color).toLowerCase()} ${PIECE_NAMES[p.type]}` : `${square}, empty`;
};
