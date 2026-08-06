import { expect, test } from '@playwright/test';

test('Part 15 electric motor slows under finite physical load', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?asset=motor');

  const canvas = page.locator('.motor-lab canvas');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-asset-version', 'motor-v1');
  await expect(canvas).toHaveAttribute('data-source-license', 'CC-BY');
  await expect(canvas).toHaveAttribute('data-source-key', 'sketchfab-joh-mackell-simple-dc-motor-cc-by');
  await expect(canvas).toHaveAttribute('data-motion', 'finite-torque-revolute-motor-load-clutch');
  await expect(canvas).toHaveAttribute('data-motion-state', 'off');
  await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __startMotorDemo?: () => void };
    review.__startMotorDemo?.();
  });

  await expect(canvas).toHaveAttribute('data-motion-state', 'spinning');
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-free-omega')), { timeout: 5000 })
    .toBeGreaterThan(9.0);

  await canvas.evaluate((element) => {
    const review = element as HTMLCanvasElement & { __engageMotorLoad?: () => void };
    review.__engageMotorLoad?.();
  });

  await expect(canvas).toHaveAttribute('data-motion-state', 'loaded');
  await expect(canvas).toHaveAttribute('data-load-engaged', 'true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-load-omega')), { timeout: 6500 })
    .toBeGreaterThan(2.0);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-clutch-slip')), { timeout: 6500 })
    .toBeGreaterThan(0.40);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-speed-drop-ratio')), { timeout: 6500 })
    .toBeGreaterThan(0.10);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-load-resistance-torque'))), { timeout: 6500 })
    .toBeGreaterThan(0.35);
  await expect.poll(async () => Number(await canvas.getAttribute('data-max-motor-torque-seen')), { timeout: 6500 })
    .toBeGreaterThan(3.0);
  expect(Number(await canvas.getAttribute('data-max-motor-torque-seen'))).toBeLessThanOrEqual(4.45);
});
