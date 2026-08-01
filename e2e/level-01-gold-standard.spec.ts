import { expect, test } from '@playwright/test';

const SELECTED_LEVEL_KEY='young-inventor:campaign:selected:v1';
const CUSTOM_LEVEL_KEY='young-inventor:custom-level:v1';

async function openCanonicalLevel01(page:any):Promise<void>{
 await page.addInitScript(({selectedKey,customKey}:{selectedKey:string;customKey:string})=>{
  localStorage.removeItem(customKey);
  localStorage.removeItem('young-inventor:level-01:best:v2');
  localStorage.setItem(selectedKey,'first-ramp');
 },{selectedKey:SELECTED_LEVEL_KEY,customKey:CUSTOM_LEVEL_KEY});
 await page.goto('/?e2e=1');
 await page.waitForFunction(()=>Boolean((window as any).__YOUNG_INVENTOR_E2E__));
}

test('level 01 teaches, rewards and completes as a focused modern first experience',async({page})=>{
 const consoleErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 page.on('pageerror',error=>consoleErrors.push(error.message));
 await openCanonicalLevel01(page);
 await expect(page.locator('#fatal-error')).toBeHidden();

 await expect(page.locator('body')).toHaveClass(/level01-game-shell/);
 await expect(page.locator('.mission-summary .level-number')).toHaveText('01');
 await expect(page.locator('.mission-summary h1')).toHaveText('Первый маршрут');
 await expect(page.locator('#campaign-open')).toHaveText('← Уровни');
 await expect(page.locator('.top-toolbar > #campaign-open')).toHaveCount(1);
 await expect(page.locator('#level-editor-open')).toBeHidden();
 await expect(page.locator('#level01-mission-card')).toContainText('Доставь шар в контейнер');
 await expect(page.locator('.palette-part:visible')).toHaveCount(1);
 await expect(page.locator('.palette-part[data-kind="plank"]')).toBeVisible();
 await expect(page.locator('.palette-part[data-kind="plank"] [data-count]')).toHaveText('×3');
 await expect(page.locator('.connections-card')).toBeHidden();
 await expect(page.locator('#level01-hud')).toBeVisible();
 await expect(page.locator('[data-bonus-count]')).toHaveText('0/3');
 await expect(page.locator('[data-best]')).toHaveText('—');
 await expect(page.locator('#level-coach')).toBeVisible();
 await expect(page.locator('.coach-progress b')).toHaveText('0/3');
 await expect(page.locator('#level-coach li.active')).toContainText('Поставь три рельса');

 await page.locator('#run-button').click();
 await expect(page.locator('#mode-label')).toHaveText('СБОРКА');
 await expect(page.locator('#status-message')).toContainText('три направляющие');
 await expect(page.locator('#level-coach')).toHaveClass(/attention/);

 await page.evaluate(()=>(window as any).__YOUNG_INVENTOR_E2E__.loadReferenceSolution());
 await expect(page.locator('.coach-progress b')).toHaveText('2/3');
 await expect(page.locator('#level-coach li.active')).toContainText('Испытай маршрут');
 await expect(page.locator('#run-button')).toHaveClass(/level-ready/);
 await page.locator('#run-button').click();
 await expect(page.locator('#mode-label')).toHaveText('СИМУЛЯЦИЯ');
 await expect(page.locator('.coach-progress b')).toHaveText('3/3');
 await expect(page.locator('.library-panel')).toHaveCSS('pointer-events','none');
 await expect(page.locator('#result-card')).toHaveClass(/visible/,{timeout:25_000});
 await expect(page.locator('#result-card h2')).toHaveText('Маршрут работает!');
 await expect(page.locator('[data-bonus-count]')).toHaveText('3/3');
 await expect(page.locator('.result-medal.earned')).toHaveCount(3);
 await expect(page.locator('.level01-result-score')).toContainText('3/3');
 await expect(page.locator('.level-takeaway')).toContainText('Один и тот же финиш можно получить разными траекториями');
 await expect(page.locator('[data-best]')).toContainText('/3');
 await expect(page.locator('#fatal-error')).toBeHidden();
 expect(consoleErrors).toEqual([]);
});

test('level 01 fits an iPad landscape viewport without desktop-editor chrome',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await openCanonicalLevel01(page);
 await expect(page.locator('#fatal-error')).toBeHidden();
 await expect(page.locator('#level-editor-open')).toBeHidden();
 await expect(page.locator('.workspace-header')).toBeHidden();
 await expect(page.locator('.task-card')).toBeHidden();
 const metrics=await page.evaluate(()=>{
  const canvas=document.querySelector('.canvas-frame')!.getBoundingClientRect();
  const inventory=document.querySelector('.library-panel')!.getBoundingClientRect();
  const toolbar=document.querySelector('.top-toolbar')!.getBoundingClientRect();
  return {
   innerWidth:window.innerWidth,
   scrollWidth:document.documentElement.scrollWidth,
   canvasWidth:canvas.width,
   canvasHeight:canvas.height,
   inventoryHeight:inventory.height,
   toolbarHeight:toolbar.height
  };
 });
 expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth+1);
 expect(metrics.canvasWidth).toBeGreaterThan(980);
 expect(metrics.canvasHeight).toBeGreaterThan(650);
 expect(metrics.inventoryHeight).toBeLessThan(150);
 expect(metrics.toolbarHeight).toBeLessThan(64);
 await expect(page.locator('#run-button')).toBeVisible();
 await expect(page.locator('#level01-mission-card')).toBeVisible();
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
 await expect(page.locator('body')).not.toHaveClass(/level01-game-shell/);
 await expect(page.locator('.mission-summary h1')).toHaveText('Мой эксперимент');
 await expect(page.locator('.task-card h2')).toHaveText('Мой эксперимент');
 await expect(page.locator('.palette-part[data-kind="plank"]')).toBeVisible();
 await expect(page.locator('.palette-part[data-kind="lever"]')).toBeVisible();
 await expect(page.locator('.connections-card')).toBeVisible();
 await expect(page.locator('#level-coach')).toHaveCount(0);
 await expect(page.locator('#level01-hud')).toHaveCount(0);
 await expect(page.locator('#run-button')).toHaveText('▶ Запустить');
});
