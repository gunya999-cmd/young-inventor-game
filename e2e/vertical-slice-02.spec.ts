import { expect, test } from '@playwright/test';

test('AAA workshop stage 02 loads game-ready GLB assets and completes its physical causal chain', async ({ page }) => {
  await page.addInitScript(() => {
    let gameNow = performance.now();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const timer = window.setTimeout(() => {
        gameNow += 120;
        callback(gameNow);
      }, 16);
      return timer;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });

  await page.goto('/?stage=workshop-02');
  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v1', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-asset-pipeline', 'game-ready-glb-pbr-v1');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-stage02-rigid-body-chain-v1');

  await canvas.evaluate((element: HTMLCanvasElement & { __applyCanonicalSolution?: () => void }) => element.__applyCanonicalSolution?.());
  await expect(canvas).toHaveAttribute('data-build-ready', 'true');
  await canvas.evaluate((element: HTMLCanvasElement & { __startStage?: () => void }) => element.__startStage?.());
  await expect(canvas).toHaveAttribute('data-stage-state', /running|won/);
  await expect(canvas).toHaveAttribute('data-lever-activated', 'true', { timeout: 12_000 });
  await expect(canvas).toHaveAttribute('data-rope-pulled', 'true', { timeout: 12_000 });
  await expect(canvas).toHaveAttribute('data-weight-pressed', 'true', { timeout: 12_000 });
  await expect(canvas).toHaveAttribute('data-goal-powered', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.aaa-win')).toBeVisible();
});
