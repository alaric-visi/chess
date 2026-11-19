/// <reference lib="webworker" />
import { search, SearchOptions, SearchResult } from './search';

export interface EngineRequest {
  id: number;
  /** Start position of the game. */
  fen: string;
  /** UCI moves played since `fen`. */
  moves: string[];
  options: SearchOptions;
}

export type EngineResponse =
  { id: number; ok: true; result: SearchResult } | { id: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { id, fen, moves, options } = event.data;
  let response: EngineResponse;
  try {
    response = { id, ok: true, result: search(fen, options, moves) };
  } catch (e) {
    response = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  self.postMessage(response);
};
