import { Box, Vec2, World, type Body, type Fixture } from 'planck';
import { PARTS, PHYSICS_SCALE, cloneSnapshot, devicePower, type Endpoint, type MachineSnapshot, type PartKind, type PartState, type Point } from './model';
import { ACTIVE_LEVEL } from './level';
import { physicsPointToPixel, pixelPointToPhysics, pxToMeters } from './engine/coordinates';
import { createHinges, createRopes } from './engine/jointSystem';
import { createStandardPartBody, type PhysicsBodyData } from './engine/partFactory';
import { PHYSICS_CONFIG } from './engine/physicsConfig';
import { applySpringForce, createSpringMechanism, springCompressionPx, type SpringMechanism } from './engine/springMechanism';
import { SignalRuntime } from './engine/signalSystem';
import { DrivetrainRuntime } from './engine/drivetrain';

interface RuntimePartState extends PartState { springCompression?: number; deviceActive?: boolean; }
export interface PhysicsEngineOptions { includeLevelGeometry?: boolean; }
export interface PartKinematics { velocity: Point; angularVelocity: number; }
const MAGNETIC_KINDS = new Set<PartKind>(['ball', 'weight', 'domino', 'lever']);

export class PhysicsEngine {
  readonly world: World;
  private readonly source: MachineSnapshot;
  private readonly bodies = new Map<string, Body>();
  private readonly springs = new Map<string, SpringMechanism>();
  private readonly signals: SignalRuntime;
  private readonly drivetrain: DrivetrainRuntime;
  private goalReached = false;

  constructor(snapshot: MachineSnapshot, options: PhysicsEngineOptions = {}) {
    this.source = cloneSnapshot(snapshot);
    this.world = new World({ gravity: Vec2(0, -PHYSICS_CONFIG.gravity), allowSleep: true });
    if (options.includeLevelGeometry !== false) this.createLevelGeometry();
    this.createParts();
    createHinges(this.world, this.source, this.bodies);
    createRopes(this.world, this.source, this.bodies);
    this.drivetrain = new DrivetrainRuntime(this.world, this.source, this.bodies);
    this.signals = new SignalRuntime(this.source, this.bodies);
    this.world.on('begin-contact', (contact) => this.handleContact(contact.getFixtureA(), contact.getFixtureB()));
  }

  step(seconds: number): void {
    for (const spring of this.springs.values()) applySpringForce(spring, this.powered(spring.part.id), devicePower(spring.part));
    this.drivetrain.step();
    this.applyConveyorForces();
    this.applyFanForces();
    this.applyMagnetForces();
    this.world.step(seconds, PHYSICS_CONFIG.velocityIterations, PHYSICS_CONFIG.positionIterations);
  }

  hasWon(): boolean { return this.goalReached; }
  springCompression(partId: string): number { const spring = this.springs.get(partId); return spring ? springCompressionPx(spring) : 0; }
  deviceActive(partId: string): boolean { return this.signals.isActive(partId); }

  snapshot(): MachineSnapshot {
    const result = cloneSnapshot(this.source);
    result.parts = result.parts.map((part) => {
      const body = this.bodies.get(part.id);
      const runtime = { ...part } as RuntimePartState;
      if (body) {
        const position = physicsPointToPixel(body.getPosition());
        runtime.x = position.x;
        runtime.y = position.y;
        runtime.angle = -body.getAngle();
      }
      if (part.kind === 'spring') runtime.springCompression = this.springCompression(part.id);
      if (part.kind === 'button' || part.kind === 'switch' || part.kind === 'latch' || part.kind === 'pulley' || part.kind === 'conveyor' || part.kind === 'magnet' || part.kind === 'spring') runtime.deviceActive = this.powered(part.id);
      return runtime;
    });
    return result;
  }

  partTransform(partId: string) { const body = this.bodies.get(partId); if (!body) return null; return { position: physicsPointToPixel(body.getPosition()), angle: -body.getAngle() }; }
  partKinematics(partId: string): PartKinematics | null {
    const body = this.bodies.get(partId);
    if (!body) return null;
    const velocity = body.getLinearVelocity();
    return { velocity: { x: velocity.x * PHYSICS_SCALE, y: -velocity.y * PHYSICS_SCALE }, angularVelocity: -body.getAngularVelocity() };
  }

  private powered(partId: string): boolean { return !this.signals.hasIncomingSignal(partId) || this.signals.isActive(partId); }

  private createLevelGeometry(): void {
    const ground = this.world.createBody({ type: 'static', userData: { kind: 'level' } satisfies PhysicsBodyData });
    for (const platform of ACTIVE_LEVEL.platforms) this.addStaticBox(ground, platform.x, platform.y, platform.width, platform.height, platform.angle);
    const r = ACTIVE_LEVEL.receiver;
    const receiver = this.world.createBody({ type: 'static', userData: { kind: 'basket' } satisfies PhysicsBodyData });
    const wallHeight = r.innerHeight + r.floorThickness;
    const wallY = r.y + r.floorThickness / 2;
    const leftX = r.x - r.innerWidth / 2 - r.wallThickness / 2;
    const rightX = r.x + r.innerWidth / 2 + r.wallThickness / 2;
    const floorY = r.y + r.innerHeight / 2 + r.floorThickness / 2;
    this.addStaticBox(receiver, r.x, floorY, r.innerWidth + r.wallThickness * 2, r.floorThickness, 0);
    this.addStaticBox(receiver, leftX, wallY, r.wallThickness, wallHeight, 0);
    this.addStaticBox(receiver, rightX, wallY, r.wallThickness, wallHeight, 0);
    const center = pixelPointToPhysics({ x: r.x, y: r.y });
    receiver.createFixture({ shape: Box(pxToMeters(r.innerWidth / 2), pxToMeters(r.innerHeight / 2), Vec2(center.x, center.y), 0), isSensor: true, userData: { goal: true } satisfies PhysicsBodyData });
  }

