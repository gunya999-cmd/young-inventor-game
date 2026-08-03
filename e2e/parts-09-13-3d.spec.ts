import { expect, test } from '@playwright/test';

const assets = [
  ['boxing-glove', 'boxing-glove-v16', 'CC-BY', 'sketchfab-incg5764-boxing-glove-cc-by'],
  ['trampoline', 'trampoline-v3', 'CC-BY', 'sketchfab-simon-laisne-trampoline-cc-by'],
  ['fan-belt', 'fan-belt-v3', 'CC-BY', 'sketchfab-v-belt-c-type-cc-by'],
  ['gear', 'gear-v3', 'CC0', 'sketchfab-plaggy-cc0-gear'],
  ['conveyor-belt', 'conveyor-belt-v3', 'CC-BY', 'sketchfab-jason-kan-conveyor-cc-by']
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
      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __pressBoxingGlove?: () => void };
        review.__pressBoxingGlove?.();
      });
      await expect.poll(async () => Number(await canvas.getAttribute('data-extension')), { timeout: 1800 }).toBeGreaterThan(0.34);
      await expect.poll(async () => Number(await canvas.getAttribute('data-oscillation-turns')), { timeout: 7000 }).toBeGreaterThanOrEqual(2);
      await expect.poll(async () => await canvas.getAttribute('data-motion-state'), { timeout: 12000 }).toBe('settled');
    }

    if (asset === 'trampoline') {
      await expect(canvas).toHaveAttribute('data-motion', 'contact-spring-bounce');
      await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __dropTrampolineProbe?: () => void };
        review.__dropTrampolineProbe?.();
      });
      await expect.poll(async () => Number(await canvas.getAttribute('data-max-compression')), { timeout: 4500 }).toBeGreaterThan(0.045);
      await expect.poll(async () => Number(await canvas.getAttribute('data-bounce-count')), { timeout: 6500 }).toBeGreaterThanOrEqual(1);
      await expect.poll(async () => Number(await canvas.getAttribute('data-peak-after-bounce')), { timeout: 6500 }).toBeGreaterThan(0.85);
    }

    if (asset === 'fan-belt') {
      await expect(canvas).toHaveAttribute('data-motion', 'physical-belt-traction-slip-transfer');
      await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await page.screenshot({ path: 'test-results/fan-belt-v3-ready.png', fullPage: true });
      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __kickFanBelt?: () => void };
        review.__kickFanBelt?.();
      });
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-right-omega'))), { timeout: 2500 }).toBeGreaterThan(1.4);
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-speed-ratio'))), { timeout: 3000 }).toBeGreaterThan(0.78);
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-belt-slip'))), { timeout: 3000 }).toBeLessThan(0.35);
      await expect.poll(async () => Number(await canvas.getAttribute('data-belt-travel')), { timeout: 3000 }).toBeGreaterThan(0.45);
      await page.screenshot({ path: 'test-results/fan-belt-v3-transmitting.png', fullPage: true });
    }

    if (asset === 'gear') {
      await expect(canvas).toHaveAttribute('data-motion', 'angular-impulse-inertia-bearing-drag');
      await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await page.screenshot({ path: 'test-results/gear-v3-ready.png', fullPage: true });
      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __kickGear?: () => void };
        review.__kickGear?.();
      });
      await expect.poll(async () => Number(await canvas.getAttribute('data-gear-peak-omega')), { timeout: 1800 }).toBeGreaterThan(0.65);
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-gear-total-angle'))), { timeout: 2500 }).toBeGreaterThan(0.5);
      await page.screenshot({ path: 'test-results/gear-v3-spinning.png', fullPage: true });
    }

    if (asset === 'conveyor-belt') {
      await expect(canvas).toHaveAttribute('data-motion', 'motor-drum-belt-friction-transport');
      await expect(canvas).toHaveAttribute('data-motion-state', 'ready');
      await expect(canvas).toHaveAttribute('data-physics-engine', 'planck');
      await page.screenshot({ path: 'test-results/conveyor-v3-ready.png', fullPage: true });
      await canvas.evaluate((element) => {
        const review = element as HTMLCanvasElement & { __startConveyor?: () => void };
        review.__startConveyor?.();
      });
      await expect.poll(async () => Number(await canvas.getAttribute('data-peak-belt-speed')), { timeout: 2500 }).toBeGreaterThan(0.8);
      await expect.poll(async () => Number(await canvas.getAttribute('data-max-crate-x')), { timeout: 5000 }).toBeGreaterThan(0.8);
      await expect.poll(async () => await canvas.getAttribute('data-delivered'), { timeout: 6500 }).toBe('true');
      await page.screenshot({ path: 'test-results/conveyor-v3-delivered.png', fullPage: true });
    }
  });
}
