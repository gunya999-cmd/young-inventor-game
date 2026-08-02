import { expect, test } from '@playwright/test';

test('Basketball Asset Lab renders the production 3D part on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=basketball');

  const lab = page.locator('.basketball-lab');
  const canvas = page.locator('.basketball-lab canvas');
  await expect(lab).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'basketball-v1');
  await expect(canvas).toHaveAttribute('data-seam-geometry', 'recessed-four-channel');
  await expect(canvas).toHaveAttribute('data-seam-count', '4');

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.basketball-lab canvas')!;
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      cameraDistance: Number(canvas.dataset.cameraDistance)
    };
  });

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.width).toBeGreaterThan(360);
  expect(metrics.height).toBeGreaterThan(620);
  expect(metrics.cameraDistance).toBeGreaterThan(8);
});
