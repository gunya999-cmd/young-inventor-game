import {
  PARTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  localToWorld,
  type GameMode,
  type HingeState,
  type MachineSnapshot,
  type PartState,
  type Point
} from './model';
import { endpointWorld } from './physics';

export interface RenderFrame {
  snapshot: MachineSnapshot;
  selectedId: string | null;
  mode: GameMode;
  ropeStart: { partId: string; localX: number; localY: number } | null;
  pointerWorld: Point | null;
  hingeTool: boolean;
  ropeTool: boolean;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function rotatable(part: PartState): boolean {
  return !part.locked && part.kind !== 'ball' && part.kind !== 'pulley';
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private dpr = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private baseScale = 1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('Canvas 2D недоступен в этом браузере.');
    this.context = context;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.round(this.cssWidth * this.dpr);
    const pixelHeight = Math.round(this.cssHeight * this.dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.baseScale = Math.min(this.cssWidth / WORLD_WIDTH, this.cssHeight / WORLD_HEIGHT);
  }

  resetCamera(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  panBy(screenX: number, screenY: number): void {
    this.panX += screenX;
    this.panY += screenY;
  }

  zoomAt(multiplier: number, clientX: number, clientY: number): void {
    const before = this.screenToWorld(clientX, clientY);
    this.zoom = Math.max(0.75, Math.min(2.6, this.zoom * multiplier));
    const after = this.screenToWorld(clientX, clientY);
    const scale = this.baseScale * this.zoom;
    this.panX += (after.x - before.x) * scale;
    this.panY += (after.y - before.y) * scale;
  }

  screenToWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.baseScale * this.zoom;
    const offset = this.viewOffset();
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale
    };
  }

  worldToScreen(point: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.baseScale * this.zoom;
    const offset = this.viewOffset();
    return {
      x: rect.left + offset.x + point.x * scale,
      y: rect.top + offset.y + point.y * scale
    };
  }

  rotationHandle(part: PartState): Point {
    const spec = PARTS[part.kind];
    const distance = (spec.radius ?? spec.height / 2) + 58;
    return localToWorld(part, { x: 0, y: -distance });
  }

