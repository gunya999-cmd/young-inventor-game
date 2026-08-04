import { expect, test } from '@playwright/test';

test('Classic Part 15 Windmill converts airflow into finite reversible Planck rotation', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=windmill');

  const canvas = page.locator('.windmill-lab canvas');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'windmill-v1-original-blender');
  await expect(canvas).toHaveAttribute('data-source-license', 'PROJECT-ORIGINAL');
  await expect(canvas).toHaveAttribute('data-source-key', 'original-blender-windmill-v1');
  await expect(canvas).toHaveAttribute('data-render-source', 'original-blender-glb');
  await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
  await expect(canvas).toHaveAttribute('data-motion', 'airflow-to-finite-shaft-torque');
  await expect(canvas).toHaveAttribute('data-orbit-mode', 'free-xy');

  await expect.poll(async () => await canvas.getAttribute('data-render-loaded'), { timeout: 30_000 }).toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-triangles')), { timeout: 30_000 })
    .toBeGreaterThan(12_000);
  await expect(canvas).toHaveAttribute('data-render-model-type', 'original-articulated-blender-glb');
  await expect(canvas).toHaveAttribute('data-render-error', '');

  // Review interaction must remain a true free X/Y orbit. This guards against the
  // earlier workaround that prevented floor intersections by disabling vertical drag.
  const beforeX = Number(await canvas.getAttribute('data-review-rotation-x'));
  const beforeY = Number(await canvas.getAttribute('data-review-rotation-y'));
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Windmill canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.50, box.y + box.height * 0.52);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.35, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-review-rotation-x')) - beforeX), { timeout: 3_000 })
    .toBeGreaterThan(0.05);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-review-rotation-y')) - beforeY), { timeout: 3_000 })
    .toBeGreaterThan(0.05);

  await page.screenshot({ path: 'test-results/windmill-v1-ready.png', fullPage: false });

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __setWind?: (strength: number) => void };
    review.__setWind?.(1.2);
  });

  // Airflow acts through finite torque; angular speed must build rather than teleport.
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-torque')), { timeout: 8_000 })
    .toBeGreaterThan(0.6);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-omega')), { timeout: 12_000 })
    .toBeGreaterThan(0.85);
  await expect.poll(async () => Number(await canvas.getAttribute('data-rotor-omega')), { timeout: 12_000 })
    .toBeGreaterThan(0.55);
  await page.screenshot({ path: 'test-results/windmill-v1-forward.png', fullPage: false });

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __setWind?: (strength: number) => void };
    review.__setWind?.(-1.2);
  });

  // Reversing the air must first brake the same inertial rotor, then reverse it.
  await expect.poll(async () => Number(await canvas.getAttribute('data-min-omega')), { timeout: 20_000 })
    .toBeLessThan(-0.45);
  await expect.poll(async () => Number(await canvas.getAttribute('data-rotor-omega')), { timeout: 20_000 })
    .toBeLessThan(-0.30);
  await expect(canvas).toHaveAttribute('data-motion-state', 'reversing');
  await page.screenshot({ path: 'test-results/windmill-v1-reversed.png', fullPage: false });
});
