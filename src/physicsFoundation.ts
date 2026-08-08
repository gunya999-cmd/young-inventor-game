import { World, Vec2, Circle, Box, RevoluteJoint, type Body } from 'planck';

export type FoundationLevel = 0 | 1;
export type FoundationScene = {
  world: World;
  ball: Body;
  seesaw?: Body;
  target?: Body;
  basket?: { x1:number; x2:number; yTop:number };
};

const makeBar = (world:World, ax:number, ay:number, bx:number, by:number, thickness=.035) => {
  const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy);
  const body=world.createBody({position:Vec2((ax+bx)/2,(ay+by)/2), angle:Math.atan2(dy,dx)});
  body.createFixture(Box(len/2,thickness),{friction:.55,restitution:.01});
  return body;
};

const makeBall = (world:World,x:number,y:number,r=.065,density=30) => {
  const body=world.createDynamicBody({position:Vec2(x,y),bullet:true,linearDamping:.01,angularDamping:.01});
  body.createFixture(Circle(r),{density,friction:.55,restitution:.02});
  return body;
};

export function buildFoundationLevel(level:FoundationLevel):FoundationScene {
  const world=new World(Vec2(0,-9.81));
  if(level===0){
    makeBar(world,.35,1.72,2.55,.46,.045);
    makeBar(world,2.48,.18,3.42,.18,.03);
    makeBar(world,2.50,.18,2.50,.60,.025);
    makeBar(world,3.40,.18,3.40,.60,.025);
    const ball=makeBall(world,.48,1.86,.07,27.8);
    return {world,ball,basket:{x1:2.52,x2:3.38,yTop:.62}};
  }

  makeBar(world,.32,1.70,1.08,1.16,.04);
  const pivot=Vec2(1.48,.88);
  const seesaw=world.createDynamicBody({position:pivot,angle:0,angularDamping:.12});
  seesaw.createFixture(Box(.62,.04),{density:3.2,friction:.62,restitution:.01});
  const ground=world.createBody();
  world.createJoint(RevoluteJoint({enableLimit:true,lowerAngle:-.10,upperAngle:.30},ground,seesaw,pivot));
  const ball=makeBall(world,.44,1.82,.07,33.5);

  const target=world.createBody({position:Vec2(2.04,1.055)});
  target.createFixture(Circle(.055),{friction:.2,restitution:.01});
  return {world,ball,seesaw,target};
}

export function stepFoundation(scene:FoundationScene,seconds:number,dt=1/120):void{
  const count=Math.ceil(seconds/dt);
  for(let i=0;i<count;i++) scene.world.step(dt);
}

export function foundationSuccess(level:FoundationLevel,scene:FoundationScene):boolean{
  if(level===0){
    const p=scene.ball.getPosition();
    const b=scene.basket!;
    return p.x>b.x1 && p.x<b.x2 && p.y<b.yTop && p.y>.12;
  }
  return scene.seesaw!.getAngle()>=.19;
}

export type FoundationRun = {
  success:boolean;
  ball:{x:number;y:number};
  seesawAngle:number;
  maxSeesawAngle:number;
};

export function runFoundation(level:FoundationLevel,seconds=8,dt=1/120):FoundationRun{
  const scene=buildFoundationLevel(level);
  const count=Math.ceil(seconds/dt);
  let success=false;
  let maxSeesawAngle=scene.seesaw?.getAngle()??0;
  for(let i=0;i<count;i++){
    scene.world.step(dt);
    const angle=scene.seesaw?.getAngle()??0;
    if(angle>maxSeesawAngle) maxSeesawAngle=angle;
    if(foundationSuccess(level,scene)) success=true;
  }
  const p=scene.ball.getPosition();
  return {success,ball:{x:p.x,y:p.y},seesawAngle:scene.seesaw?.getAngle()??0,maxSeesawAngle};
}
