import { expect, test } from '@playwright/test';

test('Bowling Ball is a real Three.js object synchronized with Planck', async ({ page }) => {
  await page.goto('/?level=1&e2e=1');
  await page.waitForFunction(() => Boolean((window as any).__YOUNG_INVENTOR_E2E__));
  await expect(page.locator('#fatal-error')).toBeHidden();

  const layer = page.locator('canvas.bowling-ball-3d-layer');
  await expect(layer).toBeVisible();
  await expect(layer).toHaveAttribute('data-render-engine', 'three-webgl');
  await expect(layer).toHaveCSS('pointer-events', 'none');
  await expect(layer).toHaveAttribute('data-bowling-ball-count', '1');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bowlingBall3d)).toBe('ready');

  const start = await layer.evaluate((canvas) => ({
    x: Number((canvas as HTMLCanvasElement).dataset.ballX),
    y: Number((canvas as HTMLCanvasElement).dataset.ballY),
    angle: Number((canvas as HTMLCanvasElement).dataset.ballAngle)
  }));

  await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.loadReferenceSolution());
  await page.locator('#run-button').click();
  await expect(page.locator('#mode-label')).toHaveText('СИМУЛЯЦИЯ');

  await expect.poll(async () => Number(await layer.getAttribute('data-ball-x')), { timeout: 12_000 }).toBeGreaterThan(start.x + 150);
  await expect(page.locator('#result-card')).toHaveClass(/visible/, { timeout: 25_000 });

  const finish = await layer.evaluate((canvas) => ({
    x: Number((canvas as HTMLCanvasElement).dataset.ballX),
    y: Number((canvas as HTMLCanvasElement).dataset.ballY),
    angle: Number((canvas as HTMLCanvasElement).dataset.ballAngle)
  }));
  expect(finish.x).toBeGreaterThan(start.x);
  expect(finish.y).not.toBe(start.y);
  expect(finish.angle).not.toBe(start.angle);
});
