// @ts-nocheck
import Phaser from 'phaser';
import { EditorV3Scene, WORLD_HEIGHT, WORLD_WIDTH } from './EditorV3Scene';
import type { Connection, MachineSnapshot, PartInstance, Vec2 } from '../tim-core/types';
import { createPartInstance, getPartSpec, type EditorPartKind } from './catalog';
import {
  createGateLevelSnapshot,
  GATE_LEVEL_HINGES,
  GATE_LEVEL_ID,
  GATE_LEVEL_INVENTORY,
  GATE_LEVEL_ROPES,
  GATE_LEVEL_TITLE
} from './levelGate';
import {
  clampHingeAngle,
  clampPivotToLever,
  hingeLimitPreset,
  localPointToWorld,
  worldPointToLocal
} from './hinge/HingeMath';

export { WORLD_HEIGHT, WORLD_WIDTH };

const SAVE_KEY = `tim-editor-v4:${GATE_LEVEL_ID}`;
type MatterPart = Phaser.Physics.Matter.Image & { body: MatterJS.BodyType };

interface RuntimeHinge {
  readonly connection: Connection;
  readonly constraint: MatterJS.ConstraintType;
}

export class EditorV4Scene extends EditorV3Scene {
  private hingeToolArmed = false;
  private runtimeHinges: RuntimeHinge[] = [];
  private hingeGraphics!: Phaser.GameObjects.Graphics;

