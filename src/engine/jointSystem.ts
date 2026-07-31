import { PulleyJoint, RevoluteJoint, RopeJoint, Vec2, type Body, type World } from 'planck';
import { PARTS, type MachineSnapshot, type PartState } from '../model';
import { localPointToPhysics, pointDistance, pxToMeters, radialContact } from './coordinates';

const MIN_ROPE_LENGTH_METERS = pxToMeters(24);
const ROPE_STARTUP_SLACK_METERS = pxToMeters(1.5);
const MIN_PULLEY_SEGMENT_METERS = pxToMeters(8);

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeRatio(value: number | undefined): number {
  return Math.max(0.25, Math.min(4, finite(value ?? 1, 1)));
}

export function createHinges(world: World, snapshot: MachineSnapshot, bodies: Map<string, Body>): void {
  for (const hinge of snapshot.hinges) {
    const part = snapshot.parts.find((candidate) => candidate.id === hinge.partId);
    const body = bodies.get(hinge.partId);
    if (!part || !body) continue;

    const localAnchor = localPointToPhysics({ x: hinge.localX, y: hinge.localY });
    const worldAnchor = body.getWorldPoint(Vec2(localAnchor.x, localAnchor.y));
    const pin = world.createBody({ type: 'static', position: worldAnchor });
    const hasLimits = hinge.lowerAngle !== undefined && hinge.upperAngle !== undefined;
    const editorLower = finite(hinge.lowerAngle ?? 0, 0);
    const editorUpper = finite(hinge.upperAngle ?? 0, 0);
    // Editor angles use clockwise-positive screen coordinates; Planck uses counter-clockwise world coordinates.
    const lowerAngle = hasLimits ? -editorUpper : 0;
    const upperAngle = hasLimits ? -editorLower : 0;

    world.createJoint(new RevoluteJoint({
      bodyA: pin,
      bodyB: body,
      localAnchorA: Vec2(0, 0),
      localAnchorB: Vec2(localAnchor.x, localAnchor.y),
      referenceAngle: -finite(hinge.referenceAngle, 0),
      enableLimit: hasLimits,
      lowerAngle: Math.min(lowerAngle, upperAngle),
      upperAngle: Math.max(lowerAngle, upperAngle),
      collideConnected: false
    }));
  }
}

export function createRopes(world: World, snapshot: MachineSnapshot, bodies: Map<string, Body>): void {
  for (const rope of snapshot.ropes) {
    const bodyA = bodies.get(rope.a.partId);
    const bodyB = bodies.get(rope.b.partId);
    if (!bodyA || !bodyB || bodyA === bodyB) continue;

    const anchorA = localPointToPhysics({ x: rope.a.localX, y: rope.a.localY });
    const anchorB = localPointToPhysics({ x: rope.b.localX, y: rope.b.localY });

    if (rope.pulleyPartId) {
      const pulleyPart = snapshot.parts.find(
        (part): part is PartState => part.id === rope.pulleyPartId && part.kind === 'sheave'
      );
      const pulleyBody = bodies.get(rope.pulleyPartId);
      if (pulleyPart && pulleyBody) {
        const center = pulleyBody.getPosition();
        const worldAnchorA = bodyA.getWorldPoint(anchorA);
        const worldAnchorB = bodyB.getWorldPoint(anchorB);
        const radius = pxToMeters((PARTS.sheave.radius ?? 42) * 0.86);
        const groundA = radialContact(center, worldAnchorA, radius);
        const groundB = radialContact(center, worldAnchorB, radius);
        const lengthA = Math.max(MIN_PULLEY_SEGMENT_METERS, pointDistance(groundA, worldAnchorA));
        const lengthB = Math.max(MIN_PULLEY_SEGMENT_METERS, pointDistance(groundB, worldAnchorB));
        world.createJoint(new PulleyJoint({
          bodyA,
          bodyB,
          groundAnchorA: Vec2(groundA.x, groundA.y),
          groundAnchorB: Vec2(groundB.x, groundB.y),
          localAnchorA: Vec2(anchorA.x, anchorA.y),
          localAnchorB: Vec2(anchorB.x, anchorB.y),
          lengthA,
          lengthB,
          ratio: safeRatio(rope.ratio),
          collideConnected: false
        }));
        continue;
      }
    }

    const currentLength = pointDistance(bodyA.getWorldPoint(anchorA), bodyB.getWorldPoint(anchorB));
    const requestedLength = pxToMeters(Math.max(24, finite(rope.maxLength, 24)));
    // Avoid a large first-frame correction when stored endpoints are farther apart than the stored length.
    const maxLength = Math.max(MIN_ROPE_LENGTH_METERS, requestedLength, currentLength + ROPE_STARTUP_SLACK_METERS);
    world.createJoint(new RopeJoint({
      bodyA,
      bodyB,
      localAnchorA: Vec2(anchorA.x, anchorA.y),
      localAnchorB: Vec2(anchorB.x, anchorB.y),
      maxLength,
      collideConnected: false
    }));
  }
}
