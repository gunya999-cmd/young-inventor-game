import { describe, expect, it } from 'vitest';
import { World, Vec2, Circle, Box, RevoluteJoint } from 'planck';

describe('engineered level 01 rigid-body principle',()=>{
  it('ball impact makes the left side of a pivoted lever rotate downward',()=>{
    const world=new World(Vec2(0,-9.81));
    const ground=world.createBody();
    const lever=world.createDynamicBody({position:Vec2(0,0),angle:0});
    lever.createFixture(Box(.43,.035),{density:4});
    world.createJoint(RevoluteJoint({enableLimit:true,lowerAngle:-.25,upperAngle:.25},ground,lever,Vec2(0,0)));
    const ball=world.createDynamicBody({position:Vec2(-.28,.55),bullet:true});
    ball.createFixture(Circle(.065),{density:30,friction:.5,restitution:.02});
    for(let i=0;i<120;i++) world.step(1/120);
    expect(lever.getAngle()).toBeGreaterThan(0.01);
  });
});
