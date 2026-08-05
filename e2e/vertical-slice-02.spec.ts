import { expect, test } from '@playwright/test';

test('bright AAA-child workshop stage 02 completes its physical causal chain', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 720, height: 480 });

  // QA mode advances the shared Rapier model explicitly, so frequent WebGL
  // frames add no coverage and can starve headless Chromium. Keep a sparse
  // render heartbeat without changing a single physics step.
  await page.addInitScript(() => {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    let firstFrames = 2;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (firstFrames > 0) {
        firstFrames -= 1;
        return nativeRaf(callback);
      }
      return window.setTimeout(() => callback(performance.now()), 750);
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });

  await page.goto('/?stage=workshop-02&qa=physics');
  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v3', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-asset-pipeline', 'original-pbr-mesh-kit-v1');
  await expect(canvas).toHaveAttribute('data-visual-target', 'bright-child-aaa-workshop-v1');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-shared-stage02-physics-v1');
  await expect(canvas).toHaveAttribute('data-qa-mode', 'physics');

  await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement & { __applyCanonicalSolution?: () => void }>('.aaa-workshop canvas');
    element?.__applyCanonicalSolution?.();
  });
  await expect(canvas).toHaveAttribute('data-build-ready', 'true');

  await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement & { __startStage?: () => void }>('.aaa-workshop canvas');
    element?.__startStage?.();
  });
  await expect(canvas).toHaveAttribute('data-stage-state', 'running');

  await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement & { __advanceSimulation?: (seconds: number) => void }>('.aaa-workshop canvas');
    element?.__advanceSimulation?.(12);
  });

  console.log('STAGE02_FINAL', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas')?.dataset })));
  await expect(canvas).toHaveAttribute('data-lever-activated', 'true');
  await expect(canvas).toHaveAttribute('data-rope-pulled', 'true');
  await expect(canvas).toHaveAttribute('data-weight-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-goal-powered', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.aaa-win')).toBeVisible();
});
