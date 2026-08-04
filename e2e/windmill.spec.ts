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

  await expect.poll(async () => await canvas.getAttribute('data-render-loaded'), { timeout: 30_000 }).toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-triangles')), { timeout: 30_000 })
    .toBeGreaterThan(12_000);
  await expect(canvas).toHaveAttribute('data-render-model-type', 'original-articulated-blender-glb');
  await expect(canvas).toHaveAttribute('data-render-error', '');

  // Geometry contract: the rendered mechanism must rest on the support plane,
  // never penetrate it. This guards the exact visual failure caught in review.
  await expect(canvas).toHaveAttribute('data-ground-intersection', 'false');
  await expect.poll(async () => Number(await canvas.getAttribute('data-ground-clearance')), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(0.008);
  await expect.poll(async () => Number(await canvas.getAttribute('data-ground-clearance')), { timeout: 5_000 })
    .toBeLessThan(0.03);
  await expect.poll(async () => {
    const bottom = Number(await canvas.getAttribute('data-model-bottom-y'));
    const ground = Number(await canvas.getAttribute('data-ground-y'));
    return bottom - ground;
  }, { timeout: 5_000 }).toBeGreaterThan(0);

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
