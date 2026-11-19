import * as THREE from 'three';
import type { Color } from 'chess.js';
import type { PieceSet } from '../../types/chess/chess';

export type BoardThemeId = 'green' | 'wood' | 'marble' | 'glass' | 'stone' | 'forest' | 'seabed';
export type BoardThemeChoice = BoardThemeId | 'auto';

type Pattern = 'flat' | 'wood' | 'marble' | 'glass' | 'stone' | 'moss' | 'water';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  light: string;
  dark: string;
  frame: string;
  /** Coordinate labels on the frame. */
  coord: string;
  pattern: Pattern;
  roughness: number;
  metalness: number;
  clearcoat: number;
  /** Overlay tints. Last move and selection are deliberately different hues. */
  lastMove: string;
  selected: string;
  /** Move dots and capture rings: dark on light boards, light on dark ones. */
  marker: string;
  markerOpacity: number;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'wood',
    name: 'Wood',
    light: '#E2C290',
    dark: '#8A5A33',
    frame: '#3E2414',
    coord: '#EAD7B7',
    pattern: 'wood',
    roughness: 0.45,
    metalness: 0,
    clearcoat: 0.35,
    lastMove: '#F2D24B',
    selected: '#3FB6A8',
    marker: '#1A0F06',
    markerOpacity: 0.3,
  },
  {
    id: 'green',
    name: 'Tournament',
    light: '#E6E6C8',
    dark: '#6F8F4E',
    frame: '#2E2C28',
    coord: '#D9D6C7',
    pattern: 'flat',
    roughness: 0.65,
    metalness: 0,
    clearcoat: 0,
    lastMove: '#F2E35B',
    selected: '#3FA7D6',
    marker: '#000000',
    markerOpacity: 0.28,
  },
  {
    id: 'marble',
    name: 'Marble',
    light: '#E6E3DD',
    dark: '#5B5F63',
    frame: '#24262A',
    coord: '#D6D6D6',
    pattern: 'marble',
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.6,
    lastMove: '#E8C547',
    selected: '#4FA3E0',
    marker: '#000000',
    markerOpacity: 0.3,
  },
  {
    id: 'glass',
    name: 'Glass',
    light: '#3B4D61',
    dark: '#141E29',
    frame: '#0A1017',
    coord: '#7FD8FF',
    pattern: 'glass',
    roughness: 0.18,
    metalness: 0.35,
    clearcoat: 0.8,
    lastMove: '#E6B84A',
    selected: '#38E1FF',
    marker: '#BFF4FF',
    markerOpacity: 0.45,
  },
  {
    id: 'stone',
    name: 'Stone',
    light: '#B9AE97',
    dark: '#675F51',
    frame: '#352F27',
    coord: '#E6DBC2',
    pattern: 'stone',
    roughness: 0.9,
    metalness: 0,
    clearcoat: 0,
    lastMove: '#E9C25A',
    selected: '#7BC5A0',
    marker: '#120D06',
    markerOpacity: 0.32,
  },
  {
    id: 'forest',
    name: 'Forest',
    light: '#C2CC9C',
    dark: '#4F6B3B',
    frame: '#3A2A1C',
    coord: '#E8E2C6',
    pattern: 'moss',
    roughness: 0.85,
    metalness: 0,
    clearcoat: 0,
    lastMove: '#F2D24B',
    selected: '#E07A5F',
    marker: '#14200E',
    markerOpacity: 0.34,
  },
  {
    id: 'seabed',
    name: 'Seabed',
    light: '#DCCCA5',
    dark: '#1F5966',
    frame: '#0E2C36',
    coord: '#9FE7F0',
    pattern: 'water',
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.3,
    lastMove: '#F2D24B',
    selected: '#FF8A65',
    marker: '#04161B',
    markerOpacity: 0.4,
  },
];

/** The board each piece set looks best on, used when the board is set to Auto. */
const PAIRED: Record<PieceSet, BoardThemeId> = {
  classic: 'wood',
  scifi: 'glass',
  fantasy: 'stone',
  forest: 'forest',
  underwater: 'seabed',
};

