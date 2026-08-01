import { CanvasRenderer } from './renderer';
import { ACTIVE_LEVEL, type LevelPlatform } from './level';
import { WORLD_HEIGHT, WORLD_WIDTH } from './model';
import {
  LEVEL01_BONUSES,
  isCanonicalLevel01,
  isLevel01BonusCollected,
  level01HintVisible
} from './level01Gameplay';

type Internals = Record<string, any>;

function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number):void{
  const safe=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);ctx.beginPath();ctx.moveTo(x+safe,y);ctx.arcTo(x+w,y,x+w,y+h,safe);ctx.arcTo(x+w,y+h,x,y+h,safe);ctx.arcTo(x,y+h,x,y,safe);ctx.arcTo(x,y,x+w,y,safe);ctx.closePath();
}

function drawPlatform(ctx:CanvasRenderingContext2D,p:LevelPlatform):void{
  const modern=isCanonicalLevel01();
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
  ctx.shadowColor=modern?'rgba(29,43,59,.18)':'rgba(75,68,57,.16)';ctx.shadowBlur=modern?14:8;ctx.shadowOffsetY=modern?8:5;
  const g=ctx.createLinearGradient(0,-p.height/2,0,p.height/2);
  if(modern){g.addColorStop(0,'#fbfdff');g.addColorStop(.18,'#dce5eb');g.addColorStop(.54,'#9aa9b5');g.addColorStop(1,'#61717e');}
  else{g.addColorStop(0,'#e4e5e1');g.addColorStop(.23,'#bbc2c1');g.addColorStop(.6,'#828d8e');g.addColorStop(1,'#5b6669');}
  ctx.fillStyle=g;roundedRect(ctx,-p.width/2,-p.height/2,p.width,p.height,Math.min(7,p.height/3));ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=modern?'rgba(66,82,96,.72)':'#5b6669';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillRect(-p.width/2+8,-p.height/2+4,p.width-16,2);
  if(p.id==='barrier'){ctx.fillStyle='rgba(83,97,100,.18)';for(let y=-p.height/2+24;y<p.height/2-15;y+=42){ctx.beginPath();ctx.arc(0,y,4,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}

function drawSpark(ctx:CanvasRenderingContext2D,x:number,y:number,collected:boolean):void{
  ctx.save();ctx.translate(x,y);
  ctx.shadowColor=collected?'rgba(45,170,126,.45)':'rgba(91,108,235,.34)';ctx.shadowBlur=22;
  ctx.fillStyle=collected?'rgba(55,183,136,.18)':'rgba(100,118,235,.12)';ctx.beginPath();ctx.arc(0,0,32,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle=collected?'rgba(42,153,112,.72)':'rgba(88,105,218,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=collected?'#2f9f73':'#6578df';ctx.beginPath();
  for(let i=0;i<8;i+=1){const angle=-Math.PI/2+i*Math.PI/4;const radius=i%2===0?10:4.2;const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
  if(collected){ctx.fillStyle='#fff';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',0,1);}
  ctx.restore();
}

function drawGhostRail(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number):void{
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='rgba(84,104,213,.07)';ctx.strokeStyle='rgba(84,104,213,.34)';ctx.lineWidth=2;ctx.setLineDash([10,8]);roundedRect(ctx,-117.5,-14,235,28,7);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();
}

function drawTag(ctx:CanvasRenderingContext2D,x:number,y:number,label:string,fill:string,ink:string):void{
  ctx.save();ctx.font='900 10px system-ui';const width=Math.max(76,ctx.measureText(label).width+28);roundedRect(ctx,x-width/2,y-15,width,30,15);ctx.fillStyle=fill;ctx.fill();ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y);ctx.restore();
}

function drawLevel01Guidance(ctx:CanvasRenderingContext2D):void{
  const start=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='start-ramp');
  const finish=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='finish-ramp');
  if(!start||!finish)return;
  const startPoint={x:start.x+start.width/2-10,y:start.y+34};
  const finishPoint={x:finish.x-finish.width/2+18,y:finish.y-18};
  ctx.save();ctx.lineCap='round';
  const corridor=ctx.createLinearGradient(startPoint.x,startPoint.y,finishPoint.x,finishPoint.y);
  corridor.addColorStop(0,'rgba(91,111,232,.065)');corridor.addColorStop(.58,'rgba(105,126,231,.035)');corridor.addColorStop(1,'rgba(45,166,121,.07)');
  ctx.strokeStyle=corridor;ctx.lineWidth=136;ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();
  ctx.strokeStyle='rgba(88,105,165,.12)';ctx.lineWidth=1.5;ctx.setLineDash([16,16]);ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();ctx.setLineDash([]);

  drawTag(ctx,118,108,'СТАРТ','rgba(233,238,255,.94)','#5065c8');
  drawTag(ctx,finish.x,finish.y-58,'ЦЕЛЬ','rgba(226,247,237,.95)','#2d8b67');

  if(level01HintVisible()){
    drawGhostRail(ctx,548,330,.34);drawGhostRail(ctx,758,407,.34);drawGhostRail(ctx,965,468,.24);
    drawTag(ctx,760,545,'ОДИН ИЗ ВАРИАНТОВ','rgba(239,242,253,.92)','#6572a8');
  }

  for(const bonus of LEVEL01_BONUSES)drawSpark(ctx,bonus.x,bonus.y,isLevel01BonusCollected(bonus.id));
  ctx.restore();
}

function drawModernWorkshop(ctx:CanvasRenderingContext2D):void{
  const board=ctx.createLinearGradient(0,0,WORLD_WIDTH,WORLD_HEIGHT);board.addColorStop(0,'#fbfdff');board.addColorStop(.55,'#f3f7fb');board.addColorStop(1,'#edf3f8');ctx.fillStyle=board;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);

  const startGlow=ctx.createRadialGradient(190,230,20,190,230,360);startGlow.addColorStop(0,'rgba(98,119,235,.11)');startGlow.addColorStop(1,'rgba(98,119,235,0)');ctx.fillStyle=startGlow;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  const finishGlow=ctx.createRadialGradient(1370,560,20,1370,560,330);finishGlow.addColorStop(0,'rgba(57,178,132,.10)');finishGlow.addColorStop(1,'rgba(57,178,132,0)');ctx.fillStyle=finishGlow;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);

  ctx.save();ctx.fillStyle='rgba(71,93,126,.055)';for(let y=76;y<WORLD_HEIGHT;y+=90){for(let x=76;x<WORLD_WIDTH;x+=90){ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fill();}}ctx.restore();
  ctx.strokeStyle='rgba(66,86,118,.10)';ctx.lineWidth=2;roundedRect(ctx,18,18,WORLD_WIDTH-36,WORLD_HEIGHT-36,24);ctx.stroke();
}

export function installLevelVisuals():void{
  const proto=CanvasRenderer.prototype as unknown as Internals;
  if(proto.__level07VisualsInstalled)return;
  proto.__level07VisualsInstalled=true;

  proto.drawWorkshop=function drawLevelBoard(this:Internals,ctx:CanvasRenderingContext2D):void{
    if(isCanonicalLevel01()){drawModernWorkshop(ctx);return;}
    const board=ctx.createLinearGradient(0,0,WORLD_WIDTH,WORLD_HEIGHT);board.addColorStop(0,'#f8f4e9');board.addColorStop(.5,'#f2eddf');board.addColorStop(1,'#ece5d6');ctx.fillStyle=board;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    ctx.save();ctx.strokeStyle='rgba(116,119,111,.07)';ctx.lineWidth=1;for(let x=0;x<=WORLD_WIDTH;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}ctx.strokeStyle='rgba(116,105,87,.105)';ctx.lineWidth=1.4;for(let x=0;x<=WORLD_WIDTH;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}ctx.restore();
    ctx.fillStyle='rgba(118,105,85,.15)';for(let y=37;y<WORLD_HEIGHT;y+=50){for(let x=37;x<WORLD_WIDTH;x+=50){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();}}
    ctx.strokeStyle='rgba(112,92,65,.22)';ctx.lineWidth=2;roundedRect(ctx,14,14,WORLD_WIDTH-28,WORLD_HEIGHT-28,16);ctx.stroke();
    ctx.fillStyle='rgba(91,88,80,.56)';ctx.font='800 13px system-ui';ctx.fillText(`УРОВЕНЬ ${String(ACTIVE_LEVEL.number).padStart(2,'0')} · ${ACTIVE_LEVEL.title.toUpperCase()}`,32,45);ctx.fillStyle='rgba(124,116,104,.46)';ctx.font='700 10px system-ui';ctx.fillText('Монтажная панель · g = 9.81 м/с² · 120 Hz',32,63);
    const r=ACTIVE_LEVEL.receiver;ctx.save();ctx.strokeStyle='rgba(83,137,99,.24)';ctx.setLineDash([9,8]);ctx.lineWidth=2;roundedRect(ctx,r.x-r.innerWidth/2-28,r.y-r.innerHeight/2-28,r.innerWidth+56,r.innerHeight+78,17);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(73,126,89,.65)';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText('ПРИЁМНАЯ ЗОНА',r.x,r.y-r.innerHeight/2-38);ctx.restore();
    const barrier=ACTIVE_LEVEL.platforms.find(p=>p.id==='barrier');if(barrier){ctx.fillStyle='rgba(139,92,45,.58)';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText('ПЕРЕГOРОДКА',barrier.x,barrier.y-barrier.height/2-12);}
  };

  proto.drawLevel=function drawSharedLevel(this:Internals,ctx:CanvasRenderingContext2D):void{
    if(isCanonicalLevel01())drawLevel01Guidance(ctx);
    for(const platform of ACTIVE_LEVEL.platforms)drawPlatform(ctx,platform);
    const r=ACTIVE_LEVEL.receiver;const wallHeight=r.innerHeight+r.floorThickness;const wallY=r.y+r.floorThickness/2;const leftX=r.x-r.innerWidth/2-r.wallThickness/2;const rightX=r.x+r.innerWidth/2+r.wallThickness/2;const floorY=r.y+r.innerHeight/2+r.floorThickness/2;
    ctx.save();ctx.translate(r.x,r.y);ctx.shadowColor='rgba(41,123,88,.15)';ctx.shadowBlur=isCanonicalLevel01()?24:18;ctx.shadowOffsetY=7;ctx.fillStyle=isCanonicalLevel01()?'rgba(92,205,153,.13)':'rgba(205,226,207,.48)';roundedRect(ctx,-r.innerWidth/2,-r.innerHeight/2,r.innerWidth,r.innerHeight,14);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=isCanonicalLevel01()?'#4a9d78':'#668b70';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=isCanonicalLevel01()?'#33795a':'#55735d';ctx.font='850 12px system-ui';ctx.textAlign='center';ctx.fillText('ПРИЁМНИК',0,r.innerHeight/2+62);ctx.restore();
    drawPlatform(ctx,{id:'receiver-floor',x:r.x,y:floorY,width:r.innerWidth+r.wallThickness*2,height:r.floorThickness,angle:0});drawPlatform(ctx,{id:'receiver-left',x:leftX,y:wallY,width:r.wallThickness,height:wallHeight,angle:0});drawPlatform(ctx,{id:'receiver-right',x:rightX,y:wallY,width:r.wallThickness,height:wallHeight,angle:0});
  };
}
