import { RevoluteJoint, Vec2, type Body, type World } from 'planck';
import { PARTS, type MachineSnapshot, type PartKind } from '../model';
import { pxToMeters } from './coordinates';

const MOTOR_SPEED = 5.2;
const MOTOR_RESPONSE = 0.18;
const COUPLING_RESPONSE = 0.28;
const MAX_DRIVE_SPEED = 12;
const DRIVETRAIN_KINDS = new Set<PartKind>(['motor', 'gear', 'sheave']);

interface DriveNode {
  id: string;
  kind: 'motor' | 'gear' | 'sheave';
  body: Body;
  radius: number;
}

interface Coupling {
  a: DriveNode;
  b: DriveNode;
  direction: 1 | -1;
  ratio: number;
}

function clampSpeed(value: number): number {
  return Math.max(-MAX_DRIVE_SPEED, Math.min(MAX_DRIVE_SPEED, value));
}

export class DrivetrainRuntime {
  private readonly nodes: DriveNode[] = [];
  private readonly couplings: Coupling[] = [];

  constructor(world: World, snapshot: MachineSnapshot, bodies: Map<string, Body>) {
    for (const part of snapshot.parts) {
      if (!DRIVETRAIN_KINDS.has(part.kind)) continue;
      const body = bodies.get(part.id);
      const radius = PARTS[part.kind].radius;
      if (!body || radius === undefined) continue;
      const pin = world.createBody({ type: 'static', position: body.getPosition() });
      world.createJoint(new RevoluteJoint({
        bodyA: pin,
        bodyB: body,
        localAnchorA: Vec2(0, 0),
        localAnchorB: Vec2(0, 0),
        collideConnected: false
      }));
      this.nodes.push({ id: part.id, kind: part.kind as DriveNode['kind'], body, radius: pxToMeters(radius) });
    }
    this.buildCouplings();
  }

  step(): void {
    for (const node of this.nodes) {
      if (node.kind !== 'motor') continue;
      const current = node.body.getAngularVelocity();
      node.body.setAngularVelocity(clampSpeed(current + (MOTOR_SPEED - current) * MOTOR_RESPONSE));
      node.body.setAwake(true);
    }

    for (let pass = 0; pass < 3; pass += 1) {
      for (const coupling of this.couplings) {
        const source = Math.abs(coupling.a.body.getAngularVelocity()) >= Math.abs(coupling.b.body.getAngularVelocity())
          ? coupling.a
          : coupling.b;
        const target = source === coupling.a ? coupling.b : coupling.a;
        const ratio = source === coupling.a ? coupling.ratio : 1 / coupling.ratio;
        const desired = source.body.getAngularVelocity() * coupling.direction * ratio;
        const current = target.body.getAngularVelocity();
        target.body.setAngularVelocity(clampSpeed(current + (desired - current) * COUPLING_RESPONSE));
        target.body.setAwake(true);
      }
    }
  }

  private buildCouplings(): void {
    for (let left = 0; left < this.nodes.length; left += 1) {
      for (let right = left + 1; right < this.nodes.length; right += 1) {
        const a = this.nodes[left];
        const b = this.nodes[right];
        const delta = Vec2.sub(a.body.getPosition(), b.body.getPosition()).length();
        const touching = delta <= (a.radius + b.radius) * 1.18;
        const beltRange = delta <= pxToMeters(360);
        const gearPair = a.kind === 'gear' && b.kind === 'gear';
        const directMotorGear = touching && ((a.kind === 'motor' && b.kind === 'gear') || (a.kind === 'gear' && b.kind === 'motor'));
        const beltPair = beltRange && !touching && a.kind !== 'gear' && b.kind !== 'gear';
        if (!gearPair && !directMotorGear && !beltPair) continue;
        if (gearPair && !touching) continue;
        this.couplings.push({
          a,
          b,
          direction: beltPair ? 1 : -1,
          ratio: a.radius / b.radius
        });
      }
    }
  }
}
