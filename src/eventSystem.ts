import { Box, Vec2, type Body, type Fixture } from 'planck';
import { GameApp } from './app';
import { CanvasRenderer, type RenderFrame } from './renderer';
import { PhysicsEngine } from './physics';
import {
  PARTS,
  PHYSICS_SCALE,
  remaining,
  topPartAt,
  type GameMode,
  type MachineSnapshot,
  type PartState,
  type SignalLink
} from './model';

interface DeviceRuntimePart extends PartState {
  deviceActive?: boolean;
}

interface BodyData {
  partId?: string;
  kind?: string;
}

const pxToMeters = (value: number): number => value / PHYSICS_SCALE;

function drawRoundedRect(
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

function drawButton(
  renderer: Record<string, any>,
  context: CanvasRenderingContext2D,
  part: DeviceRuntimePart,
  selected: boolean,
  mode: GameMode
): void {
  const spec = PARTS.button;
  const pressed = Boolean(part.deviceActive);
  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.42)';
  context.shadowBlur = selected ? 16 : 9;
  context.shadowOffsetY = 6;

  const base = context.createLinearGradient(0, -spec.height / 2, 0, spec.height / 2);
  base.addColorStop(0, '#aab4ba');
  base.addColorStop(.45, '#65737c');
  base.addColorStop(1, '#303a40');
  context.fillStyle = base;
  drawRoundedRect(context, -spec.width / 2, -spec.height / 2, spec.width, spec.height, 7);
  context.fill();
  context.strokeStyle = '#1c252a';
  context.lineWidth = 2.5;
  context.stroke();

  const capY = -spec.height / 2 - (pressed ? 4 : 10);
  const cap = context.createLinearGradient(0, capY - 10, 0, capY + 8);
  cap.addColorStop(0, pressed ? '#d98b28' : '#ffd267');
  cap.addColorStop(1, pressed ? '#9c501b' : '#d67920');
  context.fillStyle = cap;
  drawRoundedRect(context, -spec.width * .34, capY - 8, spec.width * .68, 16, 6);
  context.fill();
  context.strokeStyle = '#713b16';
  context.lineWidth = 2;
  context.stroke();

  context.shadowColor = 'transparent';
  context.fillStyle = pressed ? '#71d58c' : '#dce4e8';
  context.beginPath();
  context.arc(spec.width / 2 - 11, 0, 4, 0, Math.PI * 2);
  context.fill();
  if (part.fixed && !part.locked) renderer.drawFixedBolts(context, part);
  if (part.locked) renderer.drawLevelBadge(context, part);
  context.restore();

  if (selected && mode === 'build') renderer.drawSelection(context, part);
}

function drawLatch(
  renderer: Record<string, any>,
  context: CanvasRenderingContext2D,
  part: DeviceRuntimePart,
  selected: boolean,
  mode: GameMode
): void {
  const spec = PARTS.latch;
  const released = Boolean(part.deviceActive);
  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.42)';
  context.shadowBlur = selected ? 16 : 9;
  context.shadowOffsetY = 6;

  // Mounting foot stays fixed; the visible locking tongue swings away after release.
  context.fillStyle = '#313b42';
  drawRoundedRect(context, -spec.width / 2, -spec.height / 2, 28, spec.height, 5);
  context.fill();
  context.strokeStyle = '#151c20';
  context.lineWidth = 2.5;
  context.stroke();

  context.save();
  context.translate(-spec.width / 2 + 22, 0);
  context.rotate(released ? -Math.PI * .38 : 0);
  const arm = context.createLinearGradient(0, -10, 0, 10);
  arm.addColorStop(0, '#9aa8b0');
  arm.addColorStop(.45, '#5e6c74');
  arm.addColorStop(1, '#303a40');
  context.fillStyle = arm;
  drawRoundedRect(context, 0, -spec.height * .38, spec.width - 25, spec.height * .76, 5);
  context.fill();
  context.strokeStyle = '#1b252b';
  context.lineWidth = 2.5;
  context.stroke();
  context.restore();

  context.fillStyle = released ? '#71d58c' : '#efb64e';
  context.beginPath();
  context.arc(-spec.width / 2 + 22, 0, 7, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#202a30';
  context.lineWidth = 2;
  context.stroke();

  context.shadowColor = 'transparent';
  if (part.fixed && !part.locked) renderer.drawFixedBolts(context, part);
  if (part.locked) renderer.drawLevelBadge(context, part);
  context.restore();

  if (selected && mode === 'build') renderer.drawSelection(context, part);
}

