import { describe, expect, it } from 'vitest';
import { validateLevel } from './levelValidator';
import { LEVEL_07, type LevelSpec } from './level';
import type { MachineSnapshot } from './model';

function validationFixture():{level:LevelSpec;reference:MachineSnapshot}{
 const level:LevelSpec={
  ...LEVEL_07,id:'validator-fixture',number:99,title:'Validator fixture',subtitle:'Drop the target into the receiver',gravity:9.81,
  platforms:[{id:'floor',x:500,y:700,width:900,height:30,angle:0}],
  receiver:{x:600,y:560,innerWidth:180,innerHeight:120,wallThickness:20,floorThickness:20},
  initialParts:[{id:'anchor',kind:'wall',x:150,y:650,angle:0,fixed:true,locked:true}],initialSignals:[],targetPartId:'target',
  inventory:{...LEVEL_07.inventory,ball:1},maxRopes:0,maxHinges:0
 };
 const reference:MachineSnapshot={
  parts:[...level.initialParts,{id:'target',kind:'ball',x:600,y:420,angle:0,fixed:false}],ropes:[],hinges:[],signals:[]
 };
 return{level,reference};
}

describe('level validator',()=>{
 it('accepts a stable deterministic reference solution that does not self-complete',()=>{
  const {level,reference}=validationFixture();
  const report=validateLevel(level,reference);
  expect(report.valid).toBe(true);
  expect(report.baselineWon).toBe(false);
  expect(report.referenceWon).toBe(true);
  expect(report.referenceWinFrames).toHaveLength(3);
  expect(new Set(report.referenceWinFrames).size).toBe(1);
 });

 it('rejects a level whose locked target starts inside the receiver',()=>{
  const {level,reference}=validationFixture();
  level.initialParts=[...level.initialParts,{id:'target',kind:'ball',x:600,y:560,angle:0,fixed:false,locked:true}];
  reference.parts=level.initialParts.map(part=>({...part}));
  const report=validateLevel(level,reference);
  expect(report.valid).toBe(false);
  expect(report.baselineWon).toBe(true);
  expect(report.checks.some(item=>item.id==='self-win'&&item.severity==='error')).toBe(true);
 });

 it('rejects a missing target and a receiver outside the world',()=>{
  const {level,reference}=validationFixture();
  level.targetPartId='missing';
  level.receiver.x=-100;
  const report=validateLevel(level,reference);
  expect(report.valid).toBe(false);
  expect(report.checks.some(item=>item.id==='target'&&item.severity==='error')).toBe(true);
  expect(report.checks.some(item=>item.id==='receiver'&&item.severity==='error')).toBe(true);
 });
});
