import { useEffect, useMemo } from 'react';
import { EngineClient } from '../../engine/engineClient';

/** One engine worker per mounted game, torn down on unmount. */
export const useEngine = (): EngineClient => {
  const engine = useMemo(() => new EngineClient(), []);
  useEffect(() => () => engine.dispose(), [engine]);
  return engine;
};
