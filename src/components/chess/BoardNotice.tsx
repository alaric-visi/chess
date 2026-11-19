import { buttonClass } from '../ui/styles';

interface BoardNoticeProps {
  title: string;
  children: React.ReactNode;
  /** Offer a reload button. */
  reload?: boolean;
}

/** Message shown over (or instead of) the 3D board when graphics fail. */
export function BoardNotice({ title, children, reload }: BoardNoticeProps) {
  return (
    <div role="alert" className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-bg/90">
      <div className="max-w-sm text-center space-y-4 border border-fg p-6 bg-bg shadow-hard-lg">
        <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2>
        <div className="text-xs text-muted space-y-2">{children}</div>
        {reload && (
          <button className={buttonClass} onClick={() => location.reload()}>
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
