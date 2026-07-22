import { GameApp } from './app';
import { CanvasRenderer } from './renderer';
import { PARTS, remaining, type GameMode, type PartKind, type PartState } from './model';

const NEW_KINDS = new Set<PartKind>(['domino', 'rubberball', 'spring', 'magnet']);

function isPartKind(value: string | undefined): value is PartKind {
  return Boolean(value && Object.prototype.hasOwnProperty.call(PARTS, value));
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safe = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + safe, y);
  context.arcTo(x + width, y, x + width, y + height, safe);
  context.arcTo(x + width, y + height, x, y + height, safe);
  context.arcTo(x, y + height, x, y, safe);
  context.arcTo(x, y, x + width, y, safe);
  context.closePath();
}

function drawDomino(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
  gradient.addColorStop(0, '#b8aa8e');
  gradient.addColorStop(.25, '#f4e8ce');
  gradient.addColorStop(.72, '#d8c9aa');
  gradient.addColorStop(1, '#8e826c');
  context.fillStyle = '#26231e';
  roundedRect(context, -width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 7);
  context.fill();
  context.fillStyle = gradient;
  roundedRect(context, -width / 2, -height / 2, width, height, 5);
  context.fill();
  context.strokeStyle = '#675d4d';
  context.lineWidth = 2;
  context.stroke();
  context.strokeStyle = 'rgba(72,61,44,.5)';
  context.beginPath();
  context.moveTo(-width / 2 + 5, 0);
  context.lineTo(width / 2 - 5, 0);
  context.stroke();
  context.fillStyle = '#34302a';
  for (const y of [-height * .27, height * .27]) {
    context.beginPath();
    context.arc(0, y, 4.2, 0, Math.PI * 2);
    context.fill();
  }
}

function drawRubberBall(context: CanvasRenderingContext2D, radius: number): void {
  const gradient = context.createRadialGradient(-radius * .35, -radius * .42, 2, 0, 0, radius);
  gradient.addColorStop(0, '#e9fbff');
  gradient.addColorStop(.14, '#8ee8ff');
  gradient.addColorStop(.5, '#25a9e7');
  gradient.addColorStop(.82, '#0874b8');
  gradient.addColorStop(1, '#034674');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#062e49';
  context.lineWidth = 4;
  context.stroke();
  context.strokeStyle = 'rgba(255,255,255,.62)';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, radius * .68, -.85, .78);
  context.stroke();
  context.strokeStyle = '#ffdc63';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 0, radius * .72, 2.28, 3.92);
  context.stroke();
}

function drawSpring(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = '#20272d';
  roundedRect(context, -width / 2, -height / 2, width, height, 8);
  context.fill();
  context.strokeStyle = '#0b1014';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = '#6d7981';
  roundedRect(context, -width / 2 + 5, -height / 2 + 5, 22, height - 10, 4);
  context.fill();
  context.fillStyle = '#f2bd4f';
  roundedRect(context, width / 2 - 23, -height / 2 + 4, 18, height - 8, 4);
  context.fill();
  context.strokeStyle = '#47320b';
  context.lineWidth = 2;
  context.stroke();

  const startX = -width / 2 + 29;
  const endX = width / 2 - 27;
  const coils = 7;
  context.strokeStyle = '#d5dde1';
  context.lineWidth = 5;
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(startX, 0);
  for (let index = 0; index <= coils * 2; index += 1) {
    const ratio = index / (coils * 2);
    const x = startX + (endX - startX) * ratio;
    const y = index === coils * 2 ? 0 : (index % 2 === 0 ? -height * .27 : height * .27);
    context.lineTo(x, y);
  }
  context.stroke();
  context.strokeStyle = 'rgba(255,255,255,.55)';
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = '#ffd66f';
  context.beginPath();
  context.moveTo(width / 2 + 13, 0);
  context.lineTo(width / 2 - 1, -10);
  context.lineTo(width / 2 - 1, 10);
  context.closePath();
  context.fill();
}

