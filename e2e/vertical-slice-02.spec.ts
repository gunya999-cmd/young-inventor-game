import { expect, test } from '@playwright/test';

test('bright AAA-child workshop stage 02 completes its physical causal chain', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 720, height: 480 });
  await page.goto('/?stage=workshop-02');

  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v2', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-asset-pipeline', 'original-pbr-mesh-kit-v1');
  await expect(canvas).toHaveAttribute('data-visual-target', 'bright-child-aaa-workshop-v1');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-stage02-rigid-body-chain-v2');

  await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement & { __applyCanonicalSolution?: () => void }>('.aaa-workshop canvas');
    element?.__applyCanonicalSolution?.();
  });
  await expect(canvas).toHaveAttribute('data-build-ready', 'true');
  console.log('STAGE02_BUILD', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas')?.dataset })));

  await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement & { __startStage?: () => void }>('.aaa-workshop canvas');
    element?.__startStage?.();
  });
  await expect(canvas).toHaveAttribute('data-stage-state', /running|won/);

  await expect(canvas).toHaveAttribute('data-lever-activated', 'true', { timeout: 20_000 });
  console.log('STAGE02_LEVER', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas')?.dataset })));

  await expect(canvas).toHaveAttribute('data-rope-pulled', 'true', { timeout: 20_000 });
  console.log('STAGE02_ROPE', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas')?.dataset })));

  await expect(canvas).toHaveAttribute('data-weight-pressed', 'true', { timeout: 20_000 });
  console.log('STAGE02_WEIGHT', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas')?.dataset })));

  await expect(canvas).toHaveAttribute('data-goal-powered', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.aaa-win')).toBeVisible();
});
