import { expect, test } from '@playwright/test';

test('Lovable gimtim clone loads, places a part and runs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Невероятная машина' })).toBeVisible();
  await expect(page.getByText('Уровень 1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Детали' })).toBeVisible();

  const canvas = page.locator('canvas.tim-canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await canvas.click({ position: { x: box.width * 0.52, y: box.height * 0.42 } });
  await expect(page.getByText('Доска — тяните мышью, чтобы переместить')).toBeVisible();

  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page.getByText('механизм работает…')).toBeVisible();

  await page.getByRole('button', { name: 'Сброс' }).click();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();
});
