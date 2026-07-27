import { CanvasRenderer, type RenderFrame } from './renderer';
import { endpointWorld } from './physics';
import { PARTS, type GameMode, type PartState, type Point } from './model';

interface RuntimePart extends PartState {
  springCompression?: number;
  deviceActive?: boolean;
}

type RendererInternals = Record<string, any>;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const safe = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safe, y);
  ctx.arcTo(x + width, y, x + width, y + height, safe);
  ctx.arcTo(x + width, y + height, x, y + height, safe);
  ctx.arcTo(x, y + height, x, y, safe);
  ctx.arcTo(x, y, x + width, y, safe);
  ctx.closePath();
}

function partShadow(ctx: CanvasRenderingContext2D, selected: boolean): void {
  ctx.shadowColor = 'rgba(65,54,42,.22)';
  ctx.shadowBlur = selected ? 16 : 8;
  ctx.shadowOffsetY = 6;
}

function finishPart(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: PartState, selected: boolean, mode: GameMode): void {
  ctx.shadowColor = 'transparent';
  if (part.fixed && !part.locked) renderer.drawFixedBolts(ctx, part);
  if (part.locked) renderer.drawLevelBadge(ctx, part);
  ctx.restore();
  if (selected && mode === 'build') renderer.drawSelection(ctx, part);
}

function drawDomino(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const { width, height } = PARTS.domino;
  ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.angle); partShadow(ctx, selected);
  const face = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  face.addColorStop(0, '#cbbda4'); face.addColorStop(.28, '#f4ead6'); face.addColorStop(.72, '#ded0b8'); face.addColorStop(1, '#a79578');
  ctx.fillStyle = face; roundedRect(ctx, -width/2, -height/2, width, height, 5); ctx.fill();
  ctx.strokeStyle='#80745f';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='rgba(97,84,65,.36)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-width/2+5,0);ctx.lineTo(width/2-5,0);ctx.stroke();
  ctx.fillStyle='#5e5548';
  for(const y of [-height*.27,height*.27]){ctx.beginPath();ctx.arc(0,y,3.6,0,Math.PI*2);ctx.fill();}
  finishPart(renderer,ctx,part,selected,mode);
}

function drawRubberBall(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const radius=PARTS.rubberball.radius??31;
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  const g=ctx.createRadialGradient(-radius*.34,-radius*.4,2,0,0,radius);
  g.addColorStop(0,'#f8ffff');g.addColorStop(.15,'#9ed9e9');g.addColorStop(.48,'#4b9fbd');g.addColorStop(.8,'#2d708c');g.addColorStop(1,'#24566a');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#386b7d';ctx.lineWidth=2.5;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,radius*.67,-.95,.75);ctx.stroke();
  finishPart(renderer,ctx,part,selected,mode);
}

function drawSheave(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const radius=PARTS.sheave.radius??42;
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  ctx.fillStyle='#8b7860';roundedRect(ctx,-22,-radius-14,44,17,4);ctx.fill();
  ctx.strokeStyle='#66543f';ctx.lineWidth=2;ctx.stroke();
  const rim=ctx.createRadialGradient(-9,-11,4,0,0,radius);
  rim.addColorStop(0,'#f3f3ef');rim.addColorStop(.38,'#b8c0bf');rim.addColorStop(.7,'#7b8789');rim.addColorStop(1,'#566267');
  ctx.fillStyle=rim;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#59666a';ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle='#6d797c';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,radius-8,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#e5e2d9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,radius-13,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#738083';ctx.lineWidth=4;
  for(let i=0;i<6;i+=1){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*10,Math.sin(a)*10);ctx.lineTo(Math.cos(a)*(radius-14),Math.sin(a)*(radius-14));ctx.stroke();}
  const hub=ctx.createRadialGradient(-2,-2,1,0,0,10);hub.addColorStop(0,'#f2cf8a');hub.addColorStop(.5,'#c18a45');hub.addColorStop(1,'#79572f');ctx.fillStyle=hub;ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#586267';ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();
  finishPart(renderer,ctx,part,selected,mode);
}

