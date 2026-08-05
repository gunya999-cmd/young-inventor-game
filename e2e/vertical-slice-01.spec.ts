import { expect, test } from '@playwright/test';

test('full 3D vertical slice completes through the physical Rube Goldberg chain', async ({ page }) => {
  await page.addInitScript(() => {
    let gameNow = performance.now();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const timer = window.setTimeout(() => {
        gameNow += 1000 / 30;
        callback(gameNow);
      }, 16);
      return timer;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });

  await page.goto('/?stage=vertical-slice-01');
  const canvas = page.locator('.vs-stage canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'vertical-slice-01-v1', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-rigid-body-collisions-v1');

  await canvas.evaluate((element: HTMLCanvasElement & { __applyCanonicalSolution?: () => void }) => element.__applyCanonicalSolution?.());
  await expect(canvas).toHaveAttribute('data-build-ready', 'true');
  await expect(canvas).toHaveAttribute('data-ramps-placed', '2');

  await canvas.evaluate((element: HTMLCanvasElement & { __startStage?: () => void }) => element.__startStage?.());
  await expect(canvas).toHaveAttribute('data-stage-state', /running|chain|won/);

  await expect(canvas).toHaveAttribute('data-switch-triggered', 'true', { timeout: 10_000 });
  await expect(canvas).toHaveAttribute('data-domino-started', 'true', { timeout: 10_000 });
  await expect(canvas).toHaveAttribute('data-bell-rung', 'true', { timeout: 12_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.vs-win')).toBeVisible();
});
