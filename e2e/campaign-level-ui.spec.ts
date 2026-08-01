import { expect, test } from '@playwright/test';

const SELECTED_LEVEL_KEY='young-inventor:campaign:selected:v1';
const CUSTOM_LEVEL_KEY='young-inventor:custom-level:v1';

test('campaign selection updates all visible level copy after reload',async({page})=>{
 await page.addInitScript(({selectedKey,customKey})=>{
  localStorage.removeItem(customKey);
  localStorage.setItem(selectedKey,'first-ramp');
 },{selectedKey:SELECTED_LEVEL_KEY,customKey:CUSTOM_LEVEL_KEY});
 await page.goto('/?e2e=1');
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary .level-number')).toHaveText('01');
 await expect(page.locator('.mission-summary h1')).toHaveText('Первый запуск');
 await expect(page.locator('.mission-summary .mission-copy')).toContainText('Доставь шар в приёмник');
 await expect(page.locator('.task-card h2')).toHaveText('Первый запуск');
 await expect(page.locator('.build-prompt span')).toContainText('используя только направляющие');
 await expect(page.locator('.principles-row')).toContainText('наклон');
 await expect(page).toHaveTitle(/Первый запуск/);

 await page.evaluate((key)=>localStorage.setItem(key,'airflow'),SELECTED_LEVEL_KEY);
 await page.reload();
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary .level-number')).toHaveText('05');
 await expect(page.locator('.mission-summary h1')).toHaveText('Воздушный поток');
 await expect(page.locator('.task-card h2')).toHaveText('Воздушный поток');
 await expect(page.locator('.principles-row')).toContainText('поток');
 await expect(page).toHaveTitle(/Воздушный поток/);

 await page.locator('#campaign-open').click();
 const current=page.locator('.campaign-card.current');
 await expect(current).toContainText('Воздушный поток');
});
