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

test('a custom level may reuse the first-ramp id without inheriting tutorial restrictions',async({page})=>{
 await page.addInitScript((customKey)=>{
  localStorage.setItem(customKey,JSON.stringify({
   id:'first-ramp',number:99,title:'Мой эксперимент',subtitle:'Пользовательская механика.',gravity:9.81,
   platforms:[{id:'floor',x:800,y:815,width:1500,height:30,angle:0}],
   receiver:{x:1380,y:680,innerWidth:150,innerHeight:105,wallThickness:22,floorThickness:22},
   initialParts:[{id:'target-ball',kind:'ball',x:200,y:200,angle:0,fixed:false}],
   initialSignals:[],inventory:{plank:1,lever:1},maxRopes:1,maxHinges:1,targetPartId:'target-ball',parTime:30,parParts:4
  }));
 },CUSTOM_LEVEL_KEY);
 await page.goto('/?e2e=1');
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('.mission-summary h1')).toHaveText('Мой эксперимент');
 await expect(page.locator('.task-card h2')).toHaveText('Мой эксперимент');
 await expect(page.locator('.palette-part[data-kind="plank"]')).toBeVisible();
 await expect(page.locator('.palette-part[data-kind="lever"]')).toBeVisible();
 await expect(page.locator('.connections-card')).toBeVisible();
 await expect(page.locator('#level-coach')).toHaveCount(0);
 await expect(page.locator('#run-button')).toHaveText('▶ Запустить');
});
