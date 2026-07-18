import { CanvasRenderer } from './renderer';
import { PhysicsEngine, endpointWorld } from './physics';
import {
  INVENTORY,
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
  localToWorld,
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

const SAVE_KEY = 'young-inventor:box2d:v1';
const FIXED_STEP = 1 / 120;
const MAX_FRAME = 0.05;

interface DragState {
  partId: string;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

interface PaletteDrag {
  pointerId: number;
  kind: PartKind;
  ghost: HTMLElement;
  button: HTMLButtonElement;
}

interface PointerRecord {
  x: number;
  y: number;
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
  private paletteDrag: PaletteDrag | null = null;
  private ropeTool = false;
  private hingeTool = false;
  private ropeStart: Endpoint | null = null;
  private pointerWorld: Point | null = null;
  private pointers = new Map<number, PointerRecord>();
  private pinchDistance = 0;
  private pinchCenter: Point | null = null;
  private panPointer: number | null = null;
  private panLast: Point | null = null;
  private nextId = 1;
  private lastFrame = performance.now();
  private accumulator = 0;
  private elapsed = 0;
  private completed = false;

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
    canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    canvas.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.renderer.zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
    }, { passive: false });
  }

  private bindControls(): void {
    required<HTMLButtonElement>('#run-button').addEventListener('click', () => this.start());
    required<HTMLButtonElement>('#pause-button').addEventListener('click', () => this.pauseOrResume());
    required<HTMLButtonElement>('#stop-button').addEventListener('click', () => this.stop());
    required<HTMLButtonElement>('#reset-button').addEventListener('click', () => this.resetLevel());
    required<HTMLButtonElement>('#clear-button').addEventListener('click', () => this.clearAddedParts());
    required<HTMLButtonElement>('#undo-button').addEventListener('click', () => this.undo());
    required<HTMLButtonElement>('#redo-button').addEventListener('click', () => this.redo());
    required<HTMLButtonElement>('#rotate-left').addEventListener('click', () => this.rotateSelected(-1));
    required<HTMLButtonElement>('#rotate-right').addEventListener('click', () => this.rotateSelected(1));
    required<HTMLButtonElement>('#fix-button').addEventListener('click', () => this.toggleFixed());
    required<HTMLButtonElement>('#rope-button').addEventListener('click', () => this.armRope());
    required<HTMLButtonElement>('#hinge-button').addEventListener('click', () => this.armHinge());
    required<HTMLButtonElement>('#delete-button').addEventListener('click', () => this.deleteSelected());
    required<HTMLButtonElement>('#save-button').addEventListener('click', () => this.save());
    required<HTMLButtonElement>('#load-button').addEventListener('click', () => this.load());
    required<HTMLButtonElement>('#camera-button').addEventListener('click', () => this.renderer.resetCamera());
    required<HTMLButtonElement>('#result-again').addEventListener('click', () => this.stop());
  }

  private bindPalette(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      button.addEventListener('pointerdown', (event) => {
        if (this.mode !== 'build' || button.disabled) return;
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo(); else this.undo();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.mode === 'build') this.start(); else this.pauseOrResume();
      }
      if (event.key === 'Escape') this.stop();
      if (event.key === 'Delete' || event.key === 'Backspace') this.deleteSelected();
      if (event.key === 'ArrowLeft') this.rotateSelected(-1);
      if (event.key === 'ArrowRight') this.rotateSelected(1);
      if (event.key.toLowerCase() === 'r') this.armRope();
      if (event.key.toLowerCase() === 'h') this.armHinge();
    });
  }

  private onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.renderer.canvas.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pointerWorld = this.renderer.screenToWorld(event.clientX, event.clientY);

    if (this.pointers.size >= 2) {
      this.drag = null;
      this.panPointer = null;
      const [first, second] = [...this.pointers.values()];
      this.pinchDistance = distance(first, second);
      this.pinchCenter = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      return;
    }
    if (this.mode !== 'build') return;

    if (this.ropeTool) {
      this.chooseRopePoint(this.pointerWorld);
      return;
    }
    if (this.hingeTool) {
      this.placeHinge(this.pointerWorld);
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
    } else if (!part) {
      this.panPointer = event.pointerId;
      this.panLast = { x: event.clientX, y: event.clientY };
    }
    this.updateUi();
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pointerWorld = this.renderer.screenToWorld(event.clientX, event.clientY);

    if (this.pointers.size >= 2) {
      const [first, second] = [...this.pointers.values()];
      const currentDistance = Math.max(1, distance(first, second));
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      if (this.pinchDistance > 0) this.renderer.zoomAt(currentDistance / this.pinchDistance, center.x, center.y);
      if (this.pinchCenter) this.renderer.panBy(center.x - this.pinchCenter.x, center.y - this.pinchCenter.y);
      this.pinchDistance = currentDistance;
      this.pinchCenter = center;
      return;
    }

    if (this.mode !== 'build') return;
    if (this.drag) {
      const part = this.snapshot.parts.find((candidate) => candidate.id === this.drag?.partId);
      if (!part) return;
      part.x = Math.max(40, Math.min(WORLD_WIDTH - 40, this.pointerWorld.x - this.drag.offsetX));
      part.y = Math.max(115, Math.min(WORLD_HEIGHT - 95, this.pointerWorld.y - this.drag.offsetY));
      this.drag.moved = true;
      return;
    }
    if (this.panPointer === event.pointerId && this.panLast) {
      this.renderer.panBy(event.clientX - this.panLast.x, event.clientY - this.panLast.y);
      this.panLast = { x: event.clientX, y: event.clientY };
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault();
    this.pointers.delete(event.pointerId);
    if (this.drag?.moved) this.commit('Деталь перемещена.');
    this.drag = null;
    if (this.panPointer === event.pointerId) {
      this.panPointer = null;
      this.panLast = null;
    }
    if (this.pointers.size < 2) {
      this.pinchDistance = 0;
      this.pinchCenter = null;
    }
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
    const part: PartState = {
      id: `${kind}-${this.nextId++}`,
      kind,
      x: Math.max(spec.width / 2 + 15, Math.min(WORLD_WIDTH - spec.width / 2 - 15, point.x)),
      y: Math.max(120, Math.min(WORLD_HEIGHT - spec.height / 2 - 90, point.y)),
      angle: 0,
      fixed: spec.defaultFixed
    };
    this.snapshot.parts.push(part);
    this.selectedId = part.id;
    this.commit(`${spec.label} добавлен в свободное место.`);
  }

  private chooseRopePoint(point: Point): void {
    const part = topPartAt(this.snapshot, point);
    if (!part || part.kind === 'wall') {
      this.setStatus('Коснись шара, доски, рычага, блока или груза.');
      return;
    }
    const local = clampLocalPoint(part, worldToLocal(part, point));
    const endpoint: Endpoint = { partId: part.id, localX: local.x, localY: local.y };
    if (!this.ropeStart) {
      this.ropeStart = endpoint;
      this.setStatus('Начало верёвки выбрано. Коснись другой детали.');
      this.updateUi();
      return;
    }
    if (this.ropeStart.partId === endpoint.partId) {
      this.setStatus('Концы верёвки должны находиться на разных деталях.');
      return;
    }
    if (this.snapshot.ropes.length >= MAX_ROPES) {
      this.setStatus('Все верёвки уже использованы.');
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
      this.setStatus('Все оси уже использованы.');
      return;
    }
    const local = clampLocalPoint(part, worldToLocal(part, point));
    local.y = 0;
    this.snapshot.hinges = this.snapshot.hinges.filter((hinge) => hinge.partId !== part.id);
    this.snapshot.hinges.push({
      id: existing?.id ?? `hinge-${this.nextId++}`,
      partId: part.id,
      localX: local.x,
      localY: local.y,
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
    this.setStatus(this.ropeTool ? 'Верёвка: выбери две точки на разных деталях.' : 'Режим верёвки отменён.');
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
    this.setStatus(this.hingeTool ? 'Ось: коснись выбранной детали в точке опоры.' : 'Режим установки оси отменён.');
    this.updateUi();
  }

  private rotateSelected(direction: -1 | 1): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked || part.kind === 'ball' || part.kind === 'pulley') return;
    part.angle += direction * Math.PI / 24;
    this.commit('Угол детали изменён.');
  }

  private toggleFixed(): void {
    if (this.mode !== 'build') return;
    const part = this.selectedPart();
    if (!part || part.locked) return;
    const hinge = this.snapshot.hinges.find((candidate) => candidate.partId === part.id);
    if (hinge) {
      this.setStatus('Деталь уже закреплена осью. Удали ось, чтобы закрепить её жёстко.');
      return;
    }
    part.fixed = !part.fixed;
    this.commit(part.fixed ? 'Деталь закреплена неподвижно.' : 'Крепление снято: деталь будет двигаться.');
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
    this.ropeTool = false;
    this.hingeTool = false;
    this.ropeStart = null;
    this.setStatus('Симуляция запущена. Работают только Box2D и созданные соединения.');
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
    this.setStatus('Конструкция сохранена на этом устройстве.');
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
      this.history.reset(this.snapshot);
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
    inspector.classList.toggle('visible', build && (Boolean(selected) || this.ropeTool || this.hingeTool));
    required<HTMLElement>('#selection-name').textContent = selected ? PARTS[selected.kind].label.toUpperCase() : 'ИНСТРУМЕНТЫ';
    required<HTMLElement>('#selection-angle').textContent = selected ? `${Math.round(selected.angle * 180 / Math.PI)}°` : '';

    const rotatable = Boolean(selected && !selected.locked && selected.kind !== 'ball' && selected.kind !== 'pulley');
    required<HTMLButtonElement>('#rotate-left').disabled = !build || !rotatable;
    required<HTMLButtonElement>('#rotate-right').disabled = !build || !rotatable;
    required<HTMLButtonElement>('#delete-button').disabled = !build || !selected || Boolean(selected.locked);
    const fixedButton = required<HTMLButtonElement>('#fix-button');
    fixedButton.disabled = !build || !selected || Boolean(selected.locked) || Boolean(selectedHinge);
    fixedButton.textContent = selectedHinge ? '⊙ НА ОСИ' : selected?.fixed ? '📌 ОТКРЕПИТЬ' : '📍 ЗАКРЕПИТЬ';

    const ropeButton = required<HTMLButtonElement>('#rope-button');
    ropeButton.disabled = !build || (!this.ropeTool && this.snapshot.ropes.length >= MAX_ROPES);
    ropeButton.classList.toggle('active', this.ropeTool);
    ropeButton.textContent = this.ropeTool ? '〰 ВЫБЕРИ ТОЧКИ' : `〰 ВЕРЁВКА ×${MAX_ROPES - this.snapshot.ropes.length}`;

    const hingeButton = required<HTMLButtonElement>('#hinge-button');
    const hingeEligible = Boolean(selected && PARTS[selected.kind].canHinge && !selected.locked);
    hingeButton.disabled = !build || !hingeEligible || (!selectedHinge && this.snapshot.hinges.length >= MAX_HINGES);
    hingeButton.classList.toggle('active', this.hingeTool);
    hingeButton.textContent = selectedHinge ? '⊙ ПЕРЕНЕСТИ ОСЬ' : `⊙ ОСЬ ×${MAX_HINGES - this.snapshot.hinges.length}`;

    for (const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')) {
      const kind = button.dataset.kind;
      if (!isPartKind(kind)) continue;
      const count = remaining(this.snapshot, kind);
      button.disabled = !build || count <= 0;
      const counter = button.querySelector<HTMLElement>('[data-count]');
      if (counter) counter.textContent = `×${count}`;
    }
  }
}
