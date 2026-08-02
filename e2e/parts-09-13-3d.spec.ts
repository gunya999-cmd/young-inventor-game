import { expect, test } from '@playwright/test';

const assets = [
  ['boxing-glove', 'boxing-glove-v1', 'CC0', 'opengameart-boxing-gloves-cc0'],
  ['trampoline', 'trampoline-v1', 'CC-BY-SA', 'opengameart-elastic-trampoline'],
  ['fan-belt', 'fan-belt-v1', 'CC0', 'opengameart-belt-cc0'],
  ['gear', 'gear-v1', 'CC0', 'kenney-factory-kit-cc0'],
  ['conveyor-belt', 'conveyor-belt-v1', 'CC0', 'kenney-factory-kit-cc0']
] as const;

for (const [asset, version, license, sourceKey] of assets) {
  test(`${asset} production 3D lab fits on a phone viewport`, async ({ page }) => {
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
  });
}
