import { CanvasRenderer } from './renderer';
import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { PARTS, type GameMode, type PartState } from './model';
import {
  LEVEL01_BONUSES,
  isCanonicalLevel01,
  isLevel01BonusCollected,
  level01HintVisible
} from './level01Gameplay';

type RendererInternals = Record<string, any>;

function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number):void{
  const radius=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
  ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
}

function drawCleanWorkshop(ctx:CanvasRenderingContext2D):void{
  const bg=ctx.createLinearGradient(0,0,1600,900);bg.addColorStop(0,'#fbfcff');bg.addColorStop(.52,'#f6f8fc');bg.addColorStop(1,'#f0f5f8');ctx.fillStyle=bg;ctx.fillRect(0,0,1600,900);
  const left=ctx.createRadialGradient(160,170,20,160,170,360);left.addColorStop(0,'rgba(103,122,229,.07)');left.addColorStop(1,'rgba(103,122,229,0)');ctx.fillStyle=left;ctx.fillRect(0,0,620,520);
  const right=ctx.createRadialGradient(1380,610,20,1380,610,360);right.addColorStop(0,'rgba(57,174,128,.065)');right.addColorStop(1,'rgba(57,174,128,0)');ctx.fillStyle=right;ctx.fillRect(980,250,620,650);
}

function drawModernRail(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,angle:number,selected=false,ghost=false):void{
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  if(ghost){
    ctx.globalAlpha=.34;ctx.fillStyle='#8294d9';roundedRect(ctx,-width/2,-9,width,18,9);ctx.fill();ctx.strokeStyle='rgba(88,108,194,.7)';ctx.lineWidth=2;ctx.setLineDash([10,8]);ctx.stroke();ctx.restore();return;
  }
  ctx.shadowColor=selected?'rgba(75,100,220,.23)':'rgba(31,48,70,.13)';ctx.shadowBlur=selected?22:12;ctx.shadowOffsetY=7;
  const body=ctx.createLinearGradient(0,-height/2,0,height/2);
  body.addColorStop(0,'#718397');body.addColorStop(.24,'#5d7085');body.addColorStop(.68,'#43566b');body.addColorStop(1,'#354759');
  ctx.fillStyle=body;roundedRect(ctx,-width/2,-11,width,22,11);ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle=selected?'#7387ff':'#33475b';ctx.lineWidth=selected?3:1.6;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.48)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-width/2+14,-5);ctx.lineTo(width/2-14,-5);ctx.stroke();
  ctx.fillStyle='rgba(18,31,45,.33)';
  for(const edge of [-width/2+11,width/2-11]){ctx.beginPath();ctx.arc(edge,0,3.2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawPlayerRail(ctx:CanvasRenderingContext2D,part:PartState,selected:boolean,mode:GameMode):void{
  const spec=PARTS.plank;
  drawModernRail(ctx,part.x,part.y,spec.width,spec.height,part.angle,selected&&mode==='build');
  if(part.fixed){
    ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);ctx.fillStyle='rgba(26,43,60,.88)';
    for(const x of [-spec.width*.31,spec.width*.31]){roundedRect(ctx,x-7,7,14,9,4);ctx.fill();}
    ctx.restore();
  }
  if(selected&&mode==='build'){
    const handleY=-(spec.height/2+58);
    ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);
    ctx.strokeStyle='rgba(91,112,232,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(0,handleY+13);ctx.stroke();
    ctx.fillStyle='#fff';ctx.shadowColor='rgba(53,71,112,.18)';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,handleY,15,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#6d80e8';ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle='#6276df';ctx.font='800 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',0,handleY+.5);ctx.restore();
  }
}

