import { expect, test } from '@playwright/test';

test('outlet switch is bistable and can be triggered by a physical falling ball', async ({ page }) => {
  await page.goto('/?asset=outlet-switch');

  const canvas = page.locator('.outlet-lab canvas');
  await expect(canvas).toHaveAttribute('data-asset-version', 'outlet-switch-v2-physical-detent');
  await expect(canvas).toHaveAttribute('data-powered', 'false');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-physics', 'planck-contact+revolute-joint+torsion-detent-v2');

  // Manual interaction must be an impulse into the same physical rocker,
  // not a direct electrical boolean toggle.
  await page.getByRole('button', { name: 'Толкнуть тумблер' }).click();
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true');

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-powered', 'false');

  // The primary TIM-style interaction: gravity makes a real Planck body hit
  // the switch fixture; only the resulting angular motion can trip the detent.
  await page.getByRole('button', { name: 'Уронить шар' }).click();
  await expect(canvas).toHaveAttribute('data-ball-spawned', 'true');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on', { timeout: 6_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true');
});
