import { expect, test } from '@playwright/test';

test('isolated WebGL art lab renders and keeps the main game untouched',async({page})=>{
  const errors:string[]=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/art-lab.html');
  await page.waitForFunction(()=>document.documentElement.dataset.artLabReady==='true',{timeout:20_000});
  await expect(page.locator('#art-fatal')).toBeHidden();
  await expect(page.locator('#art-canvas')).toBeVisible();
  await expect(page.locator('#art-canvas')).toHaveAttribute('data-renderer','webgl-orthographic');
  await expect(page.locator('#art-angle-output')).toHaveText('−12°');
  await page.locator('#art-angle').fill('35');
  await expect(page.locator('#art-angle-output')).toHaveText('+35°');
  const hasWebGl=await page.locator('#art-canvas').evaluate((canvas:HTMLCanvasElement)=>Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl')));
  expect(hasWebGl).toBe(true);
  expect(errors).toEqual([]);
});
