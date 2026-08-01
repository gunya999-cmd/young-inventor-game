import { CanvasRenderer } from './renderer';
import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY, type LevelPlatform } from './level';
import { WORLD_HEIGHT, WORLD_WIDTH } from './model';

type Internals = Record<string, any>;

function roundedRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number):void{
  const safe=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);ctx.beginPath();ctx.moveTo(x+safe,y);ctx.arcTo(x+w,y,x+w,y+h,safe);ctx.arcTo(x+w,y+h,x,y+h,safe);ctx.arcTo(x,y+h,x,y,safe);ctx.arcTo(x,y,x+w,y,safe);ctx.closePath();
}

function drawPlatform(ctx:CanvasRenderingContext2D,p:LevelPlatform):void{
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.shadowColor='rgba(75,68,57,.16)';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
  const g=ctx.createLinearGradient(0,-p.height/2,0,p.height/2);g.addColorStop(0,'#e4e5e1');g.addColorStop(.23,'#bbc2c1');g.addColorStop(.6,'#828d8e');g.addColorStop(1,'#5b6669');ctx.fillStyle=g;roundedRect(ctx,-p.width/2,-p.height/2,p.width,p.height,Math.min(5,p.height/3));ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#5b6669';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='rgba(255,255,255,.58)';ctx.fillRect(-p.width/2+7,-p.height/2+4,p.width-14,2);
  if(p.id==='barrier'){ctx.fillStyle='rgba(83,97,100,.18)';for(let y=-p.height/2+24;y<p.height/2-15;y+=42){ctx.beginPath();ctx.arc(0,y,4,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}

function drawLevel01Guidance(ctx:CanvasRenderingContext2D):void{
  const start=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='start-ramp');
  const finish=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='finish-ramp');
  if(!start||!finish)return;
  const startPoint={x:start.x+start.width/2-10,y:start.y+36};
  const finishPoint={x:finish.x-finish.width/2+18,y:finish.y-18};
  ctx.save();
  ctx.lineCap='round';
  ctx.strokeStyle='rgba(190,139,68,.075)';ctx.lineWidth=116;ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();
  ctx.strokeStyle='rgba(173,122,57,.28)';ctx.lineWidth=2;ctx.setLineDash([12,11]);ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(141,98,48,.55)';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText('ЗОНА МАРШРУТА',750,360);
  const points=[{x:548,y:330,n:'1'},{x:758,y:407,n:'2'},{x:965,y:468,n:'3'}];
  for(const point of points){
    ctx.beginPath();ctx.arc(point.x,point.y,35,0,Math.PI*2);ctx.fillStyle='rgba(255,249,236,.48)';ctx.fill();ctx.strokeStyle='rgba(173,122,57,.24)';ctx.lineWidth=1.5;ctx.setLineDash([5,6]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(151,104,49,.55)';ctx.font='900 12px system-ui';ctx.fillText(point.n,point.x,point.y+4);
  }
  ctx.textAlign='left';ctx.fillStyle='rgba(75,119,143,.66)';ctx.font='850 9px system-ui';ctx.fillText('СТАРТ',96,118);
  ctx.textAlign='center';ctx.fillStyle='rgba(79,133,91,.7)';ctx.fillText('ФИНИШ',finish.x,finish.y-52);
  ctx.restore();
}

export function installLevelVisuals():void{
  const proto=CanvasRenderer.prototype as unknown as Internals;
  if(proto.__level07VisualsInstalled)return;
  proto.__level07VisualsInstalled=true;

  proto.drawWorkshop=function drawLevelBoard(this:Internals,ctx:CanvasRenderingContext2D):void{
    const board=ctx.createLinearGradient(0,0,WORLD_WIDTH,WORLD_HEIGHT);board.addColorStop(0,'#f8f4e9');board.addColorStop(.5,'#f2eddf');board.addColorStop(1,'#ece5d6');ctx.fillStyle=board;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    ctx.save();ctx.strokeStyle='rgba(116,119,111,.07)';ctx.lineWidth=1;for(let x=0;x<=WORLD_WIDTH;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}ctx.strokeStyle='rgba(116,105,87,.105)';ctx.lineWidth=1.4;for(let x=0;x<=WORLD_WIDTH;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(x?x:0,y);ctx.stroke();}ctx.restore();
    ctx.fillStyle='rgba(118,105,85,.15)';for(let y=37;y<WORLD_HEIGHT;y+=50){for(let x=37;x<WORLD_WIDTH;x+=50){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();}}
    ctx.strokeStyle='rgba(112,92,65,.22)';ctx.lineWidth=2;roundedRect(ctx,14,14,WORLD_WIDTH-28,WORLD_HEIGHT-28,16);ctx.stroke();
    ctx.fillStyle='rgba(91,88,80,.56)';ctx.font='800 13px system-ui';ctx.fillText(`УРОВЕНЬ ${String(ACTIVE_LEVEL.number).padStart(2,'0')} · ${ACTIVE_LEVEL.title.toUpperCase()}`,32,45);ctx.fillStyle='rgba(124,116,104,.46)';ctx.font='700 10px system-ui';ctx.fillText('Монтажная панель · g = 9.81 м/с² · 120 Hz',32,63);
    const r=ACTIVE_LEVEL.receiver;ctx.save();ctx.strokeStyle='rgba(83,137,99,.24)';ctx.setLineDash([9,8]);ctx.lineWidth=2;roundedRect(ctx,r.x-r.innerWidth/2-28,r.y-r.innerHeight/2-28,r.innerWidth+56,r.innerHeight+78,17);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(73,126,89,.65)';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText('ПРИЁМНАЯ ЗОНА',r.x,r.y-r.innerHeight/2-38);ctx.restore();
    const barrier=ACTIVE_LEVEL.platforms.find(p=>p.id==='barrier');if(barrier){ctx.fillStyle='rgba(139,92,45,.58)';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText('ПЕРЕГOРОДКА',barrier.x,barrier.y-barrier.height/2-12);}
  };

  proto.drawLevel=function drawSharedLevel(this:Internals,ctx:CanvasRenderingContext2D):void{
    const canonicalLevel01=ACTIVE_LEVEL.id==='first-ramp'&&!localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY);
    if(canonicalLevel01)drawLevel01Guidance(ctx);
    for(const platform of ACTIVE_LEVEL.platforms)drawPlatform(ctx,platform);
    const r=ACTIVE_LEVEL.receiver;const wallHeight=r.innerHeight+r.floorThickness;const wallY=r.y+r.floorThickness/2;const leftX=r.x-r.innerWidth/2-r.wallThickness/2;const rightX=r.x+r.innerWidth/2+r.wallThickness/2;const floorY=r.y+r.innerHeight/2+r.floorThickness/2;
    ctx.save();ctx.translate(r.x,r.y);ctx.shadowColor='rgba(59,93,67,.12)';ctx.shadowBlur=18;ctx.shadowOffsetY=7;ctx.fillStyle='rgba(205,226,207,.48)';roundedRect(ctx,-r.innerWidth/2,-r.innerHeight/2,r.innerWidth,r.innerHeight,12);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#668b70';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#55735d';ctx.font='850 12px system-ui';ctx.textAlign='center';ctx.fillText('ПРИЁМНИК',0,r.innerHeight/2+62);ctx.restore();
    drawPlatform(ctx,{id:'receiver-floor',x:r.x,y:floorY,width:r.innerWidth+r.wallThickness*2,height:r.floorThickness,angle:0});drawPlatform(ctx,{id:'receiver-left',x:leftX,y:wallY,width:r.wallThickness,height:wallHeight,angle:0});drawPlatform(ctx,{id:'receiver-right',x:rightX,y:wallY,width:r.wallThickness,height:wallHeight,angle:0});
  };
}
