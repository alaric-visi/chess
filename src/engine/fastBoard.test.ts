import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { FastBoard, toUci } from './fastBoard';

/** Counts leaf nodes to a fixed depth, the standard way to validate a move generator. */
const perft = (pos: FastBoard, depth: number): number => {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pos.legalMoves()) {
    pos.make(m);
    n += perft(pos, depth - 1);
    pos.undo();
  }
  return n;
};

describe('FastBoard (guards the chess.js internals it relies on)', () => {
  it('matches known perft counts from the start position', () => {
    expect(perft(new FastBoard(new Chess().fen()), 3)).toBe(8902);
  });

  it('matches perft on "Kiwipete" (castling, en passant, promotions)', () => {
    const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    expect(perft(new FastBoard(kiwipete), 2)).toBe(2039);
  });

  it('generates the same moves as the public API', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    const fast = new FastBoard(fen).legalMoves().map(toUci).sort();
    const pub = new Chess(fen)
      .moves({ verbose: true })
      .map((m) => m.from + m.to + (m.promotion ?? ''))
      .sort();
    expect(fast).toEqual(pub);
  });

  it('restores the hash after make/undo', () => {
    const pos = new FastBoard(new Chess().fen());
    const before = pos.hash;
    const [m] = pos.legalMoves();
    pos.make(m);
    expect(pos.hash).not.toBe(before);
    pos.undo();
    expect(pos.hash).toBe(before);
  });

  it('detects threefold repetition from the moves played', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
    expect(new FastBoard(new Chess().fen(), shuffle).isDrawish()).toBe(true);
    expect(new FastBoard(new Chess().fen(), shuffle.slice(0, 4)).isDrawish()).toBe(false);
  });

  it('treats bare kings and king+minor as drawn, but not king+rook', () => {
    expect(new FastBoard('4k3/8/8/8/8/8/8/4K3 w - - 0 1').isDrawish()).toBe(true);
    expect(new FastBoard('4k3/8/8/8/8/8/8/4KN2 w - - 0 1').isDrawish()).toBe(true);
    expect(new FastBoard('4k3/8/8/8/8/8/8/4KR2 w - - 0 1').isDrawish()).toBe(false);
  });
});
