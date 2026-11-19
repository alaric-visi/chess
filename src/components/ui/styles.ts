/**
 * Shared Tailwind class strings for the app's brutalist button and form
 * style. Colours come from the semantic tokens in index.css (fg, bg, muted,
 * ok, warn, bad, info), so each class works in both themes without dark: pairs.
 */

export const focusRing =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info';

export const buttonClass = `inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 font-label-mono text-xs uppercase transition-colors cursor-pointer shadow-hard hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] border bg-transparent text-fg border-fg hover:bg-fg hover:text-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:bg-transparent disabled:hover:text-fg ${focusRing}`;

/** Square icon-only button; always pass an aria-label. */
export const iconButtonClass = `inline-flex items-center justify-center w-10 h-10 border transition-colors cursor-pointer text-fg border-fg/40 hover:border-fg hover:bg-fg hover:text-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg ${focusRing}`;

export const selectClass = `w-full h-10 px-2 font-label-mono text-xs uppercase bg-bg border border-fg/50 text-fg focus:border-fg ${focusRing}`;

export const labelClass = 'text-xs uppercase text-muted';

/** Segmented-control option; pair with aria-pressed. */
export const segmentClass = (active: boolean) =>
  `flex-1 h-10 px-2 font-label-mono text-xs uppercase border transition-colors ${focusRing} ${
    active ? 'bg-fg text-bg border-fg' : 'border-fg/40 text-fg hover:border-fg'
  }`;
