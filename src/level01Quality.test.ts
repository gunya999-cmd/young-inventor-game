import { describe, expect, it } from 'vitest';
import { LEVEL_01 } from './level';
import { PARTS, type MachineSnapshot, type PartState } from './model';
import { evaluateBuildReadiness } from './levelRules';
import { createCampaignReferenceSolution } from './campaignReferenceSolutions';
import { validateLevel } from './levelValidator';

function snapshotWith(parts:PartState[]):MachineSnapshot{
 return {parts:[...LEVEL_01.initialParts.map(part=>({...part,locked:true})),...parts],ropes:[],hinges:[],signals:[]};
}

describe('level 01 gold-standard contract',()=>{
 it('teaches one mechanic with exactly three rails and no advanced tools',()=>{
  expect(LEVEL_01.inventory.plank).toBe(3);
  const nonRailInventory=Object.entries(LEVEL_01.inventory).filter(([kind,count])=>kind!=='plank'&&count>0);
  expect(nonRailInventory).toEqual([]);
  expect(LEVEL_01.maxRopes).toBe(0);
  expect(LEVEL_01.maxHinges).toBe(0);
 });

 it('authors a gap that cannot be bridged by two rails but fits three',()=>{
  const start=LEVEL_01.platforms.find(platform=>platform.id==='start-ramp')!;
  const finish=LEVEL_01.platforms.find(platform=>platform.id==='finish-ramp')!;
  const startEdge={x:start.x+start.width/2,y:start.y};
  const finishEdge={x:finish.x-finish.width/2,y:finish.y};
  const distance=Math.hypot(finishEdge.x-startEdge.x,finishEdge.y-startEdge.y);
  expect(distance).toBeGreaterThan(PARTS.plank.width*2);
  expect(distance).toBeLessThan(PARTS.plank.width*3);
 });

 it('blocks a premature run until placement and rotation have both been practiced',()=>{
  const empty=evaluateBuildReadiness(LEVEL_01,snapshotWith([]));
  expect(empty.ready).toBe(false);
  expect(empty.requirements.map(item=>item.met)).toEqual([false,false]);

  const flat=evaluateBuildReadiness(LEVEL_01,snapshotWith([
   {id:'a',kind:'plank',x:500,y:330,angle:0,fixed:true},
   {id:'b',kind:'plank',x:740,y:400,angle:0,fixed:true},
   {id:'c',kind:'plank',x:960,y:470,angle:0,fixed:true}
  ]));
  expect(flat.ready).toBe(false);
  expect(flat.requirements.map(item=>item.met)).toEqual([true,false]);

  const shaped=evaluateBuildReadiness(LEVEL_01,snapshotWith([
   {id:'a',kind:'plank',x:500,y:330,angle:.3,fixed:true},
   {id:'b',kind:'plank',x:740,y:400,angle:.25,fixed:true},
   {id:'c',kind:'plank',x:960,y:470,angle:0,fixed:true}
  ]));
  expect(shaped.ready).toBe(true);
 });

 it('has a stable repeatable three-rail solution in the production physics engine',()=>{
  const reference=createCampaignReferenceSolution(LEVEL_01);
  expect(reference.parts.filter(part=>!part.locked&&part.kind==='plank')).toHaveLength(3);
  const report=validateLevel(LEVEL_01,reference);
  const diagnostics=report.checks.map(check=>`${check.severity}: ${check.title} — ${check.detail}`).join('\n');
  expect(report.baselineWon,'level must never solve itself').toBe(false);
  expect(report.referenceWon,diagnostics).toBe(true);
  expect(report.valid,diagnostics).toBe(true);
 });
});
