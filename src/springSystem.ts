import { GameApp } from './app';
import { CanvasRenderer } from './renderer';
import { PARTS, type GameMode, type PartState } from './model';
import { PHYSICS_CONFIG } from './engine/physicsConfig';

interface SpringRuntimePart extends PartState {
  springCompression?: number;
}

const { travelPx, plungerHalfWidthPx, plungerHalfHeightPx } = PHYSICS_CONFIG.spring;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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

function drawPhysicalSpring(
  renderer: Record<string, any>,
  context: CanvasRenderingContext2D,
  part: SpringRuntimePart,
  selected: boolean,
  mode: GameMode
): void {
  const spec = PARTS.spring;
  const compression = clamp(part.springCompression ?? 0, 0, travelPx);
  const rearX = -spec.width / 2 + 14;
  const coilStart = rearX + 15;
  const plungerX = spec.width / 2 - plungerHalfWidthPx - 3 - compression;
  const coilEnd = plungerX - plungerHalfWidthPx - 2;
  const coilLength = Math.max(16, coilEnd - coilStart);

  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.42)';
  context.shadowBlur = selected ? 16 : 9;
  context.shadowOffsetY = 6;

  const rearGradient = context.createLinearGradient(rearX - 13, 0, rearX + 13, 0);
  rearGradient.addColorStop(0, '#37434c');
  rearGradient.addColorStop(.45, '#9aa7ae');
  rearGradient.addColorStop(1, '#2b343b');
  context.fillStyle = rearGradient;
  roundedRect(context, rearX - 13, -spec.height * .43, 26, spec.height * .86, 5);
  context.fill();
  context.strokeStyle = '#172027';
  context.lineWidth = 2.5;
  context.stroke();

  context.strokeStyle = '#58636a';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(coilStart - 4, 0);
  context.lineTo(plungerX + 2, 0);
  context.stroke();
  context.strokeStyle = '#c8d0d4';
  context.lineWidth = 2;
  context.stroke();

  const coils = 8;
  context.strokeStyle = '#d9dfe2';
  context.lineWidth = 5;
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(coilStart, 0);
  for (let index = 1; index <= coils * 2; index += 1) {
    const ratio = index / (coils * 2);
    const x = coilStart + coilLength * ratio;
    const y = index === coils * 2 ? 0 : (index % 2 === 0 ? -spec.height * .27 : spec.height * .27);
    context.lineTo(x, y);
  }
  context.stroke();
  context.strokeStyle = 'rgba(255,255,255,.7)';
  context.lineWidth = 1.2;
  context.stroke();

  const plungerGradient = context.createLinearGradient(plungerX - 12, 0, plungerX + 12, 0);
  plungerGradient.addColorStop(0, '#a72e2f');
  plungerGradient.addColorStop(.5, '#ef5a45');
  plungerGradient.addColorStop(1, '#7e2025');
  context.fillStyle = plungerGradient;
  roundedRect(context, plungerX - plungerHalfWidthPx, -plungerHalfHeightPx,
    plungerHalfWidthPx * 2, plungerHalfHeightPx * 2, 5);
  context.fill();
  context.strokeStyle = '#58181b';
  context.lineWidth = 2.5;
  context.stroke();

  context.fillStyle = '#cad2d6';
  roundedRect(context, plungerX + plungerHalfWidthPx - 2, -plungerHalfHeightPx - 4, 8,
    plungerHalfHeightPx * 2 + 8, 3);
  context.fill();
  context.strokeStyle = '#4a545a';
  context.lineWidth = 2;
  context.stroke();

  context.shadowColor = 'transparent';
  if (part.fixed && !part.locked) renderer.drawFixedBolts(context, part);
  if (part.locked) renderer.drawLevelBadge(context, part);

  if (mode !== 'build' && compression > 3) {
    context.fillStyle = 'rgba(21,29,34,.82)';
    roundedRect(context, -23, spec.height / 2 + 8, 46, 20, 7);
    context.fill();
    context.fillStyle = '#f1d06a';
    context.font = '700 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`Δx ${Math.round(compression)}`, 0, spec.height / 2 + 18);
  }

  context.restore();
  if (selected && mode === 'build') renderer.drawSelection(context, part);
}

export function installSpringSystem(): void {
  const rendererPrototype = CanvasRenderer.prototype as unknown as Record<string, any>;
  if (rendererPrototype.__physicalSpringVisualInstalled) return;
  rendererPrototype.__physicalSpringVisualInstalled = true;

  const originalDrawPart = rendererPrototype.drawPart;
  rendererPrototype.drawPart = function drawPartWithPhysicalSpring(
    this: Record<string, any>,
    context: CanvasRenderingContext2D,
    part: SpringRuntimePart,
    selected: boolean,
    mode: GameMode
  ): void {
    if (part.kind !== 'spring') {
      originalDrawPart.call(this, context, part, selected, mode);
      return;
    }
    drawPhysicalSpring(this, context, part, selected, mode);
  };

  const appPrototype = GameApp.prototype as unknown as Record<string, any>;
  const originalToggleFixed = appPrototype.toggleFixed;
  appPrototype.toggleFixed = function toggleFixedWithSpringGuard(this: Record<string, any>): void {
    const selected = this.selectedPart?.() as PartState | null;
    if (selected?.kind === 'spring') {
      selected.fixed = true;
      this.setStatus('Пружина закреплена на стенде: свободным остаётся только её шток.');
      this.updateUi();
      return;
    }
    originalToggleFixed.call(this);
  };

  const originalUpdateUi = appPrototype.updateUi;
  appPrototype.updateUi = function updateUiWithSpringState(this: Record<string, any>): void {
    originalUpdateUi.call(this);
    const selected = this.selectedPart?.() as PartState | null;
    if (selected?.kind !== 'spring') return;
    const fixButton = document.querySelector<HTMLButtonElement>('#fix-button');
    if (fixButton) {
      fixButton.disabled = true;
      fixButton.textContent = 'Основание пружины закреплено';
    }
  };
}
