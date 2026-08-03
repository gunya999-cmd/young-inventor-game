import { expect, test } from '@playwright/test';

test('classic Part 14 Jack-in-the-Box loads the original articulated Blender GLB and keeps Planck release physics', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=jack-in-the-box');

  const canvas = page.locator('.jack-in-the-box-lab canvas');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'jack-in-the-box-v5-original-blender');
  await expect(canvas).toHaveAttribute('data-source-license', 'PROJECT-ORIGINAL');
  await expect(canvas).toHaveAttribute('data-source-key', 'original-blender-jitb-option-a');
  await expect(canvas).toHaveAttribute('data-render-source', 'original-blender-glb');
  await expect(canvas).toHaveAttribute('data-motion', 'rotation-threshold-latch-spring-contact');
  await expect(canvas).toHaveAttribute('data-motion-state', 'latched');
  await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');

  await expect.poll(async () => await canvas.getAttribute('data-render-loaded'), { timeout: 30_000 }).toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-triangles')), { timeout: 30_000 })
    .toBeGreaterThan(45_000);
  await expect(canvas).toHaveAttribute('data-render-model-type', 'original-articulated-blender-glb');
  await expect(canvas).toHaveAttribute('data-render-error', '');
  await page.screenshot({ path: 'test-results/jack-in-the-box-v5-original-ready.png', fullPage: false });

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __kickJackDrive?: () => void };
    review.__kickJackDrive?.();
  });

  await expect.poll(async () => Number(await canvas.getAttribute('data-rotation-received')), { timeout: 12_000 })
    .toBeGreaterThan(4.20);
  await expect.poll(async () => Number(await canvas.getAttribute('data-release-count')), { timeout: 12_000 })
    .toBe(1);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-rise')), { timeout: 15_000 })
    .toBeGreaterThan(0.42);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-lid-angle')), { timeout: 15_000 })
    .toBeGreaterThan(0.20);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-jack-speed')), { timeout: 15_000 })
    .toBeGreaterThan(0.45);
  await page.screenshot({ path: 'test-results/jack-in-the-box-v5-original-released.png', fullPage: false });

  expect(Number(await canvas.getAttribute('data-release-count'))).toBe(1);
});
