import { describe, expect, it } from 'vitest';
import { LEVEL_01 } from './level';
import { createCampaignReferenceSolution } from './campaignReferenceSolutions';
import {
  LEVEL01_BONUSES,
  isSmoothLevel01Route,
  level01CollectedCount,
  resetLevel01Attempt,
  scoreLevel01,
  updateLevel01Bonuses
} from './level01Gameplay';

describe('level 01 gameplay layer',()=>{
 it('recognizes the canonical reference build as a smooth route',()=>{
  const snapshot=createCampaignReferenceSolution(LEVEL_01);
  expect(isSmoothLevel01Route(snapshot)).toBe(true);
 });

 it('collects route bonuses from the real target ball position and awards three medals',()=>{
  const snapshot=createCampaignReferenceSolution(LEVEL_01);
  const ball=snapshot.parts.find(part=>part.id==='target-ball');
  expect(ball).toBeTruthy();
  resetLevel01Attempt();
  for(const bonus of LEVEL01_BONUSES){
   ball!.x=bonus.x;
   ball!.y=bonus.y;
   expect(updateLevel01Bonuses(snapshot)).toContain(bonus.id);
  }
  expect(level01CollectedCount()).toBe(LEVEL01_BONUSES.length);
  const score=scoreLevel01(snapshot,5.2);
  expect(score.smooth).toBe(true);
  expect(score.fast).toBe(true);
  expect(score.explorer).toBe(true);
  expect(score.medals).toBe(3);
 });

 it('keeps bonuses optional for a valid but slower route score',()=>{
  const snapshot=createCampaignReferenceSolution(LEVEL_01);
  resetLevel01Attempt();
  const score=scoreLevel01(snapshot,9.5);
  expect(score.smooth).toBe(true);
  expect(score.explorer).toBe(false);
  expect(score.fast).toBe(false);
  expect(score.medals).toBe(1);
 });
});
