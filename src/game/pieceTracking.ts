import { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';

/** A piece on the board with an identity that survives moves, so it can animate between squares. */
export interface TrackedPiece {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
}

let idCounter = 0;
const newId = (color: Color, type: PieceSymbol) => `${color}${type}-${++idCounter}`;

/** Fresh identities for every piece in a position (new game, or a jump we can't animate). */
export const piecesFromFen = (fen: string): TrackedPiece[] => {
  const pieces: TrackedPiece[] = [];
  for (const row of new Chess(fen).board()) {
    for (const p of row) {
      if (p) pieces.push({ id: newId(p.color, p.type), type: p.type, color: p.color, square: p.square });
    }
  }
  return pieces;
};

const CASTLING_ROOK: Record<string, [Square, Square]> = {
  g1: ['h1', 'f1'],
  c1: ['a1', 'd1'],
  g8: ['h8', 'f8'],
  c8: ['a8', 'd8'],
};

/**
 * Applies one move to the tracked pieces, keeping identities so the moving
 * piece slides. Handles captures, en passant, castling (the rook slides too)
 * and promotion (the pawn slides, then becomes the new piece).
 */
export const applyMoveToPieces = (pieces: TrackedPiece[], move: Move): TrackedPiece[] => {
  const capturedSquare: Square = move.isEnPassant() ? ((move.to[0] + move.from[1]) as Square) : move.to;

  const rookMove = move.isKingsideCastle() || move.isQueensideCastle() ? CASTLING_ROOK[move.to] : undefined;

  return pieces
    .filter((p) => !(move.captured && p.square === capturedSquare && p.color !== move.color))
    .map((p) => {
      if (p.square === move.from) {
        return { ...p, square: move.to, type: move.promotion ?? p.type };
      }
      if (rookMove && p.square === rookMove[0]) {
        return { ...p, square: rookMove[1] };
      }
      return p;
    });
};

/**
 * Brings tracked pieces up to date with `fen`. If the change is exactly
 * `lastMove`, the move is animated; anything else (new game, undo) rebuilds.
 */
export const syncPieces = (
  prev: TrackedPiece[],
  prevFen: string | null,
  fen: string,
  lastMove: Move | null,
): TrackedPiece[] => {
  if (prevFen === fen) return prev;
  if (prevFen && lastMove && lastMove.before === prevFen && lastMove.after === fen) {
    return applyMoveToPieces(prev, lastMove);
  }
  return piecesFromFen(fen);
};
