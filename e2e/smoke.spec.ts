import { expect, test, Page } from '@playwright/test';

type TestChess = {
  history: { san: string }[];
  selectedSquare: string | null;
  isPlayerTurn: boolean;
  isThinking: boolean;
  playerColor: 'w' | 'b';
  fen: string;
  pendingPromotion: unknown;
  handleSquareClick: (sq: string) => void;
};

const chess = (page: Page) => page.evaluate(() => (window as unknown as { __chess: TestChess }).__chess);

/** Clicks from, waits for the selection to render, then clicks to. Returns false if nothing was selectable. */
const move = async (page: Page, from: string, to: string) => {
  await page.evaluate(
    (sq) => (window as unknown as { __chess: TestChess }).__chess.handleSquareClick(sq),
    from,
  );
  try {
    await page.waitForFunction(
      (sq) => (window as unknown as { __chess: TestChess }).__chess.selectedSquare === sq,
      from,
      { timeout: 15_000 },
    );
  } catch {
    return false;
  }
  await page.evaluate(
    (sq) => (window as unknown as { __chess: TestChess }).__chess.handleSquareClick(sq),
    to,
  );
  return true;
};

/** Waits until it is the player's turn with exactly `plies` moves played. */
const waitForPlayerTurn = (page: Page, plies: number) =>
  page.waitForFunction(
    (n) => {
      const c = (window as unknown as { __chess: TestChess }).__chess;
      return c.isPlayerTurn && c.history.length === n;
    },
    plies,
    { timeout: 30_000 },
  );

const startNewGame = async (page: Page, side: 'White' | 'Black' | 'Random', difficulty?: string) => {
  await page.getByRole('button', { name: 'New game' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByRole('button', { name: side }).click();
  if (difficulty) await dialog.getByLabel('Difficulty').selectOption(difficulty);
  await dialog.getByRole('button', { name: 'Start game' }).click();
  await expect(dialog).toBeHidden();
};

const importGame = async (page: Page, text: string) => {
  await page.getByRole('button', { name: 'PGN / FEN' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import / export' });
  await dialog.getByLabel(/paste a FEN or PGN/).fill(text);
  await dialog.getByRole('button', { name: 'Load game' }).click();
  await expect(dialog).toBeHidden();
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as unknown as { errors: string[] }).errors = errors;
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as { __chess?: unknown }).__chess);
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test('the engine replies without blocking the page, even at the strongest level', async ({ page }) => {
  await page.locator('#difficulty').selectOption('master');
  await move(page, 'e2', 'e4');
  await page.waitForFunction(() => (window as unknown as { __chess: TestChess }).__chess.isThinking);

  // Count timer ticks while the engine thinks. The old main-thread engine
  // starved the event loop completely (zero ticks for minutes). Headless
  // Chromium renders WebGL in software, so frames themselves are slow and a
  // long-task threshold would measure the GPU emulation, not the engine.
  const ticks = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const id = setInterval(() => {
          n++;
          if (!(window as unknown as { __chess: TestChess }).__chess.isThinking) {
            clearInterval(id);
            resolve(n);
          }
        }, 50);
      }),
  );
  await waitForPlayerTurn(page, 2);
  expect(ticks).toBeGreaterThanOrEqual(3);
});

test('a new game cancels the engine’s pending move', async ({ page }) => {
  await page.locator('#difficulty').selectOption('master');
  await move(page, 'd2', 'd4');
  await page.waitForFunction(() => (window as unknown as { __chess: TestChess }).__chess.isThinking);
  await startNewGame(page, 'White');
  await page.waitForTimeout(5_000); // longer than the engine's time budget
  expect((await chess(page)).history).toHaveLength(0);
});

test('playing as black: the engine opens', async ({ page }) => {
  await startNewGame(page, 'Black', 'beginner');
  await waitForPlayerTurn(page, 1);
  expect((await chess(page)).playerColor).toBe('b');
});

test('promotion asks which piece to promote to', async ({ page }) => {
  await importGame(page, '7k/P7/8/8/8/8/8/4K3 w - - 0 1');
  await move(page, 'a7', 'a8');
  const dialog = page.getByRole('dialog', { name: 'Promote pawn to' });
  await dialog.getByRole('button', { name: 'Knight' }).click();
  await expect(dialog).toBeHidden();
  expect((await chess(page)).history[0].san).toBe('a8=N');
});