function drawTargetBall(ctx:CanvasRenderingContext2D,part:PartState):void{
  const radius=PARTS.ball.radius??28;
  ctx.save();ctx.translate(part.x,part.y);
  ctx.shadowColor='rgba(67,89,210,.26)';ctx.shadowBlur=18;ctx.shadowOffsetY=7;
  const ball=ctx.createRadialGradient(-10,-12,2,0,0,radius);
  ball.addColorStop(0,'#e8ecff');ball.addColorStop(.18,'#9eacf8');ball.addColorStop(.48,'#6679e8');ball.addColorStop(.8,'#4457c8');ball.addColorStop(1,'#33459f');
  ctx.fillStyle=ball;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#3f52bd';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.62)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-4,-3,radius*.62,-2.45,-.72);ctx.stroke();ctx.restore();
}

function drawBonus(ctx:CanvasRenderingContext2D,x:number,y:number,collected:boolean):void{
  ctx.save();ctx.translate(x,y);ctx.shadowColor=collected?'rgba(45,170,126,.28)':'rgba(95,113,225,.2)';ctx.shadowBlur=18;
  ctx.fillStyle=collected?'rgba(226,250,240,.92)':'rgba(244,246,255,.94)';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle=collected?'#54b88c':'#92a0eb';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=collected?'#2e9a70':'#687be2';ctx.font='800 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(collected?'✓':'✦',0,1);ctx.restore();
}

function drawReceiver(ctx:CanvasRenderingContext2D):void{
  const r=ACTIVE_LEVEL.receiver;
  ctx.save();ctx.translate(r.x,r.y);
  ctx.shadowColor='rgba(42,151,109,.16)';ctx.shadowBlur=26;ctx.shadowOffsetY=8;
  const fill=ctx.createLinearGradient(0,-r.innerHeight/2,0,r.innerHeight/2);fill.addColorStop(0,'rgba(234,253,246,.94)');fill.addColorStop(1,'rgba(189,237,218,.78)');
  ctx.fillStyle=fill;roundedRect(ctx,-r.innerWidth/2,-r.innerHeight/2,r.innerWidth,r.innerHeight,22);ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle='#4eae83';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#3b8d6a';ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillText('ФИНИШ',0,r.innerHeight/2+38);
  ctx.restore();
  drawModernRail(ctx,r.x,r.y+r.innerHeight/2+r.floorThickness/2,r.innerWidth+r.wallThickness*2,r.floorThickness,0,false);
  drawModernRail(ctx,r.x-r.innerWidth/2-r.wallThickness/2,r.y+r.floorThickness/2,r.innerHeight+r.floorThickness,r.wallThickness,Math.PI/2,false);
  drawModernRail(ctx,r.x+r.innerWidth/2+r.wallThickness/2,r.y+r.floorThickness/2,r.innerHeight+r.floorThickness,r.wallThickness,Math.PI/2,false);
}

function drawLevel01Scene(ctx:CanvasRenderingContext2D):void{
  const start=ACTIVE_LEVEL.platforms.find(item=>item.id==='start-ramp');
  const finish=ACTIVE_LEVEL.platforms.find(item=>item.id==='finish-ramp');
  ctx.save();
  ctx.strokeStyle='rgba(71,88,116,.09)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(50,805);ctx.lineTo(1550,805);ctx.stroke();
  if(start)drawModernRail(ctx,start.x,start.y,start.width,start.height,start.angle,false);
  if(finish)drawModernRail(ctx,finish.x,finish.y,finish.width,finish.height,finish.angle,false);
  for(const bonus of LEVEL01_BONUSES)drawBonus(ctx,bonus.x,bonus.y,isLevel01BonusCollected(bonus.id));
  if(level01HintVisible()){
    drawModernRail(ctx,548,330,235,28,.34,false,true);drawModernRail(ctx,758,407,235,28,.34,false,true);drawModernRail(ctx,965,468,235,28,.24,false,true);
  }
  drawReceiver(ctx);
  ctx.restore();
}

