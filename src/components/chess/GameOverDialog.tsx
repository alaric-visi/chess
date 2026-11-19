import { useState } from 'react';
import { Color } from 'chess.js';
import { Modal } from '../ui/Modal';
import { buttonClass } from '../ui/styles';
import type { GameResult } from '../../game/gameLogic';
import { copyText } from '../../utils/clipboard';

interface GameOverDialogProps {
  result: GameResult;
  playerColor: Color;
  onRematch: () => void;
  onNewGame: () => void;
  getPgn: () => string;
  onClose: () => void;
}

const headline = (result: GameResult, playerColor: Color) => {
  if (result.winner === null) return 'Draw';
  return result.winner === playerColor ? 'You win' : 'You lose';
};

/** Shown once when a game ends. Closing it leaves the final position on the board to study. */
export function GameOverDialog({
  result,
  playerColor,
  onRematch,
  onNewGame,
  getPgn,
  onClose,
}: GameOverDialogProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal title={headline(result, playerColor)} onClose={onClose} subtle>
      <p className="text-xs uppercase mb-6">{result.text}</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          className={buttonClass}
          onClick={() => {
            onRematch();
            onClose();
          }}
        >
          Rematch
        </button>
        <button
          className={buttonClass}
          onClick={() => {
            onClose();
            onNewGame();
          }}
        >
          New game…
        </button>
        <button
          className={buttonClass}
          onClick={async () => setCopied(await copyText(getPgn()))}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy PGN'}
        </button>
        <button className={buttonClass} onClick={onClose}>
          View board
        </button>
      </div>
    </Modal>
  );
}
