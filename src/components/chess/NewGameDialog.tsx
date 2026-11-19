import { useState } from 'react';
import { Color } from 'chess.js';
import { Modal } from '../ui/Modal';
import { buttonClass, labelClass, segmentClass, selectClass } from '../ui/styles';
import { DIFFICULTY_LEVELS, DifficultyLevel, getLevel } from '../../engine/levels';
import { PIECE_SETS, PieceSet } from '../../types/chess/chess';
import type { NewGameOptions } from '../../hooks/chess/useChessGame';

type ColorChoice = Color | 'random';

interface NewGameDialogProps {
  defaults: { color: Color; difficulty: DifficultyLevel; pieceSet: PieceSet };
  onStart: (opts: NewGameOptions) => void;
  onClose: () => void;
}

const COLOR_CHOICES: { id: ColorChoice; label: string }[] = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
];

export function NewGameDialog({ defaults, onStart, onClose }: NewGameDialogProps) {
  const [color, setColor] = useState<ColorChoice>(defaults.color);
  const [difficulty, setDifficulty] = useState(defaults.difficulty);
  const [pieceSet, setPieceSet] = useState(defaults.pieceSet);

  const start = () => {
    const resolved: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    onStart({ color: resolved, difficulty, pieceSet });
    onClose();
  };

  return (
    <Modal title="New game" onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <fieldset className="space-y-1.5">
          <legend className={labelClass}>Play as</legend>
          <div className="flex gap-2 pt-1.5">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={color === c.id}
                onClick={() => setColor(c.id)}
                className={segmentClass(color === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="new-difficulty" className={labelClass}>
            Difficulty
          </label>
          <select
            id="new-difficulty"
            value={difficulty.id}
            onChange={(e) => setDifficulty(getLevel(e.target.value))}
            className={selectClass}
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} (~{level.elo})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-piece-set" className={labelClass}>
            Piece set
          </label>
          <select
            id="new-piece-set"
            value={pieceSet}
            onChange={(e) => setPieceSet(e.target.value as PieceSet)}
            className={selectClass}
          >
            {PIECE_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className={`${buttonClass} w-full`}>
          Start game
        </button>
      </form>
    </Modal>
  );
}
