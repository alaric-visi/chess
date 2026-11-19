import { useCallback, useEffect, useRef, useState } from 'react';
import type { Move } from 'chess.js';

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'end';

const MUTE_KEY = 'chess3d_muted';

const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

/** Short synthesized tones: no audio files to download. */
const play = (ctx: AudioContext, name: SoundName) => {
  const t = ctx.currentTime;
  const tone = (
    freq: number,
    start: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t + start);
    g.gain.setValueAtTime(0, t + start);
    g.gain.linearRampToValueAtTime(gain, t + start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + start);
    osc.stop(t + start + duration + 0.02);
  };

  switch (name) {
    case 'move':
      tone(520, 0, 0.07, 0.25, 'triangle');
      break;
    case 'capture':
      tone(180, 0, 0.12, 0.35, 'triangle');
      tone(420, 0.01, 0.08, 0.2, 'square');
      break;
    case 'castle':
      tone(520, 0, 0.06, 0.25, 'triangle');
      tone(440, 0.09, 0.06, 0.25, 'triangle');
      break;
    case 'check':
      tone(660, 0, 0.1, 0.25, 'square');
      tone(880, 0.1, 0.14, 0.2, 'square');
      break;
    case 'end':
      tone(523, 0, 0.18, 0.25);
      tone(659, 0.16, 0.18, 0.25);
      tone(784, 0.32, 0.35, 0.25);
      break;
  }
};

export const soundForMove = (m: Move): SoundName => {
  if (m.san.endsWith('+') || m.san.endsWith('#')) return 'check';
  if (m.isKingsideCastle() || m.isQueensideCastle()) return 'castle';
  if (m.captured) return 'capture';
  return 'move';
};

/**
 * Move sounds with a persisted mute toggle. The AudioContext is created on
 * the first sound, which browsers only allow after a user gesture; sounds
 * before then are silently skipped.
 */
export const useSounds = () => {
  const [muted, setMuted] = useState(readMuted);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
  }, [muted]);

  // Unlock audio on the first interaction so the engine's replies can play too.
  useEffect(() => {
    const unlock = () => {
      if (!ctxRef.current) {
        try {
          ctxRef.current = new AudioContext();
        } catch {
          return;
        }
      }
      void ctxRef.current.resume();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playSound = useCallback(
    (name: SoundName) => {
      const ctx = ctxRef.current;
      if (muted || !ctx || ctx.state !== 'running') return;
      play(ctx, name);
    },
    [muted],
  );

  return { muted, setMuted, playSound };
};
