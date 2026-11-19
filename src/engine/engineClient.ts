import type { EngineRequest, EngineResponse } from './engine.worker';
import type { SearchOptions, SearchResult } from './search';

export class AbortedError extends Error {
  constructor() {
    super('Search aborted');
    this.name = 'AbortedError';
  }
}

/**
 * Runs searches in a dedicated Web Worker so the UI never blocks.
 *
 * A running search is synchronous inside the worker and can't read new
 * messages, so cancelling terminates the worker outright and a fresh one is
 * spawned for the next request. That makes cancellation immediate and means
 * a stale result can never arrive after a new game has started.
 */
export class EngineClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending: { id: number; resolve: (r: SearchResult) => void; reject: (e: Error) => void } | null =
    null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<EngineResponse>) => {
        const msg = event.data;
        if (!this.pending || msg.id !== this.pending.id) return;
        const { resolve, reject } = this.pending;
        this.pending = null;
        if (msg.ok) resolve(msg.result);
        else reject(new Error(msg.error));
      };
      this.worker.onerror = (event) => {
        const pending = this.pending;
        this.pending = null;
        this.reset();
        pending?.reject(new Error(event.message || 'Engine worker crashed'));
      };
    }
    return this.worker;
  }

  search(fen: string, moves: string[], options: SearchOptions, signal?: AbortSignal): Promise<SearchResult> {
    if (signal?.aborted) return Promise.reject(new AbortedError());
    // Only one search at a time: a new request supersedes any running one.
    this.cancel();

    return new Promise<SearchResult>((resolve, reject) => {
      const id = this.nextId++;
      this.pending = { id, resolve, reject };
      signal?.addEventListener('abort', () => {
        if (this.pending?.id === id) this.cancel();
      });
      const request: EngineRequest = { id, fen, moves, options };
      this.getWorker().postMessage(request);
    });
  }

  /** Stops any running search; its promise rejects with AbortedError. */
  cancel(): void {
    if (!this.pending) return;
    const { reject } = this.pending;
    this.pending = null;
    this.reset();
    reject(new AbortedError());
  }

  dispose(): void {
    this.cancel();
    this.reset();
  }

  private reset(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
