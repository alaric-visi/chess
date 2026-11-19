import { describe, expect, it } from 'vitest';
import { BOARD_THEMES, resolveBoardTheme } from './boardThemes';

describe('resolveBoardTheme', () => {
  it('pairs each piece set with its own board on Auto', () => {
    expect(resolveBoardTheme('auto', 'classic').id).toBe('wood');
    expect(resolveBoardTheme('auto', 'scifi').id).toBe('glass');
    expect(resolveBoardTheme('auto', 'fantasy').id).toBe('stone');
    expect(resolveBoardTheme('auto', 'forest').id).toBe('forest');
    expect(resolveBoardTheme('auto', 'underwater').id).toBe('seabed');
  });

  it('uses an explicit choice regardless of piece set', () => {
    expect(resolveBoardTheme('marble', 'scifi').id).toBe('marble');
  });

  it('gives every theme distinct last-move and selection tints', () => {
    for (const t of BOARD_THEMES) expect(t.lastMove).not.toBe(t.selected);
  });
});
