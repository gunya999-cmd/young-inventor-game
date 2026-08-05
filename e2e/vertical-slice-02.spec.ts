import { expect, test } from '@playwright/test';

test('bright AAA-child workshop stage 02 completes its physical causal chain', async ({ page }) => {
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
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v2', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-asset-pipeline', 'original-pbr-mesh-kit-v1');
  await expect(canvas).toHaveAttribute('data-visual-target', 'bright-child-aaa-workshop-v1');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-stage02-rigid-body-chain-v2');

  await canvas.evaluate((element: HTMLCanvasElement & { __applyCanonicalSolution?: () => void }) => element.__applyCanonicalSolution?.());
  await expect(canvas).toHaveAttribute('data-build-ready', 'true');
  console.log('STAGE02_BUILD', await canvas.evaluate((element) => ({ ...element.dataset })));

  await canvas.evaluate((element: HTMLCanvasElement & { __startStage?: () => void }) => element.__startStage?.());
  await expect(canvas).toHaveAttribute('data-stage-state', /running|won/);

  await expect(canvas).toHaveAttribute('data-lever-activated', 'true', { timeout: 12_000 });
  console.log('STAGE02_LEVER', await canvas.evaluate((element) => ({ ...element.dataset })));

  await expect(canvas).toHaveAttribute('data-rope-pulled', 'true', { timeout: 12_000 });
  console.log('STAGE02_ROPE', await canvas.evaluate((element) => ({ ...element.dataset })));

  await expect(canvas).toHaveAttribute('data-weight-pressed', 'true', { timeout: 12_000 });
  console.log('STAGE02_WEIGHT', await canvas.evaluate((element) => ({ ...element.dataset })));

  await expect(canvas).toHaveAttribute('data-goal-powered', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.aaa-win')).toBeVisible();
});
