import { describe, expect, it } from 'vitest';
import { runFoundation } from './physicsFoundation';

describe('Physics Foundation v1',()=>{
  it('Level 00: gravity alone delivers the ball into the basket',()=>{
    const result=runFoundation(0,6);
    expect(result.success).toBe(true);
  });

  it('Level 01: the impact raises the right arm into the physical target zone',()=>{
    const result=runFoundation(1,4);
    expect(result.maxSeesawAngle).toBeGreaterThanOrEqual(.12);
    expect(result.success).toBe(true);
  });

  it('both foundation levels repeat deterministically 20 times',()=>{
    for(let i=0;i<20;i++){
      expect(runFoundation(0,6).success).toBe(true);
      expect(runFoundation(1,4).success).toBe(true);
    }
  });
});
