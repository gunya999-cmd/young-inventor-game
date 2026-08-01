import { expect, test } from '@playwright/test';

const SELECTED_LEVEL_KEY='young-inventor:campaign:selected:v1';
const CUSTOM_LEVEL_KEY='young-inventor:custom-level:v1';

test('level 01 teaches build, rotation and test as a focused first experience',async({page})=>{
 const consoleErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 page.on('pageerror',error=>consoleErrors.push(error.message));
 await page.addInitScript(({selectedKey,customKey})=>{
  localStorage.removeItem(customKey);
  localStorage.setItem(selectedKey,'first-ramp');
 },{selectedKey:SELECTED_LEVEL_KEY,customKey:CUSTOM_LEVEL_KEY});
 await page.goto('/?e2e=1');
 await page.waitForFunction(()=>Boolean((window as any).__YOUNG_INVENTOR_E2E__));
 await expect(page.locator('#fatal-error')).toBeHidden();

 await expect(page.locator('.mission-summary .level-number')).toHaveText('01');
 await expect(page.locator('.mission-summary h1')).toHaveText('Первый маршрут');
 await expect(page.locator('.task-card h2')).toHaveText('Построй непрерывный спуск');
 await expect(page.locator('.palette-part:visible')).toHaveCount(1);
 await expect(page.locator('.palette-part[data-kind="plank"]')).toBeVisible();
 await expect(page.locator('.palette-part[data-kind="plank"] [data-count]')).toHaveText('×3');
 await expect(page.locator('.connections-card')).toBeHidden();
 await expect(page.locator('#level-coach')).toBeVisible();
 await expect(page.locator('.coach-progress b')).toHaveText('0/3');

 await page.locator('#run-button').click();
 await expect(page.locator('#mode-label')).toHaveText('СБОРКА');
 await expect(page.locator('#status-message')).toContainText('три направляющие');
 await expect(page.locator('#level-coach')).toHaveClass(/attention/);

 await page.evaluate(()=>(window as any).__YOUNG_INVENTOR_E2E__.loadReferenceSolution());
 await expect(page.locator('.coach-progress b')).toHaveText('2/3');
 await expect(page.locator('#run-button')).toHaveClass(/level-ready/);
 await page.locator('#run-button').click();
 await expect(page.locator('#mode-label')).toHaveText('СИМУЛЯЦИЯ');
 await expect(page.locator('.coach-progress b')).toHaveText('3/3');
 await expect(page.locator('#result-card')).toHaveClass(/visible/,{timeout:25_000});
 await expect(page.locator('#result-card h2')).toHaveText('Первый маршрут работает!');
 await expect(page.locator('.level-takeaway')).toContainText('Наклон превращает высоту в скорость');
 await expect(page.locator('#fatal-error')).toBeHidden();
 expect(consoleErrors).toEqual([]);
});