  create(): void {
    super.create();
    this.createV4Textures();
    this.hingeGraphics = this.add.graphics().setDepth(31);

    this.model.loadSnapshot(createGateLevelSnapshot());
    this.history.reset(this.model.captureSnapshot());
    this.reseedCounters();
    this.syncVisuals();

    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, object: MatterPart) => {
      if (!this.hingeToolArmed || this.model.mode !== 'build') return;
      const id = object.getData('partId');
      if (id) this.placeHinge(id, { x: pointer.worldX, y: pointer.worldY });
    });

    document.title = 'TIM 2.0 — Подними ворота';
    const number = document.querySelector<HTMLElement>('.level-number');
    const title = document.querySelector<HTMLElement>('.mission-block h1');
    const subtitle = document.querySelector<HTMLElement>('.mission-block p');
    const resultText = document.querySelector<HTMLElement>('#result-card p');
    if (number) number.textContent = '02';
    if (title) title.textContent = GATE_LEVEL_TITLE;
    if (subtitle) subtitle.textContent = 'Используй рычаг, ось, противовес или блоки. Решение выбираешь ты.';
    if (resultText) resultText.textContent = 'Шар прошёл через открытые ворота.';

    this.setStatus('Поставь рычаг, выбери его и нажми «Ось», затем коснись нужной точки опоры.');
    this.updateAllUi();
    (window as Window & { __TIM_HINGES_READY__?: boolean }).__TIM_HINGES_READY__ = true;
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (this.model.mode === 'running') this.applyHingeLimits();
    this.drawHinges();
  }

  armHingeTool(): void {
    if (this.model.mode !== 'build') return;
    if (this.hingeToolArmed) {
      this.hingeToolArmed = false;
      this.setStatus('Установка оси отменена.');
      this.updateInspector();
      return;
    }
    if (!this.selectedId) return void this.setStatus('Сначала выбери рычаг или доску.');
    const part = this.model.getPart(this.selectedId);
    if (!this.canReceiveHinge(part)) return void this.setStatus('Ось можно установить только на рычаг или доску.');
    if (!this.findUserHinge(part.id) && this.remainingHinges() <= 0) return void this.setStatus('Все доступные оси уже использованы.');

    this.ropeToolArmed = false;
    this.ropeStart = null;
    this.hingeToolArmed = true;
    this.setStatus('Коснись рычага в точке, где должна находиться ось. Точка опоры выбирается свободно.');
    this.updateInspector();
  }

  cycleSelectedHingeLimit(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const existing = this.findUserHinge(this.selectedId);
    if (!existing) return void this.setStatus('Сначала установи ось на выбранную деталь.');

    const isFree = existing.minAngle === undefined || existing.maxAngle === undefined;
    const span = isFree ? Infinity : existing.maxAngle! - existing.minAngle!;
    const mode = isFree ? 'wide' : span > Math.PI * 0.8 ? 'narrow' : 'free';
    const limits = hingeLimitPreset(mode);
    this.model.disconnect(existing.id);
    this.model.connect({ ...existing, ...limits, minAngle: limits.minAngle, maxAngle: limits.maxAngle });
    this.commit(mode === 'free' ? 'Ограничитель угла снят.' : mode === 'narrow' ? 'Установлен узкий ограничитель ±36°.' : 'Установлен широкий ограничитель ±83°.');
  }

  removeSelectedHinge(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const connection = this.findUserHinge(this.selectedId);
    if (!connection) return;
    this.removeHingeConnection(connection);
    this.hingeToolArmed = false;
    this.commit('Ось и ограничитель удалены. Деталь снова свободна.');
  }

  deleteSelected(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const id = this.selectedId;
    const part = this.model.getPart(id);
    if (this.isLocked(part)) return;
    const hinge = this.findUserHinge(id);
    if (hinge) this.removeHingeConnection(hinge);
    this.model.removePart(id);
    this.visuals.get(id)?.destroy();
    this.visuals.delete(id);
    this.selectedId = null;
    this.ropeStart = null;
    this.hingeToolArmed = false;
    this.commit('Деталь, её ось и связанные соединения удалены.');
  }

  saveMachine(): void {
    if (this.model.mode !== 'build') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.model.captureSnapshot()));
    this.setStatus('Конструкция уровня «Подними ворота» сохранена на этом устройстве.');
    this.updateAllUi();
  }

  loadMachine(): void {
    if (this.model.mode !== 'build') return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return void this.setStatus('Сохранённой конструкции этого уровня пока нет.');
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
    this.model.loadSnapshot(createGateLevelSnapshot());
    this.history.reset(this.model.captureSnapshot());
    this.nextPartNumber = 1;
    this.nextConnectionNumber = 1;
    this.hingeToolArmed = false;
    this.syncVisuals();
    this.hideResult();
    this.resetCamera();
    this.setStatus('Уровень сброшен. Подними ворота любым рабочим способом.');
    this.updateAllUi();
  }

  startSimulation(): void {
    this.hingeToolArmed = false;
    super.startSimulation();
  }

  stopSimulation(): void {
    super.stopSimulation();
    this.hingeToolArmed = false;
    this.drawHinges();
  }

  protected createVisual(part: PartInstance): void {
    super.createVisual(part);
    if (part.metadata.editorKind === 'hinge') {
      const visual = this.visuals.get(part.id);
      visual?.disableInteractive();
      if (visual) this.input.setDraggable(visual, false);
    }
  }

  protected createRuntimeConstraints(): void {
    super.createRuntimeConstraints();
    this.runtimeHinges = [];
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'hinge') continue;
      const aPart = this.model.getPart(connection.a.partId);
      const bPart = this.model.getPart(connection.b.partId);
      const aVisual = this.visuals.get(aPart.id);
      const bVisual = this.visuals.get(bPart.id);
      if (!aVisual || !bVisual) continue;
      const aAnchor = aPart.definition.anchors.find((anchor) => anchor.id === connection.a.anchorId);
      const bAnchor = bPart.definition.anchors.find((anchor) => anchor.id === connection.b.anchorId);
      const pointA = connection.localPointA ?? aAnchor?.localPosition ?? { x: 0, y: 0 };
      const pointB = connection.localPointB ?? bAnchor?.localPosition ?? { x: 0, y: 0 };
      const constraint = this.matter.add.constraint(aVisual.body, bVisual.body, 0, 1, {
        pointA: { ...pointA },
        pointB: { ...pointB },
        damping: 0.2,
        label: connection.id
      });
      this.runtimeHinges.push({ connection, constraint });
    }
  }

  protected removeRuntimeConstraints(): void {
    for (const runtime of this.runtimeHinges) this.matter.world.removeConstraint(runtime.constraint);
    this.runtimeHinges = [];
    super.removeRuntimeConstraints();
  }

  protected updateInspector(): void {
    super.updateInspector();
    const part = this.selectedId ? this.model.getPart(this.selectedId) : null;
    const hinge = part ? this.findUserHinge(part.id) : null;
    const hingeButton = document.querySelector<HTMLButtonElement>('#hinge-button');
    const limitButton = document.querySelector<HTMLButtonElement>('#limit-button');
    const removeButton = document.querySelector<HTMLButtonElement>('#remove-hinge-button');
    const fixButton = document.querySelector<HTMLButtonElement>('#fix-button');
    const eligible = Boolean(part && this.canReceiveHinge(part) && !this.isLocked(part));

    if (hingeButton) {
      hingeButton.disabled = this.model.mode !== 'build' || !eligible || (!hinge && this.remainingHinges() <= 0);
      hingeButton.classList.toggle('active', this.hingeToolArmed);
      hingeButton.textContent = hinge ? '⊙ ПЕРЕНЕСТИ ОСЬ' : `⊙ ОСЬ ×${this.remainingHinges()}`;
    }
    if (limitButton) {
      limitButton.disabled = this.model.mode !== 'build' || !hinge;
      limitButton.textContent = hinge ? this.limitLabel(hinge) : '∠ ОГРАНИЧИТЕЛЬ';
    }
    if (removeButton) removeButton.disabled = this.model.mode !== 'build' || !hinge;
    if (fixButton && hinge) {
      fixButton.disabled = true;
      fixButton.textContent = '⊙ НА ОСИ';
    }
  }

  protected createPuzzleGeometry(): void {
    const platform = (x: number, y: number, width: number, angle: number) => {
      this.matter.add.rectangle(x, y, width, 24, { isStatic: true, angle, friction: 0.76, restitution: 0.03, label: 'level-platform' });
      this.add.rectangle(x, y, width, 24, 0x59646d, 1).setStrokeStyle(3, 0x22292e, 1).setRotation(angle).setDepth(4);
    };
    platform(270, 300, 430, 0.08);
    platform(800, 650, 1510, 0);

    const goalX = 1390;
    this.matter.add.rectangle(goalX, 590, 180, 105, { isStatic: true, isSensor: true, label: 'goal-sensor' });
    const goal = this.add.graphics().setDepth(3);
    goal.fillStyle(0x6f9b78, 0.2).fillRoundedRect(goalX - 92, 532, 184, 116, 18);
    goal.lineStyle(5, 0x52775b, 0.8).strokeRoundedRect(goalX - 92, 532, 184, 116, 18);
    this.add.text(goalX, 666, 'ВЫХОД', { color: '#55705b', fontFamily: 'system-ui', fontSize: '17px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);

    this.add.text(820, 350, 'ВОРОТА', { color: '#6b5140', fontFamily: 'system-ui', fontSize: '15px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);
  }

  private placeHinge(partId: string, worldPoint: Vec2): void {
    const part = this.model.getPart(partId);
    if (!this.canReceiveHinge(part) || this.isLocked(part)) return void this.setStatus('Выбери точку непосредственно на рычаге или доске.');
    const visual = this.visuals.get(part.id);
    if (!visual) return;

    const spec = getPartSpec(part.metadata.editorKind as EditorPartKind);
    const local = clampPivotToLever(worldPointToLocal(worldPoint, visual.body.position, visual.body.angle), spec.width);
    const pivotWorld = localPointToWorld(local, visual.body.position, visual.body.angle);
    const existing = this.findUserHinge(part.id);
    if (!existing && this.remainingHinges() <= 0) return void this.setStatus('Все оси уже использованы.');
    if (existing) this.removeHingeConnection(existing);

    const pinId = `hinge-${this.nextPartNumber++}`;
    const pinBase = createPartInstance('hinge', pinId, pivotWorld);
    const pin = { ...pinBase, metadata: { ...pinBase.metadata, internalHinge: true } };
    this.model.addPart(pin);
    this.createVisual(pin);
    this.model.setFixed(part.id, false);

    const anchor = part.definition.anchors.find((item) => item.kind === 'hinge');
    if (!anchor) return;
    const limits = hingeLimitPreset('wide');
    const connection: Connection = {
      id: `joint-${this.nextConnectionNumber++}`,
      kind: 'hinge',
      a: { partId: part.id, anchorId: anchor.id },
      b: { partId: pin.id, anchorId: 'pin' },
      localPointA: local,
      localPointB: { x: 0, y: 0 },
      referenceAngle: part.transform.angle,
      minAngle: limits.minAngle,
      maxAngle: limits.maxAngle
    };
    this.model.connect(connection);
    this.hingeToolArmed = false;
    this.selectPart(part.id);
    this.commit(`Ось установлена на расстоянии ${Math.round(local.x)} от центра рычага.`);
  }

  private removeHingeConnection(connection: Connection): void {
    const pinId = connection.b.partId;
    this.model.disconnect(connection.id);
    if (this.model.getParts().some((part) => part.id === pinId && part.metadata.editorKind === 'hinge')) {
      this.model.removePart(pinId);
      this.visuals.get(pinId)?.destroy();
      this.visuals.delete(pinId);
    }
  }

  private applyHingeLimits(): void {
    const Body = Phaser.Physics.Matter.Matter.Body;
    for (const runtime of this.runtimeHinges) {
      const { connection } = runtime;
      if (connection.minAngle === undefined || connection.maxAngle === undefined) continue;
      const visual = this.visuals.get(connection.a.partId);
      if (!visual || visual.body.isStatic) continue;
      const clamped = clampHingeAngle(visual.body.angle, connection.referenceAngle ?? 0, connection);
      if (Math.abs(clamped - visual.body.angle) < 0.0005) continue;
      Body.setAngle(visual.body, clamped);
      Body.setAngularVelocity(visual.body, -visual.body.angularVelocity * 0.08);
    }
  }

  private drawHinges(): void {
    if (!this.hingeGraphics) return;
    this.hingeGraphics.clear();
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'hinge') continue;
      const visual = this.visuals.get(connection.a.partId);
      if (!visual) continue;
      const point = localPointToWorld(connection.localPointA ?? { x: 0, y: 0 }, visual.body.position, visual.body.angle);
      const selected = this.selectedId === connection.a.partId;
      this.hingeGraphics.fillStyle(selected ? 0xffc56c : 0xd28a3f, 1).fillCircle(point.x, point.y, selected ? 11 : 8);
      this.hingeGraphics.lineStyle(3, 0x2b1b11, 1).strokeCircle(point.x, point.y, selected ? 11 : 8);
      this.hingeGraphics.fillStyle(0x30363a, 1).fillCircle(point.x, point.y, selected ? 4 : 3);
    }
  }

  private findUserHinge(partId: string): Connection | undefined {
    return this.model.getConnections().find((connection) => connection.kind === 'hinge' && connection.a.partId === partId && !connection.id.startsWith('level-'));
  }

  private canReceiveHinge(part: PartInstance): boolean {
    const kind = part.metadata.editorKind;
    return (kind === 'lever' || kind === 'plank') && part.definition.anchors.some((anchor) => anchor.kind === 'hinge');
  }

  private remaining(kind: EditorPartKind): number {
    const used = this.model.getParts().filter((part) => !this.isLocked(part) && part.metadata.editorKind === kind && part.metadata.internalHinge !== true).length;
    return Math.max(0, (GATE_LEVEL_INVENTORY[kind] ?? 0) - used);
  }

  private remainingRopes(): number {
    return Math.max(0, GATE_LEVEL_ROPES - this.model.getConnections().filter((item) => item.kind === 'rope').length);
  }

  private remainingHinges(): number {
    const used = this.model.getConnections().filter((item) => item.kind === 'hinge' && !item.id.startsWith('level-')).length;
    return Math.max(0, GATE_LEVEL_HINGES - used);
  }

  private isLocked(part: PartInstance): boolean {
    return part.metadata.locked === true;
  }

  private limitLabel(connection: Connection): string {
    if (connection.minAngle === undefined || connection.maxAngle === undefined) return '∠ БЕЗ ОГР.';
    const degrees = Math.round((connection.maxAngle - connection.minAngle) * 90 / Math.PI);
    return degrees < 90 ? '∠ ±36°' : '∠ ±83°';
  }

  private updateAllUi(): void {
    super.updateAllUi();
    const load = document.querySelector<HTMLButtonElement>('#load-button');
    if (load) load.disabled = !localStorage.getItem(SAVE_KEY) || this.model.mode !== 'build';
    this.updateInspector();
  }

  private createV4Textures(): void {
    const make = (key: string, width: number, height: number, draw: (graphics: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      draw(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    };

    make('part-lever', 270, 32, (g) => {
      g.fillStyle(0x17191c, 1).fillRoundedRect(0, 2, 270, 28, 7);
      g.fillGradientStyle(0xc77f3c, 0x9f5426, 0x6a3215, 0x45200d, 1).fillRoundedRect(5, 6, 260, 20, 5);
      g.lineStyle(2, 0xf0b66f, 0.65).lineBetween(14, 10, 252, 10);
      g.fillStyle(0x282d31, 1).fillCircle(17, 16, 6).fillCircle(253, 16, 6);
    });
    make('part-hinge', 34, 34, (g) => {
      g.fillStyle(0x1b1e20, 1).fillCircle(17, 17, 16);
      g.fillStyle(0xd58a3d, 1).fillCircle(17, 17, 12);
      g.fillStyle(0x343a3e, 1).fillCircle(17, 17, 6);
      g.fillStyle(0xe6edf0, 0.65).fillCircle(14, 13, 3);
    });
    make('part-gate', 38, 236, (g) => {
      g.fillStyle(0x171a1d, 1).fillRoundedRect(1, 0, 36, 236, 7);
      g.fillGradientStyle(0x7b8790, 0x414a51, 0x252b30, 0x121619, 1).fillRoundedRect(6, 5, 26, 226, 5);
      g.lineStyle(3, 0xadb6bb, 0.45).lineBetween(11, 14, 11, 220);
      for (let y = 28; y < 220; y += 42) g.fillStyle(0xd08a40, 1).fillCircle(19, y, 4);
    });
  }
}