export const resolveBoardTheme = (choice: BoardThemeChoice, pieceSet: PieceSet): BoardTheme => {
  const id = choice === 'auto' ? PAIRED[pieceSet] : choice;
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
};

export const BOARD_THEME_CHOICES: { id: BoardThemeChoice; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  ...BOARD_THEMES.map((t) => ({ id: t.id, name: t.name })),
];

// ---------------------------------------------------------------------------
// Procedural textures. Everything is drawn into canvases at runtime, so there
// are no image files to download.
// ---------------------------------------------------------------------------

/** Small deterministic PRNG so a theme always looks the same. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shade = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
};

type Ctx = CanvasRenderingContext2D;

const drawWood = (
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  base: string,
  rand: () => number,
  vertical: boolean,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, size, size);
  const lines = 26;
  for (let i = 0; i < lines; i++) {
    const offset = (i / lines) * size + rand() * 4;
    const amp = 1.5 + rand() * 3;
    const freq = 0.02 + rand() * 0.03;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = shade(base, rand() < 0.5 ? -0.06 - rand() * 0.06 : 0.03);
    ctx.globalAlpha = 0.35 + rand() * 0.35;
    ctx.lineWidth = 0.6 + rand() * 1.6;
    ctx.beginPath();
    for (let t = 0; t <= size; t += 4) {
      const wobble = Math.sin(t * freq + phase) * amp;
      const px = vertical ? x + offset + wobble : x + t;
      const py = vertical ? y + t : y + offset + wobble;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const drawMarble = (ctx: Ctx, x: number, y: number, size: number, base: string, rand: () => number) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, shade(base, 0.03));
  g.addColorStop(1, shade(base, -0.04));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  for (let v = 0; v < 3; v++) {
    let px = x + rand() * size;
    let py = y;
    ctx.strokeStyle = shade(base, rand() < 0.6 ? -0.18 : 0.15);
    ctx.globalAlpha = 0.25 + rand() * 0.3;
    ctx.lineWidth = 0.5 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    while (py < y + size) {
      px += (rand() - 0.5) * 14;
      py += 4 + rand() * 6;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const drawStone = (ctx: Ctx, x: number, y: number, size: number, base: string, rand: () => number) => {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, size, size);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = shade(base, (rand() - 0.5) * 0.18);
    ctx.globalAlpha = 0.5;
    const r = rand() * 2.4;
    ctx.fillRect(x + rand() * size, y + rand() * size, r, r);
  }
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = shade(base, -0.2);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;
};

/** Fine moss speckle, a few very soft patches, and a scatter of tiny leaves. */
const drawMoss = (ctx: Ctx, x: number, y: number, size: number, base: string, rand: () => number) => {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const cx = x + rand() * size;
    const cy = y + rand() * size;
    const r = 30 + rand() * 30;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, shade(base, (rand() - 0.5) * 0.06));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = shade(base, (rand() - 0.5) * 0.1);
    const d = 1 + rand() * 1.8;
    ctx.fillRect(x + rand() * size, y + rand() * size, d, d);
  }
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = shade(base, rand() < 0.5 ? -0.1 : 0.08);
    ctx.beginPath();
    ctx.ellipse(
      x + rand() * size,
      y + rand() * size,
      3 + rand() * 3,
      1.5 + rand() * 1.5,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

/** Light squares are rippled sand; dark squares are deep water with light caustics. */
const drawWater = (
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  base: string,
  rand: () => number,
  isDark: boolean,
  caustic: string,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, shade(base, 0.04));
  g.addColorStop(1, shade(base, -0.04));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  if (isDark) {
    // A soft net of wavy light lines, blurred with a glow, like sunlight on a seabed.
    ctx.strokeStyle = caustic;
    ctx.shadowColor = caustic;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.4;
    for (let dir = 0; dir < 2; dir++) {
      for (let i = 0; i < 4; i++) {
        const offset = (i + 0.5) * (size / 4) + (rand() - 0.5) * 10;
        const f1 = 0.05 + rand() * 0.04;
        const f2 = 0.11 + rand() * 0.05;
        const p1 = rand() * Math.PI * 2;
        const p2 = rand() * Math.PI * 2;
        ctx.globalAlpha = 0.16 + rand() * 0.1;
        ctx.beginPath();
        for (let t = -4; t <= size + 4; t += 3) {
          const wave = Math.sin(t * f1 + p1) * 7 + Math.sin(t * f2 + p2) * 3;
          const px = dir === 0 ? x + t : x + offset + wave;
          const py = dir === 0 ? y + offset + wave : y + t;
          if (t === -4) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  } else {
    for (let i = 0; i < 9; i++) {
      const oy = y + (i + 0.5) * (size / 9) + (rand() - 0.5) * 4;
      ctx.strokeStyle = shade(base, i % 2 ? -0.07 : 0.05);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t <= size; t += 4) {
        const py = oy + Math.sin((x + t) * 0.06 + i) * 2.5;
        if (t === 0) ctx.moveTo(x + t, py);
        else ctx.lineTo(x + t, py);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

const drawGlass = (ctx: Ctx, x: number, y: number, size: number, base: string, edge: string) => {
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, shade(base, 0.05));
  g.addColorStop(1, shade(base, -0.03));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  ctx.globalAlpha = 1;
};

const makeCanvas = (size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas;
};

const toTexture = (canvas: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/**
 * The 8x8 playing surface. Canvas row 0 is rank 8 and column 0 is the
 * a-file, matching a plane laid flat with its top edge away from White.
 */
export const createBoardTexture = (theme: BoardTheme): THREE.CanvasTexture => {
  const SIZE = 1024;
  const sq = SIZE / 8;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext('2d')!;
  const rand = rng(theme.id.length * 9973 + 17);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = 8 - row;
      const isDark = (col + rank - 1) % 2 === 0;
      const base = isDark ? theme.dark : theme.light;
      const x = col * sq;
      const y = row * sq;
      switch (theme.pattern) {
        case 'wood':
          drawWood(ctx, x, y, sq, base, rand, (row + col) % 2 === 0);
          break;
        case 'marble':
          drawMarble(ctx, x, y, sq, base, rand);
          break;
        case 'stone':
          drawStone(ctx, x, y, sq, base, rand);
          break;
        case 'glass':
          drawGlass(ctx, x, y, sq, base, theme.coord);
          break;
        case 'moss':
          drawMoss(ctx, x, y, sq, base, rand);
          break;
        case 'water':
          drawWater(ctx, x, y, sq, base, rand, isDark, theme.coord);
          break;
        default:
          ctx.fillStyle = base;
          ctx.fillRect(x, y, sq, sq);
      }
    }
  }
  return toTexture(canvas);
};

/**
 * The frame's top face with coordinates, drawn as the player sees it: files
 * read left to right along the near edge and ranks count away from the player.
 */
export const createFrameTexture = (
  theme: BoardTheme,
  playerColor: Color,
  frameSize: number,
): THREE.CanvasTexture => {
  const SIZE = 1024;
  const unit = SIZE / frameSize; // pixels per board unit
  const border = ((frameSize - 8) / 2) * unit;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext('2d')!;
  const rand = rng(theme.id.length * 31 + 5);

  if (theme.pattern === 'wood' || theme.pattern === 'moss') {
    drawWood(ctx, 0, 0, SIZE, theme.frame, rand, false);
  } else if (theme.pattern === 'stone') {
    drawStone(ctx, 0, 0, SIZE, theme.frame, rand);
  } else {
    ctx.fillStyle = theme.frame;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  const files = playerColor === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = playerColor === 'w' ? '87654321' : '12345678'; // top to bottom
  ctx.fillStyle = theme.coord;
  ctx.font = `600 ${Math.round(border * 0.5)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const along = border + (i + 0.5) * unit;
    ctx.globalAlpha = 0.95;
    ctx.fillText(files[i], along, SIZE - border / 2); // near edge
    ctx.fillText(ranks[i], border / 2, along); // left edge
    ctx.globalAlpha = 0.45;
    ctx.fillText(files[i], along, border / 2); // far edge
    ctx.fillText(ranks[i], SIZE - border / 2, along); // right edge
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
};

/** Soft red glow drawn under a king in check. */
export const createGlowTexture = (color: string): THREE.CanvasTexture => {
  const SIZE = 128;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return toTexture(canvas);
};
