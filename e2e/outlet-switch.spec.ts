import { expect, test } from '@playwright/test';

test('outlet switch is triggered by a physical falling ball', async ({ page }) => {
  await page.goto('/?asset=outlet-switch');

  const canvas = page.locator('.outlet-lab canvas');
  await expect(canvas).toHaveAttribute('data-asset-version', 'outlet-switch-v2-physical-detent');
  await expect(canvas).toHaveAttribute('data-powered', 'false');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-physics', 'planck-contact+revolute-joint+torsion-detent-v2');

  // Test only the production TIM-style interaction. The ball is a dynamic
  // Planck body; no test-only electrical toggle is allowed.
  const drop = page.locator('[data-action="drop"]');
  await drop.dispatchEvent('click');
  await expect(canvas).toHaveAttribute('data-ball-spawned', 'true', { timeout: 2_000 });
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on', { timeout: 7_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true');

  const angle = Number(await canvas.getAttribute('data-switch-angle'));
  expect(Number.isFinite(angle)).toBeTruthy();
  expect(angle).toBeGreaterThan(0.15);
});
