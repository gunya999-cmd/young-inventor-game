import { Box, PrismaticJoint, Vec2, type Body, type Fixture } from 'planck';
import { GameApp } from './app';
import { CanvasRenderer } from './renderer';
import { PhysicsEngine } from './physics';
import { PARTS, PHYSICS_SCALE, WORLD_HEIGHT, type GameMode, type PartState, type Point } from './model';

const SPRING_TRAVEL_PX = 48;
const SPRING_STIFFNESS = 125;
const SPRING_DAMPING = 7.5;
const SPRING_MAX_FORCE = 190;
const PLUNGER_HALF_WIDTH_PX = 12;
const PLUNGER_HALF_HEIGHT_PX = 19;

interface SpringRuntimePart extends PartState {
  springCompression?: number;
}

interface SpringMechanism {
  part: PartState;
  base: Body;
  plunger: Body;
  joint: PrismaticJoint;
}

interface BodyData {
  partId?: string;
  kind?: string;
}

const pxToMeters = (value: number): number => value / PHYSICS_SCALE;

function pixelPointToPhysics(point: Point): Point {
  return { x: pxToMeters(point.x), y: pxToMeters(WORLD_HEIGHT - point.y) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function createSpringMechanism(engine: Record<string, any>, part: PartState): SpringMechanism {
  const world = engine.world;
  const bodies = engine.bodies as Map<string, Body>;
  const spec = PARTS.spring;
  const basePosition = pixelPointToPhysics(part);
  const physicsAngle = -part.angle;
  const direction = Vec2(Math.cos(physicsAngle), Math.sin(physicsAngle));

  const base = world.createBody({
    type: 'static',
    position: Vec2(basePosition.x, basePosition.y),
    angle: physicsAngle,
    userData: { partId: part.id, kind: 'spring-base' } satisfies BodyData
  }) as Body;

  // Only the rear mounting plate is solid. The visible coil is intentionally open,
  // so the moving plunger is the surface that actually receives impacts.
  base.createFixture({
    shape: Box(
      pxToMeters(13),
      pxToMeters(spec.height * 0.43),
      Vec2(pxToMeters(-spec.width / 2 + 15), 0),
      0
    ),
    friction: 0.72,
    restitution: 0.02,
    userData: { partId: part.id, kind: 'spring-base' } satisfies BodyData
  });

  const restOffset = pxToMeters(spec.width / 2 - PLUNGER_HALF_WIDTH_PX - 3);
  const plungerPosition = Vec2(
    basePosition.x + direction.x * restOffset,
    basePosition.y + direction.y * restOffset
  );
  const plunger = world.createBody({
    type: 'dynamic',
    position: plungerPosition,
    angle: physicsAngle,
    gravityScale: 0,
    linearDamping: 0.04,
    angularDamping: 0.8,
    fixedRotation: false,
    bullet: true,
    userData: { partId: part.id, kind: 'spring-plunger' } satisfies BodyData
  }) as Body;
  plunger.createFixture({
    shape: Box(pxToMeters(PLUNGER_HALF_WIDTH_PX), pxToMeters(PLUNGER_HALF_HEIGHT_PX)),
    density: 3.1,
    friction: 0.68,
    restitution: 0.03,
    userData: { partId: part.id, kind: 'spring-plunger' } satisfies BodyData
  });

  const joint = new PrismaticJoint({
    enableLimit: true,
    lowerTranslation: -pxToMeters(SPRING_TRAVEL_PX),
    upperTranslation: pxToMeters(2),
    collideConnected: false
  }, base, plunger, plungerPosition, direction);
  world.createJoint(joint);

  bodies.set(part.id, base);
  return { part, base, plunger, joint };
}

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

function drawPhysicalSpring(
  renderer: Record<string, any>,
  context: CanvasRenderingContext2D,
  part: SpringRuntimePart,
  selected: boolean,
  mode: GameMode
): void {
  const spec = PARTS.spring;
  const compression = clamp(part.springCompression ?? 0, 0, SPRING_TRAVEL_PX);
  const rearX = -spec.width / 2 + 14;
  const coilStart = rearX + 15;
  const plungerX = spec.width / 2 - PLUNGER_HALF_WIDTH_PX - 3 - compression;
  const coilEnd = plungerX - PLUNGER_HALF_WIDTH_PX - 2;
  const coilLength = Math.max(16, coilEnd - coilStart);

  context.save();
  context.translate(part.x, part.y);
  context.rotate(part.angle);
  context.shadowColor = 'rgba(0,0,0,.42)';
  context.shadowBlur = selected ? 16 : 9;
  context.shadowOffsetY = 6;

  // Rear mounting bracket.
  const rearGradient = context.createLinearGradient(rearX - 13, 0, rearX + 13, 0);
  rearGradient.addColorStop(0, '#37434c');
  rearGradient.addColorStop(.45, '#9aa7ae');
  rearGradient.addColorStop(1, '#2b343b');
  context.fillStyle = rearGradient;
  drawRoundedRect(context, rearX - 13, -spec.height * .43, 26, spec.height * .86, 5);
  context.fill();
  context.strokeStyle = '#172027';
  context.lineWidth = 2.5;
  context.stroke();

  // Guide rod.
  context.strokeStyle = '#58636a';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(coilStart - 4, 0);
  context.lineTo(plungerX + 2, 0);
  context.stroke();
  context.strokeStyle = '#c8d0d4';
  context.lineWidth = 2;
  context.stroke();

  // Compressible coil. Its geometric length is tied directly to Box2D joint translation.
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

  // Moving plunger.
  const plungerGradient = context.createLinearGradient(plungerX - 12, 0, plungerX + 12, 0);
  plungerGradient.addColorStop(0, '#a72e2f');
  plungerGradient.addColorStop(.5, '#ef5a45');
  plungerGradient.addColorStop(1, '#7e2025');
  context.fillStyle = plungerGradient;
  drawRoundedRect(context, plungerX - PLUNGER_HALF_WIDTH_PX, -PLUNGER_HALF_HEIGHT_PX,
    PLUNGER_HALF_WIDTH_PX * 2, PLUNGER_HALF_HEIGHT_PX * 2, 5);
  context.fill();
  context.strokeStyle = '#58181b';
  context.lineWidth = 2.5;
  context.stroke();

  context.fillStyle = '#cad2d6';
  drawRoundedRect(context, plungerX + PLUNGER_HALF_WIDTH_PX - 2, -PLUNGER_HALF_HEIGHT_PX - 4, 8,
    PLUNGER_HALF_HEIGHT_PX * 2 + 8, 3);
  context.fill();
  context.strokeStyle = '#4a545a';
  context.lineWidth = 2;
  context.stroke();

  context.shadowColor = 'transparent';
  if (part.fixed && !part.locked) renderer.drawFixedBolts(context, part);
  if (part.locked) renderer.drawLevelBadge(context, part);

  // Small deformation mark during simulation: useful feedback without turning the scene into a graph.
  if (mode !== 'build' && compression > 3) {
    context.fillStyle = 'rgba(21,29,34,.82)';
    drawRoundedRect(context, -23, spec.height / 2 + 8, 46, 20, 7);
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
  const physicsPrototype = PhysicsEngine.prototype as unknown as Record<string, any>;
  if (physicsPrototype.__physicalSpringInstalled) return;
  physicsPrototype.__physicalSpringInstalled = true;

  const originalCreateParts = physicsPrototype.createParts;
  physicsPrototype.createParts = function createPartsWithSprings(this: Record<string, any>): void {
    const source = this.source;
    const allParts = source.parts as PartState[];
    const springParts = allParts.filter((part) => part.kind === 'spring');
    this.__springMechanisms = new Map<string, SpringMechanism>();

    source.parts = allParts.filter((part) => part.kind !== 'spring');
    try {
      originalCreateParts.call(this);
    } finally {
      source.parts = allParts;
    }

    for (const part of springParts) {
      const mechanism = createSpringMechanism(this, part);
      (this.__springMechanisms as Map<string, SpringMechanism>).set(part.id, mechanism);
    }
  };

  const originalStep = physicsPrototype.step;
  physicsPrototype.step = function stepWithSprings(this: Record<string, any>, seconds: number): void {
    const mechanisms = this.__springMechanisms as Map<string, SpringMechanism> | undefined;
    if (mechanisms) {
      for (const mechanism of mechanisms.values()) {
        const translation = mechanism.joint.getJointTranslation();
        const speed = mechanism.joint.getJointSpeed();
        const springForce = -SPRING_STIFFNESS * translation;
        const dampingForce = -SPRING_DAMPING * speed;
        const magnitude = clamp(springForce + dampingForce, -SPRING_MAX_FORCE, SPRING_MAX_FORCE);
        const angle = mechanism.base.getAngle();
        const direction = Vec2(Math.cos(angle), Math.sin(angle));
        mechanism.plunger.applyForceToCenter(Vec2(direction.x * magnitude, direction.y * magnitude), true);
      }
    }
    originalStep.call(this, seconds);
  };

  const originalSnapshot = physicsPrototype.snapshot;
  physicsPrototype.snapshot = function snapshotWithSpringCompression(this: Record<string, any>) {
    const snapshot = originalSnapshot.call(this);
    const mechanisms = this.__springMechanisms as Map<string, SpringMechanism> | undefined;
    if (!mechanisms) return snapshot;
    for (const part of snapshot.parts as SpringRuntimePart[]) {
      if (part.kind !== 'spring') continue;
      const mechanism = mechanisms.get(part.id);
      if (!mechanism) continue;
      part.springCompression = Math.max(0, -mechanism.joint.getJointTranslation() * PHYSICS_SCALE);
    }
    return snapshot;
  };

  physicsPrototype.springCompression = function springCompression(this: Record<string, any>, partId: string): number {
    const mechanism = (this.__springMechanisms as Map<string, SpringMechanism> | undefined)?.get(partId);
    return mechanism ? Math.max(0, -mechanism.joint.getJointTranslation() * PHYSICS_SCALE) : 0;
  };

  const rendererPrototype = CanvasRenderer.prototype as unknown as Record<string, any>;
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
