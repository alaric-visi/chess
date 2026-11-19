import { useState } from 'react';
import { Color } from 'chess.js';
import { Modal } from '../ui/Modal';
import { buttonClass, labelClass, segmentClass } from '../ui/styles';
import { copyText } from '../../utils/clipboard';

interface ImportExportDialogProps {
  getPgn: () => string;
  fen: string;
  getShareUrl: () => string;
  /** Returns an error message, or null when the game loaded. */
  onImport: (text: string, color?: Color) => string | null;
  onClose: () => void;
}

type SideChoice = 'auto' | Color;

export function ImportExportDialog({ getPgn, fen, getShareUrl, onImport, onClose }: ImportExportDialogProps) {
  const [text, setText] = useState('');
  const [side, setSide] = useState<SideChoice>('auto');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (what: string, value: string) => {
    if (await copyText(value)) setCopied(what);
  };

  const load = () => {
    const err = onImport(text, side === 'auto' ? undefined : side);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Modal title="Import / export" onClose={onClose}>
      <section className="space-y-3 mb-6">
        <h3 className={labelClass}>Export this game</h3>
        <div className="grid grid-cols-3 gap-2">
          <button className={buttonClass} onClick={() => copy('PGN', getPgn())}>
            PGN
          </button>
          <button className={buttonClass} onClick={() => copy('FEN', fen)}>
            FEN
          </button>
          <button className={buttonClass} onClick={() => copy('Link', getShareUrl())}>
            Link
          </button>
        </div>
        <p className="text-xs uppercase text-muted min-h-[1em]" role="status">
          {copied ? `${copied} copied to clipboard` : 'Copies to your clipboard. Links share this position.'}
        </p>
      </section>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label htmlFor="import-text" className={labelClass}>
          Load a game — paste a FEN or PGN
        </label>
        <textarea
          id="import-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={5}
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? 'import-error' : undefined}
          className="w-full p-2 text-xs font-label-mono bg-transparent border border-fg/50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
          placeholder="1. e4 e5 2. Nf3 …"
        />
        {error && (
          <p id="import-error" className="text-xs text-bad" role="alert">
            {error}
          </p>
        )}
        <fieldset>
          <legend className={labelClass}>Play as</legend>
          <div className="flex gap-2 pt-1.5">
            {(
              [
                ['auto', 'Side to move'],
                ['w', 'White'],
                ['b', 'Black'],
              ] as [SideChoice, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={side === id}
                onClick={() => setSide(id)}
                className={segmentClass(side === id)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className={`${buttonClass} w-full`} disabled={!text.trim()}>
          Load game
        </button>
      </form>
    </Modal>
  );
}
