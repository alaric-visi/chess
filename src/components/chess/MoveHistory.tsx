import { useEffect, useRef } from 'react';
import { Move } from 'chess.js';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { iconButtonClass } from '../ui/styles';

interface MoveHistoryProps {
  moves: Move[];
  /** Ply being reviewed (0 = start), or null for the live game. */
  viewPly: number | null;
  onView: (ply: number | null) => void;
}

const moveButton = (active: boolean) =>
  `w-14 text-left px-1 py-0.5 uppercase focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-info ${
    active ? 'bg-fg text-bg' : 'hover:bg-fg/10'
  }`;

/** Clickable move list: pick a move to see the board as it was, then step or jump back to live. */
export const MoveHistory = ({ moves, viewPly, onView }: MoveHistoryProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPly = viewPly ?? moves.length;

  // Keep the current move in view.
  useEffect(() => {
    // Scroll only the list itself; scrollIntoView would also scroll the page.
    const box = scrollRef.current;
    if (!box) return;
    const el = box.querySelector<HTMLElement>('[aria-current="true"]');
    if (!el) {
      box.scrollTop = box.scrollHeight;
      return;
    }
    const top = el.offsetTop; // the list is the offsetParent (position: relative)
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top + el.offsetHeight - box.clientHeight;
    }
  }, [currentPly, moves.length]);

  const pairs: { number: number; white?: Move; black?: Move; whitePly: number }[] = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (m.color === 'w' || pairs.length === 0) {
      pairs.push({ number: pairs.length + 1, whitePly: i + 1 });
    }
    const pair = pairs[pairs.length - 1];
    if (m.color === 'w') pair.white = m;
    else pair.black = m;
  }

  const cell = (m: Move | undefined, ply: number) =>
    m ? (
      <button
        className={moveButton(currentPly === ply)}
        aria-current={currentPly === ply}
        aria-label={`Move ${Math.ceil(ply / 2)}${m.color === 'b' ? ' black' : ''}: ${m.san}`}
        onClick={() => onView(ply === moves.length ? null : ply)}
      >
        {m.san}
      </button>
    ) : (
      <span className="w-14 px-1">…</span>
    );

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        className="relative h-32 overflow-y-auto border border-fg/20 bg-fg/5 p-2 scrollbar-custom"
      >
        {moves.length === 0 ? (
          <p className="text-muted text-xs">No moves yet</p>
        ) : (
          <ol className="space-y-0.5 font-label-mono text-xs">
            {pairs.map((pair) => (
              <li key={pair.number} className="flex gap-1 items-center">
                <span className="text-muted w-7">{pair.number}.</span>
                {cell(pair.white, pair.whitePly)}
                {cell(pair.black, pair.white ? pair.whitePly + 1 : pair.whitePly)}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="flex gap-2" role="group" aria-label="Review moves">
        <button
          className={iconButtonClass}
          aria-label="First position"
          disabled={currentPly === 0}
          onClick={() => onView(0)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          className={iconButtonClass}
          aria-label="Previous move"
          disabled={currentPly === 0}
          onClick={() => onView(currentPly - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className={iconButtonClass}
          aria-label="Next move"
          disabled={viewPly === null}
          onClick={() => onView(currentPly + 1 >= moves.length ? null : currentPly + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className={iconButtonClass}
          aria-label="Back to live game"
          disabled={viewPly === null}
          onClick={() => onView(null)}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
