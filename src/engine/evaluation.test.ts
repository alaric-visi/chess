import { describe, expect, it } from 'vitest';
import { formatEvaluation, toEvaluation, whiteShare } from './evaluation';
import { MATE, search } from './search';

describe('toEvaluation', () => {
  it('flips the score to White’s point of view', () => {
    expect(toEvaluation(150, 'w')).toEqual({ cp: 150, mateIn: null });
    expect(toEvaluation(150, 'b')).toEqual({ cp: -150, mateIn: null });
  });

  it('decodes mate distance into moves', () => {
    expect(toEvaluation(MATE - 1, 'w').mateIn).toBe(1); // mate next ply
    expect(toEvaluation(MATE - 5, 'w').mateIn).toBe(3);
    expect(toEvaluation(-(MATE - 2), 'w').mateIn).toBe(-1); // White gets mated
    expect(toEvaluation(MATE - 1, 'b').mateIn).toBe(-1); // Black to move mates
  });

  it('matches a real search on a mate in one', () => {
    const r = search('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { maxDepth: 3, moveTime: 2000 });
    expect(toEvaluation(r.score, 'w').mateIn).toBe(1);
  });
});

describe('formatEvaluation', () => {
  it('formats pawns and mates', () => {
    expect(formatEvaluation({ cp: 134, mateIn: null })).toBe('+1.3');
    expect(formatEvaluation({ cp: -40, mateIn: null })).toBe('−0.4');
    expect(formatEvaluation({ cp: 3, mateIn: null })).toBe('0.0');
    expect(formatEvaluation({ cp: 0, mateIn: 3 })).toBe('M3');
    expect(formatEvaluation({ cp: 0, mateIn: -2 })).toBe('−M2');
  });
});

describe('whiteShare', () => {
  it('is even at zero, saturates for big leads, and is total for mates', () => {
    expect(whiteShare({ cp: 0, mateIn: null })).toBeCloseTo(0.5);
    expect(whiteShare({ cp: 2000, mateIn: null })).toBeGreaterThan(0.99);
    expect(whiteShare({ cp: 0, mateIn: -1 })).toBe(0);
  });
});
