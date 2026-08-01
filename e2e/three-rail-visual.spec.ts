import { expect, test } from '@playwright/test';

test('Level 01 renders rails through the Three.js WebGL layer while Canvas keeps interaction', async ({ page }) => {
  await page.goto('/?level=1&e2e=1');
  await page.waitForFunction(() => Boolean((window as any).__YOUNG_INVENTOR_E2E__));
  await expect(page.locator('#fatal-error')).toBeHidden();

  const webgl = page.locator('canvas.three-rail-layer');
  await expect(webgl).toBeVisible();
  await expect(webgl).toHaveAttribute('data-render-engine', 'three-webgl');
  await expect(webgl).toHaveCSS('pointer-events', 'none');
  await expect(webgl).toHaveAttribute('data-rail-count', '2');

  await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.loadReferenceSolution());
  await expect(webgl).toHaveAttribute('data-rail-count', '5');

  const layers = await page.evaluate(() => ({
    webgl: document.querySelectorAll('canvas.three-rail-layer').length,
    interactionCanvas: document.querySelectorAll('#game-canvas').length,
    webglZ: getComputedStyle(document.querySelector('canvas.three-rail-layer')!).zIndex,
    interactionZ: getComputedStyle(document.querySelector('#game-canvas')!).zIndex
  }));
  expect(layers.webgl).toBe(1);
  expect(layers.interactionCanvas).toBe(1);
  expect(Number(layers.webglZ)).toBeGreaterThan(Number(layers.interactionZ));
});
