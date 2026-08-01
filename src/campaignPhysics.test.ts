import { describe, expect, it } from 'vitest';
import { ACTIVE_LEVEL, CAMPAIGN_LEVELS, type LevelSpec } from './level';
import { createInitialSnapshot, WORLD_HEIGHT, WORLD_WIDTH } from './model';
import { PhysicsEngine } from './physics';

const STEP=1/120;
const FRAMES=1200;
const MARGIN=350;

function withLevel<T>(level:LevelSpec,run:()=>T):T{
 const original={...ACTIVE_LEVEL,platforms:ACTIVE_LEVEL.platforms,receiver:ACTIVE_LEVEL.receiver,initialParts:ACTIVE_LEVEL.initialParts,initialSignals:ACTIVE_LEVEL.initialSignals,inventory:ACTIVE_LEVEL.inventory};
 Object.assign(ACTIVE_LEVEL,level);
 try{return run();}finally{Object.assign(ACTIVE_LEVEL,original);}
}

describe('campaign physical baseline',()=>{
 for(const level of CAMPAIGN_LEVELS){
  it(`level ${level.number} ${level.id} stays stable and cannot solve itself`,()=>withLevel(level,()=>{
   const engine=new PhysicsEngine(createInitialSnapshot());
   let won=false;
   for(let frame=0;frame<FRAMES;frame+=1){
    engine.step(STEP);
    won ||= engine.hasWon();
    for(const part of engine.snapshot().parts){
     expect(Number.isFinite(part.x),`${part.id} x at frame ${frame}`).toBe(true);
     expect(Number.isFinite(part.y),`${part.id} y at frame ${frame}`).toBe(true);
     expect(Number.isFinite(part.angle),`${part.id} angle at frame ${frame}`).toBe(true);
     expect(part.x,`${part.id} left bound at frame ${frame}`).toBeGreaterThanOrEqual(-MARGIN);
     expect(part.x,`${part.id} right bound at frame ${frame}`).toBeLessThanOrEqual(WORLD_WIDTH+MARGIN);
     expect(part.y,`${part.id} top bound at frame ${frame}`).toBeGreaterThanOrEqual(-MARGIN);
     expect(part.y,`${part.id} bottom bound at frame ${frame}`).toBeLessThanOrEqual(WORLD_HEIGHT+MARGIN);
    }
   }
   expect(won,'level must require player construction').toBe(false);
  }));
 }
});
