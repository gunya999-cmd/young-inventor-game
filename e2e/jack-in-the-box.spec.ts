import { expect, test } from '@playwright/test';

test('classic Part 14 Jack-in-the-Box loads the original articulated Blender GLB and keeps Planck release physics', async ({ page }) => {
  // This is the heaviest single asset test: a 6 MB articulated GLB, PBR textures and a 180 Hz Planck world
  // run beside the rest of the browser suite. Give it enough total budget without weakening any physics gate.
  test.setTimeout(120_000);
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

  // The classic part is driven by continued belt/crank rotation, not one magic launch command.
  // This demo hook sends a short train of real Planck angular impulses into the same drive body.
  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __runJackDrive?: () => void };
    review.__runJackDrive?.();
  });

  // The verified mechanical latch releases after 4.0 radians of accumulated real rotation.
  await expect.poll(async () => Number(await canvas.getAttribute('data-release-count')), { timeout: 12_000 })
    .toBe(1);
  await expect.poll(async () => Number(await canvas.getAttribute('data-rotation-received')), { timeout: 12_000 })
    .toBeGreaterThan(3.95);

  // Capture the actual emerging pose rather than waiting until the spring has already decayed.
  await expect.poll(async () => Number(await canvas.getAttribute('data-jack-y')), { timeout: 10_000, intervals: [40, 60, 80, 100] })
    .toBeGreaterThan(0.50);
  await page.screenshot({ path: 'test-results/jack-in-the-box-v5-original-released.png', fullPage: false });

  // These are maxima accumulated by the same physical release. Poll them together so a busy two-worker CI
  // cannot burn three sequential 15-second windows after the mechanism has already completed its motion.
  await expect.poll(async () => {
    const rise = Number(await canvas.getAttribute('data-max-rise'));
    const lid = Number(await canvas.getAttribute('data-max-lid-angle'));
    const speed = Number(await canvas.getAttribute('data-max-jack-speed'));
    return rise > 0.42 && lid > 0.20 && speed > 0.45;
  }, { timeout: 30_000, intervals: [50, 100, 200, 400] }).toBe(true);

  expect(Number(await canvas.getAttribute('data-release-count'))).toBe(1);
});
