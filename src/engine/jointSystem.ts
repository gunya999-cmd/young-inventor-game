import { PulleyJoint, RevoluteJoint, RopeJoint, Vec2, type Body, type World } from 'planck';
import { PARTS, type MachineSnapshot, type PartState } from '../model';
import { localPointToPhysics, pointDistance, pxToMeters, radialContact } from './coordinates';

export function createHinges(world: World, snapshot: MachineSnapshot, bodies: Map<string, Body>): void {
  for (const hinge of snapshot.hinges) {
    const part = snapshot.parts.find((candidate) => candidate.id === hinge.partId);
    const body = bodies.get(hinge.partId);
    if (!part || !body) continue;

    const localAnchor = localPointToPhysics({ x: hinge.localX, y: hinge.localY });
    const worldAnchor = body.getWorldPoint(Vec2(localAnchor.x, localAnchor.y));
    const pin = world.createBody({ type: 'static', position: worldAnchor });
    world.createJoint(new RevoluteJoint({
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
        const lengthA = Math.max(0.08, pointDistance(groundA, worldAnchorA));
        const lengthB = Math.max(0.08, pointDistance(groundB, worldAnchorB));
        world.createJoint(new PulleyJoint({
          bodyA,
          bodyB,
          groundAnchorA: Vec2(groundA.x, groundA.y),
          groundAnchorB: Vec2(groundB.x, groundB.y),
          localAnchorA: Vec2(anchorA.x, anchorA.y),
          localAnchorB: Vec2(anchorB.x, anchorB.y),
          lengthA,
          lengthB,
          ratio: rope.ratio ?? 1,
          collideConnected: true
        }));
        continue;
      }
    }

    world.createJoint(new RopeJoint({
      bodyA,
      bodyB,
      localAnchorA: Vec2(anchorA.x, anchorA.y),
      localAnchorB: Vec2(anchorB.x, anchorB.y),
      maxLength: pxToMeters(Math.max(24, rope.maxLength)),
      collideConnected: true
    }));
  }
}
