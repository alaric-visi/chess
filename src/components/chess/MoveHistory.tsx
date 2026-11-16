import { Move } from 'chess.js';

interface MoveHistoryProps {
  moves: Move[];
}

export const MoveHistory = ({ moves }: MoveHistoryProps) => {
  if (moves.length === 0) {
    return <p className="opacity-50 text-[10px]">No moves yet</p>;
  }

  const movePairs: { number: number; white: Move; black?: Move }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="h-28 overflow-y-auto border border-primary/20 bg-primary/5 p-2 scrollbar-thin">
      <div className="space-y-1 font-label-mono text-[10px] uppercase">
        {movePairs.map((pair) => (
          <div key={pair.number} className="flex gap-2">
            <span className="opacity-50 w-6">{pair.number}.</span>
            <span className="w-12">{pair.white.san}</span>
            {pair.black && (
              <span className="w-12">{pair.black.san}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
