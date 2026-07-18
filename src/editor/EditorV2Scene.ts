// @ts-nocheck
import Phaser from 'phaser';
import { SandboxScene, WORLD_HEIGHT, WORLD_WIDTH } from './SandboxScene';
import type { Endpoint, MachineSnapshot, PartInstance, Vec2 } from '../tim-core/types';
import { SnapshotHistory } from './SnapshotHistory';
import { createPartInstance, getPartSpec, type EditorPartKind } from './catalog';
import { createLevelSnapshot, LEVEL_ID, LEVEL_INVENTORY, LEVEL_ROPES } from './levelOne';

const SAVE_KEY = `tim-editor-v2:${LEVEL_ID}`;
export { WORLD_HEIGHT, WORLD_WIDTH };
export let activeEditor: EditorV2Scene | null = null;

type MatterPart = Phaser.Physics.Matter.Image & { body: MatterJS.BodyType };

export class EditorV2Scene extends SandboxScene {
  private history!: SnapshotHistory;
  private rotationHandle!: Phaser.GameObjects.Arc;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private pointerWorld: Vec2 = { x: 0, y: 0 };
  private rotating = false;
  private dragging = false;
  private panPointer: number | null = null;
  private panLast = { x: 0, y: 0 };
  private pinchDistance = 0;
  private won = false;
  private elapsed = 0;
  private lastTick = 0;

  constructor() { super(); }

