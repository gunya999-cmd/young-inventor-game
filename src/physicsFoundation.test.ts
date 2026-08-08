import { describe, expect, it } from 'vitest';
import { buildFoundationLevel, foundationSuccess, runFoundation, stepFoundation } from './physicsFoundation';

describe('Physics Foundation v1',()=>{
  it('Level 00: gravity alone delivers the ball into the basket',()=>{
    const result=runFoundation(0,6);
    expect(result.success).toBe(true);
  });

  it('Level 01: the ball makes the left arm descend and the right arm rise',()=>{
    const scene=buildFoundationLevel(1);
    const initial=scene.seesaw!.getAngle();
    stepFoundation(scene,3.5);
    const final=scene.seesaw!.getAngle();
    expect(final).toBeGreaterThan(initial+.15);
    expect(foundationSuccess(1,scene)).toBe(true);
  });

  it('both foundation levels repeat deterministically 20 times',()=>{
    for(let i=0;i<20;i++){
      expect(runFoundation(0,6).success).toBe(true);
      expect(runFoundation(1,4).success).toBe(true);
    }
  });
});