function drawSpring(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const spec=PARTS.spring;
  const compression=Math.max(0,Math.min(48,part.springCompression??0));
  const rearX=-spec.width/2+14;
  const plungerX=spec.width/2-15-compression;
  const coilStart=rearX+16;
  const coilEnd=plungerX-16;
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  const base=ctx.createLinearGradient(rearX-12,0,rearX+12,0);base.addColorStop(0,'#596468');base.addColorStop(.45,'#b8c0bf');base.addColorStop(1,'#535e62');ctx.fillStyle=base;roundedRect(ctx,rearX-12,-spec.height*.42,24,spec.height*.84,5);ctx.fill();ctx.strokeStyle='#526064';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='#7d888a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(coilStart-4,0);ctx.lineTo(plungerX,0);ctx.stroke();
  const coils=8;ctx.strokeStyle='#9ca7a8';ctx.lineWidth=4.5;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(coilStart,0);
  for(let i=1;i<=coils*2;i+=1){const r=i/(coils*2);const x=coilStart+Math.max(15,coilEnd-coilStart)*r;const y=i===coils*2?0:(i%2===0?-spec.height*.25:spec.height*.25);ctx.lineTo(x,y);}ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=1;ctx.stroke();
  const head=ctx.createLinearGradient(plungerX-12,0,plungerX+12,0);head.addColorStop(0,'#a94f47');head.addColorStop(.5,'#d87868');head.addColorStop(1,'#8e403b');ctx.fillStyle=head;roundedRect(ctx,plungerX-12,-18,24,36,5);ctx.fill();ctx.strokeStyle='#82413b';ctx.lineWidth=2;ctx.stroke();
  if(mode!=='build'&&compression>3){ctx.fillStyle='rgba(255,251,242,.88)';roundedRect(ctx,-22,spec.height/2+7,44,18,7);ctx.fill();ctx.fillStyle='#8d672f';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`Δx ${Math.round(compression)}`,0,spec.height/2+16);}
  finishPart(renderer,ctx,part,selected,mode);
}

function drawMagnet(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const spec=PARTS.magnet;
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#6f93a5';ctx.setLineDash([7,8]);for(const r of [58,78,98]){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}ctx.restore();
  ctx.strokeStyle='#5c666a';ctx.lineWidth=29;ctx.lineCap='round';ctx.beginPath();ctx.arc(-3,0,Math.min(spec.width,spec.height)*.31,Math.PI*.28,Math.PI*1.72);ctx.stroke();
  const g=ctx.createLinearGradient(-spec.width/2,0,spec.width/2,0);g.addColorStop(0,'#c6625a');g.addColorStop(.47,'#ad4f4a');g.addColorStop(.53,'#5c8eaa');g.addColorStop(1,'#75a9c1');ctx.strokeStyle=g;ctx.lineWidth=21;ctx.beginPath();ctx.arc(-3,0,Math.min(spec.width,spec.height)*.31,Math.PI*.28,Math.PI*1.72);ctx.stroke();
  ctx.fillStyle='#e8e7df';roundedRect(ctx,spec.width*.16,-spec.height*.39,spec.width*.25,spec.height*.24,4);ctx.fill();roundedRect(ctx,spec.width*.16,spec.height*.15,spec.width*.25,spec.height*.24,4);ctx.fill();
  finishPart(renderer,ctx,part,selected,mode);
}

function drawButton(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const spec=PARTS.button;const active=Boolean(part.deviceActive);
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  const base=ctx.createLinearGradient(0,-spec.height/2,0,spec.height/2);base.addColorStop(0,'#d7dad6');base.addColorStop(.48,'#9da7a7');base.addColorStop(1,'#687477');ctx.fillStyle=base;roundedRect(ctx,-spec.width/2,-spec.height/2,spec.width,spec.height,6);ctx.fill();ctx.strokeStyle='#677376';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=active?'#799b6c':'#d49a47';roundedRect(ctx,-spec.width*.34,-spec.height/2-(active?4:10),spec.width*.68,15,6);ctx.fill();ctx.strokeStyle=active?'#5f8156':'#a96f2d';ctx.stroke();
  finishPart(renderer,ctx,part,selected,mode);
}

