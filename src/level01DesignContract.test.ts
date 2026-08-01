import { describe, expect, it } from 'vitest';
import { LEVEL_01 } from './level';
import { LEVEL01_BONUSES } from './level01Gameplay';

describe('level 01 game-mode design contract',()=>{
 it('keeps the first stage intentionally simple',()=>{
  expect(LEVEL_01.inventory.plank).toBe(3);
  expect(Object.entries(LEVEL_01.inventory).filter(([,count])=>count>0)).toEqual([['plank',3]]);
  expect(LEVEL_01.maxRopes).toBe(0);
  expect(LEVEL_01.maxHinges).toBe(0);
 });

 it('keeps optional route rewards separate from the win condition',()=>{
  expect(LEVEL01_BONUSES).toHaveLength(3);
  expect(new Set(LEVEL01_BONUSES.map(item=>item.id)).size).toBe(3);
  expect(LEVEL_01.targetPartId).toBe('target-ball');
 });
});
