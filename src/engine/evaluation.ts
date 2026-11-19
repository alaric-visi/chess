import type { Color } from 'chess.js';
import { MATE } from './search';

/** An engine verdict on a position, always from White's point of view. */
export interface Evaluation {
  /** Centipawns, positive when White is better. Ignored when `mateIn` is set. */
  cp: number;
  /** Moves to mate: positive when White mates, negative when Black does. */
  mateIn: number | null;
}

/** Turns a search score (side to move's view, mate-distance encoded) into an Evaluation. */
export const toEvaluation = (score: number, sideToMove: Color): Evaluation => {
  const white = sideToMove === 'w' ? score : -score;
  if (Math.abs(score) > MATE - 1000) {
    const plies = MATE - Math.abs(score);
    const moves = Math.max(1, Math.ceil(plies / 2));
    return { cp: white, mateIn: white > 0 ? moves : -moves };
  }
  return { cp: white, mateIn: null };
};

/** "+1.3", "−0.4", "0.0", "M3", "−M2". */
export const formatEvaluation = (e: Evaluation): string => {
  if (e.mateIn !== null) return `${e.mateIn < 0 ? '−' : ''}M${Math.abs(e.mateIn)}`;
  const pawns = e.cp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`;
};

/** White's share of an evaluation bar, 0..1, with diminishing returns for big leads. */
export const whiteShare = (e: Evaluation): number => {
  if (e.mateIn !== null) return e.mateIn > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-e.cp / 400));
};