function drawSignalLinks(context: CanvasRenderingContext2D, frame: RenderFrame): void {
  const signals = frame.snapshot.signals ?? [];
  if (signals.length === 0) return;
  const parts = new Map(frame.snapshot.parts.map((part) => [part.id, part as DeviceRuntimePart]));

  context.save();
  context.lineWidth = 3;
  context.setLineDash([9, 7]);
  context.lineJoin = 'round';
  for (const signal of signals) {
    const source = parts.get(signal.sourcePartId);
    const target = parts.get(signal.targetPartId);
    if (!source || !target) continue;
    const active = Boolean(source.deviceActive);
    const middleX = (source.x + target.x) / 2;
    context.strokeStyle = active ? 'rgba(113,213,140,.92)' : 'rgba(78,183,224,.72)';
    context.beginPath();
    context.moveTo(source.x, source.y);
    context.lineTo(middleX, source.y);
    context.lineTo(middleX, target.y);
    context.lineTo(target.x, target.y);
    context.stroke();

    context.setLineDash([]);
    context.fillStyle = active ? '#71d58c' : '#4eb7e0';
    for (const point of [source, target]) {
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.setLineDash([9, 7]);
  }
  context.restore();
}

function releaseLatch(engine: Record<string, any>, latchId: string): void {
  const released = engine.__releasedLatches as Set<string>;
  if (released.has(latchId)) return;
  const body = (engine.bodies as Map<string, Body>).get(latchId);
  if (!body) return;
  for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) fixture.setSensor(true);
  released.add(latchId);
  // A body resting on the latch may have gone to sleep; wake dynamic bodies so gravity acts immediately.
  for (const candidate of (engine.bodies as Map<string, Body>).values()) {
    if (candidate.getType() === 'dynamic') candidate.setAwake(true);
  }
}

function activateButton(engine: Record<string, any>, buttonId: string): void {
  const active = engine.__activeButtons as Set<string>;
  if (active.has(buttonId)) return;
  active.add(buttonId);
  const links = (engine.source.signals ?? []) as SignalLink[];
  for (const link of links) {
    if (link.sourcePartId !== buttonId || link.action !== 'release') continue;
    const target = (engine.source.parts as PartState[]).find((part) => part.id === link.targetPartId);
    if (target?.kind === 'latch') releaseLatch(engine, target.id);
  }
}

