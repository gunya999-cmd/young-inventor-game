import { GameApp } from './app';
import { movePart, removePart, rotatePart, upsertHinge } from './editorState';
import { PARTS, clampLocalPoint, containsPoint, worldToLocal, type PartState, type Point } from './model';

type Internals = Record<string, any>;

function normalizeDegrees(value: number): number {
  let result = value % 360;
  if (result > 180) result -= 360;
  if (result < -180) result += 360;
  return result;
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
    if (!existing && this.snapshot.hinges.length >= 2) {
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