function patchRenderer():void{
  const proto=CanvasRenderer.prototype as unknown as RendererInternals;
  if(proto.__level01Polish2Installed)return;
  proto.__level01Polish2Installed=true;
  const previousWorkshop=proto.drawWorkshop;
  const previousLevel=proto.drawLevel;
  const previousPart=proto.drawPart;
  proto.drawWorkshop=function polishedWorkshop(this:RendererInternals,ctx:CanvasRenderingContext2D):void{
    if(!isCanonicalLevel01()){previousWorkshop.call(this,ctx);return;}
    drawCleanWorkshop(ctx);
  };
  proto.drawLevel=function polishedLevel(this:RendererInternals,ctx:CanvasRenderingContext2D):void{
    if(!isCanonicalLevel01()){previousLevel.call(this,ctx);return;}
    drawLevel01Scene(ctx);
  };
  proto.drawPart=function polishedPart(this:RendererInternals,ctx:CanvasRenderingContext2D,part:PartState,selected:boolean,mode:GameMode):void{
    if(!isCanonicalLevel01()){previousPart.call(this,ctx,part,selected,mode);return;}
    if(part.kind==='plank'){drawPlayerRail(ctx,part,selected,mode);return;}
    if(part.kind==='ball'){drawTargetBall(ctx,part);return;}
    previousPart.call(this,ctx,part,selected,mode);
  };
}

function polishChrome():void{
  if(ACTIVE_LEVEL.id!=='first-ramp'||localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY))return;
  const root=document.querySelector<HTMLElement>('.desktop-app');
  const toolbar=document.querySelector<HTMLElement>('.top-toolbar');
  const controls=document.querySelector<HTMLElement>('.simulation-controls');
  if(!root||!toolbar)return;

  const campaign=document.querySelector<HTMLButtonElement>('#campaign-open');
  if(campaign){campaign.textContent='Уровни';campaign.setAttribute('aria-label','Открыть уровни');}

  const summary=toolbar.querySelector<HTMLElement>('.mission-summary');
  if(summary&&!summary.querySelector('#level01-inline-objective')){
    const objective=document.createElement('span');objective.id='level01-inline-objective';objective.className='level01-inline-objective';objective.textContent='Шар → приёмник · 3 рельса';summary.appendChild(objective);
  }

  const hud=document.querySelector<HTMLElement>('#level01-hud');
  if(hud){hud.classList.add('level01-top-hud');toolbar.insertBefore(hud,controls??null);}

  const coach=document.querySelector<HTMLElement>('#level-coach');
  const help=document.querySelector<HTMLButtonElement>('#level-coach-toggle');
  if(help&&controls){help.classList.add('level01-top-help');controls.insertBefore(help,controls.firstChild);}
  coach?.classList.add('level01-polished-coach');

  document.querySelector<HTMLElement>('#level01-mission-card')?.setAttribute('aria-hidden','true');

  const tray=document.querySelector<HTMLElement>('.library-panel');
  const count=document.querySelector<HTMLElement>('.palette-part[data-kind="plank"] [data-count]');
  const heading=tray?.querySelector<HTMLElement>('.panel-heading h2');
  const syncTray=()=>{
    const remaining=Number((count?.textContent??'').replace(/\D/g,''));
    const empty=Number.isFinite(remaining)&&remaining===0;
    root.classList.toggle('level01-tray-empty',empty);
    if(heading)heading.textContent=empty?'Маршрут собран':'Рельсы';
  };
  syncTray();if(count)new MutationObserver(syncTray).observe(count,{childList:true,subtree:true,characterData:true});

  const modeLabel=document.querySelector<HTMLElement>('#mode-label');
  const syncMode=()=>root.classList.toggle('level01-running',modeLabel?.textContent?.includes('СИМУЛЯЦИЯ')||modeLabel?.textContent?.includes('ПАУЗА'));
  syncMode();if(modeLabel)new MutationObserver(syncMode).observe(modeLabel,{childList:true,subtree:true,characterData:true});
}

export function installLevel01Polish():void{
  if(!isCanonicalLevel01())return;
  patchRenderer();
  polishChrome();
}
