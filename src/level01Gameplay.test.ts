import { describe, expect, it } from 'vitest';
import { ACTIVE_LEVEL, LEVEL_01 } from './level';
import { createCampaignReferenceSolution } from './campaignReferenceSolutions';
import { PHYSICS_CONFIG } from './engine/physicsConfig';
import { PhysicsEngine } from './physics';
import { cloneSnapshot } from './model';
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

 it('collects all bonus sparks on the canonical route in real production physics',()=>{
  const reference=createCampaignReferenceSolution(LEVEL_01);
  const originalLevel={...ACTIVE_LEVEL,platforms:ACTIVE_LEVEL.platforms,receiver:ACTIVE_LEVEL.receiver,initialParts:ACTIVE_LEVEL.initialParts,initialSignals:ACTIVE_LEVEL.initialSignals,inventory:ACTIVE_LEVEL.inventory};
  const mutablePhysics=PHYSICS_CONFIG as unknown as {gravity:number};
  const originalGravity=mutablePhysics.gravity;
  Object.assign(ACTIVE_LEVEL,LEVEL_01);
  mutablePhysics.gravity=LEVEL_01.gravity;
  try{
   resetLevel01Attempt();
   const engine=new PhysicsEngine(cloneSnapshot(reference));
   let won=false;
   for(let frame=0;frame<1800;frame+=1){
    engine.step(1/120);
    updateLevel01Bonuses(engine.snapshot());
    if(engine.hasWon()){won=true;break;}
   }
   expect(won).toBe(true);
   expect(level01CollectedCount()).toBe(LEVEL01_BONUSES.length);
   const score=scoreLevel01(reference,5.2);
   expect(score.smooth).toBe(true);
   expect(score.fast).toBe(true);
   expect(score.explorer).toBe(true);
   expect(score.medals).toBe(3);
  }finally{
   Object.assign(ACTIVE_LEVEL,originalLevel);
   mutablePhysics.gravity=originalGravity;
  }
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
