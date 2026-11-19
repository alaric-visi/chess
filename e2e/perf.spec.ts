import { expect, test } from '@playwright/test';

interface SceneStats {
  idleFrames: number;
  triangles: number;
  meshes: number;
  materials: number;
  geometries: number;
}

/** Budgets for the starting position (Classic set). Raise them deliberately, not by accident. */
test('the scene stays within its rendering budget and is idle when nothing moves', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!(window as { __three?: unknown }).__three, null, { timeout: 30_000 });
  await expect(page.getByText('Setting up the board…')).toBeHidden({ timeout: 15_000 });
  await page.waitForTimeout(1000); // let the opening animations settle

  const stats = await page.evaluate(async (): Promise<SceneStats> => {
    // Dev-only handle set by DevSceneHandle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { gl, scene, invalidate } = (window as any).__three;
    const start = gl.info.render.frame;
    await new Promise((r) => setTimeout(r, 2000));
    const idleFrames = gl.info.render.frame - start;

    // Render one frame on purpose to read per-frame counts.
    invalidate();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const materials = new Set<string>();
    const geometries = new Set<string>();
    let meshes = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.traverse((o: any) => {
      if (!o.isMesh) return;
      meshes++;
      geometries.add(o.geometry.uuid);
      [].concat(o.material).forEach((m: { uuid: string }) => materials.add(m.uuid));
    });
    return {
      idleFrames,
      triangles: gl.info.render.triangles,
      meshes,
      materials: materials.size,
      geometries: geometries.size,
    };
  });

  console.log('scene stats', stats);
  expect(stats.idleFrames, 'frames rendered while idle').toBe(0);
  expect(stats.triangles, 'triangles per frame incl. shadow pass').toBeLessThan(600_000);
  expect(stats.materials, 'distinct materials').toBeLessThanOrEqual(20);
  expect(stats.geometries, 'distinct geometries').toBeLessThanOrEqual(40);
});