  private addStaticBox(body: Body, x: number, y: number, width: number, height: number, screenAngle: number): void {
    const center = pixelPointToPhysics({ x, y });
    body.createFixture({ shape: Box(pxToMeters(width / 2), pxToMeters(height / 2), Vec2(center.x, center.y), -screenAngle), friction: .82, restitution: .02 });
  }

  private createParts(): void {
    for (const part of this.source.parts) {
      if (part.kind === 'spring') {
        const spring = createSpringMechanism(this.world, part);
        this.springs.set(part.id, spring);
        this.bodies.set(part.id, spring.base);
        continue;
      }
      this.bodies.set(part.id, createStandardPartBody(this.world, part));
    }
  }

  private applyConveyorForces(): void {
    for (const part of this.source.parts) {
      if (part.kind !== 'conveyor' || !this.powered(part.id)) continue;
      const conveyor = this.bodies.get(part.id);
      if (!conveyor) continue;
      const power = devicePower(part);
      const origin = conveyor.getPosition(), angle = conveyor.getAngle(), dx = Math.cos(angle), dy = Math.sin(angle);
      const halfWidth = pxToMeters(PARTS.conveyor.width / 2 + 18), height = pxToMeters(PARTS.conveyor.height / 2 + 70);
      for (const [id, body] of this.bodies) {
        if (id === part.id || body.getType() !== 'dynamic') continue;
        const p = body.getPosition(), rx = p.x - origin.x, ry = p.y - origin.y;
        const along = rx * dx + ry * dy, normal = -rx * dy + ry * dx;
        if (Math.abs(along) > halfWidth || normal < 0 || normal > height) continue;
        const velocity = body.getLinearVelocity(), target = 3.2 * power, current = velocity.x * dx + velocity.y * dy;
        const maxForce = 35 * power;
        const force = Math.max(-maxForce, Math.min(maxForce, (target - current) * body.getMass() * 9));
        body.applyForceToCenter(Vec2(dx * force, dy * force), true);
      }
    }
  }

  private applyFanForces(): void {
    for (const fanPart of this.source.parts) {
      if (fanPart.kind !== 'pulley' || !this.powered(fanPart.id)) continue;
      const fanBody = this.bodies.get(fanPart.id);
      if (!fanBody) continue;
      const power = devicePower(fanPart);
      const origin = fanBody.getPosition(), angle = fanBody.getAngle(), directionX = Math.cos(angle), directionY = Math.sin(angle);
      for (const [id, body] of this.bodies) {
        if (id === fanPart.id || body.getType() !== 'dynamic') continue;
        const position = body.getPosition(), deltaX = position.x - origin.x, deltaY = position.y - origin.y;
        const forward = deltaX * directionX + deltaY * directionY;
        if (forward < .2 || forward > 4.6) continue;
        const sideways = Math.abs(-deltaX * directionY + deltaY * directionX), halfWidth = .45 + forward * .32;
        if (sideways > halfWidth) continue;
        const strength = 23 * power * (1 - forward / 5.2) * (1 - sideways / Math.max(halfWidth, .01));
        body.applyForceToCenter(Vec2(directionX * strength, directionY * strength), true);
      }
    }
  }

  private applyMagnetForces(): void {
    for (const magnetPart of this.source.parts) {
      if (magnetPart.kind !== 'magnet' || !this.powered(magnetPart.id)) continue;
      const magnetBody = this.bodies.get(magnetPart.id);
      if (!magnetBody) continue;
      const power = devicePower(magnetPart);
      const origin = magnetBody.getPosition();
      for (const targetPart of this.source.parts) {
        if (!MAGNETIC_KINDS.has(targetPart.kind)) continue;
        const targetBody = this.bodies.get(targetPart.id);
        if (!targetBody || targetBody.getType() !== 'dynamic') continue;
        const position = targetBody.getPosition(), deltaX = origin.x - position.x, deltaY = origin.y - position.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < .18 || distance > 3.8) continue;
        const falloff = Math.pow(1 - distance / 3.8, 1.45), force = targetBody.getMass() * 26 * power * falloff;
        targetBody.applyForceToCenter(Vec2(deltaX / distance * force, deltaY / distance * force), true);
      }
    }
  }

  private handleContact(a: Fixture, b: Fixture): void {
    const dataA = a.getUserData() as PhysicsBodyData | undefined, dataB = b.getUserData() as PhysicsBodyData | undefined;
    const goal = dataA?.goal === true || dataB?.goal === true;
    const targetId = ACTIVE_LEVEL.targetPartId ?? 'target-ball';
    const target = dataA?.partId === targetId || dataB?.partId === targetId;
    if (goal && target) this.goalReached = true;
    this.signals.handleContact(a, b);
  }
}

export function endpointWorld(part: PartState, endpoint: Endpoint): Point {
  const c = Math.cos(part.angle), s = Math.sin(part.angle);
  return { x: part.x + endpoint.localX * c - endpoint.localY * s, y: part.y + endpoint.localX * s + endpoint.localY * c };
}
