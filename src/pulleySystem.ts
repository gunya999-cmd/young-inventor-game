import { GameApp } from './app';
import { CanvasRenderer, type RenderFrame } from './renderer';
import { endpointWorld } from './physics';
import {
  MAX_ROPES,
  PARTS,
  clampLocalPoint,
  remaining,
  topPartAt,
  worldToLocal,
  type Endpoint,
  type PartState,
  type Point,
  type RopeState
} from './model';

type Internals = Record<string, any>;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function radialContact(center: Point, target: Point, radius: number): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { x: center.x, y: center.y - radius };
  return {
    x: center.x + dx / length * radius,
    y: center.y + dy / length * radius
  };
}

function drawSheave(
  renderer: Internals,
  context: CanvasRenderingContext2D,
  part: PartState,
  selected: boolean,
  mode: string
): void {
  const radius = PARTS.sheave.radius ?? 42;
  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.5)';
  context.shadowBlur = selected ? 18 : 11;
  context.shadowOffsetY = 7;

  context.fillStyle = '#2a3136';
  context.fillRect(-26, -radius - 17, 52, 25);
  context.fillStyle = '#8f6a3c';
  context.fillRect(-20, -radius - 13, 40, 17);
  context.fillStyle = '#d7dde0';
  for (const x of [-13, 13]) {
    context.beginPath();
    context.arc(x, -radius - 5, 4, 0, Math.PI * 2);
    context.fill();
  }

  const outer = context.createRadialGradient(-10, -12, 5, 0, 0, radius);
  outer.addColorStop(0, '#e6ecef');
  outer.addColorStop(.38, '#93a1aa');
  outer.addColorStop(.72, '#4b5962');
  outer.addColorStop(1, '#182127');
  context.fillStyle = '#11181d';
  context.beginPath();
  context.arc(0, 0, radius + 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = outer;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#202b32';
  context.lineWidth = 8;
  context.beginPath();
  context.arc(0, 0, radius - 8, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = '#0e1519';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 0, radius - 1, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = '#53636d';
  context.lineWidth = 6;
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    context.lineTo(Math.cos(angle) * (radius - 13), Math.sin(angle) * (radius - 13));
    context.stroke();
  }

  context.fillStyle = '#d99a42';
  context.beginPath();
  context.arc(0, 0, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#29343a';
  context.beginPath();
  context.arc(0, 0, 4, 0, Math.PI * 2);
  context.fill();

  context.shadowColor = 'transparent';
  renderer.drawFixedBolts(context, part);
  context.restore();
  if (selected && mode === 'build') renderer.drawSelection(context, part);
}

function drawWrappedRope(
  renderer: Internals,
  context: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  sheave: PartState,
  preview: boolean
): void {
  const radius = (PARTS.sheave.radius ?? 42) * 0.86;
  const contactA = radialContact(sheave, a, radius);
  const contactB = radialContact(sheave, b, radius);
  renderer.drawRopeLine(context, a, contactA, preview);
  renderer.drawRopeLine(context, contactB, b, preview);

  let start = Math.atan2(contactA.y - sheave.y, contactA.x - sheave.x);
  let end = Math.atan2(contactB.y - sheave.y, contactB.x - sheave.x);
  let delta = end - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  end = start + delta;

  context.save();
  context.strokeStyle = preview ? 'rgba(255,193,90,.35)' : 'rgba(0,0,0,.42)';
  context.lineWidth = preview ? 8 : 9;
  context.beginPath();
  context.arc(sheave.x, sheave.y, radius, start, end, delta < 0);
  context.stroke();
  context.strokeStyle = preview ? '#ffc15a' : '#d29b59';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(sheave.x, sheave.y, radius, start, end, delta < 0);
  context.stroke();
  context.restore();
}

export function installPulleySystem(): void {
  const appPrototype = GameApp.prototype as unknown as Internals;
  if (appPrototype.__pulleySystemInstalled) return;
  appPrototype.__pulleySystemInstalled = true;

  const originalArmRope = appPrototype.armRope;
  appPrototype.armRope = function armRope(this: Internals): void {
    this.ropePulleyId = null;
    this.renderer.pulleyPreviewId = null;
    originalArmRope.call(this);
  };

  const originalCancelTools = appPrototype.cancelTools;
  appPrototype.cancelTools = function cancelTools(this: Internals): void {
    this.ropePulleyId = null;
    this.renderer.pulleyPreviewId = null;
    originalCancelTools.call(this);
  };

  appPrototype.chooseRopePoint = function chooseRopePoint(this: Internals, point: Point): void {
    const part = topPartAt(this.snapshot, point);
    if (!part || part.kind === 'wall') {
      this.setStatus('Верёвка: выбери точку на подвижной детали или закреплённом элементе.');
      return;
    }

    if (part.kind === 'sheave') {
      if (!this.ropeStart) {
        this.setStatus('Сначала выбери первый конец верёвки, затем шкив.');
        return;
      }
      if (this.ropePulleyId === part.id) {
        this.setStatus('Этот шкив уже выбран. Теперь укажи второй конец верёвки.');
        return;
      }
      this.ropePulleyId = part.id;
      this.renderer.pulleyPreviewId = part.id;
      this.setStatus('Шкив включён в трассу. Теперь кликни по второй детали.');
      this.updateUi();
      return;
    }

    const local = clampLocalPoint(part, worldToLocal(part, point));
    const endpoint: Endpoint = { partId: part.id, localX: local.x, localY: local.y };
    if (!this.ropeStart) {
      this.ropeStart = endpoint;
      this.ropePulleyId = null;
      this.renderer.pulleyPreviewId = null;
      this.setStatus('Начало верёвки выбрано. Кликни по второй детали или сначала по шкиву.');
      this.updateUi();
      return;
    }
    if (this.ropeStart.partId === endpoint.partId) {
      this.setStatus('Концы верёвки должны находиться на разных деталях.');
      return;
    }
    if (this.snapshot.ropes.length >= MAX_ROPES) {
      this.setStatus('Все доступные верёвки уже использованы.');
      return;
    }

    const startPart = this.snapshot.parts.find((candidate: PartState) => candidate.id === this.ropeStart?.partId);
    if (!startPart) return;
    const startWorld = endpointWorld(startPart, this.ropeStart);
    const endWorld = endpointWorld(part, endpoint);
    const pulleyPart = this.ropePulleyId
      ? this.snapshot.parts.find((candidate: PartState) => candidate.id === this.ropePulleyId && candidate.kind === 'sheave')
      : null;

    const rope: RopeState = {
      id: `rope-${this.nextId++}`,
      a: { ...this.ropeStart },
      b: endpoint,
      maxLength: pulleyPart
        ? Math.max(30, (distance(startWorld, pulleyPart) + distance(pulleyPart, endWorld)) * 1.01)
        : Math.max(30, distance(startWorld, endWorld) * 1.035)
    };
    if (pulleyPart) {
      rope.pulleyPartId = pulleyPart.id;
      rope.ratio = 1;
    }
    this.snapshot.ropes.push(rope);
    this.ropeStart = null;
    this.ropePulleyId = null;
    this.renderer.pulleyPreviewId = null;
    this.ropeTool = false;
    this.commit(pulleyPart
      ? 'Верёвка проведена через шкив: движение одного конца передаётся второму.'
      : 'Верёвка соединяет выбранные точки и допускает провисание.');
  };

  const originalToggleFixed = appPrototype.toggleFixed;
  appPrototype.toggleFixed = function toggleFixed(this: Internals): void {
    const selected = this.selectedPart();
    if (selected?.kind === 'sheave') {
      selected.fixed = true;
      this.setStatus('Шкив закреплён на стенде: его ось остаётся неподвижной.');
      this.updateUi();
      return;
    }
    originalToggleFixed.call(this);
  };

  const originalDeleteSelected = appPrototype.deleteSelected;
  appPrototype.deleteSelected = function deleteSelected(this: Internals): void {
    const selected = this.selectedPart();
    if (selected?.kind === 'sheave') {
      this.snapshot.ropes = this.snapshot.ropes.filter((rope: RopeState) => rope.pulleyPartId !== selected.id);
    }
    originalDeleteSelected.call(this);
  };

  const originalUpdateUi = appPrototype.updateUi;
  appPrototype.updateUi = function updateUi(this: Internals): void {
    originalUpdateUi.call(this);
    const button = document.querySelector<HTMLButtonElement>('.palette-part[data-kind="sheave"]');
    if (button) {
      const count = remaining(this.snapshot, 'sheave');
      button.disabled = this.mode !== 'build' || count <= 0;
      const counter = button.querySelector<HTMLElement>('[data-count]');
      if (counter) counter.textContent = `×${count}`;
    }
    const selected = this.selectedPart();
    if (selected?.kind === 'sheave') {
      const fixedButton = document.querySelector<HTMLButtonElement>('#fix-button');
      if (fixedButton) {
        fixedButton.disabled = true;
        fixedButton.textContent = 'Шкив закреплён на стенде';
      }
    }
  };

  const rendererPrototype = CanvasRenderer.prototype as unknown as Internals;
  const previousDrawPart = rendererPrototype.drawPart;
  rendererPrototype.drawPart = function drawPart(
    this: Internals,
    context: CanvasRenderingContext2D,
    part: PartState,
    selected: boolean,
    mode: string
  ): void {
    if (part.kind === 'sheave') {
      drawSheave(this, context, part, selected, mode);
      return;
    }
    previousDrawPart.call(this, context, part, selected, mode);
  };

  const previousDrawRopes = rendererPrototype.drawRopes;
  rendererPrototype.drawRopes = function drawRopes(
    this: Internals,
    context: CanvasRenderingContext2D,
    frame: RenderFrame
  ): void {
    const simpleFrame: RenderFrame = {
      ...frame,
      snapshot: {
        ...frame.snapshot,
        ropes: frame.snapshot.ropes.filter((rope) => !rope.pulleyPartId)
      }
    };
    previousDrawRopes.call(this, context, simpleFrame);

    for (const rope of frame.snapshot.ropes) {
      if (!rope.pulleyPartId) continue;
      const partA = frame.snapshot.parts.find((part) => part.id === rope.a.partId);
      const partB = frame.snapshot.parts.find((part) => part.id === rope.b.partId);
      const sheave = frame.snapshot.parts.find((part) => part.id === rope.pulleyPartId && part.kind === 'sheave');
      if (!partA || !partB || !sheave) continue;
      drawWrappedRope(this, context, endpointWorld(partA, rope.a), endpointWorld(partB, rope.b), sheave, false);
    }
  };

  const previousDrawToolPreview = rendererPrototype.drawToolPreview;
  rendererPrototype.drawToolPreview = function drawToolPreview(
    this: Internals,
    context: CanvasRenderingContext2D,
    frame: RenderFrame
  ): void {
    const sheave = this.pulleyPreviewId
      ? frame.snapshot.parts.find((part) => part.id === this.pulleyPreviewId && part.kind === 'sheave')
      : null;
    if (!sheave || !frame.ropeStart || !frame.pointerWorld) {
      previousDrawToolPreview.call(this, context, frame);
      return;
    }

    previousDrawToolPreview.call(this, context, { ...frame, ropeStart: null });
    const startPart = frame.snapshot.parts.find((part) => part.id === frame.ropeStart?.partId);
    if (!startPart) return;
    drawWrappedRope(this, context, endpointWorld(startPart, frame.ropeStart), frame.pointerWorld, sheave, true);
  };
}
