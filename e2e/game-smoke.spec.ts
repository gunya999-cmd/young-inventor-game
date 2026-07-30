import { expect, test } from '@playwright/test';

test('editor commands, simulation controls and victory work in a real browser', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/?e2e=1');
  await expect(page.locator('#mode-label')).toHaveText('СБОРКА');
  await expect(page.locator('#fatal-error')).toBeHidden();
  await page.waitForFunction(() => Boolean((window as any).__YOUNG_INVENTOR_E2E__));

  await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.loadEditorFixture());
  await expect(page.locator('#selection-name')).toContainText('Направляющая');

  await page.locator('#position-x').fill('720');
  await page.locator('#position-x').dispatchEvent('change');
  await page.locator('#position-y').fill('460');
  await page.locator('#position-y').dispatchEvent('change');
  await page.locator('#angle-input').fill('15');
  await page.locator('#angle-input').dispatchEvent('change');

  let snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  let plank = snapshot.parts.find((part: any) => part.id === 'e2e-plank');
  expect(plank.x).toBe(720);
  expect(plank.y).toBe(460);
  expect(plank.angle).toBeCloseTo(Math.PI / 12, 4);

  await page.locator('#duplicate-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.filter((part: any) => !part.locked && part.kind === 'plank')).toHaveLength(2);

  await page.locator('#fix-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  const selectedCopy = snapshot.parts.find((part: any) => !part.locked && part.id !== 'e2e-plank');
  expect(selectedCopy.fixed).toBe(false);

  await page.locator('#save-button').click();
  await expect(page.locator('#load-button')).toBeEnabled();
  const saved = await page.evaluate(() => localStorage.getItem('young-inventor:desktop:v1'));
  expect(saved).toBeTruthy();

  await page.locator('#clear-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.filter((part: any) => !part.locked)).toHaveLength(0);

  await page.locator('#undo-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.filter((part: any) => !part.locked)).toHaveLength(2);

  await page.locator('#redo-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.filter((part: any) => !part.locked)).toHaveLength(0);

  await page.locator('#load-button').click();
  snapshot = await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.snapshot());
  expect(snapshot.parts.filter((part: any) => !part.locked)).toHaveLength(2);

  await page.locator('#run-button').click();
  await expect(page.locator('#mode-label')).toHaveText('СИМУЛЯЦИЯ');
  await page.locator('#pause-button').click();
  await expect(page.locator('#mode-label')).toHaveText('ПАУЗА');
  await page.locator('#pause-button').click();
  await expect(page.locator('#mode-label')).toHaveText('СИМУЛЯЦИЯ');
  await page.locator('#stop-button').click();
  await expect(page.locator('#mode-label')).toHaveText('СБОРКА');

  await page.evaluate(() => (window as any).__YOUNG_INVENTOR_E2E__.loadReferenceSolution());
  await page.locator('#run-button').click();
  await expect(page.locator('#result-card')).toHaveClass(/visible/, { timeout: 25_000 });
  await expect(page.locator('#result-card')).toContainText('ИСПЫТАНИЕ ПРОЙДЕНО');
  await expect(page.locator('#pause-button')).toBeDisabled();

  await page.locator('#result-again').click();
  await expect(page.locator('#mode-label')).toHaveText('СБОРКА');
  await expect(page.locator('#result-card')).not.toHaveClass(/visible/);
  await expect(page.locator('#fatal-error')).toBeHidden();
  expect(consoleErrors).toEqual([]);
});