test('undo takes back the player’s move and the engine’s reply', async ({ page }) => {
  await page.locator('#difficulty').selectOption('beginner');
  await move(page, 'e2', 'e4');
  await waitForPlayerTurn(page, 2);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await waitForPlayerTurn(page, 0);
});

test('the game survives a page refresh', async ({ page }) => {
  await page.locator('#difficulty').selectOption('beginner');
  await move(page, 'e2', 'e4');
  await waitForPlayerTurn(page, 2);
  const before = (await chess(page)).history.map((m) => m.san);
  await page.reload();
  await page.waitForFunction(() => !!(window as { __chess?: unknown }).__chess);
  expect((await chess(page)).history.map((m) => m.san)).toEqual(before);
  await expect(page.locator('#difficulty')).toHaveValue('beginner');
});

test('checkmate shows a result card that can be dismissed to view the board', async ({ page }) => {
  await importGame(page, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  await move(page, 'a1', 'a8');
  const card = page.getByRole('dialog', { name: 'You win' });
  await expect(card).toContainText('White wins by checkmate');
  await card.getByRole('button', { name: 'View board' }).click();
  await expect(card).toBeHidden();
  await expect(page.getByText('White wins by checkmate').first()).toBeVisible();
});

test('a share link opens that position with you to move', async ({ page }) => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1';
  // A hash-only goto is same-document navigation, so leave the app first to force a fresh load.
  await page.goto('about:blank');
  await page.goto(`/#fen=${encodeURIComponent(fen)}`);
  await page.waitForFunction(() => !!(window as { __chess?: unknown }).__chess);
  const c = await chess(page);
  expect(c.fen).toBe(fen);
  expect(c.playerColor).toBe('b');
  expect(new URL(page.url()).hash).toBe('');
});

test('loads without any third-party requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') external.push(r.url());
  });
  await page.reload();
  await page.waitForFunction(() => !!(window as { __chess?: unknown }).__chess);
  await expect(page.getByText('Setting up the board…')).toBeHidden({ timeout: 15_000 });
  expect(external).toEqual([]);
});

test('the board theme can be changed and is remembered', async ({ page }) => {
  await expect(page.locator('#board-theme option[value="auto"]')).toHaveText('Auto (Wood)');
  await page.locator('#board-theme').selectOption('marble');
  await page.reload();
  await page.waitForFunction(() => !!(window as { __chess?: unknown }).__chess);
  await expect(page.locator('#board-theme')).toHaveValue('marble');
});

test('a lost graphics context shows a notice and recovers', async ({ page }) => {
  await expect(page.getByText('Setting up the board…')).toBeHidden({ timeout: 15_000 });
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    ext.loseContext();
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Graphics paused' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
  await expect(page.getByText('Graphics paused')).toBeHidden();
  // The loss is reported as an error on purpose; don't fail the run for it.
  (page as unknown as { errors: string[] }).errors.length = 0;
});

test('analysis shows an evaluation and the best move', async ({ page }) => {
  await importGame(page, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  await page.getByLabel('Show eval & best move').check();
  await expect(page.getByText('Eval M1 · White’s view'.replace('’', "'"))).toBeVisible({ timeout: 15_000 });
  const best = await page.evaluate(
    () => (window as unknown as { __chess: { analysis: { bestMove: unknown } } }).__chess.analysis.bestMove,
  );
  expect(best).toEqual({ from: 'a1', to: 'a8' });
});

test('every piece set loads, with its paired board on Auto', async ({ page }) => {
  const pairs: [string, string][] = [
    ['classic', 'Wood'],
    ['scifi', 'Glass'],
    ['fantasy', 'Stone'],
    ['forest', 'Forest'],
    ['underwater', 'Seabed'],
  ];
  for (const [set, board] of pairs) {
    await page.locator('#piece-set').selectOption(set);
    await expect(page.locator('#board-theme option[value="auto"]')).toHaveText(`Auto (${board})`);
    // Give the lazily loaded set time to arrive and render.
    await page.waitForTimeout(400);
  }
  // A move still works on the last set.
  await page.locator('#difficulty').selectOption('beginner');
  await move(page, 'e2', 'e4');
  await waitForPlayerTurn(page, 2);
});
