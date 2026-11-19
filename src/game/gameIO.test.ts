import { describe, expect, it } from 'vitest';
import {
  buildPgn,
  fenFromHash,
  loadSavedState,
  parseGameText,
  replay,
  saveState,
  shareUrl,
  START_FEN,
} from './gameIO';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

describe('parseGameText', () => {
  it('reads a FEN', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    expect(parseGameText(fen)).toEqual({ startFen: fen, moves: [] });
  });

  it('rejects a broken FEN with a readable message', () => {
    const r = parseGameText('not a fen at all');
    expect('error' in r && r.error).toMatch(/FEN/);
  });

  it('reads a PGN with tags', () => {
    const r = parseGameText('[Event "Test"]\n\n1. e4 e5 2. Nf3 Nc6 *');
    expect(r).toEqual({ startFen: START_FEN, moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] });
  });

  it('reads a bare move list', () => {
    expect(parseGameText('1. d4 d5 2. c4')).toMatchObject({ moves: ['d2d4', 'd7d5', 'c2c4'] });
  });

  it('keeps a PGN’s custom start position', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    const r = parseGameText(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. e4 *`);
    expect(r).toEqual({ startFen: fen, moves: ['e2e4'] });
  });

  it('rejects an illegal PGN', () => {
    expect('error' in parseGameText('1. e5 e4')).toBe(true);
  });
});

describe('buildPgn', () => {
  it('round-trips through parseGameText', () => {
    const record = { startFen: START_FEN, moves: ['e2e4', 'e7e5', 'g1f3'] };
    const pgn = buildPgn(record, {
      playerColor: 'b',
      opponent: 'Computer (Hard)',
      result: null,
      date: new Date('2026-11-19'),
    });
    expect(pgn).toContain('[White "Computer (Hard)"]');
    expect(pgn).toContain('[Black "You"]');
    expect(pgn).toContain('[Date "2026.11.19"]');
    expect(pgn).toContain('[Result "*"]');
    expect(parseGameText(pgn)).toEqual(record);
  });

  it('writes the result tag', () => {
    const record = { startFen: START_FEN, moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'] };
    const result = { winner: 'b' as const, reason: 'checkmate' as const, text: '' };
    expect(buildPgn(record, { playerColor: 'w', opponent: 'CPU', result })).toContain('0-1');
  });
});

describe('saved state', () => {
  it('round-trips', () => {
    const storage = memoryStorage();
    const state = {
      startFen: START_FEN,
      moves: ['e2e4'],
      playerColor: 'w' as const,
      difficulty: 'hard',
      pieceSet: 'scifi',
      boardTheme: 'marble',
    };
    saveState(storage, state);
    expect(loadSavedState(storage)).toEqual(state);
  });

  it('ignores corrupt or illegal saves', () => {
    const storage = memoryStorage();
    storage.setItem('chess3d_game_v1', '{nope');
    expect(loadSavedState(storage)).toBeNull();
    storage.setItem(
      'chess3d_game_v1',
      JSON.stringify({ startFen: START_FEN, moves: ['e2e5'], playerColor: 'w' }),
    );
    expect(loadSavedState(storage)).toBeNull();
  });

  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSavedState(throwing)).toBeNull();
    expect(() =>
      saveState(throwing, { startFen: START_FEN, moves: [], playerColor: 'w', difficulty: '', pieceSet: '' }),
    ).not.toThrow();
  });
});

describe('share links', () => {
  it('round-trips a FEN through the URL hash', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
    const url = shareUrl('https://example.test/chess/#old', fen);
    expect(url.startsWith('https://example.test/chess/#fen=')).toBe(true);
    expect(fenFromHash(new URL(url).hash)).toBe(fen);
  });

  it('ignores unrelated or invalid hashes', () => {
    expect(fenFromHash('')).toBeNull();
    expect(fenFromHash('#section')).toBeNull();
    expect(fenFromHash('#fen=garbage')).toBeNull();
  });

  it('replays a record', () => {
    expect(replay({ startFen: START_FEN, moves: ['e2e4'] }).fen()).toContain('4P3');
  });
});
