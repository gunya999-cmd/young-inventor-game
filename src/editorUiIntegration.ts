import { GameApp } from './app';
import { addRope, movePart, removePart, rotatePart, upsertHinge } from './editorState';
import { endpointWorld } from './physics';
import {
  MAX_HINGES,
  MAX_ROPES,
  PARTS,
  clampLocalPoint,
  containsPoint,
  topPartAt,
  worldToLocal,
  type Endpoint,
  type PartState,
  type Point,
  type RopeState
} from './model';

type Internals = Record<string, any>;

function normalizeDegrees(value: number): number {
  let result = value % 360;
  if (result > 180) result -= 360;
  if (result < -180) result += 360;
  return result;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function installEditorUiIntegration(): void {
  const prototype = GameApp.prototype as unknown as Internals;
  if (prototype.__editorUiIntegrationInstalled) return;
  prototype.__editorUiIntegrationInstalled = true;

  const originalPointerMove = prototype.onPointerMove;
  prototype.onPointerMove = function onPointerMove(this: Internals, event: PointerEvent): void {
    originalPointerMove.call(this, event);
    if (this.mode !== 'build') return;

    if (this.drag) {
      const part = this.snapshot.parts.find((candidate: PartState) => candidate.id === this.drag.partId);
      if (part) this.snapshot = movePart(this.snapshot, part.id, { x: part.x, y: part.y });
    }
    if (this.rotateDrag) {
      const part = this.snapshot.parts.find((candidate: PartState) => candidate.id === this.rotateDrag.partId);
      if (part) this.snapshot = rotatePart(this.snapshot, part.id, part.angle);
    }
  };

  prototype.rotateSelected = function rotateSelected(this: Internals, direction: -1 | 1, fine: boolean): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart() as PartState | null;
    if (!part) return;
    const degrees = fine ? 1 : 5;
    const next = rotatePart(this.snapshot, part.id, part.angle + direction * degrees * Math.PI / 180);
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.commit(`Деталь повёрнута на ${degrees}°.`);
  };

  prototype.nudgeSelected = function nudgeSelected(this: Internals, deltaX: number, deltaY: number): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart() as PartState | null;
    if (!part) return;
    const next = movePart(this.snapshot, part.id, { x: part.x + deltaX, y: part.y + deltaY });
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.commit('Положение детали изменено клавиатурой.');
  };

  prototype.applyPositionInputs = function applyPositionInputs(this: Internals): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart() as PartState | null;
    if (!part) return;
    const x = Number(document.querySelector<HTMLInputElement>('#position-x')?.value);
    const y = Number(document.querySelector<HTMLInputElement>('#position-y')?.value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const next = movePart(this.snapshot, part.id, { x, y });
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.commit('Точные координаты применены.');
  };

  prototype.applyAngleInput = function applyAngleInput(this: Internals): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart() as PartState | null;
    if (!part) return;
    const degrees = Number(document.querySelector<HTMLInputElement>('#angle-input')?.value);
    if (!Number.isFinite(degrees)) return;
    const next = rotatePart(this.snapshot, part.id, normalizeDegrees(degrees) * Math.PI / 180);
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.commit('Точный угол применён.');
  };

  prototype.placeHinge = function placeHinge(this: Internals, point: Point): void {
    const part = this.selectedPart() as PartState | null;
    if (!part || !PARTS[part.kind].canHinge || part.locked) {
      this.setStatus('Сначала выбери доску или рычаг.');
      return;
    }
    if (!containsPoint(part, point, 4)) {
      this.setStatus('Ось нужно поставить непосредственно на выбранной детали.');
      return;
    }
    const existing = this.snapshot.hinges.find((hinge: { partId: string }) => hinge.partId === part.id);
    if (!existing && this.snapshot.hinges.length >= MAX_HINGES) {
      this.setStatus('Все доступные оси уже использованы.');
      return;
    }
    const local = clampLocalPoint(part, worldToLocal(part, point));
    const next = upsertHinge(this.snapshot, {
      id: existing?.id ?? `hinge-${this.nextId++}`,
      partId: part.id,
      localX: local.x,
      localY: 0,
      referenceAngle: part.angle,
      lowerAngle: -Math.PI * 0.82,
      upperAngle: Math.PI * 0.82
    });
    this.snapshot = next;
    this.hingeTool = false;
    this.commit(`Ось установлена ${Math.round(local.x)} px от центра.`);
  };

  prototype.chooseRopePoint = function chooseRopePoint(this: Internals, point: Point): void {
    const part = topPartAt(this.snapshot, point);
    if (!part || part.kind === 'wall') {
      this.setStatus('Верёвка: выбери точку на детали или закреплённом элементе.');
      return;
    }

    if (part.kind === 'sheave') {
      if (!this.ropeStart) {
        this.setStatus('Сначала выбери первый конец верёвки, затем шкив.');
        return;
      }
      this.ropePulleyId = part.id;
      this.renderer.pulleyPreviewId = part.id;
      this.setStatus('Шкив включён в трассу. Теперь выбери вторую деталь.');
      this.updateUi();
      return;
    }

    const local = clampLocalPoint(part, worldToLocal(part, point));
    const endpoint: Endpoint = { partId: part.id, localX: local.x, localY: local.y };
    if (!this.ropeStart) {
      this.ropeStart = endpoint;
      this.ropePulleyId = null;
      this.renderer.pulleyPreviewId = null;
      this.setStatus('Начало верёвки выбрано. Укажи второй конец или сначала шкив.');
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

    const startPart = this.snapshot.parts.find((candidate: PartState) => candidate.id === this.ropeStart.partId);
    if (!startPart) {
      this.cancelTools();
      return;
    }
    const startWorld = endpointWorld(startPart, this.ropeStart);
    const endWorld = endpointWorld(part, endpoint);
    const pulleyPart = this.ropePulleyId
      ? this.snapshot.parts.find((candidate: PartState) => candidate.id === this.ropePulleyId && candidate.kind === 'sheave')
      : undefined;

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

    const next = addRope(this.snapshot, rope);
    if (next.ropes.length === this.snapshot.ropes.length) {
      this.setStatus('Верёвку не удалось создать: проверь выбранные детали и шкив.');
      return;
    }
    this.snapshot = next;
    this.ropeStart = null;
    this.ropePulleyId = null;
    this.renderer.pulleyPreviewId = null;
    this.ropeTool = false;
    this.commit(pulleyPart
      ? 'Верёвка проведена через шкив.'
      : 'Верёвка соединяет выбранные точки.');
  };

  prototype.deleteSelected = function deleteSelected(this: Internals): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart() as PartState | null;
    if (!part || part.locked) return;
    const next = removePart(this.snapshot, part.id);
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.selectedId = null;
    this.commit('Деталь и все её соединения удалены.');
  };
}
