import { expect, test } from '@playwright/test';

test('clean reboot Level 1 loads independently and completes canonical physics benchmark', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1180, height: 760 });
  await page.goto('/');
  const canvas = page.locator('.rb-canvas');
  await expect(canvas).toHaveAttribute('data-version', 'reboot-level-01-v1', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-state', 'build');
  await expect(canvas).toHaveAttribute('data-physics', 'rapier3d-cleanroom-reboot-v1');
  await expect(canvas).toHaveAttribute('data-layout', 'original-benchmark-not-tim-level-data');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __applyCanonicalSolution?: () => void }>('.rb-canvas');
    c?.__applyCanonicalSolution?.();
  });
  await expect(canvas).toHaveAttribute('data-parts', '6');
  await expect(canvas).toHaveAttribute('data-belts', '3');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __start?: () => void }>('.rb-canvas');
    c?.__start?.();
  });
  await expect(canvas).toHaveAttribute('data-state', 'run');

  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement & { __advance?: (seconds: number) => void }>('.rb-canvas');
    c?.__advance?.(12);
  });
  await expect(canvas).toHaveAttribute('data-state', 'won');
  await expect(page.locator('.rb-win')).toBeVisible();
});
