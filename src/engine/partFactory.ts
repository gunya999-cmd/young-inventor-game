import { Box, Circle, Vec2, type Body, type World } from 'planck';
import { PARTS, type PartKind, type PartState } from '../model';
import { pixelPointToPhysics, pxToMeters } from './coordinates';
import { PHYSICS_CONFIG } from './physicsConfig';

export interface PhysicsBodyData {
  partId?: string;
  kind?: PartKind | 'level' | 'basket' | 'button-sensor' | 'spring-base' | 'spring-plunger';
  goal?: boolean;
}

function dampingFor(part: PartState): { linear: number; angular: number } {
  const rolling = part.kind === 'ball' || part.kind === 'rubberball';
  if (rolling) {
    return {
      linear: PHYSICS_CONFIG.rollingLinearDamping,
      angular: PHYSICS_CONFIG.rollingAngularDamping
    };
  }
  if (part.kind === 'weight') {
    return {
      linear: PHYSICS_CONFIG.heavyLinearDamping,
      angular: PHYSICS_CONFIG.heavyAngularDamping
    };
  }
  return {
    linear: PHYSICS_CONFIG.defaultLinearDamping,
    angular: part.kind === 'domino' ? 0.05 : PHYSICS_CONFIG.defaultAngularDamping
  };
}

export function createStandardPartBody(world: World, part: PartState): Body {
  const spec = PARTS[part.kind];
  const position = pixelPointToPhysics(part);
  const damping = dampingFor(part);
  const body = world.createBody({
    type: part.fixed ? 'static' : 'dynamic',
    position: Vec2(position.x, position.y),
    angle: -part.angle,
    linearDamping: damping.linear,
    angularDamping: damping.angular,
    bullet: part.kind === 'ball' || part.kind === 'rubberball',
    userData: { partId: part.id, kind: part.kind } satisfies PhysicsBodyData
  });

  const shape = spec.radius
    ? Circle(pxToMeters(spec.radius))
    : Box(pxToMeters(spec.width / 2), pxToMeters(spec.height / 2));

  body.createFixture({
    shape,
    density: spec.density,
    friction: spec.friction,
    restitution: spec.restitution,
    userData: { partId: part.id, kind: part.kind } satisfies PhysicsBodyData
  });

  if (part.kind === 'button') {
    body.createFixture({
      shape: Box(
        pxToMeters(spec.width * 0.34),
        pxToMeters(9),
        Vec2(0, pxToMeters(spec.height / 2 + 8)),
        0
      ),
      isSensor: true,
      userData: { partId: part.id, kind: 'button-sensor' } satisfies PhysicsBodyData
    });
  }

  return body;
}
