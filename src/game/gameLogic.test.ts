import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { describeMove, describeSquare, getCaptured, getMaterialBalance, getResult } from './gameLogic';

const play = (moves: string[], fen?: string) => {
  const game = new Chess(fen);
  for (const m of moves) game.move(m);
  return game;
};

describe('getResult', () => {
  it('returns null while the game is in progress', () => {
    expect(getResult(new Chess())).toBeNull();
  });

  it("names the winner of fool's mate", () => {
    const r = getResult(play(['f3', 'e5', 'g4', 'Qh4#']));
    expect(r).toEqual({ winner: 'b', reason: 'checkmate', text: 'Black wins by checkmate' });
  });

  it('names stalemate rather than a generic draw', () => {
    const r = getResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
    expect(r?.reason).toBe('stalemate');
    expect(r?.winner).toBeNull();
  });

  it('names insufficient material', () => {
    expect(getResult(new Chess('4k3/8/8/8/8/8/8/4KB2 w - - 0 1'))?.reason).toBe('insufficient-material');
  });

  it('names threefold repetition', () => {
    const r = getResult(play(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']));
    expect(r?.reason).toBe('threefold-repetition');
  });

  it('names the fifty-move rule', () => {
    expect(getResult(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'))?.reason).toBe('fifty-move-rule');
  });
});

describe('getCaptured', () => {
  it('credits captures to the side that made them, whichever colour the player is', () => {
    const game = play(['e4', 'd5', 'exd5', 'Qxd5']);
    expect(getCaptured(game.history({ verbose: true }))).toEqual({ w: ['p'], b: ['p'] });
  });

  it('counts en passant captures', () => {
    const game = play(['e4', 'a6', 'e5', 'd5', 'exd6']);
    expect(getCaptured(game.history({ verbose: true })).w).toEqual(['p']);
  });
});

describe('getMaterialBalance', () => {
  it('counts captures and promotions from white’s point of view', () => {
    const game = play(['e4', 'd5', 'exd5', 'c6', 'dxc6', 'Nf6', 'cxb7', 'Nbd7', 'bxa8=Q']);
    // White took pawn, pawn, pawn, rook (1+1+1+5) and promoted (+8); black took nothing.
    expect(getMaterialBalance(game.history({ verbose: true }))).toBe(16);
  });
});

describe('describeMove', () => {
  const last = (moves: string[], fen?: string) => play(moves, fen).history({ verbose: true }).at(-1)!;

  it('describes a quiet move', () => {
    expect(describeMove(last(['Nf3']))).toBe('White knight g1 to f3');
  });

  it('describes captures and checks', () => {
    expect(describeMove(last(['e4', 'f5', 'exf5']))).toBe('White pawn e4 to f5, takes pawn');
    expect(describeMove(last(['f3', 'e5', 'g4', 'Qh4#']))).toBe('Black queen d8 to h4, checkmate');
  });

  it('describes castling and promotion', () => {
    expect(describeMove(last(['O-O'], '4k3/8/8/8/8/8/8/4K2R w K - 0 1'))).toBe('White castles kingside');
    expect(describeMove(last(['a8=N+'], '1k6/P7/8/8/8/8/8/4K3 w - - 0 1'))).toBe(
      'White pawn a7 to a8, promotes to knight',
    );
  });
});

describe('describeSquare', () => {
  it('names the piece or says empty', () => {
    const game = new Chess();
    expect(describeSquare(game, 'e2')).toBe('e2, white pawn');
    expect(describeSquare(game, 'e4')).toBe('e4, empty');
  });
});
