import { Box, Circle, Vec2, type Body, type World } from 'planck';
import { PARTS, type PartKind, type PartState } from '../model';
import { pixelPointToPhysics, pxToMeters } from './coordinates';
import { PHYSICS_CONFIG } from './physicsConfig';
import { CONTACT_TUNING } from './contactTuning';

export interface PhysicsBodyData {
  partId?: string;
  kind?: PartKind | 'level' | 'basket' | 'button-sensor' | 'spring-base' | 'spring-plunger';
  goal?: boolean;
}

function dampingFor(part: PartState): { linear: number; angular: number } {
  const rolling = part.kind === 'ball' || part.kind === 'rubberball';
  if (rolling) return { linear: PHYSICS_CONFIG.rollingLinearDamping, angular: PHYSICS_CONFIG.rollingAngularDamping };
  if (part.kind === 'lever') return { linear: PHYSICS_CONFIG.leverLinearDamping, angular: PHYSICS_CONFIG.leverAngularDamping };
  if (part.kind === 'weight') return { linear: PHYSICS_CONFIG.heavyLinearDamping, angular: PHYSICS_CONFIG.heavyAngularDamping };
  if (part.kind === 'motor' || part.kind === 'gear' || part.kind === 'sheave') return { linear: 0, angular: 0.035 };
  return { linear: PHYSICS_CONFIG.defaultLinearDamping, angular: part.kind === 'domino' ? 0.07 : PHYSICS_CONFIG.defaultAngularDamping };
}

function contactFor(part: PartState): { friction: number; restitution: number } {
  const spec = PARTS[part.kind];
  if (part.kind === 'ball') return { friction: CONTACT_TUNING.steelBallFriction, restitution: CONTACT_TUNING.steelBallRestitution };
  if (part.kind === 'rubberball') return { friction: CONTACT_TUNING.rubberBallFriction, restitution: CONTACT_TUNING.rubberBallRestitution };
  if (part.kind === 'domino') return { friction: CONTACT_TUNING.dominoFriction, restitution: CONTACT_TUNING.dominoRestitution };
  if (part.kind === 'plank' || part.kind === 'lever') return { friction: Math.min(spec.friction, CONTACT_TUNING.guideFriction), restitution: spec.restitution };
  return { friction: spec.friction, restitution: spec.restitution };
}

function needsContinuousCollision(part: PartState): boolean {
  return !part.fixed && (part.kind === 'ball' || part.kind === 'rubberball' || part.kind === 'domino' || part.kind === 'weight');
}

function isDrivetrainPart(part: PartState): boolean {
  return part.kind === 'motor' || part.kind === 'gear' || part.kind === 'sheave';
}

export function createStandardPartBody(world: World, part: PartState): Body {
  const spec = PARTS[part.kind];
  const position = pixelPointToPhysics(part);
  const damping = dampingFor(part);
  const contact = contactFor(part);
  const drivetrain = isDrivetrainPart(part);
  const body = world.createBody({
    type: part.fixed && !drivetrain ? 'static' : 'dynamic',
    position: Vec2(position.x, position.y),
    angle: -part.angle,
    linearDamping: damping.linear,
    angularDamping: damping.angular,
    bullet: needsContinuousCollision(part),
    allowSleep: !drivetrain,
    awake: !part.fixed || drivetrain,
    userData: { partId: part.id, kind: part.kind } satisfies PhysicsBodyData
  });

  const shape = spec.radius ? Circle(pxToMeters(spec.radius)) : Box(pxToMeters(spec.width / 2), pxToMeters(spec.height / 2));
  body.createFixture({
    shape,
    density: spec.density,
    friction: contact.friction,
    restitution: contact.restitution,
    userData: { partId: part.id, kind: part.kind } satisfies PhysicsBodyData
  });

  if (part.kind === 'button') {
    body.createFixture({
      shape: Box(pxToMeters(spec.width * 0.34), pxToMeters(9), Vec2(0, pxToMeters(spec.height / 2 + 8)), 0),
      isSensor: true,
      userData: { partId: part.id, kind: 'button-sensor' } satisfies PhysicsBodyData
    });
  }

  return body;
}
