import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { piecesFromFen, syncPieces, TrackedPiece } from './pieceTracking';

/** Plays `setup`, then one more move, and returns the tracked pieces before and after. */
const track = (setup: string[], move: string, fen?: string) => {
  const game = new Chess(fen);
  for (const m of setup) game.move(m);
  const beforeFen = game.fen();
  const before = piecesFromFen(beforeFen);
  const played = game.move(move);
  const after = syncPieces(before, beforeFen, game.fen(), played);
  return { before, after, game };
};

const at = (pieces: TrackedPiece[], square: string) => pieces.find((p) => p.square === square);

const matchesBoard = (pieces: TrackedPiece[], game: Chess) => {
  const expected = game
    .board()
    .flat()
    .filter(Boolean)
    .map((p) => `${p!.color}${p!.type}${p!.square}`)
    .sort();
  expect(pieces.map((p) => `${p.color}${p.type}${p.square}`).sort()).toEqual(expected);
};

describe('syncPieces', () => {
  it('keeps the moving piece’s identity', () => {
    const { before, after, game } = track([], 'e4');
    expect(at(after, 'e4')!.id).toBe(at(before, 'e2')!.id);
    matchesBoard(after, game);
  });

  it('removes a captured piece', () => {
    const { after, game } = track(['e4', 'd5'], 'exd5');
    expect(after).toHaveLength(31);
    matchesBoard(after, game);
  });

  it('slides the rook when castling (both pieces keep their ids)', () => {
    const { before, after, game } = track(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], 'O-O');
    expect(at(after, 'g1')!.id).toBe(at(before, 'e1')!.id);
    expect(at(after, 'f1')!.id).toBe(at(before, 'h1')!.id);
    matchesBoard(after, game);
  });

  it('handles queenside castling for black', () => {
    const { before, after, game } = track([], 'O-O-O', 'r3k3/8/8/8/8/8/8/4K3 b q - 0 1');
    expect(at(after, 'd8')!.id).toBe(at(before, 'a8')!.id);
    matchesBoard(after, game);
  });

  it('removes the pawn taken en passant', () => {
    const { after, game } = track(['e4', 'a6', 'e5', 'd5'], 'exd6');
    expect(at(after, 'd5')).toBeUndefined();
    matchesBoard(after, game);
  });

  it('turns the promoting pawn into the new piece', () => {
    const { before, after, game } = track([], 'a8=N', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(at(after, 'a8')).toMatchObject({ id: at(before, 'a7')!.id, type: 'n' });
    matchesBoard(after, game);
  });

  it('rebuilds when the position jumps (e.g. a new game)', () => {
    const { after, game } = track([], 'e4');
    game.reset();
    const rebuilt = syncPieces(after, after.length ? 'stale' : null, game.fen(), null);
    expect(rebuilt).toHaveLength(32);
    matchesBoard(rebuilt, game);
  });
});
