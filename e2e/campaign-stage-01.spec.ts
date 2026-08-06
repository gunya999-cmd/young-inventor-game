import { expect, test } from '@playwright/test';

async function sparseRaf(page: any): Promise<void> {
  await page.addInitScript(() => {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    let firstFrames = 3;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (firstFrames > 0) {
        firstFrames -= 1;
        return nativeRaf(callback);
      }
      return window.setTimeout(() => callback(performance.now()), 700);
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });
}

test('campaign stage 01 reference construction wins only through Rapier goal contact', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await sparseRaf(page);
  await page.goto('/?stage=campaign-01&qa=physics');

  const canvas = page.locator('.campaign-stage01 canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'campaign-stage-01-v1-free-build-275d', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-free-build-stage01-v1');
  await expect(canvas).toHaveAttribute('data-editor', 'free-xy-275d-pointer-v1');
  await expect(canvas).toHaveAttribute('data-cleanroom', 'true');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __applyCanonicalSolution?: () => void }>('.campaign-stage01 canvas');
    c?.__applyCanonicalSolution?.();
  });
  await expect(canvas).toHaveAttribute('data-part-count', '3');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __startStage?: () => void }>('.campaign-stage01 canvas');
    c?.__startStage?.();
  });
  await expect(canvas).toHaveAttribute('data-stage-state', 'running');
  await expect(canvas).toHaveAttribute('data-goal-contact', 'false');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __advanceSimulation?: (seconds: number) => void }>('.campaign-stage01 canvas');
    c?.__advanceSimulation?.(12);
  });

  console.log('CAMPAIGN_STAGE01_FINAL', await page.evaluate(() => ({ ...document.querySelector<HTMLCanvasElement>('.campaign-stage01 canvas')?.dataset })));
  await expect(canvas).toHaveAttribute('data-goal-contact', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.campaign-stage01 .aaa-win')).toBeVisible();
});

test('iPad-style pointer creates a freely placed part without requiring a solution snap', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await sparseRaf(page);
  await page.goto('/?stage=campaign-01&qa=physics');

  const canvas = page.locator('.campaign-stage01 canvas');
  await expect(canvas).toHaveAttribute('data-stage-state', 'build', { timeout: 15_000 });
  const ramp = page.locator('.campaign-stage01 .aaa-part[data-part="ramp"]');
  const rampBox = await ramp.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!rampBox || !canvasBox) throw new Error('Stage 01 pointer geometry unavailable');

  const start = { x: rampBox.x + rampBox.width / 2, y: rampBox.y + rampBox.height / 2 };
  const drop = { x: canvasBox.x + canvasBox.width * 0.44, y: canvasBox.y + canvasBox.height * 0.46 };

  await page.evaluate(({ start, drop }) => {
    const button = document.querySelector<HTMLButtonElement>('.campaign-stage01 .aaa-part[data-part="ramp"]');
    if (!button) throw new Error('Ramp button missing');
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: start.x, clientY: start.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: drop.x, clientY: drop.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: drop.x, clientY: drop.y, isPrimary: true, buttons: 0 }));
  }, { start, drop });

  await expect(canvas).toHaveAttribute('data-part-count', '1');
  await expect(page.locator('[data-count="ramp"]')).toHaveText('1');
  await expect(page.locator('.campaign-stage01 [data-action="run"]').first()).toBeEnabled();
});
