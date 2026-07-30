import { expect, test, type Page } from '@playwright/test';

type Point = { x: number; y: number };

async function bridgePoint(page: Page, method: 'partCenter' | 'rotationHandle', partId: string): Promise<Point> {
  const point = await page.evaluate(({ method, partId }) => {
    const bridge = (window as any).__YOUNG_INVENTOR_E2E__;
    return bridge[method](partId);
  }, { method, partId });
  if (!point) throw new Error(`No ${method} for ${partId}`);
  return point;
}

async function worldPoint(page: Page, point: Point): Promise<Point> {
  return page.evaluate((value) => (window as any).__YOUNG_INVENTOR_E2E__.screenPoint(value), point);
}

test('palette drag and direct canvas tools work through real pointer events', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean((window as any).__YOUNG_INVENTOR_E2E__));
  await expect(page.locator('#fatal-error')).toBeHidden();

  // Real pointer drag from the palette to a world-space point on the canvas.
  const palette = page.locator('.palette-part[data-kind="plank"]');
  const paletteBox = await palette.boundingBox();
  if (!paletteBox) throw new Error('Palette plank is not visible');
  const drop = await worldPoint(page, { x: 760, y: 320 });
  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(drop.x, drop.y, { steps: 12 });
  await page.mouse.up();

  let snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  const palettePlanks = snapshot.parts.filter((part: any) => !part.locked && part.kind === 'plank');
  expect(palettePlanks).toHaveLength(1);
  expect(palettePlanks[0].x).toBeCloseTo(760, -1);
  expect(palettePlanks[0].y).toBeCloseTo(320, -1);

  // Controlled two-part fixture for direct canvas editing.
  await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.loadPointerFixture());
  let centerA = await bridgePoint(page, 'partCenter', 'pointer-plank-a');
  const movedTo = await worldPoint(page, { x: 720, y: 370 });

  await page.mouse.click(centerA.x, centerA.y);
  await expect(page.locator('#selection-name')).toContainText('Направляющая');
  await page.mouse.move(centerA.x, centerA.y);
  await page.mouse.down();
  await page.mouse.move(movedTo.x, movedTo.y, { steps: 10 });
  await page.mouse.up();

  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  let partA = snapshot.parts.find((part: any) => part.id === 'pointer-plank-a');
  expect(partA.x).toBe(720);
  expect(partA.y).toBe(370);

  // Drag the rendered rotation handle, not the inspector buttons.
  centerA = await bridgePoint(page, 'partCenter', 'pointer-plank-a');
  const handle = await bridgePoint(page, 'rotationHandle', 'pointer-plank-a');
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(centerA.x + 95, centerA.y - 35, { steps: 10 });
  await page.mouse.up();

  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  partA = snapshot.parts.find((part: any) => part.id === 'pointer-plank-a');
  expect(Math.abs(partA.angle)).toBeGreaterThan(0.25);

  // Install an axis by arming the tool and clicking the selected part.
  await page.locator('#hinge-button').click();
  centerA = await bridgePoint(page, 'partCenter', 'pointer-plank-a');
  await page.mouse.click(centerA.x, centerA.y);
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.hinges).toHaveLength(1);
  expect(snapshot.hinges[0].partId).toBe('pointer-plank-a');

  // Create a real rope with two canvas clicks.
  const centerB = await bridgePoint(page, 'partCenter', 'pointer-plank-b');
  await page.locator('#rope-button').click();
  await page.mouse.click(centerA.x, centerA.y);
  await page.mouse.click(centerB.x, centerB.y);
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.ropes).toHaveLength(1);
  expect(new Set([snapshot.ropes[0].a.partId, snapshot.ropes[0].b.partId])).toEqual(
    new Set(['pointer-plank-a', 'pointer-plank-b'])
  );

  // Selection and deletion must cascade through both axis and rope.
  await page.mouse.click(centerA.x, centerA.y);
  await page.locator('#delete-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.some((part: any) => part.id === 'pointer-plank-a')).toBe(false);
  expect(snapshot.hinges).toHaveLength(0);
  expect(snapshot.ropes).toHaveLength(0);

  await page.screenshot({ path: 'test-results/canvas-pointer-final.png', fullPage: true });
  await expect(page.locator('#fatal-error')).toBeHidden();
  expect(consoleErrors).toEqual([]);
});
