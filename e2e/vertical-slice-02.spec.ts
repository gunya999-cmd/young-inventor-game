import { expect, test, type Page } from '@playwright/test';

async function installSparseRaf(page: Page): Promise<void> {
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

test('bright 2.75D workshop Stage 02 completes its physical causal chain', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 720, height: 480 });
  await installSparseRaf(page);

  await page.goto('/?stage=workshop-02&qa=physics');
  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v5-2_75d', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-stage-state', 'build');
  await expect(canvas).toHaveAttribute('data-gameplay-space', 'constrained-2.75d');
  await expect(canvas).toHaveAttribute('data-active-axes', 'x-y');
  await expect(canvas).toHaveAttribute('data-depth-layers', 'back-main-front');
  await expect(canvas).toHaveAttribute('data-camera-mode', 'limited-perspective');
  await expect(canvas).toHaveAttribute('data-rotation-axis', 'z');
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

test('iPad touch moves a part in XY while depth stays discrete', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await installSparseRaf(page);
  await page.goto('/?stage=workshop-02&qa=physics');

  const canvas = page.locator('.aaa-workshop canvas');
  await expect(canvas).toHaveAttribute('data-stage-version', 'workshop-stage-02-v5-2_75d', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-input-system', 'unified-pointer-events-2_75d-v2');

  const button = page.locator('.aaa-part[data-part="ramp"]');
  const buttonBox = await button.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!buttonBox || !canvasBox) throw new Error('Stage 02 touch test geometry unavailable');

  const start = { x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 };
  const drop = { x: canvasBox.x + canvasBox.width * 0.46, y: canvasBox.y + canvasBox.height * 0.62 };

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
    const canvas = document.querySelector<HTMLCanvasElement & {
      __partScreenPosition?: (type: 'ramp') => { x: number; y: number } | null;
      __partWorldPosition?: (type: 'ramp') => { x: number; y: number; z: number; layer: string } | null;
    }>('.aaa-workshop canvas');
    return { screen: canvas?.__partScreenPosition?.('ramp') ?? null, world: canvas?.__partWorldPosition?.('ramp') ?? null };
  });
  if (!before.screen || !before.world) throw new Error('Ramp position unavailable');
  expect(before.world.layer).toBe('main');
  expect(Math.abs(before.world.z)).toBeLessThan(0.001);

  const target = { x: before.screen.x + 56, y: before.screen.y - 82 };
  await page.evaluate(({ before, target }) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.aaa-workshop canvas');
    if (!canvas || !before.screen) throw new Error('Canvas missing');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: before.screen.x, clientY: before.screen.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: target.x, clientY: target.y, isPrimary: true, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 52, pointerType: 'touch', clientX: target.x, clientY: target.y, isPrimary: true, buttons: 0 }));
  }, { before, target });

  await expect(canvas).toHaveAttribute('data-last-drag-source', 'scene-touch');
  const moved = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement & { __partWorldPosition?: (type: 'ramp') => { x: number; y: number; z: number; layer: string } | null }>('.aaa-workshop canvas');
    return canvas?.__partWorldPosition?.('ramp') ?? null;
  });
  if (!moved) throw new Error('Ramp final position unavailable');
  expect(Math.abs(moved.y - before.world.y)).toBeGreaterThan(0.12);
  expect(Math.abs(moved.z)).toBeLessThan(0.001);
  expect(moved.layer).toBe('main');

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement & { __setPartLayer?: (type: 'ramp', layer: 'front') => void }>('.aaa-workshop canvas');
    canvas?.__setPartLayer?.('ramp', 'front');
  });
  const front = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement & { __partWorldPosition?: (type: 'ramp') => { x: number; y: number; z: number; layer: string } | null }>('.aaa-workshop canvas');
    return canvas?.__partWorldPosition?.('ramp') ?? null;
  });
  if (!front) throw new Error('Ramp front-layer position unavailable');
  expect(front.layer).toBe('front');
  expect(front.z).toBeCloseTo(0.52, 2);
  await expect(canvas).toHaveAttribute('data-selected-layer', 'front');
  await expect(canvas).toHaveAttribute('data-build-ready', 'false');
});