function drawLatch(renderer: RendererInternals, ctx: CanvasRenderingContext2D, part: RuntimePart, selected: boolean, mode: GameMode): void {
  const spec=PARTS.latch;const released=Boolean(part.deviceActive);
  ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);partShadow(ctx,selected);
  ctx.fillStyle='#6e797b';roundedRect(ctx,-spec.width/2,-spec.height/2,26,spec.height,5);ctx.fill();
  ctx.save();ctx.translate(-spec.width/2+21,0);ctx.rotate(released?-Math.PI*.38:0);const arm=ctx.createLinearGradient(0,-10,0,10);arm.addColorStop(0,'#d6d9d5');arm.addColorStop(.45,'#9ba5a6');arm.addColorStop(1,'#687477');ctx.fillStyle=arm;roundedRect(ctx,0,-spec.height*.38,spec.width-24,spec.height*.76,5);ctx.fill();ctx.strokeStyle='#667276';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  ctx.fillStyle=released?'#6e9878':'#d39a49';ctx.beginPath();ctx.arc(-spec.width/2+21,0,6.5,0,Math.PI*2);ctx.fill();
  finishPart(renderer,ctx,part,selected,mode);
}

function ropeSegment(ctx: CanvasRenderingContext2D,a:Point,b:Point,preview:boolean):void{
  const d=Math.hypot(b.x-a.x,b.y-a.y);const sag=preview?0:Math.min(36,d*.055);ctx.save();ctx.strokeStyle=preview?'rgba(75,139,165,.28)':'rgba(79,56,34,.19)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(a.x+2,a.y+3);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+sag,b.x+2,b.y+3);ctx.stroke();ctx.strokeStyle=preview?'#4c8eaa':'#aa7b49';ctx.lineWidth=3.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+sag,b.x,b.y);ctx.stroke();ctx.restore();
}

function radialContact(center:Point,target:Point,radius:number):Point{const dx=target.x-center.x;const dy=target.y-center.y;const length=Math.hypot(dx,dy);if(length<.001)return{x:center.x,y:center.y-radius};return{x:center.x+dx/length*radius,y:center.y+dy/length*radius};}

function drawAllRopes(ctx:CanvasRenderingContext2D,frame:RenderFrame):void{
  for(const rope of frame.snapshot.ropes){const aPart=frame.snapshot.parts.find(p=>p.id===rope.a.partId);const bPart=frame.snapshot.parts.find(p=>p.id===rope.b.partId);if(!aPart||!bPart)continue;const a=endpointWorld(aPart,rope.a);const b=endpointWorld(bPart,rope.b);if(!rope.pulleyPartId){ropeSegment(ctx,a,b,false);continue;}const sheave=frame.snapshot.parts.find(p=>p.id===rope.pulleyPartId&&p.kind==='sheave');if(!sheave){ropeSegment(ctx,a,b,false);continue;}const radius=(PARTS.sheave.radius??42)*.86;const ca=radialContact(sheave,a,radius);const cb=radialContact(sheave,b,radius);ropeSegment(ctx,a,ca,false);ropeSegment(ctx,cb,b,false);let start=Math.atan2(ca.y-sheave.y,ca.x-sheave.x);let end=Math.atan2(cb.y-sheave.y,cb.x-sheave.x);let delta=end-start;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;end=start+delta;ctx.save();ctx.strokeStyle='rgba(79,56,34,.19)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(sheave.x,sheave.y,radius,start,end,delta<0);ctx.stroke();ctx.strokeStyle='#aa7b49';ctx.lineWidth=3.2;ctx.beginPath();ctx.arc(sheave.x,sheave.y,radius,start,end,delta<0);ctx.stroke();ctx.restore();}
}

export function installFinalVisuals(): void {
  const prototype=CanvasRenderer.prototype as unknown as RendererInternals;
  if(prototype.__finalLightVisualsInstalled)return;
  prototype.__finalLightVisualsInstalled=true;
  const previousDrawPart=prototype.drawPart;
  prototype.drawPart=function finalPart(this:RendererInternals,ctx:CanvasRenderingContext2D,part:RuntimePart,selected:boolean,mode:GameMode):void{
    switch(part.kind){
      case 'domino':drawDomino(this,ctx,part,selected,mode);return;
      case 'rubberball':drawRubberBall(this,ctx,part,selected,mode);return;
      case 'sheave':drawSheave(this,ctx,part,selected,mode);return;
      case 'spring':drawSpring(this,ctx,part,selected,mode);return;
      case 'magnet':drawMagnet(this,ctx,part,selected,mode);return;
      case 'button':drawButton(this,ctx,part,selected,mode);return;
      case 'latch':drawLatch(this,ctx,part,selected,mode);return;
      default:previousDrawPart.call(this,ctx,part,selected,mode);
    }
  };
  prototype.drawRopes=function finalRopes(this:RendererInternals,ctx:CanvasRenderingContext2D,frame:RenderFrame):void{drawAllRopes(ctx,frame);};
}
