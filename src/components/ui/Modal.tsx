import { ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { iconButtonClass } from './styles';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Lighter backdrop that leaves the board readable behind it. */
  subtle?: boolean;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focuses its first control, keeps Tab inside, closes on
 * Escape or a backdrop click, and returns focus to where it was on close.
 */
export function Modal({ title, onClose, children, subtle }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Parents usually pass an inline function; keep the latest in a ref so the
  // effect below runs once per opening instead of on every parent render
  // (which would keep yanking focus back to the first control).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Skip the close button so the first real control gets focus.
    (focusables()[1] ?? focusables()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        subtle ? 'bg-bg/40' : 'bg-bg/70 backdrop-blur-sm'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto font-label-mono text-fg border border-fg bg-bg p-6 shadow-hard-lg"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className={`${iconButtonClass} absolute top-3 right-3 w-8 h-8`}
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id={titleId} className="text-sm font-bold uppercase tracking-widest mb-5 pr-10">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