  render(frame: RenderFrame): void {
    this.resize();
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#e9e2d5';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const scale = this.baseScale * this.zoom;
    const offset = this.viewOffset();
    context.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * offset.x, this.dpr * offset.y);
    this.drawWorkshop(context);
    this.drawLevel(context);
    this.drawRopes(context, frame);
    for (const part of frame.snapshot.parts) this.drawPart(context, part, frame.selectedId === part.id, frame.mode);
    this.drawHinges(context, frame.snapshot.hinges, frame.snapshot.parts, frame.selectedId);
    this.drawToolPreview(context, frame);
  }

  private viewOffset(): Point {
    const scale = this.baseScale * this.zoom;
    return {
      x: (this.cssWidth - WORLD_WIDTH * scale) / 2 + this.panX,
      y: (this.cssHeight - WORLD_HEIGHT * scale) / 2 + this.panY
    };
  }

  private drawWorkshop(context: CanvasRenderingContext2D): void {
    const board = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    board.addColorStop(0, '#f8f4e9');
    board.addColorStop(.5, '#f2eddf');
    board.addColorStop(1, '#ece5d6');
    context.fillStyle = board;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Subtle engineering grid: useful for construction, deliberately secondary to the mechanism.
    context.save();
    context.strokeStyle = 'rgba(116,119,111,.075)';
    context.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 25) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, WORLD_HEIGHT); context.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 25) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(WORLD_WIDTH, y); context.stroke();
    }
    context.strokeStyle = 'rgba(116,105,87,.105)';
    context.lineWidth = 1.4;
    for (let x = 0; x <= WORLD_WIDTH; x += 100) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, WORLD_HEIGHT); context.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(WORLD_WIDTH, y); context.stroke();
    }
    context.restore();

    // Pegboard holes make the surface feel like a physical laboratory fixture rather than CAD software.
    context.fillStyle = 'rgba(118,105,85,.16)';
    for (let y = 37; y < WORLD_HEIGHT; y += 50) {
      for (let x = 37; x < WORLD_WIDTH; x += 50) {
        context.beginPath(); context.arc(x, y, 2.25, 0, Math.PI * 2); context.fill();
      }
    }

    context.strokeStyle = 'rgba(112,92,65,.22)';
    context.lineWidth = 2;
    roundedRect(context, 14, 14, WORLD_WIDTH - 28, WORLD_HEIGHT - 28, 16);
    context.stroke();

    context.fillStyle = 'rgba(91,88,80,.56)';
    context.font = '800 13px system-ui, sans-serif';
    context.fillText('МОНТАЖНАЯ ПАНЕЛЬ · МЕХАНИКА', 32, 45);
    context.fillStyle = 'rgba(124,116,104,.46)';
    context.font = '700 10px system-ui, sans-serif';
    context.fillText('g = 9.81 м/с² · фиксированный шаг 120 Hz', 32, 63);

    context.save();
    context.strokeStyle = 'rgba(83,137,99,.24)';
    context.setLineDash([9, 8]);
    context.lineWidth = 2;
    roundedRect(context, 1266, 504, 248, 246, 18);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = 'rgba(73,126,89,.65)';
    context.font = '800 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('ПРИЁМНАЯ ЗОНА', 1390, 488);
    context.restore();
  }

  private drawLevel(context: CanvasRenderingContext2D): void {
    this.drawPlatform(context, 800, 788, 1500, 34, 0);
    this.drawPlatform(context, 275, 305, 420, 28, 0.08);
    this.drawPlatform(context, 1130, 565, 230, 24, -0.04);

    context.save();
    context.translate(1385, 625);
    context.shadowColor = 'rgba(59,93,67,.13)';
    context.shadowBlur = 20;
    context.shadowOffsetY = 7;
    context.fillStyle = 'rgba(201,224,204,.52)';
    roundedRect(context, -82, -62, 164, 116, 13);
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = '#668b70';
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = '#55735d';
    context.font = '850 13px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('ПРИЁМНИК', 0, 82);
    context.restore();

    this.drawPlatform(context, 1385, 687, 190, 22, 0);
    this.drawPlatform(context, 1298, 622, 22, 145, 0);
    this.drawPlatform(context, 1472, 622, 22, 145, 0);
  }

  private drawPlatform(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, angle: number): void {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.shadowColor = 'rgba(75,68,57,.18)';
    context.shadowBlur = 9;
    context.shadowOffsetY = 5;
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#e2e3df');
    gradient.addColorStop(.22, '#aeb6b6');
    gradient.addColorStop(.58, '#798486');
    gradient.addColorStop(1, '#596366');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = '#515c60';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.58)';
    context.fillRect(-width / 2 + 8, -height / 2 + 4, width - 16, 2);
    context.restore();
  }

  private drawPart(context: CanvasRenderingContext2D, part: PartState, selected: boolean, mode: GameMode): void {
    const spec = PARTS[part.kind];
    context.save();
    context.translate(part.x, part.y);
    context.rotate(part.angle);
    context.shadowColor = 'rgba(64,55,44,.22)';
    context.shadowBlur = selected ? 17 : 9;
    context.shadowOffsetY = 6;

    switch (part.kind) {
      case 'ball': this.drawBall(context, spec.radius ?? 28); break;
      case 'plank': this.drawGuide(context, spec.width, spec.height); break;
      case 'lever': this.drawLever(context, spec.width, spec.height); break;
      case 'wall': this.drawBumper(context, spec.width, spec.height); break;
      case 'pulley': this.drawFan(context, spec.radius ?? 38); break;
      case 'weight': this.drawWeight(context, spec.width, spec.height); break;
    }

    context.shadowColor = 'transparent';
    if (part.fixed && !part.locked) this.drawFixedBolts(context, part);
    if (part.locked) this.drawLevelBadge(context, part);
    context.restore();

    if (selected && mode === 'build') this.drawSelection(context, part);
  }

  private drawSelection(context: CanvasRenderingContext2D, part: PartState): void {
    const spec = PARTS[part.kind];
    context.save();
    context.translate(part.x, part.y);
    context.rotate(part.angle);
    context.strokeStyle = '#4c8eaa';
    context.lineWidth = 3;
    context.setLineDash([8, 6]);
    if (spec.radius) {
      context.beginPath();
      context.arc(0, 0, spec.radius + 11, 0, Math.PI * 2);
      context.stroke();
    } else {
      roundedRect(context, -spec.width / 2 - 9, -spec.height / 2 - 9, spec.width + 18, spec.height + 18, 8);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#4c8eaa';
      for (const x of [-spec.width / 2 - 9, spec.width / 2 + 9]) {
        for (const y of [-spec.height / 2 - 9, spec.height / 2 + 9]) context.fillRect(x - 4, y - 4, 8, 8);
      }
    }
    context.setLineDash([]);

    if (rotatable(part)) {
      const handleY = -(spec.height / 2 + 55);
      context.strokeStyle = '#4c8eaa';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -spec.height / 2 - 9);
      context.lineTo(0, handleY + 9);
      context.stroke();
      context.fillStyle = '#f8f4ea';
      context.beginPath(); context.arc(0, handleY, 12, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#4c8eaa';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#4c8eaa';
      context.font = '900 14px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('↻', 0, handleY + 1);
    }
    context.restore();
  }

  private drawFixedBolts(context: CanvasRenderingContext2D, part: PartState): void {
    const spec = PARTS[part.kind];
    const points = spec.radius ? [{ x: 0, y: 0 }] : [{ x: -spec.width * .32, y: 0 }, { x: spec.width * .32, y: 0 }];
    for (const point of points) {
      const gradient = context.createRadialGradient(point.x - 2, point.y - 2, 1, point.x, point.y, 7);
      gradient.addColorStop(0, '#f8dfac');
      gradient.addColorStop(.45, '#c5914b');
      gradient.addColorStop(1, '#79552b');
      context.fillStyle = gradient;
      context.beginPath(); context.arc(point.x, point.y, 6.5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#765128';
      context.lineWidth = 1.5;
      context.stroke();
      context.beginPath(); context.moveTo(point.x - 3, point.y); context.lineTo(point.x + 3, point.y); context.stroke();
    }
  }

  private drawLevelBadge(context: CanvasRenderingContext2D, part: PartState): void {
    const spec = PARTS[part.kind];
    context.save();
    context.rotate(-part.angle);
    context.translate(spec.radius ? spec.radius + 8 : spec.width / 2 + 8, -(spec.radius ?? spec.height / 2) - 8);
    context.fillStyle = '#dcebf0';
    roundedRect(context, -22, -9, 44, 18, 6);
    context.fill();
    context.strokeStyle = '#8cabb8';
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = '#496b79';
    context.font = '850 8px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('ДАНО', 0, 0);
    context.restore();
  }

  private drawBall(context: CanvasRenderingContext2D, radius: number): void {
    const gradient = context.createRadialGradient(-radius * .34, -radius * .4, radius * .05, 0, 0, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(.14, '#d8dde0');
    gradient.addColorStop(.42, '#90999d');
    gradient.addColorStop(.72, '#515b60');
    gradient.addColorStop(1, '#283035');
    context.fillStyle = gradient;
    context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#424b50';
    context.lineWidth = 2.5;
    context.stroke();
    context.strokeStyle = 'rgba(255,255,255,.36)';
    context.lineWidth = 1.5;
    context.beginPath(); context.arc(-5, -6, radius * .62, 3.6, 5.2); context.stroke();
  }

  private drawGuide(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#e9e9e4');
    gradient.addColorStop(.25, '#b7c0c0');
    gradient.addColorStop(.6, '#7e8a8c');
    gradient.addColorStop(1, '#596467');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.strokeStyle = '#5e696c';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(255,255,255,.65)';
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(-width / 2 + 10, -height / 2 + 5); context.lineTo(width / 2 - 10, -height / 2 + 5); context.stroke();
    context.strokeStyle = 'rgba(54,65,68,.33)';
    context.lineWidth = 1;
    context.beginPath(); context.moveTo(-width / 2 + 12, height / 2 - 5); context.lineTo(width / 2 - 12, height / 2 - 5); context.stroke();
  }

  private drawLever(context: CanvasRenderingContext2D, width: number, height: number): void {
    const wood = context.createLinearGradient(0, -height / 2, 0, height / 2);
    wood.addColorStop(0, '#e2b77f');
    wood.addColorStop(.42, '#bd7d45');
    wood.addColorStop(1, '#86502b');
    context.fillStyle = wood;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.strokeStyle = '#754623';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(255,232,196,.56)';
    context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(-width/2+14,-height/2+6); context.bezierCurveTo(-40,-height/2+2,40,-height/2+9,width/2-14,-height/2+5); context.stroke();
    context.strokeStyle = 'rgba(86,48,22,.25)';
    context.beginPath(); context.moveTo(-width/2+18,4); context.bezierCurveTo(-50,0,60,8,width/2-18,2); context.stroke();
  }

  private drawBumper(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.fillStyle = '#636e72';
    roundedRect(context, -width/2-4,-height/2-4,width+8,height+8,7); context.fill();
    const rubber = context.createLinearGradient(0,-height/2,0,height/2);
    rubber.addColorStop(0,'#d87c6f');
    rubber.addColorStop(.48,'#b7554d');
    rubber.addColorStop(1,'#873f3c');
    context.fillStyle = rubber;
    roundedRect(context,-width/2,-height/2,width,height,6); context.fill();
    context.strokeStyle='#743735'; context.lineWidth=2; context.stroke();
    context.strokeStyle='rgba(255,220,210,.45)'; context.lineWidth=2;
    context.beginPath(); context.moveTo(-width/2+10,-height/2+6); context.lineTo(width/2-10,-height/2+6); context.stroke();
  }

  private drawFan(context: CanvasRenderingContext2D, radius: number): void {
    const shell = context.createRadialGradient(-9,-10,3,0,0,radius);
    shell.addColorStop(0,'#e5e7e4'); shell.addColorStop(.45,'#9ca7a8'); shell.addColorStop(1,'#59666a');
    context.fillStyle=shell; context.beginPath(); context.arc(0,0,radius,0,Math.PI*2); context.fill();
    context.strokeStyle='#596569'; context.lineWidth=3; context.stroke();
    context.fillStyle='#506067';
    for(let i=0;i<6;i+=1){context.save();context.rotate(i*Math.PI/3);context.beginPath();context.moveTo(5,0);context.quadraticCurveTo(radius*.48,-12,radius*.68,0);context.quadraticCurveTo(radius*.45,11,5,0);context.fill();context.restore();}
    context.fillStyle='#d39a4d'; context.beginPath();context.arc(0,0,8,0,Math.PI*2);context.fill();
    context.fillStyle='#5c5143'; context.beginPath();context.arc(0,0,3,0,Math.PI*2);context.fill();
  }

  private drawWeight(context: CanvasRenderingContext2D, width: number, height: number): void {
    const crate = context.createLinearGradient(-width/2,0,width/2,0);
    crate.addColorStop(0,'#76502f'); crate.addColorStop(.25,'#bd8650'); crate.addColorStop(.55,'#9a663a'); crate.addColorStop(1,'#674329');
    context.fillStyle=crate;
    roundedRect(context,-width/2,-height/2+8,width,height-8,6); context.fill();
    context.strokeStyle='#654125'; context.lineWidth=2.5; context.stroke();
    context.strokeStyle='rgba(75,46,25,.38)'; context.lineWidth=5;
    context.beginPath();context.moveTo(-width/2+8,-height/2+16);context.lineTo(width/2-8,height/2-7);context.stroke();
    context.beginPath();context.moveTo(width/2-8,-height/2+16);context.lineTo(-width/2+8,height/2-7);context.stroke();
    context.strokeStyle='#657175'; context.lineWidth=7; context.beginPath();context.arc(0,-height/2+8,13,Math.PI,0);context.stroke();
    context.strokeStyle='rgba(255,255,255,.45)';context.lineWidth=1.5;context.beginPath();context.arc(-2,-height/2+7,10,3.5,5.9);context.stroke();
  }

  private drawRopes(context: CanvasRenderingContext2D, frame: RenderFrame): void {
    for (const rope of frame.snapshot.ropes) {
      const partA = frame.snapshot.parts.find((part) => part.id === rope.a.partId);
      const partB = frame.snapshot.parts.find((part) => part.id === rope.b.partId);
      if (!partA || !partB) continue;
      this.drawRopeLine(context, endpointWorld(partA, rope.a), endpointWorld(partB, rope.b), false);
    }
  }

  private drawRopeLine(context: CanvasRenderingContext2D, a: Point, b: Point, preview: boolean): void {
    const ropeDistance = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = preview ? 0 : Math.min(38, ropeDistance * .06);
    context.save();
    context.strokeStyle = preview ? 'rgba(65,133,160,.25)' : 'rgba(84,58,33,.22)';
    context.lineWidth = preview ? 7 : 7;
    context.beginPath(); context.moveTo(a.x+2,a.y+3); context.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+sag,b.x+2,b.y+3); context.stroke();
    context.strokeStyle = preview ? '#4c8eaa' : '#aa7b49';
    context.lineWidth = 3.3;
    context.beginPath(); context.moveTo(a.x,a.y); context.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+sag,b.x,b.y); context.stroke();
    context.strokeStyle = preview ? 'rgba(255,255,255,.45)' : 'rgba(238,207,162,.55)';
    context.lineWidth = 1;
    context.beginPath(); context.moveTo(a.x,a.y-1); context.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+sag-1,b.x,b.y-1); context.stroke();
    context.restore();
  }

  private drawHinges(context: CanvasRenderingContext2D, hinges: HingeState[], parts: PartState[], selectedId: string | null): void {
    for (const hinge of hinges) {
      const part = parts.find((candidate) => candidate.id === hinge.partId);
      if (!part) continue;
      const point = localToWorld(part, { x: hinge.localX, y: hinge.localY });
      const selected = selectedId === hinge.partId;
      const gradient = context.createRadialGradient(point.x-2,point.y-2,1,point.x,point.y,selected?11:8);
      gradient.addColorStop(0,'#f6d899'); gradient.addColorStop(.5,'#c38d44'); gradient.addColorStop(1,'#76532d');
      context.fillStyle=gradient; context.beginPath(); context.arc(point.x,point.y,selected?11:8,0,Math.PI*2); context.fill();
      context.strokeStyle='#74512c'; context.lineWidth=2; context.stroke();
      context.fillStyle='#596267'; context.beginPath(); context.arc(point.x,point.y,selected?4.5:3.5,0,Math.PI*2); context.fill();
    }
  }

  private drawToolPreview(context: CanvasRenderingContext2D, frame: RenderFrame): void {
    if (frame.ropeTool) {
      context.fillStyle = '#4c8eaa';
      context.strokeStyle = '#f7f2e8';
      context.lineWidth = 2;
      for (const part of frame.snapshot.parts) {
        if (part.kind === 'wall') continue;
        context.beginPath(); context.arc(part.x,part.y,7,0,Math.PI*2); context.fill(); context.stroke();
      }
    }
    if (frame.ropeStart && frame.pointerWorld) {
      const part = frame.snapshot.parts.find((candidate) => candidate.id === frame.ropeStart?.partId);
      if (part) this.drawRopeLine(context,endpointWorld(part,frame.ropeStart),frame.pointerWorld,true);
    }
    if (frame.hingeTool && frame.pointerWorld) {
      context.strokeStyle='#4c8eaa';context.lineWidth=3;
      context.beginPath();context.arc(frame.pointerWorld.x,frame.pointerWorld.y,12,0,Math.PI*2);context.stroke();
      context.beginPath();context.moveTo(frame.pointerWorld.x-16,frame.pointerWorld.y);context.lineTo(frame.pointerWorld.x+16,frame.pointerWorld.y);context.stroke();
      context.beginPath();context.moveTo(frame.pointerWorld.x,frame.pointerWorld.y-16);context.lineTo(frame.pointerWorld.x,frame.pointerWorld.y+16);context.stroke();
    }
  }
}
