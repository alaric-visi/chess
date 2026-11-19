interface MaterialBarProps {
  /** Your material lead in pawns (negative when behind). */
  lead: number;
}

const RANGE = 10; // pawns at which the bar is full

/** Who is ahead on material, at a glance: the filled part is your share. */
export function MaterialBar({ lead }: MaterialBarProps) {
  const share = 0.5 + Math.max(-RANGE, Math.min(RANGE, lead)) / (2 * RANGE);
  const label = lead === 0 ? 'Material is even' : lead > 0 ? `You are up ${lead}` : `You are down ${-lead}`;
  return (
    <div className="space-y-1">
      <div
        role="meter"
        aria-label="Material balance"
        aria-valuemin={-RANGE}
        aria-valuemax={RANGE}
        aria-valuenow={lead}
        aria-valuetext={label}
        className="relative h-2 border border-fg/40 bg-fg/10 overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 bg-fg transition-[width] duration-500"
          style={{ width: `${share * 100}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-bg/80" aria-hidden />
      </div>
      <p className="text-xs uppercase text-muted">{label}</p>
    </div>
  );
}
