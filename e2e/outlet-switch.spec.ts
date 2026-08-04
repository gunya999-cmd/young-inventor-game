import { expect, test } from '@playwright/test';

test('outlet switch is bistable and can be triggered by a physical falling ball', async ({ page }) => {
  await page.goto('/?asset=outlet-switch');

  const canvas = page.locator('.outlet-lab canvas');
  await expect(canvas).toHaveAttribute('data-asset-version', 'outlet-switch-v2-physical-detent');
  await expect(canvas).toHaveAttribute('data-powered', 'false');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-physics', 'planck-contact+revolute-joint+torsion-detent-v2');

  const activate = async (action: 'toggle' | 'reset' | 'drop') => {
    await page.locator(`[data-action="${action}"]`).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
  };

  // Manual interaction must inject an impulse into the same physical rocker,
  // not directly flip the electrical boolean. Trigger the DOM handler without
  // Playwright's layout-stability wait so the continuously-rendering WebGL
  // scene cannot make this functional test flaky.
  await activate('toggle');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true');

  await activate('reset');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'off');
  await expect(canvas).toHaveAttribute('data-powered', 'false');

  // Primary TIM-style interaction: gravity makes a real Planck body hit the
  // switch fixture; only resulting angular motion can trip the detent.
  await activate('drop');
  await expect(canvas).toHaveAttribute('data-ball-spawned', 'true');
  await expect(canvas).toHaveAttribute('data-switch-latched', 'on', { timeout: 6_000 });
  await expect(canvas).toHaveAttribute('data-powered', 'true');
});
