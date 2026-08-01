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

function roundedRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number):void{
  const safe=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);ctx.beginPath();ctx.moveTo(x+safe,y);ctx.arcTo(x+w,y,x+w,y+h,safe);ctx.arcTo(x+w,y+h,x,y+h,safe);ctx.arcTo(x,y+h,x,y,safe);ctx.arcTo(x,y,x+w,y,safe);ctx.closePath();
}

function drawPlatform(ctx:CanvasRenderingContext2D,p:LevelPlatform):void{
  const modern=isCanonicalLevel01();
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
  ctx.shadowColor=modern?'rgba(33,47,61,.15)':'rgba(75,68,57,.16)';ctx.shadowBlur=modern?12:8;ctx.shadowOffsetY=modern?7:5;
  const g=ctx.createLinearGradient(0,-p.height/2,0,p.height/2);
  if(modern){g.addColorStop(0,'#f8fbfd');g.addColorStop(.2,'#d9e1e7');g.addColorStop(.58,'#93a1ad');g.addColorStop(1,'#647481');}
  else{g.addColorStop(0,'#e4e5e1');g.addColorStop(.23,'#bbc2c1');g.addColorStop(.6,'#828d8e');g.addColorStop(1,'#5b6669');}
  ctx.fillStyle=g;roundedRect(ctx,-p.width/2,-p.height/2,p.width,p.height,Math.min(6,p.height/3));ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=modern?'#667784':'#5b6669';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(-p.width/2+7,-p.height/2+4,p.width-14,2);
  if(p.id==='barrier'){ctx.fillStyle='rgba(83,97,100,.18)';for(let y=-p.height/2+24;y<p.height/2-15;y+=42){ctx.beginPath();ctx.arc(0,y,4,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
}

function drawSpark(ctx:CanvasRenderingContext2D,x:number,y:number,collected:boolean):void{
  ctx.save();ctx.translate(x,y);
  ctx.shadowColor=collected?'rgba(45,170,126,.42)':'rgba(91,124,255,.28)';ctx.shadowBlur=18;
  ctx.fillStyle=collected?'rgba(61,183,139,.17)':'rgba(93,126,255,.13)';ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle=collected?'rgba(42,153,112,.72)':'rgba(78,111,222,.58)';ctx.lineWidth=2;ctx.setLineDash(collected?[]:[7,7]);ctx.beginPath();ctx.arc(0,0,26,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=collected?'#2e9d72':'#5c76cf';ctx.beginPath();
  for(let i=0;i<8;i+=1){const angle=-Math.PI/2+i*Math.PI/4;const radius=i%2===0?11:4.5;const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
  if(collected){ctx.fillStyle='#fff';ctx.font='900 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',0,1);}
  ctx.restore();
}

function drawGhostRail(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number):void{
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='rgba(77,116,214,.08)';ctx.strokeStyle='rgba(77,116,214,.38)';ctx.lineWidth=2;ctx.setLineDash([10,8]);roundedRect(ctx,-117.5,-14,235,28,7);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();
}

function drawLevel01Guidance(ctx:CanvasRenderingContext2D):void{
  const start=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='start-ramp');
  const finish=ACTIVE_LEVEL.platforms.find(platform=>platform.id==='finish-ramp');
  if(!start||!finish)return;
  const startPoint={x:start.x+start.width/2-10,y:start.y+34};
  const finishPoint={x:finish.x-finish.width/2+18,y:finish.y-18};
  ctx.save();
  ctx.lineCap='round';

  const corridor=ctx.createLinearGradient(startPoint.x,startPoint.y,finishPoint.x,finishPoint.y);
  corridor.addColorStop(0,'rgba(73,116,207,.08)');corridor.addColorStop(.5,'rgba(87,120,203,.045)');corridor.addColorStop(1,'rgba(45,166,121,.08)');
  ctx.strokeStyle=corridor;ctx.lineWidth=150;ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();
  ctx.strokeStyle='rgba(84,108,161,.18)';ctx.lineWidth=1.5;ctx.setLineDash([14,14]);ctx.beginPath();ctx.moveTo(startPoint.x,startPoint.y);ctx.lineTo(finishPoint.x,finishPoint.y);ctx.stroke();ctx.setLineDash([]);

  ctx.textAlign='left';ctx.fillStyle='rgba(55,88,166,.78)';ctx.font='900 10px system-ui';ctx.fillText('СТАРТ',88,116);
  ctx.textAlign='center';ctx.fillStyle='rgba(38,139,101,.82)';ctx.fillText('ФИНИШ',finish.x,finish.y-54);
  ctx.fillStyle='rgba(69,82,108,.46)';ctx.font='800 9px system-ui';ctx.fillText('СОБЕРИ СВОЮ ТРАЕКТОРИЮ',760,286);

  if(level01HintVisible()){
    drawGhostRail(ctx,548,330,.34);drawGhostRail(ctx,758,407,.34);drawGhostRail(ctx,965,468,.24);
    ctx.fillStyle='rgba(67,93,159,.62)';ctx.font='800 9px system-ui';ctx.fillText('пример плавного маршрута',760,540);
  }

  for(const bonus of LEVEL01_BONUSES){
    const collected=isLevel01BonusCollected(bonus.id);
    drawSpark(ctx,bonus.x,bonus.y,collected);
    ctx.fillStyle=collected?'rgba(37,132,94,.78)':'rgba(77,94,139,.55)';ctx.font='800 7px system-ui';ctx.textAlign='center';ctx.fillText(collected?'СОБРАНО':bonus.label,bonus.x,bonus.y+49);
  }
  ctx.restore();
}

function drawModernWorkshop(ctx:CanvasRenderingContext2D):void{
  const board=ctx.createLinearGradient(0,0,WORLD_WIDTH,WORLD_HEIGHT);board.addColorStop(0,'#f9fbfe');board.addColorStop(.48,'#f3f6fa');board.addColorStop(1,'#edf2f7');ctx.fillStyle=board;ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  ctx.save();
  ctx.strokeStyle='rgba(71,96,133,.055)';ctx.lineWidth=1;for(let x=0;x<=WORLD_WIDTH;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}
  ctx.strokeStyle='rgba(63,89,128,.085)';for(let x=0;x<=WORLD_WIDTH;x+=160){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD_HEIGHT);ctx.stroke();}for(let y=0;y<=WORLD_HEIGHT;y+=160){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD_WIDTH,y);ctx.stroke();}
  ctx.fillStyle='rgba(72,94,126,.09)';for(let y=36;y<WORLD_HEIGHT;y+=80){for(let x=36;x<WORLD_WIDTH;x+=80){ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
  ctx.strokeStyle='rgba(72,91,118,.15)';ctx.lineWidth=2;roundedRect(ctx,16,16,WORLD_WIDTH-32,WORLD_HEIGHT-32,22);ctx.stroke();
  ctx.fillStyle='rgba(46,61,83,.66)';ctx.font='900 13px system-ui';ctx.fillText('ROUTE LAB · 01',34,48);ctx.fillStyle='rgba(87,101,123,.48)';ctx.font='700 9px system-ui';ctx.fillText('Собери путь · запусти · улучши результат',34,67);
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
