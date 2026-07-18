import {
  Box,
  Circle,
  RevoluteJoint,
  RopeJoint,
  Vec2,
  World,
  type Body,
  type Fixture
} from 'planck';
import {
  PHYSICS_SCALE,
  PARTS,
  WORLD_HEIGHT,
  cloneSnapshot,
  type Endpoint,
  type MachineSnapshot,
  type PartState,
  type Point
} from './model';

interface BodyData {
  partId?: string;
  kind?: string;
  goal?: boolean;
}

const pxToMeters = (value: number): number => value / PHYSICS_SCALE;
const metersToPx = (value: number): number => value * PHYSICS_SCALE;

function pixelPointToPhysics(point: Point): Point {
  return { x: pxToMeters(point.x), y: pxToMeters(WORLD_HEIGHT - point.y) };
}

function physicsPointToPixel(point: Point): Point {
  return { x: metersToPx(point.x), y: WORLD_HEIGHT - metersToPx(point.y) };
}

function localPointToPhysics(point: Point): Point {
  return { x: pxToMeters(point.x), y: -pxToMeters(point.y) };
}

export class PhysicsEngine {
  readonly world: World;
  private readonly source: MachineSnapshot;
  private readonly bodies = new Map<string, Body>();
  private goalReached = false;

  constructor(snapshot: MachineSnapshot) {
    this.source = cloneSnapshot(snapshot);
    this.world = new World({ gravity: Vec2(0, -9.8), allowSleep: true });
    this.createLevelGeometry();
    this.createParts();
    this.createHinges();
    this.createRopes();
    this.world.on('begin-contact', (contact) => this.handleContact(contact.getFixtureA(), contact.getFixtureB()));
  }

  step(seconds: number): void {
    this.world.step(seconds, 8, 3);
  }

  hasWon(): boolean {
    return this.goalReached;
  }

  snapshot(): MachineSnapshot {
    const result = cloneSnapshot(this.source);
    result.parts = result.parts.map((part) => {
      const body = this.bodies.get(part.id);
      if (!body) return part;
      const position = physicsPointToPixel(body.getPosition());
      return { ...part, x: position.x, y: position.y, angle: -body.getAngle() };
    });
    return result;
  }

  partTransform(partId: string): { position: Point; angle: number } | null {
    const body = this.bodies.get(partId);
    if (!body) return null;
    return { position: physicsPointToPixel(body.getPosition()), angle: -body.getAngle() };
  }

  private createLevelGeometry(): void {
    const ground = this.world.createBody({ type: 'static', userData: { kind: 'level' } satisfies BodyData });
    this.addStaticBox(ground, 800, 788, 1500, 34, 0);
    this.addStaticBox(ground, 275, 305, 420, 28, -0.08);
    this.addStaticBox(ground, 1130, 565, 230, 24, 0.04);

    const basket = this.world.createBody({ type: 'static', userData: { kind: 'basket' } satisfies BodyData });
    this.addStaticBox(basket, 1385, 687, 190, 22, 0);
    this.addStaticBox(basket, 1298, 622, 22, 145, 0);
    this.addStaticBox(basket, 1472, 622, 22, 145, 0);
    const sensorCenter = pixelPointToPhysics({ x: 1385, y: 625 });
    basket.createFixture({
      shape: Box(pxToMeters(72), pxToMeters(54), Vec2(sensorCenter.x, sensorCenter.y), 0),
      isSensor: true,
      userData: { goal: true } satisfies BodyData
    });
  }

  private addStaticBox(body: Body, x: number, y: number, width: number, height: number, angle: number): void {
    const center = pixelPointToPhysics({ x, y });
    body.createFixture({
      shape: Box(pxToMeters(width / 2), pxToMeters(height / 2), Vec2(center.x, center.y), -angle),
      friction: 0.82,
      restitution: 0.02
    });
  }

  private createParts(): void {
    for (const part of this.source.parts) {
      const spec = PARTS[part.kind];
      const position = pixelPointToPhysics(part);
      const body = this.world.createBody({
        type: part.fixed ? 'static' : 'dynamic',
        position: Vec2(position.x, position.y),
        angle: -part.angle,
        linearDamping: part.kind === 'ball' ? 0.04 : 0.12,
        angularDamping: part.kind === 'ball' ? 0.04 : 0.18,
        bullet: part.kind === 'ball',
        userData: { partId: part.id, kind: part.kind } satisfies BodyData
      });
      const shape = spec.radius
        ? Circle(pxToMeters(spec.radius))
        : Box(pxToMeters(spec.width / 2), pxToMeters(spec.height / 2));
      body.createFixture({
        shape,
        density: spec.density,
        friction: spec.friction,
        restitution: spec.restitution,
        userData: { partId: part.id, kind: part.kind } satisfies BodyData
      });
      this.bodies.set(part.id, body);
    }
  }

  private createHinges(): void {
    for (const hinge of this.source.hinges) {
      const part = this.source.parts.find((candidate) => candidate.id === hinge.partId);
      const body = this.bodies.get(hinge.partId);
      if (!part || !body) continue;
      const localAnchor = localPointToPhysics({ x: hinge.localX, y: hinge.localY });
      const worldAnchor = body.getWorldPoint(Vec2(localAnchor.x, localAnchor.y));
      const pin = this.world.createBody({ type: 'static', position: worldAnchor });
      this.world.createJoint(new RevoluteJoint({
        bodyA: pin,
        bodyB: body,
        localAnchorA: Vec2(0, 0),
        localAnchorB: Vec2(localAnchor.x, localAnchor.y),
        referenceAngle: -hinge.referenceAngle,
        enableLimit: hinge.lowerAngle !== undefined && hinge.upperAngle !== undefined,
        lowerAngle: hinge.lowerAngle,
        upperAngle: hinge.upperAngle,
        collideConnected: false
      }));
    }
  }

  private createRopes(): void {
    for (const rope of this.source.ropes) {
      const bodyA = this.bodies.get(rope.a.partId);
      const bodyB = this.bodies.get(rope.b.partId);
      if (!bodyA || !bodyB || bodyA === bodyB) continue;
      const anchorA = localPointToPhysics(rope.a);
      const anchorB = localPointToPhysics(rope.b);
      this.world.createJoint(new RopeJoint({
        bodyA,
        bodyB,
        localAnchorA: Vec2(anchorA.x, anchorA.y),
        localAnchorB: Vec2(anchorB.x, anchorB.y),
        maxLength: pxToMeters(Math.max(24, rope.maxLength)),
        collideConnected: true
      }));
    }
  }

  private handleContact(a: Fixture, b: Fixture): void {
    const dataA = a.getUserData() as BodyData | undefined;
    const dataB = b.getUserData() as BodyData | undefined;
    const goal = dataA?.goal === true || dataB?.goal === true;
    const target = dataA?.partId === 'target-ball' || dataB?.partId === 'target-ball';
    if (goal && target) this.goalReached = true;
  }
}

export function endpointWorld(part: PartState, endpoint: Endpoint): Point {
  const cosine = Math.cos(part.angle);
  const sine = Math.sin(part.angle);
  return {
    x: part.x + endpoint.localX * cosine - endpoint.localY * sine,
    y: part.y + endpoint.localX * sine + endpoint.localY * cosine
  };
}
