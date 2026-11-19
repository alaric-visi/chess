import { Chess, PieceSymbol, Color } from 'chess.js';

/**
 * A thin, fast view onto chess.js's internal 0x88 board.
 *
 * The public chess.js API builds SAN and two FEN strings for every move it
 * returns, which made search roughly 100x slower than necessary. Search only
 * needs to generate, make and unmake moves, so it uses these internals. They
 * are private API: chess.js is pinned to an exact version in package.json,
 * and fastBoard.test.ts checks this adapter against the public API so an
 * upgrade that changes the internals fails loudly.
 */

export interface InternalMove {
  color: Color;
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
}

interface ChessInternals {
  _board: ({ type: PieceSymbol; color: Color } | undefined)[];
  _turn: Color;
  _hash: bigint;
  _halfMoves: number;
  _moves(opts: { legal: boolean }): InternalMove[];
  _makeMove(move: InternalMove): void;
  _undoMove(): InternalMove | null;
  _isKingAttacked(color: Color): boolean;
  _getPositionCount(hash: bigint): number;
  _incPositionCount(): void;
  _decPositionCount(hash: bigint): void;
}

const FILES = 'abcdefgh';

/** 0x88 index -> algebraic square, e.g. 0 -> "a8", 119 -> "h1". */
export const squareName = (sq: number): string => FILES[sq & 15] + (8 - (sq >> 4));

export const toUci = (m: InternalMove): string => squareName(m.from) + squareName(m.to) + (m.promotion ?? '');

export class FastBoard {
  private readonly c: ChessInternals;

  /** Builds the position from a start FEN plus the UCI moves played since, so repetitions count. */
  constructor(fen: string, moves: string[] = []) {
    const chess = new Chess(fen);
    for (const uci of moves) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    this.c = chess as unknown as ChessInternals;
  }

  get turn(): Color {
    return this.c._turn;
  }

  get hash(): bigint {
    return this.c._hash;
  }

  /** The 128-entry 0x88 board; only indices where (sq & 0x88) === 0 are real squares. */
  get squares(): ChessInternals['_board'] {
    return this.c._board;
  }

  legalMoves(): InternalMove[] {
    return this.c._moves({ legal: true });
  }

  make(m: InternalMove): void {
    this.c._makeMove(m);
    this.c._incPositionCount();
  }

  undo(): void {
    const hash = this.c._hash;
    this.c._undoMove();
    this.c._decPositionCount(hash);
  }

  inCheck(): boolean {
    return this.c._isKingAttacked(this.c._turn);
  }

  /** Threefold repetition, fifty-move rule or bare kings (the cheap insufficient-material cases). */
  isDrawish(): boolean {
    if (this.c._halfMoves >= 100) return true;
    if (this.c._getPositionCount(this.c._hash) >= 3) return true;
    let minors = 0;
    const board = this.c._board;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = board[sq];
      if (!p || p.type === 'k') continue;
      if (p.type === 'n' || p.type === 'b') {
        if (++minors > 1) return false;
      } else {
        return false;
      }
    }
    return true;
  }
}
