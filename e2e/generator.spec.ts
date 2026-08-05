import { expect, test } from '@playwright/test';

test('generator converts belt rotation into electrical output', async ({ page }) => {
  await page.addInitScript(() => {
    let gameNow = performance.now();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const timer = window.setTimeout(() => {
        gameNow += 50;
        callback(gameNow);
      }, 16);
      return timer;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });

  await page.goto('/?asset=generator');
  const canvas = page.locator('.generator-lab canvas');

  await expect(canvas).toHaveAttribute('data-asset-version', 'generator-v1');
  await expect(canvas).toHaveAttribute('data-generator-powered', 'false');
  await expect(canvas).toHaveAttribute('data-load-connected', 'true');
  await expect(canvas).toHaveAttribute('data-physics', 'planck-finite-torque-driver+friction-belt+generator-load-v1');

  await page.locator('[data-action="start"]').dispatchEvent('click');
  await expect(canvas).toHaveAttribute('data-drive-enabled', 'true');
  await expect(canvas).toHaveAttribute('data-generator-powered', 'true', { timeout: 5_000 });

  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-rotor-omega'))), {
    timeout: 5_000,
    message: 'fan-belt input must physically spin the generator rotor',
  }).toBeGreaterThan(3.5);

  await expect.poll(async () => Number(await canvas.getAttribute('data-output-level')), {
    timeout: 5_000,
    message: 'rotor speed must produce measurable electrical output',
  }).toBeGreaterThan(0.08);

  await page.locator('[data-action="stop"]').dispatchEvent('click');
  await expect(canvas).toHaveAttribute('data-drive-enabled', 'false');
});
