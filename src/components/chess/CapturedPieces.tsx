import { PieceSymbol } from 'chess.js';

interface CapturedPiecesProps {
  pieces: string[];
  color: 'w' | 'b';
}

const pieceSymbols: Record<PieceSymbol, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

export const CapturedPieces = ({ pieces, color }: CapturedPiecesProps) => {
  if (pieces.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {pieces.map((piece, index) => (
        <span 
          key={index}
          className={`text-base ${color === 'w' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {pieceSymbols[piece as PieceSymbol] || piece}
        </span>
      ))}
    </div>
  );
};