  create(): void {
    super.create();
    activeEditor = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeEditor === this) activeEditor = null;
    });
    this.input.addPointer(2);
    this.createPuzzleGeometry();
    this.model.loadSnapshot(createLevelSnapshot());
    for (const part of this.model.getParts()) this.createVisual(part);
    this.history = new SnapshotHistory(this.model.captureSnapshot());
    this.previewGraphics = this.add.graphics().setDepth(29);
    this.rotationHandle = this.add.circle(0, 0, 16, 0xffc56c, 1)
      .setStrokeStyle(3, 0x2a1a0f, 1).setDepth(42).setVisible(false).setInteractive({ useHandCursor: true });
    this.rotationHandle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.selectedId || this.model.mode !== 'build') return;
      pointer.event.stopPropagation?.();
      this.rotating = true;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld = { x: pointer.worldX, y: pointer.worldY };
      if (this.rotating) this.rotateHandleTo(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointerup', () => {
      if (this.rotating) this.commit('Угол детали изменён.');
      this.rotating = false;
    });
    this.input.on('dragstart', () => { this.dragging = true; });
    this.input.on('dragend', () => {
      if (this.dragging) this.commit('Деталь перемещена.');
      this.dragging = false;
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (objects.length === 0 && this.model.mode === 'build' && !this.ropeToolArmed) {
        this.panPointer = pointer.id;
        this.panLast = { x: pointer.x, y: pointer.y };
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.panPointer === pointer.id) this.panPointer = null;
    });
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      if (this.model.mode !== 'running' || this.won) return;
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label ?? '', pair.bodyB.label ?? ''];
        if (labels.includes('goal-sensor') && labels.some((label) => label.includes('ball'))) {
          this.completeLevel();
          break;
        }
      }
    });
    this.setStatus('Построй путь: шар должен попасть в корзину справа.');
    this.updateAllUi();
    (window as Window & { __TIM_EDITOR_V2_READY__?: boolean }).__TIM_EDITOR_V2_READY__ = true;
  }

  update(): void {
    super.update();
    this.updateCameraGesture();
    this.updateRotationHandle();
    this.drawRopePreview();
    this.updateTimer();
  }

  addPartFromPalette(kind: EditorPartKind, position: Vec2): void {
    if (this.remaining(kind) <= 0) {
      this.setStatus('Эта деталь закончилась. Удали одну или выбери другой способ.');
      return;
    }
    super.addPartFromPalette(kind, position);
    this.commit(`${getPartSpec(kind).label} добавлен свободно.`);
  }

  rotateSelected(direction: -1 | 1): void {
    const before = this.model.captureSnapshot();
    super.rotateSelected(direction);
    if (JSON.stringify(before) !== JSON.stringify(this.model.captureSnapshot())) this.commit('Угол детали изменён.');
  }

  duplicateSelected(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const source = this.model.getPart(this.selectedId);
    if (this.isLocked(source)) return;
    const kind = source.metadata.editorKind as EditorPartKind;
    if (this.remaining(kind) <= 0) return void this.setStatus('В инвентаре больше нет такой детали.');
    const id = `${kind}-${this.nextPartNumber++}`;
    const copy = createPartInstance(kind, id, {
      x: Phaser.Math.Clamp(source.transform.position.x + 36, 60, WORLD_WIDTH - 60),
      y: Phaser.Math.Clamp(source.transform.position.y + 36, 110, 780)
    });
    const placed = { ...copy, transform: { ...copy.transform, angle: source.transform.angle }, fixed: source.fixed };
    this.model.addPart(placed);
    this.createVisual(placed);
    this.selectPart(id);
    this.commit('Создана копия выбранной детали.');
  }

  toggleSelectedFixed(): void {
    const before = this.model.captureSnapshot();
    super.toggleSelectedFixed();
    if (JSON.stringify(before) !== JSON.stringify(this.model.captureSnapshot())) this.commit('Крепление детали изменено.');
  }

  deleteSelected(): void {
    if (!this.selectedId) return;
    const part = this.model.getPart(this.selectedId);
    if (this.isLocked(part)) return;
    super.deleteSelected();
    this.commit('Деталь и её соединения удалены.');
  }

  clearMachine(): void {
    if (this.model.mode !== 'build') return;
    for (const part of [...this.model.getParts()]) {
      if (this.isLocked(part)) continue;
      this.model.removePart(part.id);
      this.visuals.get(part.id)?.destroy();
      this.visuals.delete(part.id);
    }
    this.selectedId = null;
    this.ropeStart = null;
    this.ropeToolArmed = false;
    this.commit('Все добавленные детали убраны.');
  }

  armRopeTool(): void {
    if (!this.ropeToolArmed && this.remainingRopes() <= 0) {
      this.setStatus('Верёвки закончились.');
      return;
    }
    super.armRopeTool();
    this.updateAllUi();
  }

  undo(): void {
    if (this.model.mode !== 'build') return;
    const snapshot = this.history.undo();
    if (!snapshot) return;
    this.applySnapshot(snapshot);
    this.setStatus('Последнее действие отменено.');
  }

  redo(): void {
    if (this.model.mode !== 'build') return;
    const snapshot = this.history.redo();
    if (!snapshot) return;
    this.applySnapshot(snapshot);
    this.setStatus('Действие повторено.');
  }

  saveMachine(): void {
    if (this.model.mode !== 'build') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.model.captureSnapshot()));
    this.setStatus('Конструкция сохранена на этом устройстве.');
    this.updateAllUi();
  }

  loadMachine(): void {
    if (this.model.mode !== 'build') return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return void this.setStatus('Сохранённой конструкции пока нет.');
    try {
      this.model.loadSnapshot(JSON.parse(raw) as MachineSnapshot);
      this.reseedCounters();
      this.history.reset(this.model.captureSnapshot());
      this.syncVisuals();
      this.setStatus('Сохранённая конструкция загружена.');
      this.updateAllUi();
    } catch {
      localStorage.removeItem(SAVE_KEY);
      this.setStatus('Сохранение повреждено и удалено.');
    }
  }

  resetLevel(): void {
    if (this.model.mode !== 'build') this.stopSimulation();
    this.model.loadSnapshot(createLevelSnapshot());
    this.history.reset(this.model.captureSnapshot());
    this.nextPartNumber = 1;
    this.nextConnectionNumber = 1;
    this.syncVisuals();
    this.hideResult();
    this.resetCamera();
    this.setStatus('Уровень сброшен. Построй новый механизм.');
    this.updateAllUi();
  }

  startSimulation(): void {
    this.won = false;
    this.elapsed = 0;
    this.lastTick = this.time.now;
    this.hideResult();
    super.startSimulation();
    this.updateAllUi();
  }

  pauseOrResume(): void {
    if (this.model.mode === 'running') this.accumulateTime();
    super.pauseOrResume();
    if (this.model.mode === 'running') this.lastTick = this.time.now;
    this.updateAllUi();
  }

  stopSimulation(): void {
    super.stopSimulation();
    for (const part of this.model.getParts()) {
      if (this.isLocked(part)) this.visuals.get(part.id)?.disableInteractive();
    }
    this.won = false;
    this.hideResult();
    this.updateAllUi();
  }

  dismissResult(): void { this.stopSimulation(); }

  resetCamera(): void {
    this.cameras.main.setZoom(1).setScroll(0, 0);
  }

  protected createVisual(part: PartInstance): void {
    const kind = part.metadata.editorKind as EditorPartKind;
    const spec = getPartSpec(kind);
    const visual = this.matter.add.image(part.transform.position.x, part.transform.position.y, `part-${kind}`) as MatterPart;
    if (spec.radius) visual.setCircle(spec.radius); else visual.setRectangle(spec.width, spec.height);
    visual.setFriction(spec.friction).setFrictionAir(kind === 'ball' ? 0.002 : 0.012).setBounce(spec.restitution).setDensity(spec.density).setStatic(true);
    Phaser.Physics.Matter.Matter.Body.setAngle(visual.body, part.transform.angle);
    visual.setRotation(part.transform.angle);
    visual.body.label = part.id;
    visual.setData('partId', part.id).setData('editorKind', kind).setDepth(10);
    if (!this.isLocked(part)) {
      visual.setInteractive({ useHandCursor: true });
      this.input.setDraggable(visual, true);
    }
    this.visuals.set(part.id, visual);
  }

  protected selectPart(id: string | null): void {
    if (id && this.isLocked(this.model.getPart(id))) id = null;
    super.selectPart(id);
    this.updateAllUi();
  }

  protected chooseRopeEndpoint(partId: string, point: Vec2): void {
    const before = this.model.getConnections().length;
    super.chooseRopeEndpoint(partId, point);
    if (this.model.getConnections().length > before) this.commit('Верёвка создана вручную.');
    else this.updateAllUi();
  }

  protected updateInspector(): void {
    super.updateInspector();
    const part = this.selectedId ? this.model.getPart(this.selectedId) : null;
    const duplicate = document.querySelector<HTMLButtonElement>('#duplicate-button');
    const name = document.querySelector<HTMLElement>('#selection-name');
    const angle = document.querySelector<HTMLElement>('#selection-angle');
    if (duplicate) duplicate.disabled = !part || this.isLocked(part) || this.remaining(part.metadata.editorKind as EditorPartKind) <= 0;
    if (name) name.textContent = part ? getPartSpec(part.metadata.editorKind as EditorPartKind).label.toUpperCase() : 'ИНСТРУМЕНТЫ';
    if (angle) angle.textContent = part ? `${Math.round(Phaser.Math.RadToDeg(part.transform.angle))}°` : '';
    const rope = document.querySelector<HTMLButtonElement>('#rope-button');
    if (rope) {
      rope.disabled = this.model.mode !== 'build' || (!this.ropeToolArmed && this.remainingRopes() <= 0);
      rope.textContent = `〰 ВЕРЁВКА ×${this.remainingRopes()}`;
    }
  }

  private commit(message: string): void {
    this.history.commit(this.model.captureSnapshot());
    this.setStatus(message);
    this.updateAllUi();
  }

  private applySnapshot(snapshot: MachineSnapshot): void {
    this.model.loadSnapshot(snapshot);
    this.reseedCounters();
    this.syncVisuals();
    this.updateAllUi();
  }

  private syncVisuals(): void {
    for (const visual of this.visuals.values()) visual.destroy();
    this.visuals.clear();
    this.selectedId = null;
    this.ropeStart = null;
    this.ropeToolArmed = false;
    for (const part of this.model.getParts()) this.createVisual(part);
  }

  private reseedCounters(): void {
    this.nextPartNumber = 1 + this.model.getParts().reduce((max, part) => Math.max(max, Number(part.id.match(/-(\d+)$/)?.[1] ?? 0)), 0);
    this.nextConnectionNumber = 1 + this.model.getConnections().reduce((max, item) => Math.max(max, Number(item.id.match(/-(\d+)$/)?.[1] ?? 0)), 0);
  }

  private remaining(kind: EditorPartKind): number {
    const used = this.model.getParts().filter((part) => !this.isLocked(part) && part.metadata.editorKind === kind).length;
    return Math.max(0, LEVEL_INVENTORY[kind] - used);
  }

  private remainingRopes(): number {
    return Math.max(0, LEVEL_ROPES - this.model.getConnections().filter((item) => item.kind === 'rope').length);
  }

  private isLocked(part: PartInstance): boolean { return part.metadata.locked === true; }

  private updateAllUi(): void {
    this.updateModeUi();
    this.updateInspector();
    document.querySelectorAll<HTMLButtonElement>('.palette-part').forEach((button) => {
      const kind = button.dataset.kind as EditorPartKind;
      const count = this.remaining(kind);
      button.disabled = count <= 0 || this.model.mode !== 'build';
      const label = button.querySelector<HTMLElement>('.part-count');
      if (label) label.textContent = `×${count}`;
    });
    const undo = document.querySelector<HTMLButtonElement>('#undo-button');
    const redo = document.querySelector<HTMLButtonElement>('#redo-button');
    const load = document.querySelector<HTMLButtonElement>('#load-button');
    if (undo) undo.disabled = !this.history?.canUndo() || this.model.mode !== 'build';
    if (redo) redo.disabled = !this.history?.canRedo() || this.model.mode !== 'build';
    if (load) load.disabled = !localStorage.getItem(SAVE_KEY) || this.model.mode !== 'build';
  }

  private rotateHandleTo(x: number, y: number): void {
    if (!this.selectedId) return;
    const part = this.model.getPart(this.selectedId);
    const visual = this.visuals.get(this.selectedId);
    if (!visual || this.isLocked(part) || !part.definition.canRotate) return;
    const angle = Math.atan2(y - visual.y, x - visual.x) + Math.PI / 2;
    this.model.rotatePart(part.id, angle);
    Phaser.Physics.Matter.Matter.Body.setAngle(visual.body, angle);
    visual.setRotation(angle);
    this.updateInspector();
  }

  private updateRotationHandle(): void {
    if (!this.selectedId || this.model.mode !== 'build' || this.ropeToolArmed) return void this.rotationHandle.setVisible(false);
    const part = this.model.getPart(this.selectedId);
    const visual = this.visuals.get(this.selectedId);
    if (!visual || this.isLocked(part) || !part.definition.canRotate) return void this.rotationHandle.setVisible(false);
    const spec = getPartSpec(part.metadata.editorKind as EditorPartKind);
    const radius = Math.max(spec.width, spec.height) / 2 + 42;
    const angle = visual.rotation - Math.PI / 2;
    this.rotationHandle.setPosition(visual.x + Math.cos(angle) * radius, visual.y + Math.sin(angle) * radius).setVisible(true);
  }

  private drawRopePreview(): void {
    this.previewGraphics.clear();
    if (this.selectedId && this.rotationHandle.visible) {
      const visual = this.visuals.get(this.selectedId);
      if (visual) this.previewGraphics.lineStyle(2, 0xffc56c, .8).lineBetween(visual.x, visual.y, this.rotationHandle.x, this.rotationHandle.y);
    }
    if (this.ropeToolArmed && this.ropeStart) {
      const a = this.anchorWorld(this.ropeStart as Endpoint);
      this.previewGraphics.lineStyle(4, 0xffc56c, .9).lineBetween(a.x, a.y, this.pointerWorld.x, this.pointerWorld.y);
    }
  }

  private updateCameraGesture(): void {
    if (this.dragging || this.rotating || this.ropeToolArmed) return;
    const pointers = this.input.manager.pointers.filter((p: Phaser.Input.Pointer) => p.isDown);
    const camera = this.cameras.main;
    if (pointers.length >= 2) {
      const [a, b] = pointers;
      const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinchDistance > 0) {
        const before = camera.getWorldPoint(mid.x, mid.y);
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * distance / this.pinchDistance, 1, 2.35));
        const after = camera.getWorldPoint(mid.x, mid.y);
        camera.scrollX += before.x - after.x;
        camera.scrollY += before.y - after.y;
        this.clampCamera();
      }
      this.pinchDistance = distance;
      this.panPointer = null;
      return;
    }
    this.pinchDistance = 0;
    if (this.panPointer !== null) {
      const pointer = pointers.find((p: Phaser.Input.Pointer) => p.id === this.panPointer);
      if (!pointer) return;
      camera.scrollX -= (pointer.x - this.panLast.x) / camera.zoom;
      camera.scrollY -= (pointer.y - this.panLast.y) / camera.zoom;
      this.panLast = { x: pointer.x, y: pointer.y };
      this.clampCamera();
    }
  }

  private clampCamera(): void {
    const camera = this.cameras.main;
    camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, WORLD_WIDTH - camera.width / camera.zoom));
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, WORLD_HEIGHT - camera.height / camera.zoom));
  }

  private createPuzzleGeometry(): void {
    const platform = (x: number, y: number, width: number, angle: number) => {
      this.matter.add.rectangle(x, y, width, 24, { isStatic: true, angle, friction: .72, restitution: .04, label: 'level-platform' });
      this.add.rectangle(x, y, width, 24, 0x5b6570, 1).setStrokeStyle(3, 0x242a2f, 1).setRotation(angle).setDepth(4);
    };
    platform(250, 260, 360, .08);
    platform(690, 455, 250, 0);
    platform(1080, 620, 230, -.03);
    this.matter.add.rectangle(820, 655, 32, 300, { isStatic: true, label: 'level-barrier', friction: .7 });
    this.add.rectangle(820, 655, 32, 300, 0x4b555f, 1).setStrokeStyle(3, 0x20252a, 1).setDepth(4);
    const x = 1390, y = 735;
    this.matter.add.rectangle(x - 72, y - 62, 18, 126, { isStatic: true, label: 'basket-wall' });
    this.matter.add.rectangle(x + 72, y - 62, 18, 126, { isStatic: true, label: 'basket-wall' });
    this.matter.add.rectangle(x, y, 162, 18, { isStatic: true, label: 'basket-bottom' });
    this.matter.add.rectangle(x, y - 54, 120, 92, { isStatic: true, isSensor: true, label: 'goal-sensor' });
    const basket = this.add.graphics().setDepth(5);
    basket.fillStyle(0x6d4525, 1).fillRoundedRect(x - 82, y - 12, 164, 28, 8);
    basket.fillStyle(0xa76a35, 1).fillRoundedRect(x - 82, y - 128, 18, 128, 8).fillRoundedRect(x + 64, y - 128, 18, 128, 8);
    basket.lineStyle(5, 0xd6a263, 1).strokeRoundedRect(x - 72, y - 120, 144, 124, 14);
    this.add.text(x, y + 28, 'ЦЕЛЬ', { color: '#6b4b2c', fontFamily: 'system-ui', fontSize: '17px', fontStyle: 'bold' }).setOrigin(.5).setDepth(6);
  }

  private completeLevel(): void {
    this.won = true;
    this.accumulateTime();
    this.model.pauseSimulation();
    this.matter.world.pause();
    this.paused = true;
    const card = document.querySelector<HTMLElement>('#result-card');
    const time = document.querySelector<HTMLElement>('#result-time');
    if (time) time.textContent = `${this.elapsed.toFixed(1)} сек.`;
    card?.classList.add('visible');
    document.querySelector('#app')?.classList.add('completed');
    this.setStatus('Готово! Шар попал в корзину благодаря твоей конструкции.');
    this.updateAllUi();
  }

  private accumulateTime(): void {
    if (this.model.mode !== 'running') return;
    const now = this.time.now;
    this.elapsed += Math.max(0, now - this.lastTick) / 1000;
    this.lastTick = now;
  }

  private updateTimer(): void {
    if (this.model.mode === 'running') this.accumulateTime();
    const timer = document.querySelector<HTMLElement>('#run-timer');
    if (timer) timer.textContent = `${(this.model.mode === 'build' ? 0 : this.elapsed).toFixed(1)}с`;
  }

  private hideResult(): void {
    document.querySelector<HTMLElement>('#result-card')?.classList.remove('visible');
    document.querySelector('#app')?.classList.remove('completed');
  }
}
