import { Color } from 'chess.js';
import { Evaluation, formatEvaluation, whiteShare } from '../../engine/evaluation';

interface EvalBarProps {
  evaluation: Evaluation | null;
  /** Fill from the player's side. */
  playerColor: Color;
  paused: boolean;
}

/** Engine evaluation as a bar: the filled part is the player's share. */
export function EvalBar({ evaluation, playerColor, paused }: EvalBarProps) {
  const white = evaluation ? whiteShare(evaluation) : 0.5;
  const yours = playerColor === 'w' ? white : 1 - white;
  const label = evaluation
    ? formatEvaluation(evaluation)
    : paused
      ? 'Waiting for the computer…'
      : 'Analysing…';
  return (
    <div className="space-y-1">
      <div
        role="meter"
        aria-label="Engine evaluation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(yours * 100)}
        aria-valuetext={evaluation ? `${label} (White's view)` : label}
        className="relative h-3 border border-fg/40 bg-fg/10 overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 bg-info transition-[width] duration-500"
          style={{ width: `${yours * 100}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-bg/80" aria-hidden />
      </div>
      <p className="text-xs uppercase text-muted">{evaluation ? `Eval ${label} · White's view` : label}</p>
    </div>
  );
}
