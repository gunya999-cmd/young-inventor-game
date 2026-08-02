import { expect, test } from '@playwright/test';

const assets = [
  ['boxing-glove', 'boxing-glove-v6', 'CC-BY', 'sketchfab-incg5764-boxing-glove-cc-by'],
  ['trampoline', 'trampoline-v2', 'CC-BY', 'sketchfab-simon-laisne-trampoline-cc-by'],
  ['fan-belt', 'fan-belt-v2', 'CC-BY', 'sketchfab-v-belt-c-type-cc-by'],
  ['gear', 'gear-v2', 'CC0', 'sketchfab-plaggy-cc0-gear'],
  ['conveyor-belt', 'conveyor-belt-v2', 'CC-BY', 'sketchfab-jason-kan-conveyor-cc-by']
] as const;

for (const [asset, version, license, sourceKey] of assets) {
  test(`${asset} premium 3D lab fits on a phone viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?asset=${asset}`);

    const lab = page.locator(`.${asset}-lab`);
    const canvas = lab.locator('canvas');
    await expect(page.locator('#fatal-error')).toBeHidden();
    await expect(lab).toBeVisible();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-asset-version', version);
    await expect(canvas).toHaveAttribute('data-source-license', license);
    await expect(canvas).toHaveAttribute('data-source-key', sourceKey);
    await expect(canvas).toHaveAttribute('data-studio-lighting', 'pmrem-soft');

    const metrics = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        cameraDistance: Number((element as HTMLCanvasElement).dataset.cameraDistance),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.width).toBeGreaterThan(360);
    expect(metrics.height).toBeGreaterThan(620);
    expect(metrics.cameraDistance).toBeGreaterThan(8);

    if (asset === 'boxing-glove') {
      await expect(canvas).toHaveAttribute('data-motion', 'impulse-spring-gravity');
      await expect(canvas).toHaveAttribute('data-motion-state', 'armed');

      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __pressBoxingGlove?: () => void };
        review.__pressBoxingGlove?.();
      });

      // Strong launch impulse: the spring should extend quickly instead of
      // following a scripted forward/back animation.
      await expect.poll(async () => Number(await canvas.getAttribute('data-extension')), { timeout: 1800 })
        .toBeGreaterThan(0.38);
      await expect(canvas).toHaveAttribute('data-motion-state', 'free');
      await page.screenshot({ path: 'test-results/boxing-glove-v6-impulse.png', fullPage: true });

      // Gravity then pulls the released glove below the fixed spring anchor.
      await expect.poll(async () => Number(await canvas.getAttribute('data-center-y')), { timeout: 7000 })
        .toBeLessThan(-0.62);

      // Damping must remove the oscillation energy until the glove hangs still.
      await expect.poll(async () => await canvas.getAttribute('data-motion-state'), { timeout: 14000 })
        .toBe('settled');
      await expect.poll(async () => Number(await canvas.getAttribute('data-speed')))
        .toBeLessThan(0.06);
      await page.screenshot({ path: 'test-results/boxing-glove-v6-settled.png', fullPage: true });
    }
  });
}
