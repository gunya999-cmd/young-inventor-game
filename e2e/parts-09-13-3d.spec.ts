import { expect, test } from '@playwright/test';

const assets = [
  ['boxing-glove', 'boxing-glove-v16', 'CC-BY', 'sketchfab-incg5764-boxing-glove-cc-by'],
  ['trampoline', 'trampoline-v3', 'CC-BY', 'sketchfab-simon-laisne-trampoline-cc-by'],
  ['fan-belt', 'fan-belt-v2', 'CC-BY', 'sketchfab-v-belt-c-type-cc-by'],
  ['gear', 'gear-v2', 'CC0', 'sketchfab-plaggy-cc0-gear'],
  ['conveyor-belt', 'conveyor-belt-v2', 'CC-BY', 'sketchfab-jason-kan-conveyor-cc-by']
] as const;

for (const [asset, version, license, sourceKey] of assets) {
  test(`${asset} premium 3D lab fits on a phone viewport`, async ({ page }) => {
    if (asset === 'boxing-glove' || asset === 'trampoline') test.setTimeout(60_000);

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
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await page.screenshot({ path: 'test-results/boxing-glove-v16-armed.png', fullPage: true });

      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __pressBoxingGlove?: () => void };
        review.__pressBoxingGlove?.();
      });

      await expect.poll(async () => Number(await canvas.getAttribute('data-extension')), { timeout: 1800 })
        .toBeGreaterThan(0.34);
      await expect(canvas).toHaveAttribute('data-motion-state', 'free');
      await page.screenshot({ path: 'test-results/boxing-glove-v16-impulse.png', fullPage: true });

      // The Planck body itself counts genuine vertical velocity reversals.
      // Requiring at least two proves an under-damped oscillation rather than
      // a scripted launch followed by a one-way return.
      await expect.poll(async () => Number(await canvas.getAttribute('data-oscillation-turns')), { timeout: 7000 })
        .toBeGreaterThanOrEqual(2);

      await expect.poll(async () => Number(await canvas.getAttribute('data-center-y')), { timeout: 6500 })
        .toBeLessThan(-0.62);

      await expect.poll(async () => await canvas.getAttribute('data-motion-state'), { timeout: 12000 })
        .toBe('settled');
      await expect.poll(async () => Number(await canvas.getAttribute('data-speed')))
        .toBeLessThan(0.06);
      await page.screenshot({ path: 'test-results/boxing-glove-v16-settled.png', fullPage: true });
    }

    if (asset === 'trampoline') {
      await expect(canvas).toHaveAttribute('data-motion', 'contact-spring-bounce');
      await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await page.screenshot({ path: 'test-results/trampoline-v3-ready.png', fullPage: true });

      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __dropTrampolineProbe?: () => void };
        review.__dropTrampolineProbe?.();
      });

      // The test ball has horizontal velocity before impact. The trampoline
      // must compress through a real contact rather than a scripted bounce.
      await expect.poll(async () => Number(await canvas.getAttribute('data-max-compression')), { timeout: 4500 })
        .toBeGreaterThan(0.045);
      await expect.poll(async () => Number(await canvas.getAttribute('data-impact-speed')), { timeout: 4500 })
        .toBeGreaterThan(2.0);
      await page.screenshot({ path: 'test-results/trampoline-v3-compressed.png', fullPage: true });

      await expect.poll(async () => Number(await canvas.getAttribute('data-bounce-count')), { timeout: 6500 })
        .toBeGreaterThanOrEqual(1);
      await expect.poll(async () => Number(await canvas.getAttribute('data-peak-after-bounce')), { timeout: 6500 })
        .toBeGreaterThan(0.85);
      await expect.poll(async () => Number(await canvas.getAttribute('data-horizontal-retention')), { timeout: 6500 })
        .toBeGreaterThan(0.72);
      await page.screenshot({ path: 'test-results/trampoline-v3-bounced.png', fullPage: true });
    }
  });
}
