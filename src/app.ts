import { CanvasRenderer } from './renderer';
import { PhysicsEngine, endpointWorld } from './physics';
import {
  MAX_HINGES,
  MAX_ROPES,
  PARTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  SnapshotHistory,
  clampLocalPoint,
  cloneSnapshot,
  containsPoint,
  createInitialSnapshot,
  remaining,
  topPartAt,
  worldToLocal,
  type Endpoint,
  type GameMode,
  type MachineSnapshot,
  type PartKind,
  type PartState,
  type Point
} from './model';

const SAVE_KEY = 'young-inventor:desktop:v1';
const FIXED_STEP = 1 / 120;
const MAX_FRAME = 0.05;
const MOVE_GRID = 10;

interface DragState {
  partId: string;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

interface RotateDrag {
  partId: string;
  angleOffset: number;
  moved: boolean;
}

interface PaletteDrag {
  pointerId: number;
  kind: PartKind;
  ghost: HTMLElement;
  button: HTMLButtonElement;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент интерфейса: ${selector}`);
  return element;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function isPartKind(value: string | undefined): value is PartKind {
  return value === 'ball' || value === 'plank' || value === 'wall' || value === 'lever' || value === 'pulley' || value === 'weight';
}

function isSnapshot(value: unknown): value is MachineSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MachineSnapshot>;
  return Array.isArray(candidate.parts) && Array.isArray(candidate.ropes) && Array.isArray(candidate.hinges);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function normalizeDegrees(value: number): number {
  let result = value % 360;
  if (result > 180) result -= 360;
  if (result < -180) result += 360;
  return result;
}

function rotatable(part: PartState | null): boolean {
  return Boolean(part && !part.locked && part.kind !== 'ball' && part.kind !== 'pulley');
}

export class GameApp {
  private readonly renderer: CanvasRenderer;
  private snapshot = createInitialSnapshot();
  private runtimeSnapshot = cloneSnapshot(this.snapshot);
  private runStartSnapshot = cloneSnapshot(this.snapshot);
  private history = new SnapshotHistory(this.snapshot);
  private physics: PhysicsEngine | null = null;
  private mode: GameMode = 'build';
  private selectedId: string | null = null;
  private drag: DragState | null = null;
  private rotateDrag: RotateDrag | null = null;
  private paletteDrag: PaletteDrag | null = null;
  private ropeTool = false;
  private hingeTool = false;
  private ropeStart: Endpoint | null = null;
  private pointerWorld: Point | null = null;
  private panPointer: number | null = null;
  private panLast: Point | null = null;
  private nextId = 1;
  private lastFrame = performance.now();
  private accumulator = 0;
  private elapsed = 0;
  private completed = false;
  private snapEnabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new CanvasRenderer(canvas);
    this.bindCanvas();
    this.bindControls();
    this.bindPalette();
    this.bindKeyboard();
    this.updateUi();
    this.setStatus('Построй механизм: стартовый шар должен попасть в корзину справа.');
    requestAnimationFrame((time) => this.frame(time));
    window.dispatchEvent(new CustomEvent('tim-ready'));
  }

  private bindCanvas(): void {
    const canvas = this.renderer.canvas;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    canvas.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
  }

  private bindControls(): void {
    required<HTMLButtonElement>('#run-button').addEventListener('click', () => this.start());
    required<HTMLButtonElement>('#pause-button').addEventListener('click', () => this.pauseOrResume());
    required<HTMLButtonElement>('#stop-button').addEventListener('click', () => this.stop());
    required<HTMLButtonElement>('#reset-button').addEventListener('click', () => this.resetLevel());
    required<HTMLButtonElement>('#clear-button').addEventListener('click', () => this.clearAddedParts());
    required<HTMLButtonElement>('#undo-button').addEventListener('click', () => this.undo());
    required<HTMLButtonElement>('#redo-button').addEventListener('click', () => this.redo());
    required<HTMLButtonElement>('#rotate-left').addEventListener('click', () => this.rotateSelected(-1, false));
    required<HTMLButtonElement>('#rotate-right').addEventListener('click', () => this.rotateSelected(1, false));
    required<HTMLButtonElement>('#duplicate-button').addEventListener('click', () => this.duplicateSelected());
    required<HTMLButtonElement>('#fix-button').addEventListener('click', () => this.toggleFixed());
    required<HTMLButtonElement>('#rope-button').addEventListener('click', () => this.armRope());
    required<HTMLButtonElement>('#hinge-button').addEventListener('click', () => this.armHinge());
    required<HTMLButtonElement>('#remove-hinge-button').addEventListener('click', () => this.removeSelectedHinge());
    required<HTMLButtonElement>('#delete-button').addEventListener('click', () => this.deleteSelected());
    required<HTMLButtonElement>('#save-button').addEventListener('click', () => this.save());
    required<HTMLButtonElement>('#load-button').addEventListener('click', () => this.load());
    required<HTMLButtonElement>('#camera-button').addEventListener('click', () => this.renderer.resetCamera());
    required<HTMLButtonElement>('#result-again').addEventListener('click', () => this.stop());

    required<HTMLInputElement>('#snap-toggle').addEventListener('change', (event) => {
      this.snapEnabled = (event.currentTarget as HTMLInputElement).checked;
      this.setStatus(this.snapEnabled ? 'Привязка к сетке 10 px включена.' : 'Привязка отключена: свободное позиционирование.');
    });
    required<HTMLInputElement>('#position-x').addEventListener('change', () => this.applyPositionInputs());
    required<HTMLInputElement>('#position-y').addEventListener('change', () => this.applyPositionInputs());
    required<HTMLInputElement>('#angle-input').addEventListener('change', () => this.applyAngleInput());
  }

  private bindPalette(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      button.addEventListener('pointerdown', (event) => {
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

    window.addEventListener('pointermove', (event) => {
      if (this.paletteDrag?.pointerId !== event.pointerId) return;
      event.preventDefault();
      this.movePaletteGhost(event.clientX, event.clientY);
    }, { passive: false });

    window.addEventListener('pointerup', (event) => {
      if (this.paletteDrag?.pointerId === event.pointerId) this.finishPaletteDrag(event.clientX, event.clientY);
    });
    window.addEventListener('pointercancel', (event) => {
      if (this.paletteDrag?.pointerId === event.pointerId) this.finishPaletteDrag(-1000, -1000);
    });
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo(); else this.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        this.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault();
        this.duplicateSelected();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.mode === 'build') this.start(); else this.stop();
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        this.pauseOrResume();
        return;
      }
      if (event.key === 'Escape') {
        if (this.mode !== 'build') this.stop();
        else {
          this.cancelTools();
          this.selectedId = null;
          this.setStatus('Выбор и активный инструмент сброшены.');
          this.updateUi();
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.deleteSelected();
        return;
      }
      if (key === 'q') this.rotateSelected(-1, event.shiftKey);
      if (key === 'e') this.rotateSelected(1, event.shiftKey);
      if (key === 'r') this.armRope();
      if (key === 'h') this.armHinge();
      if (key === 'f') this.toggleFixed();

      const nudge = event.shiftKey ? 1 : MOVE_GRID;
      if (event.key === 'ArrowLeft') this.nudgeSelected(-nudge, 0);
      if (event.key === 'ArrowRight') this.nudgeSelected(nudge, 0);
      if (event.key === 'ArrowUp') this.nudgeSelected(0, -nudge);
      if (event.key === 'ArrowDown') this.nudgeSelected(0, nudge);
    });
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      this.renderer.zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
      return;
    }
    if (this.mode === 'build' && rotatable(this.selectedPart())) {
      this.rotateSelected(event.deltaY < 0 ? -1 : 1, event.shiftKey);
    }
  }

  private onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.pointerWorld = this.renderer.screenToWorld(event.clientX, event.clientY);

    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      this.panPointer = event.pointerId;
      this.panLast = { x: event.clientX, y: event.clientY };
      this.renderer.canvas.setPointerCapture?.(event.pointerId);
      this.updateCanvasCursor();
      return;
    }
    if (event.button !== 0 || this.mode !== 'build') return;

    this.renderer.canvas.setPointerCapture?.(event.pointerId);
    if (this.ropeTool) {
      this.chooseRopePoint(this.pointerWorld);
      return;
    }
    if (this.hingeTool) {
      this.placeHinge(this.pointerWorld);
      return;
    }

    const selected = this.selectedPart();
    if (selected && rotatable(selected) && this.hitRotationHandle(selected, event.clientX, event.clientY)) {
      const pointerAngle = Math.atan2(this.pointerWorld.y - selected.y, this.pointerWorld.x - selected.x);
      this.rotateDrag = { partId: selected.id, angleOffset: selected.angle - pointerAngle, moved: false };
      this.updateCanvasCursor();
      return;
    }

    const part = topPartAt(this.snapshot, this.pointerWorld);
    this.selectedId = part?.id ?? null;
    if (part && !part.locked) {
      this.drag = {
        partId: part.id,
        offsetX: this.pointerWorld.x - part.x,
        offsetY: this.pointerWorld.y - part.y,
        moved: false
      };
    }
    this.updateUi();
  }

  private onPointerMove(event: PointerEvent): void {
    this.pointerWorld = this.renderer.screenToWorld(event.clientX, event.clientY);

    if (this.panPointer === event.pointerId && this.panLast) {
      this.renderer.panBy(event.clientX - this.panLast.x, event.clientY - this.panLast.y);
      this.panLast = { x: event.clientX, y: event.clientY };
      return;
    }
    if (this.mode !== 'build') return;

    if (this.drag) {
      const part = this.snapshot.parts.find((candidate) => candidate.id === this.drag?.partId);
      if (!part) return;
      let x = this.pointerWorld.x - this.drag.offsetX;
      let y = this.pointerWorld.y - this.drag.offsetY;
      if (this.snapEnabled) {
        x = snap(x, MOVE_GRID);
        y = snap(y, MOVE_GRID);
      }
      const spec = PARTS[part.kind];
      part.x = clamp(x, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10);
      part.y = clamp(y, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10);
      this.drag.moved = true;
      this.updateSelectionFields();
      return;
    }

    if (this.rotateDrag) {
      const part = this.snapshot.parts.find((candidate) => candidate.id === this.rotateDrag?.partId);
      if (!part) return;
      const pointerAngle = Math.atan2(this.pointerWorld.y - part.y, this.pointerWorld.x - part.x);
      const degreesStep = event.shiftKey ? 1 : 5;
      const angle = pointerAngle + this.rotateDrag.angleOffset;
      part.angle = snap(angle * 180 / Math.PI, degreesStep) * Math.PI / 180;
      this.rotateDrag.moved = true;
      this.updateSelectionFields();
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.drag?.moved) this.commit('Деталь перемещена.');
    if (this.rotateDrag?.moved) this.commit('Угол детали изменён.');
    this.drag = null;
    this.rotateDrag = null;
    if (this.panPointer === event.pointerId) {
      this.panPointer = null;
      this.panLast = null;
    }
    this.updateCanvasCursor();
  }

  private hitRotationHandle(part: PartState, clientX: number, clientY: number): boolean {
    const screen = this.renderer.worldToScreen(this.renderer.rotationHandle(part));
    return Math.hypot(clientX - screen.x, clientY - screen.y) <= 18;
  }

  private movePaletteGhost(clientX: number, clientY: number): void {
    if (!this.paletteDrag) return;
    this.paletteDrag.ghost.style.transform = `translate3d(${clientX}px,${clientY}px,0) translate(-50%,-50%)`;
  }

  private finishPaletteDrag(clientX: number, clientY: number): void {
    const drag = this.paletteDrag;
    if (!drag) return;
    this.paletteDrag = null;
    drag.ghost.remove();
    drag.button.classList.remove('dragging');
    const rect = this.renderer.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    this.addPart(drag.kind, this.renderer.screenToWorld(clientX, clientY));
  }

  private addPart(kind: PartKind, point: Point): void {
    if (this.mode !== 'build' || remaining(this.snapshot, kind) <= 0) return;
    const spec = PARTS[kind];
    let x = point.x;
    let y = point.y;
    if (this.snapEnabled) {
      x = snap(x, MOVE_GRID);
      y = snap(y, MOVE_GRID);
    }
    const part: PartState = {
      id: `${kind}-${this.nextId++}`,
      kind,
      x: clamp(x, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10),
      y: clamp(y, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10),
      angle: 0,
      fixed: spec.defaultFixed
    };
    this.snapshot.parts.push(part);
    this.selectedId = part.id;
    this.commit(`${spec.label} добавлен на рабочее поле.`);
  }

  private chooseRopePoint(point: Point): void {
    const part = topPartAt(this.snapshot, point);
    if (!part || part.kind === 'wall') {
      this.setStatus('Выбери точку на шаре, доске, рычаге, блоке или грузе.');
      return;
    }
    const local = clampLocalPoint(part, worldToLocal(part, point));
    const endpoint: Endpoint = { partId: part.id, localX: local.x, localY: local.y };
    if (!this.ropeStart) {
      this.ropeStart = endpoint;
      this.setStatus('Начало верёвки выбрано. Кликни по второй детали.');
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
    const startPart = this.snapshot.parts.find((candidate) => candidate.id === this.ropeStart?.partId);
    if (!startPart) return;
    const startWorld = endpointWorld(startPart, this.ropeStart);
    const endWorld = endpointWorld(part, endpoint);
    this.snapshot.ropes.push({
      id: `rope-${this.nextId++}`,
      a: { ...this.ropeStart },
      b: endpoint,
      maxLength: Math.max(30, distance(startWorld, endWorld) * 1.035)
    });
    this.ropeStart = null;
    this.ropeTool = false;
    this.commit('Верёвка соединяет выбранные точки и допускает провисание.');
  }

  private placeHinge(point: Point): void {
    const part = this.selectedPart();
    if (!part || !PARTS[part.kind].canHinge || part.locked) {
      this.setStatus('Сначала выбери доску или рычаг.');
      return;
    }
    if (!containsPoint(part, point, 4)) {
      this.setStatus('Ось нужно поставить непосредственно на выбранной детали.');
      return;
    }
    const existing = this.snapshot.hinges.find((hinge) => hinge.partId === part.id);
    if (!existing && this.snapshot.hinges.length >= MAX_HINGES) {
      this.setStatus('Все доступные оси уже использованы.');
      return;
    }
    const local = clampLocalPoint(part, worldToLocal(part, point));
    local.y = 0;
    this.snapshot.hinges = this.snapshot.hinges.filter((hinge) => hinge.partId !== part.id);
    this.snapshot.hinges.push({
      id: existing?.id ?? `hinge-${this.nextId++}`,
      partId: part.id,
      localX: local.x,
      localY: 0,
      referenceAngle: part.angle,
      lowerAngle: -Math.PI * 0.82,
      upperAngle: Math.PI * 0.82
    });
    part.fixed = false;
    this.hingeTool = false;
    this.commit(`Ось установлена ${Math.round(local.x)} px от центра.`);
  }

  private armRope(): void {
    if (this.mode !== 'build') return;
    if (!this.ropeTool && this.snapshot.ropes.length >= MAX_ROPES) {
      this.setStatus('Все верёвки уже использованы.');
      return;
    }
    this.ropeTool = !this.ropeTool;
    this.hingeTool = false;
    this.ropeStart = null;
    this.setStatus(this.ropeTool ? 'Верёвка: кликни по двум точкам на разных деталях.' : 'Режим верёвки отменён.');
    this.updateUi();
  }

  private armHinge(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || !PARTS[part.kind].canHinge || part.locked) {
      this.setStatus('Сначала выбери доску или рычаг.');
      return;
    }
    this.hingeTool = !this.hingeTool;
    this.ropeTool = false;
    this.ropeStart = null;
    this.setStatus(this.hingeTool ? 'Ось: кликни по выбранной детали в точке опоры.' : 'Режим установки оси отменён.');
    this.updateUi();
  }

  private rotateSelected(direction: -1 | 1, fine: boolean): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!rotatable(part)) return;
    const degrees = fine ? 1 : 5;
    part.angle += direction * degrees * Math.PI / 180;
    this.commit(`Деталь повёрнута на ${degrees}°.`);
  }

  private nudgeSelected(deltaX: number, deltaY: number): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked) return;
    const spec = PARTS[part.kind];
    part.x = clamp(part.x + deltaX, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10);
    part.y = clamp(part.y + deltaY, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10);
    this.commit('Положение детали изменено клавиатурой.');
  }

  private applyPositionInputs(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked) return;
    const x = Number(required<HTMLInputElement>('#position-x').value);
    const y = Number(required<HTMLInputElement>('#position-y').value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const spec = PARTS[part.kind];
    part.x = clamp(x, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10);
    part.y = clamp(y, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10);
    this.commit('Точные координаты применены.');
  }

  private applyAngleInput(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!rotatable(part)) return;
    const degrees = Number(required<HTMLInputElement>('#angle-input').value);
    if (!Number.isFinite(degrees)) return;
    part.angle = normalizeDegrees(degrees) * Math.PI / 180;
    this.commit('Точный угол применён.');
  }

  private duplicateSelected(): void {
    if (this.mode !== 'build') return;
    const source = this.selectedPart();
    if (!source || source.locked || remaining(this.snapshot, source.kind) <= 0) return;
    const spec = PARTS[source.kind];
    const copy: PartState = {
      ...source,
      id: `${source.kind}-${this.nextId++}`,
      x: clamp(source.x + 30, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10),
      y: clamp(source.y + 30, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10),
      locked: false
    };
    this.snapshot.parts.push(copy);
    this.selectedId = copy.id;
    this.commit(`${spec.label} продублирован без соединений.`);
  }

  private toggleFixed(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked) return;
    const hinge = this.snapshot.hinges.find((candidate) => candidate.partId === part.id);
    if (hinge) {
      this.setStatus('Деталь закреплена осью. Сначала удали ось.');
      return;
    }
    part.fixed = !part.fixed;
    this.commit(part.fixed ? 'Деталь закреплена неподвижно.' : 'Крепление снято: деталь станет подвижной.');
  }

  private removeSelectedHinge(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part) return;
    const before = this.snapshot.hinges.length;
    this.snapshot.hinges = this.snapshot.hinges.filter((hinge) => hinge.partId !== part.id);
    if (before === this.snapshot.hinges.length) return;
    this.commit('Ось удалена. Деталь снова свободна.');
  }

  private deleteSelected(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked) return;
    this.snapshot.parts = this.snapshot.parts.filter((candidate) => candidate.id !== part.id);
    this.snapshot.ropes = this.snapshot.ropes.filter((rope) => rope.a.partId !== part.id && rope.b.partId !== part.id);
    this.snapshot.hinges = this.snapshot.hinges.filter((hinge) => hinge.partId !== part.id);
    this.selectedId = null;
    this.commit('Деталь и её соединения удалены.');
  }

  private start(): void {
    if (this.mode !== 'build') return;
    this.runStartSnapshot = cloneSnapshot(this.snapshot);
    this.physics = new PhysicsEngine(this.runStartSnapshot);
    this.runtimeSnapshot = cloneSnapshot(this.runStartSnapshot);
    this.mode = 'running';
    this.elapsed = 0;
    this.accumulator = 0;
    this.completed = false;
    this.selectedId = null;
    this.cancelTools();
    this.lastFrame = performance.now();
    this.setStatus('Симуляция запущена. Space — остановить, P — пауза.');
    this.updateUi();
  }

  private pauseOrResume(): void {
    if (this.mode === 'running') {
      this.mode = 'paused';
      this.setStatus('Пауза: физический мир заморожен.');
    } else if (this.mode === 'paused') {
      this.mode = 'running';
      this.lastFrame = performance.now();
      this.setStatus('Симуляция продолжена.');
    }
    this.updateUi();
  }

  private stop(): void {
    if (this.mode === 'build') return;
    this.mode = 'build';
    this.snapshot = cloneSnapshot(this.runStartSnapshot);
    this.runtimeSnapshot = cloneSnapshot(this.snapshot);
    this.physics = null;
    this.accumulator = 0;
    this.completed = false;
    required<HTMLElement>('#result-card').classList.remove('visible');
    this.setStatus('Стоп: конструкция точно возвращена в состояние до запуска.');
    this.updateUi();
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    this.mode = 'paused';
    required<HTMLElement>('#result-time').textContent = `${this.elapsed.toFixed(1)} сек.`;
    required<HTMLElement>('#result-card').classList.add('visible');
    this.setStatus('Механизм сработал: стартовый шар оказался в корзине.');
    this.updateUi();
  }

  private undo(): void {
    if (this.mode !== 'build') return;
    const snapshot = this.history.undo();
    if (!snapshot) return;
    this.snapshot = snapshot;
    this.selectedId = null;
    this.cancelTools();
    this.setStatus('Последнее действие отменено.');
    this.updateUi();
  }

  private redo(): void {
    if (this.mode !== 'build') return;
    const snapshot = this.history.redo();
    if (!snapshot) return;
    this.snapshot = snapshot;
    this.selectedId = null;
    this.cancelTools();
    this.setStatus('Действие повторено.');
    this.updateUi();
  }

  private clearAddedParts(): void {
    if (this.mode !== 'build') return;
    this.snapshot.parts = this.snapshot.parts.filter((part) => part.locked);
    this.snapshot.ropes = [];
    this.snapshot.hinges = [];
    this.selectedId = null;
    this.cancelTools();
    this.commit('Все добавленные детали убраны.');
  }

  private resetLevel(): void {
    if (this.mode !== 'build') this.stop();
    this.snapshot = createInitialSnapshot();
    this.runtimeSnapshot = cloneSnapshot(this.snapshot);
    this.history.reset(this.snapshot);
    this.nextId = 1;
    this.selectedId = null;
    this.cancelTools();
    this.renderer.resetCamera();
    this.setStatus('Уровень сброшен. Построй новый механизм.');
    this.updateUi();
  }

  private save(): void {
    if (this.mode !== 'build') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot));
    this.setStatus('Конструкция сохранена в браузере.');
    this.updateUi();
  }

  private load(): void {
    if (this.mode !== 'build') return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSnapshot(parsed)) throw new Error('invalid snapshot');
      this.snapshot = cloneSnapshot(parsed);
      this.runtimeSnapshot = cloneSnapshot(this.snapshot);
      this.history.reset(this.snapshot);
      this.reseedNextId();
      this.selectedId = null;
      this.cancelTools();
      this.setStatus('Сохранённая конструкция загружена.');
      this.updateUi();
    } catch {
      localStorage.removeItem(SAVE_KEY);
      this.setStatus('Сохранение повреждено и удалено.');
      this.updateUi();
    }
  }

  private reseedNextId(): void {
    const values = [
      ...this.snapshot.parts.map((part) => part.id),
      ...this.snapshot.ropes.map((rope) => rope.id),
      ...this.snapshot.hinges.map((hinge) => hinge.id)
    ];
    const maximum = values.reduce((current, value) => {
      const match = value.match(/(\d+)$/);
      return Math.max(current, match ? Number(match[1]) : 0);
    }, 0);
    this.nextId = maximum + 1;
  }

  private cancelTools(): void {
    this.ropeTool = false;
    this.hingeTool = false;
    this.ropeStart = null;
  }

  private selectedPart(): PartState | null {
    return this.selectedId ? this.snapshot.parts.find((part) => part.id === this.selectedId) ?? null : null;
  }

  private commit(message: string): void {
    this.history.commit(this.snapshot);
    this.setStatus(message);
    this.updateUi();
  }

  private frame(time: number): void {
    const delta = Math.min(MAX_FRAME, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    if (this.mode === 'running' && this.physics) {
      this.accumulator += delta;
      this.elapsed += delta;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < 8) {
        this.physics.step(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
        steps += 1;
      }
      this.runtimeSnapshot = this.physics.snapshot();
      if (this.physics.hasWon()) this.complete();
      this.updateTimer();
    }

    this.renderer.render({
      snapshot: this.mode === 'build' ? this.snapshot : this.runtimeSnapshot,
      selectedId: this.selectedId,
      mode: this.mode,
      ropeStart: this.ropeStart,
      pointerWorld: this.pointerWorld,
      hingeTool: this.hingeTool,
      ropeTool: this.ropeTool
    });
    requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private updateTimer(): void {
    required<HTMLElement>('#run-timer').textContent = `${this.elapsed.toFixed(1)}с`;
  }

  private setStatus(message: string): void {
    required<HTMLElement>('#status-message').textContent = message;
  }

  private updateSelectionFields(): void {
    const selected = this.selectedPart();
    const xInput = required<HTMLInputElement>('#position-x');
    const yInput = required<HTMLInputElement>('#position-y');
    const angleInput = required<HTMLInputElement>('#angle-input');
    const degrees = selected ? Math.round(normalizeDegrees(selected.angle * 180 / Math.PI)) : 0;
    xInput.value = selected ? String(Math.round(selected.x)) : '';
    yInput.value = selected ? String(Math.round(selected.y)) : '';
    angleInput.value = selected ? String(degrees) : '';
    required<HTMLElement>('#selection-angle').textContent = selected ? `${degrees}°` : '—';
  }

  private updateCanvasCursor(): void {
    const canvas = this.renderer.canvas;
    canvas.classList.toggle('cursor-move', this.panPointer !== null);
    canvas.classList.toggle('cursor-drag', Boolean(this.drag));
    canvas.classList.toggle('cursor-rotate', Boolean(this.rotateDrag));
    canvas.classList.toggle('cursor-tool', this.ropeTool || this.hingeTool);
  }

  private updateUi(): void {
    const build = this.mode === 'build';
    const selected = this.selectedPart();
    const selectedHinge = selected ? this.snapshot.hinges.find((hinge) => hinge.partId === selected.id) : undefined;
    const root = required<HTMLElement>('#app');
    root.classList.toggle('simulating', !build);
    root.classList.toggle('completed', this.completed);

    required<HTMLElement>('#mode-label').textContent = build ? 'СБОРКА' : this.mode === 'paused' ? 'ПАУЗА' : 'СИМУЛЯЦИЯ';
    required<HTMLButtonElement>('#run-button').disabled = !build;
    required<HTMLButtonElement>('#pause-button').disabled = build;
    required<HTMLButtonElement>('#pause-button').textContent = this.mode === 'paused' ? '▶' : 'Ⅱ';
    required<HTMLButtonElement>('#stop-button').disabled = build;
    required<HTMLButtonElement>('#undo-button').disabled = !build || !this.history.canUndo;
    required<HTMLButtonElement>('#redo-button').disabled = !build || !this.history.canRedo;
    required<HTMLButtonElement>('#load-button').disabled = !build || !localStorage.getItem(SAVE_KEY);

    const inspector = required<HTMLElement>('#inspector');
    inspector.classList.toggle('has-selection', Boolean(selected));
    required<HTMLElement>('#selection-name').textContent = selected ? PARTS[selected.kind].label : 'Ничего не выбрано';
    required<HTMLElement>('#selection-help').textContent = selected
      ? selected.locked
        ? 'Объект является частью уровня. Его можно использовать, но нельзя перемещать или удалять.'
        : 'Перетаскивай мышью, вращай круглой ручкой или вводи точные значения.'
      : 'Выбери деталь на поле, чтобы изменить её положение и свойства.';

    const stateBadge = required<HTMLElement>('#selection-status');
    stateBadge.className = 'state-badge';
    if (!selected) stateBadge.textContent = '—';
    else if (selected.locked) {
      stateBadge.textContent = 'ОБЪЕКТ УРОВНЯ';
      stateBadge.classList.add('locked');
    } else if (selectedHinge) {
      stateBadge.textContent = 'НА ОСИ';
      stateBadge.classList.add('active');
    } else if (selected.fixed) {
      stateBadge.textContent = 'ЗАКРЕПЛЕНА';
      stateBadge.classList.add('fixed');
    } else {
      stateBadge.textContent = 'ПОДВИЖНАЯ';
      stateBadge.classList.add('active');
    }

    const selectedEditable = Boolean(build && selected && !selected.locked);
    const canRotate = build && rotatable(selected);
    required<HTMLInputElement>('#position-x').disabled = !selectedEditable;
    required<HTMLInputElement>('#position-y').disabled = !selectedEditable;
    required<HTMLInputElement>('#angle-input').disabled = !canRotate;
    required<HTMLButtonElement>('#rotate-left').disabled = !canRotate;
    required<HTMLButtonElement>('#rotate-right').disabled = !canRotate;
    required<HTMLButtonElement>('#duplicate-button').disabled = !selectedEditable || !selected || remaining(this.snapshot, selected.kind) <= 0;
    required<HTMLButtonElement>('#delete-button').disabled = !selectedEditable;

    const fixedButton = required<HTMLButtonElement>('#fix-button');
    fixedButton.disabled = !selectedEditable || Boolean(selectedHinge);
    fixedButton.textContent = selectedHinge ? 'Деталь закреплена осью' : selected?.fixed ? 'Снять жёсткое крепление' : 'Закрепить неподвижно';
    const removeHinge = required<HTMLButtonElement>('#remove-hinge-button');
    removeHinge.disabled = !build || !selectedHinge;

    const ropeButton = required<HTMLButtonElement>('#rope-button');
    ropeButton.disabled = !build || (!this.ropeTool && this.snapshot.ropes.length >= MAX_ROPES);
    ropeButton.classList.toggle('active', this.ropeTool);
    ropeButton.innerHTML = this.ropeTool
      ? '〰 Выбери точки <span>Esc</span>'
      : `〰 Верёвка <span>×${MAX_ROPES - this.snapshot.ropes.length}</span>`;

    const hingeButton = required<HTMLButtonElement>('#hinge-button');
    const hingeEligible = Boolean(selected && PARTS[selected.kind].canHinge && !selected.locked);
    hingeButton.disabled = !build || !hingeEligible || (!selectedHinge && this.snapshot.hinges.length >= MAX_HINGES);
    hingeButton.classList.toggle('active', this.hingeTool);
    hingeButton.innerHTML = selectedHinge
      ? '⊙ Перенести ось <span>H</span>'
      : `⊙ Установить ось <span>×${MAX_HINGES - this.snapshot.hinges.length}</span>`;

    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      const kind = button.dataset.kind;
      if (!isPartKind(kind)) continue;
      const count = remaining(this.snapshot, kind);
      button.disabled = !build || count <= 0;
      const counter = button.querySelector<HTMLElement>('[data-count]');
      if (counter) counter.textContent = `×${count}`;
    }

    this.updateSelectionFields();
    this.updateCanvasCursor();
  }
}
