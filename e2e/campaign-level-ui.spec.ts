import { expect, test } from '@playwright/test';

const SELECTED_LEVEL_KEY='young-inventor:campaign:selected:v1';
const CUSTOM_LEVEL_KEY='young-inventor:custom-level:v1';

test('campaign selection updates all visible level copy after reload',async({page})=>{
 await page.goto('/?e2e=1');
 await page.evaluate(({selectedKey,customKey})=>{
  localStorage.removeItem(customKey);
  localStorage.setItem(selectedKey,'first-ramp');
 },{selectedKey:SELECTED_LEVEL_KEY,customKey:CUSTOM_LEVEL_KEY});
 await page.reload();
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary .level-number')).toHaveText('01');
 await expect(page.locator('.mission-summary h1')).toHaveText('Первый маршрут');
 await expect(page.locator('.mission-summary .mission-copy')).toContainText('тремя направляющими');
 await expect(page.locator('.task-card .eyebrow')).toHaveText('ЗАДАЧА');
 await expect(page.locator('.task-card h2')).toHaveText('Проложи свой первый маршрут');
 await expect(page.locator('.task-card > p:not(.eyebrow)')).toContainText('три рельса');
 await expect(page.locator('.build-prompt span')).toContainText('3 рельса');
 await expect(page.locator('.principles-row')).toContainText('наклон');
 await expect(page).toHaveTitle(/Первый маршрут/);

 await page.evaluate((key)=>localStorage.setItem(key,'airflow'),SELECTED_LEVEL_KEY);
 await page.reload();
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary .level-number')).toHaveText('05');
 await expect(page.locator('.mission-summary h1')).toHaveText('Воздушный поток');
 await expect(page.locator('.task-card .eyebrow')).toHaveText('ЗАДАЧА');
 await expect(page.locator('.task-card h2')).toHaveText('Воздушный поток');
 await expect(page.locator('.task-card > p:not(.eyebrow)')).toContainText('Используй вентилятор');
 await expect(page.locator('.principles-row')).toContainText('поток');
 await expect(page).toHaveTitle(/Воздушный поток/);

 await page.locator('#campaign-open').click();
 const current=page.locator('.campaign-card.current');
 await expect(current).toContainText('Воздушный поток');
});