export function installEventSystem(): void {
  const physicsPrototype = PhysicsEngine.prototype as unknown as Record<string, any>;
  if (physicsPrototype.__eventSystemInstalled) return;
  physicsPrototype.__eventSystemInstalled = true;

  const originalCreateParts = physicsPrototype.createParts;
  physicsPrototype.createParts = function createPartsWithControls(this: Record<string, any>): void {
    this.__activeButtons = new Set<string>();
    this.__releasedLatches = new Set<string>();
    originalCreateParts.call(this);

    for (const part of this.source.parts as PartState[]) {
      if (part.kind !== 'button') continue;
      const body = (this.bodies as Map<string, Body>).get(part.id);
      if (!body) continue;
      const spec = PARTS.button;
      body.createFixture({
        shape: Box(
          pxToMeters(spec.width * .34),
          pxToMeters(9),
          Vec2(0, pxToMeters(spec.height / 2 + 8)),
          0
        ),
        isSensor: true,
        userData: { partId: part.id, kind: 'button-sensor' } satisfies BodyData
      });
    }
  };

  const originalHandleContact = physicsPrototype.handleContact;
  physicsPrototype.handleContact = function handleControlContact(this: Record<string, any>, a: Fixture, b: Fixture): void {
    originalHandleContact.call(this, a, b);
    const dataA = a.getUserData() as BodyData | undefined;
    const dataB = b.getUserData() as BodyData | undefined;
    const buttonFixture = dataA?.kind === 'button-sensor' ? a : dataB?.kind === 'button-sensor' ? b : null;
    const otherFixture = buttonFixture === a ? b : buttonFixture === b ? a : null;
    if (!buttonFixture || !otherFixture) return;
    if (otherFixture.getBody().getType() !== 'dynamic') return;
    const buttonId = (buttonFixture.getUserData() as BodyData | undefined)?.partId;
    if (buttonId) activateButton(this, buttonId);
  };

  const originalSnapshot = physicsPrototype.snapshot;
  physicsPrototype.snapshot = function snapshotWithDeviceState(this: Record<string, any>): MachineSnapshot {
    const snapshot = originalSnapshot.call(this) as MachineSnapshot;
    const activeButtons = this.__activeButtons as Set<string> | undefined;
    const releasedLatches = this.__releasedLatches as Set<string> | undefined;
    for (const part of snapshot.parts as DeviceRuntimePart[]) {
      if (part.kind === 'button') part.deviceActive = Boolean(activeButtons?.has(part.id));
      if (part.kind === 'latch') part.deviceActive = Boolean(releasedLatches?.has(part.id));
    }
    return snapshot;
  };

  physicsPrototype.deviceActive = function deviceActive(this: Record<string, any>, partId: string): boolean {
    return Boolean(
      (this.__activeButtons as Set<string> | undefined)?.has(partId) ||
      (this.__releasedLatches as Set<string> | undefined)?.has(partId)
    );
  };

  const rendererPrototype = CanvasRenderer.prototype as unknown as Record<string, any>;
  const originalDrawPart = rendererPrototype.drawPart;
  rendererPrototype.drawPart = function drawControlDevice(
    this: Record<string, any>,
    context: CanvasRenderingContext2D,
    part: DeviceRuntimePart,
    selected: boolean,
    mode: GameMode
  ): void {
    if (part.kind === 'button') {
      drawButton(this, context, part, selected, mode);
      return;
    }
    if (part.kind === 'latch') {
      drawLatch(this, context, part, selected, mode);
      return;
    }
    originalDrawPart.call(this, context, part, selected, mode);
  };

  const originalRender = rendererPrototype.render;
  rendererPrototype.render = function renderWithSignalLinks(this: Record<string, any>, frame: RenderFrame): void {
    originalRender.call(this, frame);
    drawSignalLinks(this.context as CanvasRenderingContext2D, frame);
  };

  const appPrototype = GameApp.prototype as unknown as Record<string, any>;

  const originalBindControls = appPrototype.bindControls;
  appPrototype.bindControls = function bindControlsWithSignals(this: Record<string, any>): void {
    originalBindControls.call(this);
    document.querySelector<HTMLButtonElement>('#signal-button')?.addEventListener('click', () => this.armSignal());
  };

  appPrototype.armSignal = function armSignal(this: Record<string, any>): void {
    if (this.mode !== 'build') return;
    if (this.signalTool) {
      this.signalTool = false;
      this.signalStartId = null;
      this.setStatus('Режим управляющей связи отменён.');
    } else {
      this.cancelTools();
      this.signalTool = true;
      this.signalStartId = null;
      this.setStatus('Управляющая связь: сначала выбери нажимную кнопку.');
    }
    this.updateUi();
  };

  const originalPointerDown = appPrototype.onPointerDown;
  appPrototype.onPointerDown = function onPointerDownWithSignalTool(this: Record<string, any>, event: PointerEvent): void {
    if (!this.signalTool || event.button !== 0 || this.mode !== 'build') {
      originalPointerDown.call(this, event);
      return;
    }
    event.preventDefault();
    this.pointerWorld = this.renderer.screenToWorld(event.clientX, event.clientY);
    const part = topPartAt(this.snapshot as MachineSnapshot, this.pointerWorld);
    if (!this.signalStartId) {
      if (part?.kind !== 'button') {
        this.setStatus('Первым источником связи должна быть нажимная кнопка.');
        return;
      }
      this.signalStartId = part.id;
      this.selectedId = part.id;
      this.setStatus('Кнопка выбрана. Теперь кликни по механической защёлке.');
      this.updateUi();
      return;
    }
    if (part?.kind !== 'latch') {
      this.setStatus('Приёмником этой связи должна быть механическая защёлка.');
      return;
    }
    const signals = ((this.snapshot as MachineSnapshot).signals ??= []);
    if (signals.some((link: SignalLink) => link.sourcePartId === this.signalStartId && link.targetPartId === part.id)) {
      this.setStatus('Эта кнопка уже соединена с выбранной защёлкой.');
      return;
    }
    signals.push({
      id: `signal-${this.nextId++}`,
      sourcePartId: this.signalStartId,
      targetPartId: part.id,
      action: 'release'
    });
    this.signalTool = false;
    this.signalStartId = null;
    this.selectedId = part.id;
    this.commit('Создана связь: физическое нажатие кнопки освободит эту защёлку.');
  };

  const originalCancelTools = appPrototype.cancelTools;
  appPrototype.cancelTools = function cancelToolsWithSignal(this: Record<string, any>): void {
    originalCancelTools.call(this);
    this.signalTool = false;
    this.signalStartId = null;
  };

  for (const methodName of ['armRope', 'armHinge']) {
    const original = appPrototype[methodName];
    appPrototype[methodName] = function switchAwayFromSignal(this: Record<string, any>, ...args: unknown[]): unknown {
      this.signalTool = false;
      this.signalStartId = null;
      return original.apply(this, args);
    };
  }

  const originalDeleteSelected = appPrototype.deleteSelected;
  appPrototype.deleteSelected = function deleteSelectedWithSignals(this: Record<string, any>): void {
    const selected = this.selectedPart?.() as PartState | null;
    if (selected && !selected.locked) {
      const snapshot = this.snapshot as MachineSnapshot;
      snapshot.signals = (snapshot.signals ?? []).filter(
        (link) => link.sourcePartId !== selected.id && link.targetPartId !== selected.id
      );
    }
    originalDeleteSelected.call(this);
  };

  const originalClear = appPrototype.clearAddedParts;
  appPrototype.clearAddedParts = function clearWithSignals(this: Record<string, any>): void {
    (this.snapshot as MachineSnapshot).signals = [];
    originalClear.call(this);
  };

  const originalReseed = appPrototype.reseedNextId;
  appPrototype.reseedNextId = function reseedWithSignals(this: Record<string, any>): void {
    originalReseed.call(this);
    const signals = ((this.snapshot as MachineSnapshot).signals ?? []) as SignalLink[];
    for (const signal of signals) {
      const match = signal.id.match(/(\d+)$/);
      if (match) this.nextId = Math.max(this.nextId, Number(match[1]) + 1);
    }
  };

  const originalToggleFixed = appPrototype.toggleFixed;
  appPrototype.toggleFixed = function keepControlDevicesMounted(this: Record<string, any>): void {
    const selected = this.selectedPart?.() as PartState | null;
    if (selected?.kind === 'button' || selected?.kind === 'latch') {
      selected.fixed = true;
      this.setStatus('Кнопка и защёлка являются закреплёнными механизмами стенда.');
      this.updateUi();
      return;
    }
    originalToggleFixed.call(this);
  };

  const originalUpdateCursor = appPrototype.updateCanvasCursor;
  appPrototype.updateCanvasCursor = function updateCursorWithSignal(this: Record<string, any>): void {
    originalUpdateCursor.call(this);
    this.renderer.canvas.classList.toggle('cursor-tool', Boolean(this.ropeTool || this.hingeTool || this.signalTool));
  };

  const originalUpdateUi = appPrototype.updateUi;
  appPrototype.updateUi = function updateUiWithSignals(this: Record<string, any>): void {
    originalUpdateUi.call(this);
    const build = this.mode === 'build';
    const signalButton = document.querySelector<HTMLButtonElement>('#signal-button');
    if (signalButton) {
      signalButton.disabled = !build;
      signalButton.classList.toggle('active', Boolean(this.signalTool));
      signalButton.innerHTML = this.signalTool
        ? this.signalStartId ? '⚡ Выбери защёлку <span>Esc</span>' : '⚡ Выбери кнопку <span>Esc</span>'
        : `⚡ Управляющая связь <span>×${((this.snapshot as MachineSnapshot).signals ?? []).length}</span>`;
    }
    for (const kind of ['button', 'latch'] as const) {
      const button = document.querySelector<HTMLButtonElement>(`.palette-part[data-kind="${kind}"]`);
      if (!button) continue;
      const count = remaining(this.snapshot as MachineSnapshot, kind);
      button.disabled = !build || count <= 0;
      const counter = button.querySelector<HTMLElement>('[data-count]');
      if (counter) counter.textContent = `×${count}`;
    }
  };
}
