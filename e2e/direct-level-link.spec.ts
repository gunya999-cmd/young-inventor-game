import { expect, test } from '@playwright/test';

const SELECTED_LEVEL_KEY='young-inventor:campaign:selected:v1';
const CUSTOM_LEVEL_KEY='young-inventor:custom-level:v1';

test('level query opens Level 01 even when Safari-style stored state points elsewhere',async({page})=>{
 await page.addInitScript(({selectedKey,customKey})=>{
  localStorage.setItem(selectedKey,'impulse-and-moment');
  localStorage.setItem(customKey,JSON.stringify({stale:true}));
 },{selectedKey:SELECTED_LEVEL_KEY,customKey:CUSTOM_LEVEL_KEY});
 await page.goto('/?e2e=1&level=1');
 await page.waitForFunction(()=>Boolean((window as any).__YOUNG_INVENTOR_E2E__));
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary .level-number')).toHaveText('01');
 await expect(page.locator('.mission-summary h1')).toHaveText('Первый маршрут');
 await expect(page.locator('#level01-hud')).toBeVisible();
 await expect.poll(()=>page.evaluate((key)=>localStorage.getItem(key),CUSTOM_LEVEL_KEY)).toBeNull();
});
