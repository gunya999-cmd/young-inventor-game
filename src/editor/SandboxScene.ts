// @ts-nocheck
import Phaser from 'phaser';
import { MachineModel } from '../tim-core/MachineModel';
import type { Connection, Endpoint, PartInstance, Vec2 } from '../tim-core/types';
import { createPartInstance, getPartSpec, type EditorPartKind } from './catalog';

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
const FLOOR_Y = 824;
const ROTATION_STEP = Phaser.Math.DegToRad(7.5);

export let activeSandbox: SandboxScene | null = null;

type MatterPart = Phaser.Physics.Matter.Image & { body: MatterJS.BodyType };

export class SandboxScene extends Phaser.Scene {
  private readonly model = new MachineModel();
  private readonly visuals = new Map<string, MatterPart>();
  private readonly runtimeConstraints: MatterJS.ConstraintType[] = [];
  private ropeGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private selectedId: string | null = null;
  private ropeToolArmed = false;
  private ropeStart: Endpoint | null = null;
  private nextPartNumber = 1;
  private nextConnectionNumber = 1;
  private paused = false;

  constructor() {
    super('SandboxScene');
  }

  create(): void {
    activeSandbox = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeSandbox === this) activeSandbox = null;
    });

    this.createTextures();
    this.drawWorkshopGrid();
    this.matter.world.setBounds(0, 0, WORLD_WIDTH, FLOOR_Y, 48, true, true, true, false);
    this.matter.add.rectangle(WORLD_WIDTH / 2, FLOOR_Y + 22, WORLD_WIDTH, 44, {
      isStatic: true,
      label: 'floor',
      friction: 0.82,
      restitution: 0.03
    });

    this.ropeGraphics = this.add.graphics().setDepth(12);
    this.overlayGraphics = this.add.graphics().setDepth(30);

    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, object: MatterPart) => {
      if (this.model.mode !== 'build' || this.ropeToolArmed) return;
      this.selectPart(object.getData('partId'));
      object.setDepth(20);
    });

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, object: MatterPart, dragX: number, dragY: number) => {
      if (this.model.mode !== 'build' || this.ropeToolArmed) return;
      const spec = getPartSpec(object.getData('editorKind'));
      const x = Phaser.Math.Clamp(dragX, spec.width / 2 + 8, WORLD_WIDTH - spec.width / 2 - 8);
      const y = Phaser.Math.Clamp(dragY, spec.height / 2 + 92, FLOOR_Y - spec.height / 2 - 4);
      object.setPosition(x, y);
      this.model.movePart(object.getData('partId'), { x, y });
      this.setStatus(`Положение: ${Math.round(x)}, ${Math.round(y)}`);
    });

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, object: MatterPart) => {
      object.setDepth(10);
      this.updateInspector();
    });

    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, object: MatterPart) => {
      const id = object.getData('partId');
      if (!id || this.model.mode !== 'build') return;
      if (this.ropeToolArmed) this.chooseRopeEndpoint(id, { x: pointer.worldX, y: pointer.worldY });
      else this.selectPart(id);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (this.model.mode === 'build' && objects.length === 0 && !this.ropeToolArmed) this.selectPart(null);
    });

    this.setStatus('Перетащи деталь из нижней панели на любое место поля.');
    this.updateModeUi();
    this.updateInspector();
    (window as Window & { __TIM_EDITOR_READY__?: boolean }).__TIM_EDITOR_READY__ = true;
  }

  update(): void {
    this.drawConnections();
    this.drawOverlay();
  }

  clientToWorld(clientX: number, clientY: number): Vec2 | null {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return {
      x: (clientX - rect.left) * (WORLD_WIDTH / rect.width),
      y: (clientY - rect.top) * (WORLD_HEIGHT / rect.height)
    };
  }

  addPartFromPalette(kind: EditorPartKind, position: Vec2): void {
    if (this.model.mode !== 'build') return;
    const id = `${kind}-${this.nextPartNumber++}`;
    const spec = getPartSpec(kind);
    const safePosition = {
      x: Phaser.Math.Clamp(position.x, spec.width / 2 + 8, WORLD_WIDTH - spec.width / 2 - 8),
      y: Phaser.Math.Clamp(position.y, spec.height / 2 + 90, FLOOR_Y - spec.height / 2 - 4)
    };
    const part = createPartInstance(kind, id, safePosition);
    this.model.addPart(part);
    this.createVisual(part);
    this.selectPart(id);
    this.setStatus(`${spec.label} добавлен свободно. Перетащи или поверни его.`);
  }

  rotateSelected(direction: -1 | 1): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const part = this.model.getPart(this.selectedId);
    if (!part.definition.canRotate) {
      this.setStatus('Эту деталь вращать нельзя.');
      return;
    }
    const angle = part.transform.angle + direction * ROTATION_STEP;
    this.model.rotatePart(part.id, angle);
    const visual = this.visuals.get(part.id);
    if (visual) {
      Phaser.Physics.Matter.Matter.Body.setAngle(visual.body, angle);
      visual.setRotation(angle);
    }
    this.updateInspector();
  }

  toggleSelectedFixed(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const part = this.model.getPart(this.selectedId);
    this.model.setFixed(part.id, !part.fixed);
    this.setStatus(!part.fixed ? 'Деталь закреплена на поле.' : 'Крепление снято: при запуске деталь будет двигаться.');
    this.updateInspector();
  }

  deleteSelected(): void {
    if (!this.selectedId || this.model.mode !== 'build') return;
    const id = this.selectedId;
    this.model.removePart(id);
    this.visuals.get(id)?.destroy();
    this.visuals.delete(id);
    this.selectedId = null;
    this.ropeStart = null;
    this.setStatus('Деталь удалена, связанные с ней соединения тоже удалены.');
    this.updateInspector();
  }

  armRopeTool(): void {
    if (this.model.mode !== 'build') return;
    this.ropeToolArmed = !this.ropeToolArmed;
    this.ropeStart = null;
    this.setStatus(this.ropeToolArmed
      ? 'Верёвка: коснись первой точки крепления, затем второй.'
      : 'Режим верёвки отменён.');
    this.updateInspector();
  }

  startSimulation(): void {
    if (this.model.mode !== 'build') return;
    if (this.model.getParts().length === 0) {
      this.setStatus('Сначала добавь хотя бы одну деталь.');
      return;
    }
    this.ropeToolArmed = false;
    this.ropeStart = null;
    this.selectPart(null);
    this.model.startSimulation();
    this.paused = false;
    this.createRuntimeConstraints();
    for (const part of this.model.getParts()) {
      const visual = this.visuals.get(part.id);
      if (!visual) continue;
      Phaser.Physics.Matter.Matter.Body.setVelocity(visual.body, { x: 0, y: 0 });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(visual.body, 0);
      visual.setStatic(part.fixed || part.definition.kind === 'wall' || part.definition.kind === 'pulley');
      visual.disableInteractive();
    }
    this.matter.world.resume();
    this.setStatus('Симуляция запущена. Работают только физика и созданные соединения.');
    this.updateModeUi();
    this.updateInspector();
  }

  pauseOrResume(): void {
    if (this.model.mode === 'running') {
      this.model.pauseSimulation();
      this.matter.world.pause();
      this.paused = true;
      this.setStatus('Пауза. Конструкция заморожена в текущем состоянии.');
    } else if (this.model.mode === 'paused') {
      this.model.resumeSimulation();
      this.matter.world.resume();
      this.paused = false;
      this.setStatus('Симуляция продолжена.');
    }
    this.updateModeUi();
  }

  stopSimulation(): void {
    if (this.model.mode === 'build') return;
    this.matter.world.pause();
    this.removeRuntimeConstraints();
    this.model.stopSimulation();
    for (const part of this.model.getParts()) {
      const visual = this.visuals.get(part.id);
      if (!visual) continue;
      visual.setStatic(true);
      visual.setPosition(part.transform.position.x, part.transform.position.y);
      Phaser.Physics.Matter.Matter.Body.setPosition(visual.body, part.transform.position);
      Phaser.Physics.Matter.Matter.Body.setAngle(visual.body, part.transform.angle);
      Phaser.Physics.Matter.Matter.Body.setVelocity(visual.body, { x: 0, y: 0 });
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(visual.body, 0);
      visual.setRotation(part.transform.angle);
      visual.setInteractive({ useHandCursor: true });
      this.input.setDraggable(visual, true);
    }
    this.paused = false;
    this.matter.world.resume();
    this.setStatus('Стоп: конструкция точно возвращена в состояние до запуска.');
    this.updateModeUi();
    this.updateInspector();
  }

  clearMachine(): void {
    if (this.model.mode !== 'build') return;
    for (const part of [...this.model.getParts()]) {
      this.model.removePart(part.id);
      this.visuals.get(part.id)?.destroy();
    }
    this.visuals.clear();
    this.selectedId = null;
    this.ropeStart = null;
    this.ropeToolArmed = false;
    this.setStatus('Поле очищено.');
    this.updateInspector();
  }

  private createVisual(part: PartInstance): void {
    const kind = part.metadata.editorKind as EditorPartKind;
    const spec = getPartSpec(kind);
    const visual = this.matter.add.image(
      part.transform.position.x,
      part.transform.position.y,
      `part-${kind}`,
      undefined,
      {
        isStatic: true,
        label: part.id,
        density: spec.density,
        friction: spec.friction,
        restitution: spec.restitution,
        frictionAir: kind === 'ball' ? 0.002 : 0.012
      }
    ) as MatterPart;

    if (spec.radius) visual.setCircle(spec.radius);
    else visual.setRectangle(spec.width, spec.height);

    visual.setData('partId', part.id);
    visual.setData('editorKind', kind);
    visual.setDepth(10);
    visual.setInteractive({ useHandCursor: true });
    this.input.setDraggable(visual, true);
    this.visuals.set(part.id, visual);
  }

  private selectPart(id: string | null): void {
    this.selectedId = id;
    this.updateInspector();
  }

  private chooseRopeEndpoint(partId: string, worldPoint: Vec2): void {
    const part = this.model.getPart(partId);
    const candidates = part.definition.anchors.filter((anchor) => anchor.kind === 'rope');
    if (candidates.length === 0) {
      this.setStatus('У этой детали нет точки крепления верёвки.');
      return;
    }
    const endpoint = candidates
      .map((anchor) => ({ endpoint: { partId, anchorId: anchor.id }, distance: Phaser.Math.Distance.BetweenPoints(worldPoint, this.anchorWorld({ partId, anchorId: anchor.id })) }))
      .sort((a, b) => a.distance - b.distance)[0].endpoint as Endpoint;

    if (!this.ropeStart) {
      this.ropeStart = endpoint;
      this.setStatus('Первая точка выбрана. Теперь коснись второй детали.');
      return;
    }
    if (this.ropeStart.partId === endpoint.partId && this.ropeStart.anchorId === endpoint.anchorId) {
      this.setStatus('Нужна другая точка крепления.');
      return;
    }

    const a = this.anchorWorld(this.ropeStart);
    const b = this.anchorWorld(endpoint);
    const connection: Connection = {
      id: `rope-${this.nextConnectionNumber++}`,
      kind: 'rope',
      a: this.ropeStart,
      b: endpoint,
      restLength: Math.max(24, Phaser.Math.Distance.BetweenPoints(a, b))
    };
    this.model.connect(connection);
    this.ropeStart = null;
    this.ropeToolArmed = false;
    this.setStatus('Верёвка создана вручную между выбранными точками.');
    this.updateInspector();
  }

  private createRuntimeConstraints(): void {
    this.removeRuntimeConstraints();
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'rope') continue;
      const aPart = this.model.getPart(connection.a.partId);
      const bPart = this.model.getPart(connection.b.partId);
      const aVisual = this.visuals.get(aPart.id);
      const bVisual = this.visuals.get(bPart.id);
      if (!aVisual || !bVisual) continue;
      const aAnchor = aPart.definition.anchors.find((anchor) => anchor.id === connection.a.anchorId);
      const bAnchor = bPart.definition.anchors.find((anchor) => anchor.id === connection.b.anchorId);
      if (!aAnchor || !bAnchor) continue;
      const constraint = this.matter.add.constraint(
        aVisual.body,
        bVisual.body,
        connection.restLength ?? 0,
        0.92,
        {
          pointA: { ...aAnchor.localPosition },
          pointB: { ...bAnchor.localPosition },
          damping: 0.08,
          label: connection.id
        }
      );
      this.runtimeConstraints.push(constraint);
    }
  }

  private removeRuntimeConstraints(): void {
    while (this.runtimeConstraints.length > 0) {
      const constraint = this.runtimeConstraints.pop();
      if (constraint) this.matter.world.removeConstraint(constraint);
    }
  }

  private anchorWorld(endpoint: Endpoint): Vec2 {
    const part = this.model.getPart(endpoint.partId);
    const visual = this.visuals.get(part.id);
    const anchor = part.definition.anchors.find((item) => item.id === endpoint.anchorId);
    if (!anchor) return part.transform.position;
    const position = visual ? visual.body.position : part.transform.position;
    const angle = visual ? visual.body.angle : part.transform.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: position.x + anchor.localPosition.x * cos - anchor.localPosition.y * sin,
      y: position.y + anchor.localPosition.x * sin + anchor.localPosition.y * cos
    };
  }

  private drawConnections(): void {
    this.ropeGraphics.clear();
    this.ropeGraphics.lineStyle(7, 0x4a2d17, 0.34);
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'rope') continue;
      const a = this.anchorWorld(connection.a);
      const b = this.anchorWorld(connection.b);
      this.ropeGraphics.beginPath();
      this.ropeGraphics.moveTo(a.x + 2, a.y + 3);
      this.ropeGraphics.lineTo(b.x + 2, b.y + 3);
      this.ropeGraphics.strokePath();
    }
    this.ropeGraphics.lineStyle(4, 0xd2a15f, 1);
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'rope') continue;
      const a = this.anchorWorld(connection.a);
      const b = this.anchorWorld(connection.b);
      this.ropeGraphics.beginPath();
      this.ropeGraphics.moveTo(a.x, a.y);
      this.ropeGraphics.lineTo(b.x, b.y);
      this.ropeGraphics.strokePath();
    }
  }

  private drawOverlay(): void {
    this.overlayGraphics.clear();
    if (this.selectedId && this.model.mode === 'build') {
      const visual = this.visuals.get(this.selectedId);
      if (visual) {
        const bounds = visual.getBounds();
        this.overlayGraphics.lineStyle(3, 0xffc56c, 1);
        this.overlayGraphics.strokeRoundedRect(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16, 10);
      }
    }

    if (this.ropeToolArmed && this.model.mode === 'build') {
      for (const part of this.model.getParts()) {
        for (const anchor of part.definition.anchors.filter((item) => item.kind === 'rope')) {
          const point = this.anchorWorld({ partId: part.id, anchorId: anchor.id });
          const selected = this.ropeStart?.partId === part.id && this.ropeStart.anchorId === anchor.id;
          this.overlayGraphics.fillStyle(selected ? 0x66e09b : 0xffc56c, 1);
          this.overlayGraphics.fillCircle(point.x, point.y, selected ? 10 : 7);
          this.overlayGraphics.lineStyle(2, 0x21150d, 0.9);
          this.overlayGraphics.strokeCircle(point.x, point.y, selected ? 10 : 7);
        }
      }
    }
  }

  private drawWorkshopGrid(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0xe9dfd1, 0xe9dfd1, 0xcbb9a4, 0xcbb9a4, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    background.lineStyle(1, 0x9f8d79, 0.22);
    for (let x = 0; x <= WORLD_WIDTH; x += 50) background.lineBetween(x, 82, x, FLOOR_Y);
    for (let y = 82; y <= FLOOR_Y; y += 50) background.lineBetween(0, y, WORLD_WIDTH, y);
    background.fillStyle(0x4b392d, 1);
    background.fillRect(0, FLOOR_Y, WORLD_WIDTH, WORLD_HEIGHT - FLOOR_Y);
    background.fillStyle(0x211a16, 1);
    background.fillRect(0, FLOOR_Y, WORLD_WIDTH, 9);

    this.add.text(30, 96, 'СВОБОДНОЕ ПОЛЕ', {
      color: '#725f4d',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold'
    }).setAlpha(0.72);
  }

  private createTextures(): void {
    const make = (key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      draw(g);
      g.generateTexture(key, width, height);
      g.destroy();
    };

    make('part-ball', 60, 60, (g) => {
      g.fillStyle(0x121820, 1); g.fillCircle(30, 30, 28);
      g.fillGradientStyle(0xf6fbff, 0x8a9aa8, 0x25313c, 0x05080b, 1); g.fillCircle(30, 30, 24);
      g.fillStyle(0xffffff, 0.62); g.fillCircle(22, 20, 7);
    });
    make('part-plank', 220, 38, (g) => {
      g.fillStyle(0x17191c, 1); g.fillRoundedRect(0, 3, 220, 32, 8);
      g.fillGradientStyle(0xd18a45, 0xa75b2b, 0x713815, 0x4d2510, 1); g.fillRoundedRect(5, 7, 210, 24, 5);
      g.lineStyle(2, 0xf0bb78, 0.62); g.lineBetween(14, 11, 202, 11);
      g.fillStyle(0x20262b, 1); g.fillCircle(14, 19, 6); g.fillCircle(206, 19, 6);
    });
    make('part-wall', 170, 38, (g) => {
      g.fillStyle(0x171a1d, 1); g.fillRoundedRect(0, 2, 170, 34, 6);
      g.fillGradientStyle(0x65727c, 0x313a41, 0x1d2227, 0x0f1215, 1); g.fillRoundedRect(5, 7, 160, 24, 4);
      g.lineStyle(2, 0x9ca8ae, 0.5); g.lineBetween(12, 10, 156, 10);
    });
    make('part-pulley', 80, 80, (g) => {
      g.fillStyle(0x101418, 1); g.fillCircle(40, 40, 37);
      g.fillStyle(0x586570, 1); g.fillCircle(40, 40, 31);
      g.fillStyle(0x151b21, 1); g.fillCircle(40, 40, 24);
      g.lineStyle(5, 0xa7b1b7, 0.8); g.strokeCircle(40, 40, 27);
      g.fillStyle(0xe9a34b, 1); g.fillCircle(40, 40, 9);
      g.fillStyle(0x36200e, 1); g.fillCircle(40, 40, 4);
    });
    make('part-weight', 76, 92, (g) => {
      g.fillStyle(0x111417, 1); g.fillRoundedRect(4, 15, 68, 73, 8);
      g.fillGradientStyle(0x8f9aa0, 0x22292d, 0x15191c, 0x050708, 1); g.fillRoundedRect(9, 20, 58, 63, 7);
      g.lineStyle(7, 0x30383d, 1); g.strokeCircle(38, 17, 11);
      g.lineStyle(3, 0xaeb8bd, 0.65); g.lineBetween(17, 27, 57, 27);
    });
  }

  private setStatus(message: string): void {
    const element = document.querySelector<HTMLElement>('#status-message');
    if (element) element.textContent = message;
  }

  private updateModeUi(): void {
    const mode = document.querySelector<HTMLElement>('#mode-label');
    const run = document.querySelector<HTMLButtonElement>('#run-button');
    const pause = document.querySelector<HTMLButtonElement>('#pause-button');
    const stop = document.querySelector<HTMLButtonElement>('#stop-button');
    if (mode) mode.textContent = this.model.mode === 'build' ? 'СБОРКА' : this.model.mode === 'paused' ? 'ПАУЗА' : 'СИМУЛЯЦИЯ';
    if (run) run.disabled = this.model.mode !== 'build';
    if (pause) {
      pause.disabled = this.model.mode === 'build';
      pause.textContent = this.paused ? '▶ ПРОДОЛЖИТЬ' : 'Ⅱ ПАУЗА';
    }
    if (stop) stop.disabled = this.model.mode === 'build';
    document.querySelector('#app')?.classList.toggle('simulating', this.model.mode !== 'build');
  }

  private updateInspector(): void {
    const inspector = document.querySelector<HTMLElement>('#inspector');
    const fixed = document.querySelector<HTMLButtonElement>('#fix-button');
    const rope = document.querySelector<HTMLButtonElement>('#rope-button');
    if (inspector) inspector.classList.toggle('visible', Boolean(this.selectedId) || this.ropeToolArmed);
    if (fixed) {
      fixed.disabled = !this.selectedId || this.model.mode !== 'build';
      fixed.textContent = this.selectedId && this.model.getPart(this.selectedId).fixed ? '📌 ОТКРЕПИТЬ' : '📍 ЗАКРЕПИТЬ';
    }
    if (rope) rope.classList.toggle('active', this.ropeToolArmed);
  }
}
