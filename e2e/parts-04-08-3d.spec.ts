import { expect, test } from '@playwright/test';

const assets = [
  ['baseball', 'baseball-v2', 'CC0', 'opengameart-old-baseball-cc0'],
  ['tennis-ball', 'tennis-ball-v1', 'CC0', 'opengameart-hq-pbr-tennis-ball-cc0'],
  ['balloon', 'balloon-v1', 'CC0', 'opengameart-balloons-cc0'],
  ['teeter-totter', 'teeter-totter-v1', 'CC0', 'opengameart-playground-cc0'],
  ['bellows', 'bellows-v1', 'CC-BY', 'sketchfab-nudluria-bellows-cc-by']
] as const;

for (const [asset, version, license, sourceKey] of assets) {
  test(`${asset} open-asset lab fits on a phone viewport`, async ({ page }) => {
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

    if (asset === 'baseball') {
      await expect(canvas).toHaveAttribute('data-seam-construction', 'surface-integrated');
      await expect(canvas).toHaveAttribute('data-external-stitch-meshes', '0');
    }

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
