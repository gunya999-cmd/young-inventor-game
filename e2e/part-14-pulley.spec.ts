import { expect, test } from '@playwright/test';

test('Part 14 pulley uses Planck motion', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=pulley');

  const canvas = page.locator('.pulley-lab canvas');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'pulley-v1');
  await expect(canvas).toHaveAttribute('data-source-license', 'CC-BY');
  await expect(canvas).toHaveAttribute('data-source-key', 'sketchfab-fuglee-pulley-cc-by');
  await expect(canvas).toHaveAttribute('data-motion', 'planck-pulley-joint-clutch');
  await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
  await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __startPulleyDemo?: () => void };
    review.__startPulleyDemo?.();
  });

  await expect.poll(async () => Number(await canvas.getAttribute('data-max-travel')), { timeout: 6500 })
    .toBeGreaterThan(0.24);
  await expect.poll(async () => await canvas.getAttribute('data-opposed-motion'), { timeout: 6500 })
    .toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-wheel-omega')), { timeout: 6500 })
    .toBeGreaterThan(0.35);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-slip')), { timeout: 6500 })
    .toBeGreaterThan(0.08);
  await expect.poll(async () => Number(await canvas.getAttribute('data-rope-error')), { timeout: 6500 })
    .toBeLessThan(0.025);
});
