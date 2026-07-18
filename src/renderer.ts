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
    this.zoom = Math.max(0.75, Math.min(2.4, this.zoom * multiplier));
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

  render(frame: RenderFrame): void {
    this.resize();
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#cfc1ae';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const scale = this.baseScale * this.zoom;
    const offset = this.viewOffset();
    context.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * offset.x, this.dpr * offset.y);
    this.drawWorkshop(context);
    this.drawLevel(context);
    this.drawRopes(context, frame);
    for (const part of frame.snapshot.parts) this.drawPart(context, part, frame.selectedId === part.id);
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
    background.addColorStop(0, '#e5d8c7');
    background.addColorStop(0.65, '#d4c3af');
    background.addColorStop(1, '#bca68e');
    context.fillStyle = background;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    context.fillStyle = 'rgba(70,53,39,.055)';
    for (let x = 0; x <= WORLD_WIDTH; x += 50) context.fillRect(x, 0, 1.2, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += 50) context.fillRect(0, y, WORLD_WIDTH, 1.2);

    context.save();
    context.globalAlpha = 0.13;
    context.fillStyle = '#553d2a';
    for (let x = 30; x < WORLD_WIDTH; x += 260) {
      roundedRect(context, x, 92, 180, 105, 12);
      context.fill();
    }
    context.restore();

    context.fillStyle = '#3b2e25';
    context.fillRect(0, 806, WORLD_WIDTH, 94);
    const floor = context.createLinearGradient(0, 806, 0, 900);
    floor.addColorStop(0, '#5b4636');
    floor.addColorStop(1, '#271f1a');
    context.fillStyle = floor;
    context.fillRect(0, 813, WORLD_WIDTH, 87);
    context.fillStyle = 'rgba(255,255,255,.1)';
    context.fillRect(0, 813, WORLD_WIDTH, 3);

    context.fillStyle = 'rgba(78,57,40,.58)';
    context.font = '800 15px system-ui, sans-serif';
    context.fillText('ИНЖЕНЕРНЫЙ СТЕНД · СВОБОДНАЯ СБОРКА', 28, 122);
  }

  private drawLevel(context: CanvasRenderingContext2D): void {
    this.drawPlatform(context, 800, 788, 1500, 34, 0);
    this.drawPlatform(context, 275, 305, 420, 28, 0.08);
    this.drawPlatform(context, 1130, 565, 230, 24, -0.04);

    context.save();
    context.translate(1385, 625);
    context.fillStyle = 'rgba(66,124,83,.16)';
    roundedRect(context, -82, -62, 164, 116, 18);
    context.fill();
    context.strokeStyle = 'rgba(54,101,67,.78)';
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = '#486c51';
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
    context.shadowColor = 'rgba(24,18,14,.26)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 7;
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#78848c');
    gradient.addColorStop(0.42, '#4d5961');
    gradient.addColorStop(1, '#252d32');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = '#20272b';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.25)';
    context.fillRect(-width / 2 + 8, -height / 2 + 5, width - 16, 2);
    context.restore();
  }

  private drawPart(context: CanvasRenderingContext2D, part: PartState, selected: boolean): void {
    const spec = PARTS[part.kind];
    context.save();
    context.translate(part.x, part.y);
    context.rotate(part.angle);
    context.shadowColor = 'rgba(25,18,13,.34)';
    context.shadowBlur = selected ? 16 : 10;
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
    if (selected) {
      context.strokeStyle = '#ffb94e';
      context.lineWidth = 4;
      context.setLineDash([10, 7]);
      if (spec.radius) {
        context.beginPath();
        context.arc(0, 0, spec.radius + 10, 0, Math.PI * 2);
        context.stroke();
      } else {
        roundedRect(context, -spec.width / 2 - 9, -spec.height / 2 - 9, spec.width + 18, spec.height + 18, 10);
        context.stroke();
      }
      context.setLineDash([]);
    }
    context.restore();
  }

  private drawBall(context: CanvasRenderingContext2D, radius: number): void {
    const gradient = context.createRadialGradient(-radius * 0.35, -radius * 0.42, radius * 0.08, 0, 0, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.18, '#bbc7cf');
    gradient.addColorStop(0.52, '#5d6b76');
    gradient.addColorStop(0.82, '#202a31');
    gradient.addColorStop(1, '#0e1418');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#11181d';
    context.lineWidth = 4;
    context.stroke();
  }

  private drawWood(context: CanvasRenderingContext2D, width: number, height: number, lever: boolean): void {
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, lever ? '#e69a49' : '#dda05d');
    gradient.addColorStop(0.45, lever ? '#ae5f29' : '#a85c2c');
    gradient.addColorStop(1, '#5e2d14');
    context.fillStyle = '#1e2022';
    roundedRect(context, -width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 8);
    context.fill();
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 6);
    context.fill();
    context.strokeStyle = '#4b240f';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(255,224,174,.42)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-width / 2 + 14, -height / 2 + 7);
    context.lineTo(width / 2 - 14, -height / 2 + 7);
    context.stroke();
    context.fillStyle = '#252b2f';
    context.beginPath(); context.arc(-width / 2 + 18, 0, 6, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(width / 2 - 18, 0, 6, 0, Math.PI * 2); context.fill();
  }

  private drawMetalBar(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#9aa6ad');
    gradient.addColorStop(0.35, '#5e6a72');
    gradient.addColorStop(1, '#20282d');
    context.fillStyle = '#161c20';
    roundedRect(context, -width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 7);
    context.fill();
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2, width, height, 5);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,.28)';
    context.fillRect(-width / 2 + 10, -height / 2 + 5, width - 20, 2);
  }

  private drawPulley(context: CanvasRenderingContext2D, radius: number): void {
    context.fillStyle = '#151b20';
    context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill();
    const gradient = context.createRadialGradient(-8, -10, 4, 0, 0, radius - 4);
    gradient.addColorStop(0, '#aab4ba');
    gradient.addColorStop(0.45, '#66747e');
    gradient.addColorStop(1, '#29343b');
    context.fillStyle = gradient;
    context.beginPath(); context.arc(0, 0, radius - 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#172027';
    context.lineWidth = 10;
    context.beginPath(); context.arc(0, 0, radius - 15, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#ef9e3f';
    context.beginPath(); context.arc(0, 0, 9, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#342315';
    context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.fill();
  }

  private drawWeight(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, '#111619');
    gradient.addColorStop(0.35, '#7b858a');
    gradient.addColorStop(0.62, '#323a3f');
    gradient.addColorStop(1, '#0c1012');
    context.fillStyle = gradient;
    roundedRect(context, -width / 2, -height / 2 + 11, width, height - 11, 8);
    context.fill();
    context.strokeStyle = '#20282c';
    context.lineWidth = 9;
    context.beginPath(); context.arc(0, -height / 2 + 10, 13, Math.PI, 0); context.stroke();
    context.strokeStyle = 'rgba(255,255,255,.25)';
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(-width / 2 + 10, -height / 2 + 25); context.lineTo(width / 2 - 10, -height / 2 + 25); context.stroke();
  }

  private drawRopes(context: CanvasRenderingContext2D, frame: RenderFrame): void {
    for (const rope of frame.snapshot.ropes) {
      const partA = frame.snapshot.parts.find((part) => part.id === rope.a.partId);
      const partB = frame.snapshot.parts.find((part) => part.id === rope.b.partId);
      if (!partA || !partB) continue;
      const a = endpointWorld(partA, rope.a);
      const b = endpointWorld(partB, rope.b);
      this.drawRopeLine(context, a, b, false);
    }
  }

  private drawRopeLine(context: CanvasRenderingContext2D, a: Point, b: Point, preview: boolean): void {
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = preview ? 0 : Math.min(42, distance * 0.07);
    context.save();
    context.strokeStyle = preview ? '#ffc15a' : 'rgba(43,27,16,.35)';
    context.lineWidth = preview ? 7 : 9;
    context.beginPath();
    context.moveTo(a.x + 3, a.y + 4);
    context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x + 3, b.y + 4);
    context.stroke();
    context.strokeStyle = preview ? '#ffd587' : '#c99251';
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
      for (const part of frame.snapshot.parts) {
        if (part.kind === 'wall') continue;
        context.beginPath(); context.arc(part.x, part.y, 8, 0, Math.PI * 2); context.fill();
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
