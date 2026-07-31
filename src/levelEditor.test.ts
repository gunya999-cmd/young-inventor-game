import { describe,expect,it } from 'vitest';
import { LEVEL_07,normalizeLevel } from './level';

describe('level editor data',()=>{
 it('normalizes limits, inventory and target object',()=>{
  const level=normalizeLevel({...LEVEL_07,id:' custom ',maxRopes:99,maxHinges:-2,targetPartId:'level-weight',inventory:{...LEVEL_07.inventory,plank:120}});
  expect(level?.id).toBe('custom');
  expect(level?.maxRopes).toBe(20);
  expect(level?.maxHinges).toBe(0);
  expect(level?.inventory.plank).toBe(99);
  expect(level?.targetPartId).toBe('level-weight');
 });
 it('rejects malformed level files',()=>{
  expect(normalizeLevel(null)).toBeNull();
  expect(normalizeLevel({id:'x'})).toBeNull();
 });
 it('forces imported initial objects to be level-locked',()=>{
  const level=normalizeLevel({...LEVEL_07,initialParts:LEVEL_07.initialParts.map(part=>({...part,locked:false}))});
  expect(level?.initialParts.every(part=>part.locked)).toBe(true);
 });
 it('falls back to an existing target when configured id is missing',()=>{
  const level=normalizeLevel({...LEVEL_07,targetPartId:'missing'});
  expect(level?.targetPartId).toBe(LEVEL_07.initialParts[0].id);
 });
});
