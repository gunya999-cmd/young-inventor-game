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
    context.fillStyle = '#0b1118';
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
    const background = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    background.addColorStop(0, '#1a2b3b');
    background.addColorStop(0.62, '#152433');
    background.addColorStop(1, '#101b26');
    context.fillStyle = background;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    context.fillStyle = 'rgba(108,151,184,.12)';
    for (let x = 0; x <= WORLD_WIDTH; x += 25) context.fillRect(x, 0, 1, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += 25) context.fillRect(0, y, WORLD_WIDTH, 1);
    context.fillStyle = 'rgba(125,172,207,.19)';
    for (let x = 0; x <= WORLD_WIDTH; x += 100) context.fillRect(x, 0, 1.5, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += 100) context.fillRect(0, y, WORLD_WIDTH, 1.5);

    context.strokeStyle = 'rgba(133,180,215,.28)';
    context.lineWidth = 2;
    context.strokeRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36);

    context.fillStyle = 'rgba(172,203,225,.68)';
    context.font = '800 15px system-ui, sans-serif';
    context.fillText('ИСПЫТАТЕЛЬНЫЙ СТЕНД 01', 36, 52);
    context.fillStyle = 'rgba(133,167,193,.55)';
    context.font = '700 11px system-ui, sans-serif';
    context.fillText('СВОБОДНАЯ СБОРКА · ГРАВИТАЦИЯ 9.8 м/с²', 36, 72);

    context.save();
    context.strokeStyle = 'rgba(112,192,137,.24)';
    context.setLineDash([12, 10]);
    context.lineWidth = 3;
    roundedRect(context, 1265, 505, 250, 245, 20);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = 'rgba(112,192,137,.7)';
    context.font = '800 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('ЦЕЛЕВАЯ ЗОНА', 1390, 490);
    context.restore();
  }

  private drawLevel(context: CanvasRenderingContext2D): void {
    this.drawPlatform(context, 800, 788, 1500, 34, 0);
    this.drawPlatform(context, 275, 305, 420, 28, 0.08);
    this.drawPlatform(context, 1130, 565, 230, 24, -0.04);

    context.save();
    context.translate(1385, 625);
    const glow = context.createLinearGradient(0, -70, 0, 65);
    glow.addColorStop(0, 'rgba(103,184,126,.08)');
    glow.addColorStop(1, 'rgba(103,184,126,.2)');
    context.fillStyle = glow;
    roundedRect(context, -82, -62, 164, 116, 14);
    context.fill();
    context.strokeStyle = '#70b884';
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = '#8bc99d';
    context.font = '900 16px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('КОРЗИНА', 0, 82);
    context.restore();

    this.drawPlatform(context, 1385, 687, 190, 22, 0);
    this.drawPlatform(context, 1298, 622, 22, 145, 0);
    this.drawPlatform(context, 1472, 622, 22, 145, 0);
  }

  private drawPlatform(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, angle: number): void {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.shadowColor = 'rgba(0,0,0,.42)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 6;
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#9ba8b1');
    gradient.addColorStop(0.35, '#5d6b75');
    gradient.addColorStop(1, '#263139');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = '#111a21';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.3)';
    context.fillRect(-width / 2 + 8, -height / 2 + 5, width - 16, 2);
    context.restore();
  }

  private drawPart(context: CanvasRenderingContext2D, part: PartState, selected: boolean, mode: GameMode): void {
    const spec = PARTS[part.kind];
    context.save();
    context.translate(part.x, part.y);
    context.rotate(part.angle);
    context.shadowColor = 'rgba(0,0,0,.46)';
    context.shadowBlur = selected ? 18 : 10;
    context.shadowOffsetY = 7;

    switch (part.kind) {
      case 'ball': this.drawBall(context, spec.radius ?? 28); break;
      case 'plank': this.drawWood(context, spec.width, spec.height, false); break;
      case 'lever': this.drawWood(context, spec.width, spec.height, true); break;
      case 'wall': this.drawMetalBar(context, spec.width, spec.height); break;
      case 'pulley': this.drawPulley(context, spec.radius ?? 38); break;
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
    context.strokeStyle = '#ffc15b';
    context.lineWidth = 3;
    context.setLineDash([9, 6]);
    if (spec.radius) {
      context.beginPath();
      context.arc(0, 0, spec.radius + 12, 0, Math.PI * 2);
      context.stroke();
    } else {
      roundedRect(context, -spec.width / 2 - 10, -spec.height / 2 - 10, spec.width + 20, spec.height + 20, 8);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#ffc15b';
      for (const x of [-spec.width / 2 - 10, spec.width / 2 + 10]) {
        for (const y of [-spec.height / 2 - 10, spec.height / 2 + 10]) context.fillRect(x - 5, y - 5, 10, 10);
      }
    }
    context.setLineDash([]);

    if (rotatable(part)) {
      const handleY = -(spec.height / 2 + 58);
      context.strokeStyle = '#ffc15b';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -spec.height / 2 - 10);
      context.lineTo(0, handleY + 10);
      context.stroke();
      context.fillStyle = '#17212b';
      context.beginPath();
      context.arc(0, handleY, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffc15b';
      context.lineWidth = 4;
      context.stroke();
      context.fillStyle = '#ffc15b';
      context.font = '900 15px system-ui, sans-serif';
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
      context.fillStyle = '#d8a24f';
      context.beginPath();
      context.arc(point.x, point.y, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#352414';
      context.lineWidth = 2;
      context.stroke();
      context.strokeStyle = '#5b3b18';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(point.x - 3, point.y);
      context.lineTo(point.x + 3, point.y);
      context.stroke();
    }
  }

  private drawLevelBadge(context: CanvasRenderingContext2D, part: PartState): void {
    const spec = PARTS[part.kind];
    context.save();
    context.rotate(-part.angle);
    context.translate(spec.radius ? spec.radius + 8 : spec.width / 2 + 8, -(spec.radius ?? spec.height / 2) - 8);
    context.fillStyle = '#8bbad8';
    roundedRect(context, -25, -10, 50, 20, 5);
    context.fill();
    context.fillStyle = '#132737';
    context.font = '900 9px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('LEVEL', 0, 0);
    context.restore();
  }

  private drawBall(context: CanvasRenderingContext2D, radius: number): void {
    const gradient = context.createRadialGradient(-radius * .35, -radius * .42, radius * .08, 0, 0, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(.18, '#c4d0d8');
    gradient.addColorStop(.52, '#62727e');
    gradient.addColorStop(.82, '#222d35');
    gradient.addColorStop(1, '#0c1217');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0a1116';
    context.lineWidth = 4;
    context.stroke();
  }

  private drawWood(context: CanvasRenderingContext2D, width: number, height: number, lever: boolean): void {
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, lever ? '#efa34f' : '#e5aa66');
    gradient.addColorStop(.45, lever ? '#b9652d' : '#ad6332');
    gradient.addColorStop(1, '#5e2d14');
    context.fillStyle = '#191d20';
    roundedRect(context, -width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 7);
    context.fill();
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.strokeStyle = '#4b240f';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(255,225,180,.45)';
    context.beginPath();
    context.moveTo(-width / 2 + 14, -height / 2 + 7);
    context.lineTo(width / 2 - 14, -height / 2 + 7);
    context.stroke();
  }

  private drawMetalBar(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#a7b2ba');
    gradient.addColorStop(.35, '#65727b');
    gradient.addColorStop(1, '#222b31');
    context.fillStyle = '#11181d';
    roundedRect(context, -width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 6);
    context.fill();
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 4);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,.3)';
    context.fillRect(-width / 2 + 10, -height / 2 + 5, width - 20, 2);
  }

  private drawPulley(context: CanvasRenderingContext2D, radius: number): void {
    context.fillStyle = '#11181e';
    context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill();
    const gradient = context.createRadialGradient(-8, -10, 4, 0, 0, radius - 4);
    gradient.addColorStop(0, '#b9c4ca');
    gradient.addColorStop(.45, '#6e7d87');
    gradient.addColorStop(1, '#2b3740');
    context.fillStyle = gradient;
    context.beginPath(); context.arc(0, 0, radius - 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#152029';
    context.lineWidth = 10;
    context.beginPath(); context.arc(0, 0, radius - 15, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#f0a246';
    context.beginPath(); context.arc(0, 0, 9, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#332315';
    context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.fill();
  }

  private drawWeight(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, '#0e1418');
    gradient.addColorStop(.35, '#8c969b');
    gradient.addColorStop(.62, '#384148');
    gradient.addColorStop(1, '#090d10');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2 + 11, width, height - 11, 7);
    context.fill();
    context.strokeStyle = '#20292e';
    context.lineWidth = 9;
    context.beginPath(); context.arc(0, -height / 2 + 10, 13, Math.PI, 0); context.stroke();
    context.strokeStyle = 'rgba(255,255,255,.27)';
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(-width / 2 + 10, -height / 2 + 25); context.lineTo(width / 2 - 10, -height / 2 + 25); context.stroke();
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
    const sag = preview ? 0 : Math.min(42, ropeDistance * .07);
    context.save();
    context.strokeStyle = preview ? 'rgba(255,193,90,.35)' : 'rgba(0,0,0,.42)';
    context.lineWidth = preview ? 8 : 9;
    context.beginPath();
    context.moveTo(a.x + 3, a.y + 4);
    context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x + 3, b.y + 4);
    context.stroke();
    context.strokeStyle = preview ? '#ffc15a' : '#d29b59';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
    context.stroke();
    context.restore();
  }

  private drawHinges(context: CanvasRenderingContext2D, hinges: HingeState[], parts: PartState[], selectedId: string | null): void {
    for (const hinge of hinges) {
      const part = parts.find((candidate) => candidate.id === hinge.partId);
      if (!part) continue;
      const point = localToWorld(part, { x: hinge.localX, y: hinge.localY });
      const selected = selectedId === hinge.partId;
      context.fillStyle = selected ? '#ffc15b' : '#d88a38';
      context.beginPath(); context.arc(point.x, point.y, selected ? 12 : 9, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#302016';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#31383c';
      context.beginPath(); context.arc(point.x, point.y, selected ? 5 : 4, 0, Math.PI * 2); context.fill();
    }
  }

  private drawToolPreview(context: CanvasRenderingContext2D, frame: RenderFrame): void {
    if (frame.ropeTool) {
      context.fillStyle = '#ffc15b';
      context.strokeStyle = '#2b1b0d';
      context.lineWidth = 2;
      for (const part of frame.snapshot.parts) {
        if (part.kind === 'wall') continue;
        context.beginPath(); context.arc(part.x, part.y, 8, 0, Math.PI * 2); context.fill(); context.stroke();
      }
    }
    if (frame.ropeStart && frame.pointerWorld) {
      const part = frame.snapshot.parts.find((candidate) => candidate.id === frame.ropeStart?.partId);
      if (part) this.drawRopeLine(context, endpointWorld(part, frame.ropeStart), frame.pointerWorld, true);
    }
    if (frame.hingeTool && frame.pointerWorld) {
      context.strokeStyle = '#ffc15b';
      context.lineWidth = 3;
      context.beginPath(); context.arc(frame.pointerWorld.x, frame.pointerWorld.y, 13, 0, Math.PI * 2); context.stroke();
      context.beginPath(); context.moveTo(frame.pointerWorld.x - 18, frame.pointerWorld.y); context.lineTo(frame.pointerWorld.x + 18, frame.pointerWorld.y); context.stroke();
      context.beginPath(); context.moveTo(frame.pointerWorld.x, frame.pointerWorld.y - 18); context.lineTo(frame.pointerWorld.x, frame.pointerWorld.y + 18); context.stroke();
    }
  }
}
