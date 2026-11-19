import { Color, PieceSymbol } from 'chess.js';

interface CapturedPiecesProps {
  /** Pieces that were captured. */
  pieces: PieceSymbol[];
  /** Colour of the captured pieces (the victims). */
  color: Color;
  /** Material lead in pawns for the capturing side, shown when positive. */
  advantage?: number;
}

const GLYPHS: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

const NAMES: Record<PieceSymbol, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

export const CapturedPieces = ({ pieces, color, advantage = 0 }: CapturedPiecesProps) => {
  if (pieces.length === 0 && advantage <= 0) {
    return <span className="text-muted text-xs">—</span>;
  }

  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const label = sorted.map((p) => NAMES[p]).join(', ');

  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      aria-label={label ? `Captured: ${label}` : undefined}
    >
      {sorted.map((piece, index) => (
        <span key={index} className="text-base leading-none" aria-hidden>
          {GLYPHS[color][piece]}
        </span>
      ))}
      {advantage > 0 && <span className="ml-1 text-xs text-muted">+{advantage}</span>}
    </div>
  );
};
