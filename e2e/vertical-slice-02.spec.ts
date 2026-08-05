import { expect, test } from '@playwright/test';

test('bright AAA-child workshop stage 02 completes its physical causal chain', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 720, height: 480 });
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

  // Deterministically advance the exact Rapier model used by the real-time
  // runtime. This bypasses headless WebGL frame throttling, not game physics.
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
