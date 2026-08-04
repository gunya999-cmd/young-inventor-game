import { test, expect } from '@playwright/test';

test('scissors close fully and split rope into two physical pieces', async ({ page }) => {
  await page.goto('/?asset=scissors');

  const canvas = page.locator('.scissors3d-lab canvas');
  await expect(canvas).toHaveAttribute('data-asset-version', 'scissors-v12-guaranteed-final-closure-cut');

  await page.getByRole('button', { name: 'Сжать ручки' }).click();

  await expect.poll(async () => await canvas.getAttribute('data-rope-cut'), {
    timeout: 7000,
    message: 'rope must actually be cut after the scissors close',
  }).toBe('true');

  await expect.poll(async () => await canvas.getAttribute('data-rope-pieces'), {
    timeout: 3000,
    message: 'cut rope must become two visible physical pieces',
  }).toBe('2');

  const relativeOpening = Number(await canvas.getAttribute('data-relative-opening'));
  expect(Number.isFinite(relativeOpening)).toBeTruthy();
  expect(relativeOpening).toBeLessThan(0.025);
});
