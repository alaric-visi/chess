import { useEffect, useRef } from 'react';
import { Color, PieceSymbol } from 'chess.js';

interface PromotionPickerProps {
  color: Color;
  onChoose: (piece: PieceSymbol) => void;
  onCancel: () => void;
}

const OPTIONS: { piece: PieceSymbol; name: string; glyph: Record<Color, string> }[] = [
  { piece: 'q', name: 'Queen', glyph: { w: '♕', b: '♛' } },
  { piece: 'r', name: 'Rook', glyph: { w: '♖', b: '♜' } },
  { piece: 'b', name: 'Bishop', glyph: { w: '♗', b: '♝' } },
  { piece: 'n', name: 'Knight', glyph: { w: '♘', b: '♞' } },
];

/** Asks which piece a pawn promotes to. Escape or clicking outside cancels the move. */
export const PromotionPicker = ({ color, onChoose, onCancel }: PromotionPickerProps) => {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
        className="font-label-mono text-fg border border-fg bg-bg p-6 shadow-hard-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="promotion-title" className="text-xs uppercase tracking-widest mb-4 text-center">
          Promote pawn to
        </h2>
        <div className="flex gap-3">
          {OPTIONS.map(({ piece, name, glyph }, i) => (
            <button
              key={piece}
              ref={i === 0 ? firstRef : undefined}
              onClick={() => onChoose(piece)}
              aria-label={name}
              className="w-16 h-20 flex flex-col items-center justify-center gap-1 border border-fg hover:bg-fg hover:text-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-info transition-colors"
            >
              <span className="text-4xl leading-none" aria-hidden>
                {glyph[color]}
              </span>
              <span className="text-xs uppercase">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
