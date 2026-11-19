import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { FastBoard } from './fastBoard';
import { evaluate, search } from './search';
import { DIFFICULTY_LEVELS } from './levels';

const fixedRandom = () => 0.5; // noise term becomes exactly zero

describe('evaluate', () => {
  it('scores the start position as roughly level', () => {
    expect(Math.abs(evaluate(new FastBoard(new Chess().fen())))).toBeLessThan(50);
  });

  it('is symmetric: the side to move sees its own advantage as positive', () => {
    // White is a queen up.
    const whiteToMove = new FastBoard('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
    const blackToMove = new FastBoard('4k3/8/8/8/8/8/8/3QK3 b - - 0 1');
    expect(evaluate(whiteToMove)).toBeGreaterThan(800);
    expect(evaluate(blackToMove)).toBeLessThan(-800);
  });
});

describe('search', () => {
  it('finds mate in one', () => {
    // Back-rank mate: Ra8#.
    const r = search('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { maxDepth: 3, moveTime: 2000 });
    expect(r.bestMove).toBe('a1a8');
  });

  it('takes a hanging queen', () => {
    const r = search('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', { maxDepth: 3, moveTime: 2000 });
    expect(r.bestMove).toBe('d1d5');
  });

  it('does not grab a poisoned pawn defended by a pawn (quiescence)', () => {
    // Qxd5?? loses the queen to ...exd5.
    const r = search('4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1', { maxDepth: 1, moveTime: 2000 });
    expect(r.bestMove).not.toBe('d1d5');
  });

  it('returns null when there are no legal moves', () => {
    const mated = 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1';
    expect(search(mated, { maxDepth: 3, moveTime: 500 }).bestMove).toBeNull();
  });

  it('still finds mate when noise is high', () => {
    const r = search('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', {
      maxDepth: 2,
      moveTime: 2000,
      noise: 10_000,
      random: Math.random,
    });
    expect(r.bestMove).toBe('a1a8');
  });

  it('respects the time budget at the strongest level', () => {
    const master = DIFFICULTY_LEVELS.at(-1)!;
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const start = performance.now();
    const r = search(fen, { maxDepth: master.maxDepth, moveTime: 1000, random: fixedRandom });
    const elapsed = performance.now() - start;
    expect(r.bestMove).toMatch(/^[a-h][1-8][a-h][1-8]/);
    expect(r.depth).toBeGreaterThanOrEqual(2);
    // One node-check interval of slack on top of the budget.
    expect(elapsed).toBeLessThan(1500);
  });
});
