/** Branded placeholder shown until the 3D scene has drawn its first frame. */
export function SceneLoader({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 animate-pulse ${(i + Math.floor(i / 4)) % 2 ? 'bg-fg' : 'bg-fg/20'}`}
            style={{ animationDelay: `${(i % 4) * 120 + Math.floor(i / 4) * 120}ms` }}
          />
        ))}
      </div>
      <p className="text-xs uppercase tracking-widest text-muted" role={visible ? 'status' : undefined}>
        {visible ? 'Setting up the board…' : ''}
      </p>
    </div>
  );
}