function drawMagnet(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.globalAlpha = .28;
  context.strokeStyle = '#ff7480';
  context.setLineDash([8, 8]);
  for (const radius of [58, 78, 98]) {
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();

  context.strokeStyle = '#1c232a';
  context.lineWidth = 30;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(-3, 0, Math.min(width, height) * .31, Math.PI * .28, Math.PI * 1.72);
  context.stroke();

  const gradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
  gradient.addColorStop(0, '#e54f5a');
  gradient.addColorStop(.48, '#bb303d');
  gradient.addColorStop(.52, '#407fc4');
  gradient.addColorStop(1, '#6aafe9');
  context.strokeStyle = gradient;
  context.lineWidth = 22;
  context.beginPath();
  context.arc(-3, 0, Math.min(width, height) * .31, Math.PI * .28, Math.PI * 1.72);
  context.stroke();

  context.fillStyle = '#f2f4f5';
  roundedRect(context, width * .16, -height * .39, width * .25, height * .24, 4);
  context.fill();
  roundedRect(context, width * .16, height * .15, width * .25, height * .24, 4);
  context.fill();
  context.strokeStyle = '#59636a';
  context.lineWidth = 2;
  context.stroke();
}

function drawExtendedPart(
  renderer: Record<string, any>,
  context: CanvasRenderingContext2D,
  part: PartState,
  selected: boolean,
  mode: GameMode
): void {
  const spec = PARTS[part.kind];
  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.48)';
  context.shadowBlur = selected ? 18 : 11;
  context.shadowOffsetY = 7;

  if (part.kind === 'domino') drawDomino(context, spec.width, spec.height);
  if (part.kind === 'rubberball') drawRubberBall(context, spec.radius ?? 31);
  if (part.kind === 'spring') drawSpring(context, spec.width, spec.height);
  if (part.kind === 'magnet') drawMagnet(context, spec.width, spec.height);

  context.shadowColor = 'transparent';
  if (part.fixed && !part.locked) renderer.drawFixedBolts(context, part);
  if (part.locked) renderer.drawLevelBadge(context, part);
  context.restore();

  if (selected && mode === 'build') renderer.drawSelection(context, part);
}

export function installExtendedParts(): void {
  const appPrototype = GameApp.prototype as unknown as Record<string, any>;
  if (appPrototype.__extendedPartsInstalled) return;
  appPrototype.__extendedPartsInstalled = true;

  appPrototype.bindPalette = function bindPalette(this: Record<string, any>): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      button.addEventListener('pointerdown', (event: PointerEvent) => {
        if (event.button !== 0 || this.mode !== 'build' || button.disabled) return;
        const kind = button.dataset.kind;
        if (!isPartKind(kind)) return;
        event.preventDefault();
        const ghost = document.createElement('div');
        ghost.className = `palette-ghost ghost-${kind}`;
        ghost.textContent = PARTS[kind].label;
        document.body.appendChild(ghost);
        button.classList.add('dragging');
        button.setPointerCapture?.(event.pointerId);
        this.paletteDrag = { pointerId: event.pointerId, kind, ghost, button };
        this.movePaletteGhost(event.clientX, event.clientY);
      });
    }

    window.addEventListener('pointermove', (event: PointerEvent) => {
      if (this.paletteDrag?.pointerId !== event.pointerId) return;
      event.preventDefault();
      this.movePaletteGhost(event.clientX, event.clientY);
    }, { passive: false });

    window.addEventListener('pointerup', (event: PointerEvent) => {
      if (this.paletteDrag?.pointerId === event.pointerId) this.finishPaletteDrag(event.clientX, event.clientY);
    });
    window.addEventListener('pointercancel', (event: PointerEvent) => {
      if (this.paletteDrag?.pointerId === event.pointerId) this.finishPaletteDrag(-1000, -1000);
    });
  };

  const originalUpdateUi = appPrototype.updateUi;
  appPrototype.updateUi = function updateUi(this: Record<string, any>): void {
    originalUpdateUi.call(this);
    const build = this.mode === 'build';
    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      const kind = button.dataset.kind;
      if (!isPartKind(kind) || !NEW_KINDS.has(kind)) continue;
      const count = remaining(this.snapshot, kind);
      button.disabled = !build || count <= 0;
      const counter = button.querySelector<HTMLElement>('[data-count]');
      if (counter) counter.textContent = `×${count}`;
    }
  };

  const rendererPrototype = CanvasRenderer.prototype as unknown as Record<string, any>;
  const originalDrawPart = rendererPrototype.drawPart;
  rendererPrototype.drawPart = function drawPart(
    this: Record<string, any>,
    context: CanvasRenderingContext2D,
    part: PartState,
    selected: boolean,
    mode: GameMode
  ): void {
    if (!NEW_KINDS.has(part.kind)) {
      originalDrawPart.call(this, context, part, selected, mode);
      return;
    }
    drawExtendedPart(this, context, part, selected, mode);
  };
}
