import { expect, test } from '@playwright/test';

async function installSparseRaf(page: Parameters<typeof test>[0] extends never ? never : any): Promise<void> {
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
}

test('bright AAA-child workshop stage 02 completes its physical causal chain', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 720, height: 480 });
  await installSparseRaf(page);

  await page.goto('/?stage=workshop-02&qa=physics');
  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v4-ipad-pointer', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-asset-pipeline', 'original-pbr-mesh-kit-v1');
  await expect(canvas).toHaveAttribute('data-visual-target', 'bright-child-aaa-workshop-v1');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-0.19.3-shared-stage02-physics-v1');
  await expect(canvas).toHaveAttribute('data-input-system', 'unified-pointer-events-v1');
  await expect(canvas).toHaveAttribute('data-touch-ready', 'true');

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

  await expect(canvas).toHaveAttribute('data-lever-activated', 'true');
  await expect(canvas).toHaveAttribute('data-rope-pulled', 'true');
  await expect(canvas).toHaveAttribute('data-weight-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-goal-powered', 'true');
  await expect(canvas).toHaveAttribute('data-stage-state', 'won');
  await expect(page.locator('.aaa-win')).toBeVisible();
});

test('iPad-style touch can drag a part from inventory and move it again on the 3D scene', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await installSparseRaf(page);
  await page.goto('/?stage=workshop-02&qa=physics');

  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v4-ipad-pointer', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-touch-ready', 'true');
  const button = page.locator('.aaa-part[data-part="ramp"]');
  const buttonBox = await button.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!buttonBox || !canvasBox) throw new Error('Stage 02 touch test geometry unavailable');

  const start = { x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 };
  const drop = { x: canvasBox.x + canvasBox.width * 0.52, y: canvasBox.y + canvasBox.height * 0.58 };

  await page.evaluate(({ start, drop }) => {
    const button = document.querySelector<HTMLButtonElement>('.aaa-part[data-part="ramp"]');
    if (!button) throw new Error('Ramp button missing');
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 51, pointerType: 'touch', clientX: start.x, clientY: start.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 51, pointerType: 'touch', clientX: drop.x, clientY: drop.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 51, pointerType: 'touch', clientX: drop.x, clientY: drop.y, isPrimary: true, buttons: 0 }));
  }, { start, drop });

  await expect(canvas).toHaveAttribute('data-placeable-count', '1');
  await expect(canvas).toHaveAttribute('data-last-drag-source', 'inventory-touch');

  const before = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement & { __partScreenPosition?: (type: 'ramp') => { x: number; y: number } | null }>('.aaa-workshop canvas');
    return canvas?.__partScreenPosition?.('ramp') ?? null;
  });
  if (!before) throw new Error('Ramp screen position unavailable');
  const afterTarget = { x: before.x + 72, y: before.y + 24 };

  await page.evaluate(({ before, afterTarget }) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas');
    if (!canvas) throw new Error('Canvas missing');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: before.x, clientY: before.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: afterTarget.x, clientY: afterTarget.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: afterTarget.x, clientY: afterTarget.y, isPrimary: true, buttons: 0 }));
  }, { before, afterTarget });

  await expect(canvas).toHaveAttribute('data-last-drag-source', 'scene-touch');
  const after = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement & { __partScreenPosition?: (type: 'ramp') => { x: number; y: number } | null }>('.aaa-workshop canvas');
    return canvas?.__partScreenPosition?.('ramp') ?? null;
  });
  if (!after) throw new Error('Ramp final screen position unavailable');
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(8);
});
