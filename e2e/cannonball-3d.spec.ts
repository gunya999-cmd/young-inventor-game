import { expect, test } from '@playwright/test';

test('Cannonball Asset Lab fits the seamless CC0-based cast-iron asset on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=cannonball');

  const lab = page.locator('.cannonball-lab');
  const canvas = page.locator('.cannonball-lab canvas');
  await expect(lab).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'cannonball-v2');
  await expect(canvas).toHaveAttribute('data-surface', 'seamless-gunmetal-cast-iron');
  await expect(canvas).toHaveAttribute('data-casting-seam', '0');
  await expect(canvas).toHaveAttribute('data-source', 'kenney-tower-defense-cc0');
  await expect(canvas).toHaveAttribute('data-lighting', 'soft-studio-environment');

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.cannonball-lab canvas')!;
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
