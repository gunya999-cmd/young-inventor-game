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
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
}

function drawCleanWorkshop(ctx:CanvasRenderingContext2D):void{
  const bg=ctx.createLinearGradient(0,0,1600,900);
  bg.addColorStop(0,'#edf3f9');
  bg.addColorStop(.5,'#f7f9fc');
  bg.addColorStop(1,'#eaf4f2');
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,1600,900);

  const haloA=ctx.createRadialGradient(230,240,10,230,240,520);
  haloA.addColorStop(0,'rgba(92,116,230,.12)');
  haloA.addColorStop(.52,'rgba(92,116,230,.035)');
  haloA.addColorStop(1,'rgba(92,116,230,0)');
  ctx.fillStyle=haloA;
  ctx.fillRect(0,0,760,700);

  const haloB=ctx.createRadialGradient(1390,640,20,1390,640,500);
  haloB.addColorStop(0,'rgba(45,177,132,.115)');
  haloB.addColorStop(.5,'rgba(45,177,132,.025)');
  haloB.addColorStop(1,'rgba(45,177,132,0)');
  ctx.fillStyle=haloB;
  ctx.fillRect(900,220,700,680);

  ctx.save();
  ctx.globalAlpha=.22;
  ctx.fillStyle='#8290a4';
  for(let y=90;y<850;y+=80){
    for(let x=80;x<1560;x+=80){
      ctx.beginPath();ctx.arc(x,y,1.35,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();

  const edge=ctx.createLinearGradient(0,0,0,900);
  edge.addColorStop(0,'rgba(255,255,255,.92)');
  edge.addColorStop(1,'rgba(211,222,233,.42)');
  ctx.strokeStyle=edge;
  ctx.lineWidth=2;
  roundedRect(ctx,22,22,1556,856,30);
  ctx.stroke();
}

function drawRailSocket(ctx:CanvasRenderingContext2D,x:number,active=false):void{
  ctx.save();ctx.translate(x,0);
  ctx.shadowColor=active?'rgba(105,126,255,.55)':'rgba(20,35,50,.2)';
  ctx.shadowBlur=active?14:5;
  ctx.fillStyle=active?'#8090ff':'#253548';
  ctx.beginPath();ctx.arc(0,0,7.5,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='transparent';
  ctx.fillStyle=active?'#e9edff':'#7f91a3';
  ctx.beginPath();ctx.arc(0,0,3.2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawPremiumRail(
  ctx:CanvasRenderingContext2D,
  x:number,
  y:number,
  width:number,
  angle:number,
  options:{selected?:boolean;ghost?:boolean;fixed?:boolean;authored?:boolean}={}
):void{
  const {selected=false,ghost=false,fixed=false,authored=false}=options;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);

  if(ghost){
    ctx.globalAlpha=.45;
    ctx.strokeStyle='#778bff';ctx.lineWidth=3;ctx.setLineDash([12,9]);
    roundedRect(ctx,-width/2,-15,width,30,12);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(113,133,255,.08)';roundedRect(ctx,-width/2,-15,width,30,12);ctx.fill();
    drawRailSocket(ctx,-width/2+13,true);drawRailSocket(ctx,width/2-13,true);
    ctx.restore();return;
  }

  ctx.shadowColor=selected?'rgba(83,104,229,.34)':'rgba(29,46,66,.22)';
  ctx.shadowBlur=selected?28:17;ctx.shadowOffsetY=11;

  // underside / extrusion
  const underside=ctx.createLinearGradient(0,10,0,28);
  underside.addColorStop(0,'#2b3c4d');underside.addColorStop(1,'#182634');
  ctx.fillStyle=underside;roundedRect(ctx,-width/2+3,-4,width-6,32,13);ctx.fill();

  // anodized aluminium top body
  const body=ctx.createLinearGradient(0,-17,0,18);
  body.addColorStop(0,'#d5dee7');
  body.addColorStop(.16,'#a9b7c5');
  body.addColorStop(.46,'#718397');
  body.addColorStop(.7,'#53677c');
  body.addColorStop(1,'#394e63');
  ctx.fillStyle=body;roundedRect(ctx,-width/2,-16,width,31,13);ctx.fill();
  ctx.shadowColor='transparent';

  // precise machined edge
  ctx.strokeStyle=selected?'#7184ff':'#33485b';ctx.lineWidth=selected?3.2:1.6;
  roundedRect(ctx,-width/2,-16,width,31,13);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.68)';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(-width/2+18,-10);ctx.lineTo(width/2-18,-10);ctx.stroke();

  // inset running surface: makes function readable
  const strip=ctx.createLinearGradient(0,-5,0,7);
  strip.addColorStop(0,'#30445a');strip.addColorStop(.5,'#213548');strip.addColorStop(1,'#172a3b');
  ctx.fillStyle=strip;roundedRect(ctx,-width/2+22,-4,width-44,12,6);ctx.fill();
  ctx.strokeStyle='rgba(179,198,214,.2)';ctx.lineWidth=1;roundedRect(ctx,-width/2+22,-4,width-44,12,6);ctx.stroke();

  // end caps / magnetic docking collars
  for(const side of [-1,1]){
    const capX=side*(width/2-12);
    const cap=ctx.createLinearGradient(capX-side*10,0,capX+side*10,0);
    cap.addColorStop(0,'#172838');cap.addColorStop(.5,'#40566b');cap.addColorStop(1,'#132330');
    ctx.fillStyle=cap;roundedRect(ctx,capX-10,-11,20,22,8);ctx.fill();
    drawRailSocket(ctx,capX,selected);
  }

  // integrated mounting feet on player pieces
  if(fixed&&!authored){
    for(const px of [-width*.3,width*.3]){
      ctx.save();ctx.translate(px,18);
      const foot=ctx.createLinearGradient(0,-2,0,14);foot.addColorStop(0,'#6f8294');foot.addColorStop(1,'#263b4c');
      ctx.fillStyle=foot;roundedRect(ctx,-13,-5,26,15,6);ctx.fill();
      ctx.fillStyle='#91a4b5';ctx.beginPath();ctx.arc(0,2,3.2,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  if(selected){
    ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#7184ff';roundedRect(ctx,-width/2-9,-25,width+18,49,18);ctx.fill();ctx.restore();
  }
  ctx.restore();
}

function drawRotationHandle(ctx:CanvasRenderingContext2D,part:PartState):void{
  const spec=PARTS.plank;const handleY=-(spec.height/2+64);
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);
  ctx.strokeStyle='rgba(104,123,232,.55)';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(0,handleY+18);ctx.stroke();
  ctx.shadowColor='rgba(54,71,123,.24)';ctx.shadowBlur=14;
  const puck=ctx.createLinearGradient(0,handleY-18,0,handleY+18);
  puck.addColorStop(0,'#ffffff');puck.addColorStop(1,'#e9eef8');
  ctx.fillStyle=puck;ctx.beginPath();ctx.arc(0,handleY,18,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle='#7082ef';ctx.lineWidth=2.4;ctx.stroke();
  ctx.fillStyle='#5e72df';ctx.font='800 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',0,handleY+.5);
  ctx.restore();
}

function drawPlayerRail(ctx:CanvasRenderingContext2D,part:PartState,selected:boolean,mode:GameMode):void{
  drawPremiumRail(ctx,part.x,part.y,PARTS.plank.width,part.angle,{selected:selected&&mode==='build',fixed:part.fixed});
  if(selected&&mode==='build')drawRotationHandle(ctx,part);
}

function drawTargetBall(ctx:CanvasRenderingContext2D,part:PartState):void{
  const r=PARTS.ball.radius??28;
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);
  ctx.shadowColor='rgba(55,72,154,.28)';ctx.shadowBlur=22;ctx.shadowOffsetY=10;
  const metal=ctx.createRadialGradient(-11,-13,2,3,5,r+7);
  metal.addColorStop(0,'#ffffff');metal.addColorStop(.12,'#cfd8ff');metal.addColorStop(.34,'#8998f3');metal.addColorStop(.62,'#5368db');metal.addColorStop(.86,'#3144a8');metal.addColorStop(1,'#253475');
  ctx.fillStyle=metal;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle='#3045ad';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(-3,-4,r*.65,-2.55,-.7);ctx.stroke();
  ctx.strokeStyle='rgba(38,54,129,.35)';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(2,3,r*.8,.1,1.35);ctx.stroke();
  ctx.restore();
}

function drawBonusBeacon(ctx:CanvasRenderingContext2D,x:number,y:number,collected:boolean):void{
  ctx.save();ctx.translate(x,y);
  ctx.shadowColor=collected?'rgba(44,181,133,.38)':'rgba(88,111,234,.28)';ctx.shadowBlur=22;
  const outer=ctx.createRadialGradient(-6,-7,2,0,0,28);
  outer.addColorStop(0,collected?'rgba(243,255,250,.98)':'rgba(250,251,255,.98)');
  outer.addColorStop(1,collected?'rgba(154,232,201,.7)':'rgba(176,188,255,.62)');
  ctx.fillStyle=outer;
  ctx.beginPath();
  for(let i=0;i<6;i+=1){const a=Math.PI/3*i-Math.PI/6;const px=Math.cos(a)*24,py=Math.sin(a)*24;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle=collected?'#3eaa7d':'#7284ef';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=collected?'#2d8f69':'#6074df';ctx.font='900 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(collected?'✓':'✦',0,1);
  ctx.restore();
}

function drawReceiver(ctx:CanvasRenderingContext2D):void{
  const r=ACTIVE_LEVEL.receiver;
  ctx.save();ctx.translate(r.x,r.y);
  ctx.shadowColor='rgba(27,129,99,.22)';ctx.shadowBlur=30;ctx.shadowOffsetY=13;

  // back housing
  const shell=ctx.createLinearGradient(0,-r.innerHeight/2-26,0,r.innerHeight/2+38);
  shell.addColorStop(0,'#dce6e8');shell.addColorStop(.32,'#9fb2b8');shell.addColorStop(.75,'#58727a');shell.addColorStop(1,'#334b54');
  ctx.fillStyle=shell;roundedRect(ctx,-r.innerWidth/2-34,-r.innerHeight/2-20,r.innerWidth+68,r.innerHeight+58,25);ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle='#405a64';ctx.lineWidth=2.4;roundedRect(ctx,-r.innerWidth/2-34,-r.innerHeight/2-20,r.innerWidth+68,r.innerHeight+58,25);ctx.stroke();

  // illuminated soft landing surface
  const pad=ctx.createLinearGradient(0,-r.innerHeight/2,0,r.innerHeight/2);
  pad.addColorStop(0,'#eafff6');pad.addColorStop(.48,'#a9ecd2');pad.addColorStop(1,'#63c49f');
  ctx.fillStyle=pad;roundedRect(ctx,-r.innerWidth/2,-r.innerHeight/2,r.innerWidth,r.innerHeight,20);ctx.fill();
  ctx.strokeStyle='#32a878';ctx.lineWidth=3;roundedRect(ctx,-r.innerWidth/2,-r.innerHeight/2,r.innerWidth,r.innerHeight,20);ctx.stroke();

  // led goal strip
  ctx.shadowColor='rgba(73,229,169,.72)';ctx.shadowBlur=15;ctx.fillStyle='#73efbd';roundedRect(ctx,-r.innerWidth/2+14,r.innerHeight/2-11,r.innerWidth-28,5,3);ctx.fill();ctx.shadowColor='transparent';
  ctx.fillStyle='#246f58';ctx.font='850 11px system-ui';ctx.textAlign='center';ctx.fillText('GOAL',0,r.innerHeight/2+55);
  ctx.restore();
}

function drawStartDock(ctx:CanvasRenderingContext2D):void{
  const start=ACTIVE_LEVEL.platforms.find(item=>item.id==='start-ramp');
  if(!start)return;
  drawPremiumRail(ctx,start.x,start.y,start.width,start.angle,{authored:true});
  ctx.save();ctx.translate(start.x-start.width*.39,start.y-45);ctx.rotate(start.angle);
  ctx.fillStyle='rgba(86,105,216,.1)';roundedRect(ctx,-44,-19,88,38,14);ctx.fill();
  ctx.fillStyle='#5368d6';ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('START',0,1);ctx.restore();
}

function drawFinishDock(ctx:CanvasRenderingContext2D):void{
  const finish=ACTIVE_LEVEL.platforms.find(item=>item.id==='finish-ramp');
  if(!finish)return;
  drawPremiumRail(ctx,finish.x,finish.y,finish.width,finish.angle,{authored:true});
}

function drawLevel01Scene(ctx:CanvasRenderingContext2D):void{
  ctx.save();
  drawStartDock(ctx);
  drawFinishDock(ctx);
  for(const bonus of LEVEL01_BONUSES)drawBonusBeacon(ctx,bonus.x,bonus.y,isLevel01BonusCollected(bonus.id));
  if(level01HintVisible()){
    drawPremiumRail(ctx,548,330,235,.34,{ghost:true});
    drawPremiumRail(ctx,758,407,235,.34,{ghost:true});
    drawPremiumRail(ctx,965,468,235,.24,{ghost:true});
  }
  drawReceiver(ctx);
  ctx.restore();
}

function patchRenderer():void{
  const proto=CanvasRenderer.prototype as unknown as RendererInternals;
  if(proto.__level01Visual2026Installed)return;
  proto.__level01Visual2026Installed=true;
  const previousWorkshop=proto.drawWorkshop;
  const previousLevel=proto.drawLevel;
  const previousPart=proto.drawPart;
  proto.drawWorkshop=function premiumWorkshop(this:RendererInternals,ctx:CanvasRenderingContext2D):void{
    if(!isCanonicalLevel01()){previousWorkshop.call(this,ctx);return;}
    drawCleanWorkshop(ctx);
  };
  proto.drawLevel=function premiumLevel(this:RendererInternals,ctx:CanvasRenderingContext2D):void{
    if(!isCanonicalLevel01()){previousLevel.call(this,ctx);return;}
    drawLevel01Scene(ctx);
  };
  proto.drawPart=function premiumPart(this:RendererInternals,ctx:CanvasRenderingContext2D,part:PartState,selected:boolean,mode:GameMode):void{
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
  root.classList.add('level01-visual-2026');

  const campaign=document.querySelector<HTMLButtonElement>('#campaign-open');
  if(campaign){campaign.textContent='← Уровни';campaign.setAttribute('aria-label','Открыть уровни');}

  const summary=toolbar.querySelector<HTMLElement>('.mission-summary');
  if(summary&&!summary.querySelector('#level01-inline-objective')){
    const objective=document.createElement('span');objective.id='level01-inline-objective';objective.className='level01-inline-objective';objective.textContent='Соедини старт и финиш тремя рельсами';summary.appendChild(objective);
  }

  const hud=document.querySelector<HTMLElement>('#level01-hud');
  if(hud){hud.classList.add('level01-top-hud');toolbar.insertBefore(hud,controls??null);}

  const coach=document.querySelector<HTMLElement>('#level-coach');
  const help=document.querySelector<HTMLButtonElement>('#level-coach-toggle');
  if(help&&controls){help.classList.add('level01-top-help');help.textContent='?';controls.insertBefore(help,controls.firstChild);}
  coach?.classList.add('level01-polished-coach');

  const mission=document.querySelector<HTMLElement>('#level01-mission-card');
  mission?.removeAttribute('aria-hidden');

  const tray=document.querySelector<HTMLElement>('.library-panel');
  const heading=tray?.querySelector<HTMLElement>('.panel-heading h2');
  const badge=tray?.querySelector<HTMLElement>('.panel-badge');
  if(heading)heading.textContent='Детали';
  if(badge)badge.textContent='ПЕРЕТАЩИ';

  const count=document.querySelector<HTMLElement>('.palette-part[data-kind="plank"] [data-count]');
  const syncTray=()=>{
    const remaining=Number((count?.textContent??'').replace(/\D/g,''));
    const used=Math.max(0,3-(Number.isFinite(remaining)?remaining:3));
    root.dataset.level01Placed=String(used);
    if(heading)heading.textContent=used===3?'Все рельсы на поле':'Детали';
  };
  syncTray();if(count)new MutationObserver(syncTray).observe(count,{childList:true,subtree:true,characterData:true});

  const selectionName=document.querySelector<HTMLElement>('#selection-name');
  const syncSelection=()=>root.classList.toggle('level01-has-selection',Boolean(selectionName&&selectionName.textContent?.trim()&&selectionName.textContent.trim()!=='Ничего'));
  syncSelection();if(selectionName)new MutationObserver(syncSelection).observe(selectionName,{childList:true,subtree:true,characterData:true});

  const modeLabel=document.querySelector<HTMLElement>('#mode-label');
  const syncMode=()=>root.classList.toggle('level01-running',modeLabel?.textContent?.includes('СИМУЛЯЦИЯ')||modeLabel?.textContent?.includes('ПАУЗА'));
  syncMode();if(modeLabel)new MutationObserver(syncMode).observe(modeLabel,{childList:true,subtree:true,characterData:true});
}

export function installLevel01Polish():void{
  if(!isCanonicalLevel01())return;
  patchRenderer();
  polishChrome();
}
