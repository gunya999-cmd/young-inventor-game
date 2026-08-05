import { expect, test } from '@playwright/test';

test('outlet switch reliably powers on when the falling ball reaches the rocker', async ({ page }) => {
  await page.goto('/?asset=outlet-switch');

  const canvas = page.locator('.outlet-lab canvas');
  await expect(canvas).toHaveAttribute('data-asset-version', 'outlet-switch-v5-responsive');
  await expect(canvas).toHaveAttribute('data-powered', 'false');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-physics', 'planck-falling-ball+reliable-impact-zone+motor-latched-switch-v5');

  await page.locator('[data-action="drop"]').dispatchEvent('click');
  await expect(canvas).toHaveAttribute('data-ball-spawned', 'true', { timeout: 2_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true', { timeout: 7_000 });
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on');

  await expect.poll(async () => Number(await canvas.getAttribute('data-switch-angle')), {
    timeout: 5_000,
    message: 'rocker must physically travel into the ON position',
  }).toBeGreaterThan(0.15);
});
