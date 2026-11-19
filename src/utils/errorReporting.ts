/**
 * Lightweight error reporting.
 *
 * Errors are always logged to the console. If the build sets
 * VITE_ERROR_ENDPOINT, a small report is also sent there with
 * navigator.sendBeacon. Reports carry only the error itself, the page path
 * and a timestamp: no game data, no user details, no user agent. Repeats of
 * the same message are dropped, and at most MAX_REPORTS go out per page load.
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  /** Where it came from: 'window', 'promise', 'react', 'webgl'. */
  source: string;
  path: string;
  time: string;
}

const MAX_REPORTS = 10;
const MAX_STACK = 2000;

type Sender = (url: string, body: string) => boolean;

export const createReporter = (opts: {
  endpoint?: string;
  send?: Sender;
  log?: (r: ErrorReport) => void;
}) => {
  const seen = new Set<string>();
  let sent = 0;

  return (error: unknown, source: string): ErrorReport | null => {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${source}:${err.message}`;
    if (seen.has(key)) return null;
    seen.add(key);

    const report: ErrorReport = {
      message: err.message.slice(0, 500),
      stack: err.stack?.slice(0, MAX_STACK),
      source,
      path: typeof location !== 'undefined' ? location.pathname : '',
      time: new Date().toISOString(),
    };
    opts.log?.(report);
    if (opts.endpoint && opts.send && sent < MAX_REPORTS) {
      sent++;
      opts.send(opts.endpoint, JSON.stringify(report));
    }
    return report;
  };
};

const reporter = createReporter({
  endpoint: import.meta.env.VITE_ERROR_ENDPOINT as string | undefined,
  send: (url, body) => navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' })) ?? false,
  log: (r) => console.error(`[${r.source}] ${r.message}`),
});

export const reportError = (error: unknown, source: string) => reporter(error, source);

/** Catches errors that escape React and unhandled promise rejections. Call once at startup. */
export const initErrorReporting = () => {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
};
