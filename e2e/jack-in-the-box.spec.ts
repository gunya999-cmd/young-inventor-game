import { expect, test } from '@playwright/test';

test('classic Part 14 Jack-in-the-Box uses imported GLB plus real Planck release physics', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=jack-in-the-box');

  const canvas = page.locator('.jack-in-the-box-lab canvas');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'jack-in-the-box-v3-glb-realistic');
  await expect(canvas).toHaveAttribute('data-source-license', 'CC-BY-reference');
  await expect(canvas).toHaveAttribute('data-source-key', 'local-jitb-v3-glb-evan-cg-reference');
  await expect(canvas).toHaveAttribute('data-render-source', 'glb');
  await expect(canvas).toHaveAttribute('data-motion', 'rotation-threshold-latch-spring-contact');
  await expect(canvas).toHaveAttribute('data-motion-state', 'latched');
  await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');

  await expect.poll(async () => await canvas.getAttribute('data-render-loaded'), { timeout: 10_000 }).toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-triangles')), { timeout: 10_000 })
    .toBeGreaterThan(30_000);
  await expect(canvas).toHaveAttribute('data-render-error', '');

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __kickJackDrive?: () => void };
    review.__kickJackDrive?.();
  });

  await expect.poll(async () => Number(await canvas.getAttribute('data-rotation-received')), { timeout: 4500 })
    .toBeGreaterThan(4.20);
  await expect.poll(async () => Number(await canvas.getAttribute('data-release-count')), { timeout: 4500 })
    .toBe(1);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-rise')), { timeout: 5500 })
    .toBeGreaterThan(0.42);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-lid-angle')), { timeout: 5500 })
    .toBeGreaterThan(0.20);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-jack-speed')), { timeout: 5500 })
    .toBeGreaterThan(0.45);

  expect(Number(await canvas.getAttribute('data-release-count'))).toBe(1);
});
