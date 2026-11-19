import { PieceSymbol } from 'chess.js';
import { FastBoard, InternalMove, toUci } from './fastBoard';

/**
 * A small negamax engine on top of chess.js internals (see fastBoard.ts): iterative deepening under a time
 * budget, alpha-beta with a transposition table, and quiescence search on
 * captures. It is pure (no DOM, no timers) so it runs in a Web Worker and in
 * unit tests alike.
 */

export interface SearchOptions {
  maxDepth: number;
  /** Time budget in milliseconds. */
  moveTime: number;
  /** Centipawns of noise added per root move (0 = play the best move). */
  noise?: number;
  /** Injected for deterministic tests. */
  random?: () => number;
  now?: () => number;
}

export interface SearchResult {
  /** UCI move, e.g. "e2e4" or "e7e8q". Null when there are no legal moves. */
  bestMove: string | null;
  /** Score in centipawns from the side to move's point of view. */
  score: number;
  depth: number;
  nodes: number;
}

export const MATE = 100_000;
const INF = 1_000_000;

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables, written from White's point of view with a8 first.
// prettier-ignore
const PST: Record<PieceSymbol | 'k_end', number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
  k_end: [
   -50,-40,-30,-20,-20,-30,-40,-50,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -50,-30,-30,-30,-30,-30,-30,-50,
  ],
};

/**
 * Static evaluation in centipawns from the side to move's point of view.
 * The 0x88 index maps straight onto the tables: row = sq >> 4 (rank 8 first).
 */
export const evaluate = (pos: FastBoard): number => {
  const board = pos.squares;
  let score = 0;
  let nonPawnMaterial = 0;
  let whiteKing = -1;
  let blackKing = -1;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = board[sq];
    if (!piece) continue;
    const row = sq >> 4;
    const col = sq & 7;
    const idx = piece.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
    if (piece.type === 'k') {
      if (piece.color === 'w') whiteKing = idx;
      else blackKing = idx;
      continue;
    }
    if (piece.type !== 'p') nonPawnMaterial += PIECE_VALUES[piece.type];
    const value = PIECE_VALUES[piece.type] + PST[piece.type][idx];
    score += piece.color === 'w' ? value : -value;
  }

  // Kings shelter in the middlegame and centralise in the endgame.
  const kingTable = nonPawnMaterial <= 1300 ? PST.k_end : PST.k;
  if (whiteKing >= 0) score += kingTable[whiteKing];
  if (blackKing >= 0) score -= kingTable[blackKing];

  return pos.turn === 'w' ? score : -score;
};

const sameMove = (a: InternalMove, b: InternalMove | undefined) =>
  !!b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;

const orderScore = (m: InternalMove, ttMove: InternalMove | undefined): number => {
  if (sameMove(m, ttMove)) return 1_000_000;
  let s = 0;
  if (m.captured) s += 10_000 + PIECE_VALUES[m.captured] * 10 - PIECE_VALUES[m.piece];
  if (m.promotion) s += 9_000 + PIECE_VALUES[m.promotion];
  return s;
};

const orderMoves = (moves: InternalMove[], ttMove?: InternalMove): InternalMove[] =>
  moves
    .map((m) => ({ m, s: orderScore(m, ttMove) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);

type Bound = 0 | 1 | 2; // exact, lower, upper
interface TTEntry {
  depth: number;
  score: number;
  bound: Bound;
  move?: InternalMove;
}

class TimeUp extends Error {}

/**
 * Finds a move for the side to play. `moves` are the UCI moves played since
 * `fen`, passed so the engine can see (and avoid or aim for) repetitions.
 */
export const search = (fen: string, opts: SearchOptions, moves: string[] = []): SearchResult => {
  const pos = new FastBoard(fen, moves);
  const now = opts.now ?? (() => performance.now());
  const random = opts.random ?? Math.random;
  const deadline = now() + opts.moveTime;
  const tt = new Map<bigint, TTEntry>();
  let nodes = 0;

  const rootMoves = pos.legalMoves();
  if (rootMoves.length === 0) return { bestMove: null, score: 0, depth: 0, nodes: 0 };
  if (rootMoves.length === 1) return { bestMove: toUci(rootMoves[0]), score: 0, depth: 0, nodes: 0 };

  const checkTime = () => {
    if ((++nodes & 1023) === 0 && now() > deadline) throw new TimeUp();
  };

  const quiesce = (alpha: number, beta: number): number => {
    checkTime();
    const standPat = evaluate(pos);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const captures = orderMoves(pos.legalMoves().filter((m) => m.captured || m.promotion));
    for (const m of captures) {
      pos.make(m);
      const score = -quiesce(-beta, -alpha);
      pos.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const negamax = (depth: number, alpha: number, beta: number, ply: number): number => {
    checkTime();
    if (ply > 0 && pos.isDrawish()) return 0;

    const key = pos.hash;
    const entry = tt.get(key);
    if (entry && entry.depth >= depth && ply > 0) {
      if (entry.bound === 0) return entry.score;
      if (entry.bound === 1 && entry.score >= beta) return entry.score;
      if (entry.bound === 2 && entry.score <= alpha) return entry.score;
    }

    const moves = pos.legalMoves();
    if (moves.length === 0) return pos.inCheck() ? -MATE + ply : 0;
    if (depth <= 0) return quiesce(alpha, beta);

    const alphaOrig = alpha;
    let best = -INF;
    let bestMove: InternalMove | undefined;
    for (const m of orderMoves(moves, entry?.move)) {
      pos.make(m);
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      pos.undo();
      if (score > best) {
        best = score;
        bestMove = m;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    const bound: Bound = best <= alphaOrig ? 2 : best >= beta ? 1 : 0;
    tt.set(key, { depth, score: best, bound, move: bestMove });
    return best;
  };

  /** Scores every root move with a full window so noise can be applied fairly. */
  const scoreAllRootMoves = (depth: number) =>
    orderMoves(rootMoves).map((m) => {
      pos.make(m);
      const score = -negamax(depth - 1, -INF, INF, 1);
      pos.undo();
      return { move: m, score };
    });

  const noise = opts.noise ?? 0;
  let result: SearchResult = { bestMove: toUci(orderMoves(rootMoves)[0]), score: 0, depth: 0, nodes: 0 };

  for (let depth = 1; depth <= opts.maxDepth; depth++) {
    try {
      if (noise > 0) {
        const scored = scoreAllRootMoves(depth);
        // Never throw away a forced mate: noise only decides between non-mating moves.
        let pick = scored[0];
        let pickNoisy = -INF;
        for (const s of scored) {
          const isMate = s.score > MATE - 1000;
          const noisy = isMate ? s.score + INF : s.score + (random() * 2 - 1) * noise;
          if (noisy > pickNoisy) {
            pickNoisy = noisy;
            pick = s;
          }
        }
        result = { bestMove: toUci(pick.move), score: pick.score, depth, nodes };
      } else {
        const score = negamax(depth, -INF, INF, 0);
        const move = tt.get(pos.hash)?.move;
        if (move) result = { bestMove: toUci(move), score, depth, nodes };
        if (Math.abs(score) > MATE - 1000) break; // forced mate found, no need to go deeper
      }
    } catch (e) {
      if (e instanceof TimeUp) {
        // The interrupted iteration may have left moves made on the board; the
        // position object is discarded, so there is nothing to restore.
        break;
      }
      throw e;
    }
    if (now() > deadline) break;
  }

  return { ...result, nodes };
};
