import { Box, PrismaticJoint, Vec2, type Body, type World } from 'planck';
import { PARTS, PHYSICS_SCALE, type PartState } from '../model';
import { pixelPointToPhysics, pxToMeters } from './coordinates';
import { PHYSICS_CONFIG } from './physicsConfig';
import type { PhysicsBodyData } from './partFactory';

export interface SpringMechanism {
  part: PartState;
  base: Body;
  plunger: Body;
  joint: PrismaticJoint;
}

export function createSpringMechanism(world: World, part: PartState): SpringMechanism {
  const spec = PARTS.spring;
  const config = PHYSICS_CONFIG.spring;
  const basePosition = pixelPointToPhysics(part);
  const physicsAngle = -part.angle;
  const direction = Vec2(Math.cos(physicsAngle), Math.sin(physicsAngle));

  const base = world.createBody({
    type: 'static',
    position: Vec2(basePosition.x, basePosition.y),
    angle: physicsAngle,
    userData: { partId: part.id, kind: 'spring-base' } satisfies PhysicsBodyData
  });
  base.createFixture({
    shape: Box(pxToMeters(13), pxToMeters(spec.height * 0.43), Vec2(pxToMeters(-spec.width / 2 + 15), 0), 0),
    friction: 0.72,
    restitution: 0.02,
    userData: { partId: part.id, kind: 'spring-base' } satisfies PhysicsBodyData
  });

  const restOffset = pxToMeters(spec.width / 2 - config.plungerHalfWidthPx - 3);
  const plungerPosition = Vec2(basePosition.x + direction.x * restOffset, basePosition.y + direction.y * restOffset);
  const plunger = world.createBody({
    type: 'dynamic',
    position: plungerPosition,
    angle: physicsAngle,
    gravityScale: 0,
    linearDamping: 0.04,
    angularDamping: 0.8,
    fixedRotation: false,
    bullet: true,
    userData: { partId: part.id, kind: 'spring-plunger' } satisfies PhysicsBodyData
  });
  plunger.createFixture({
    shape: Box(pxToMeters(config.plungerHalfWidthPx), pxToMeters(config.plungerHalfHeightPx)),
    density: 3.1,
    friction: 0.68,
    restitution: 0.03,
    userData: { partId: part.id, kind: 'spring-plunger' } satisfies PhysicsBodyData
  });

  const joint = new PrismaticJoint({
    enableLimit: true,
    lowerTranslation: -pxToMeters(config.travelPx),
    upperTranslation: pxToMeters(2),
    collideConnected: false
  }, base, plunger, plungerPosition, direction);
  world.createJoint(joint);

  return { part, base, plunger, joint };
}

export function applySpringForce(mechanism: SpringMechanism, enabled = true, power = 1): void {
  const config = PHYSICS_CONFIG.spring;
  const translation = mechanism.joint.getJointTranslation();
  const speed = mechanism.joint.getJointSpeed();
  const safePower = Math.max(0.25, Math.min(2, power));
  const stiffness = enabled ? config.stiffness * safePower : 0;
  const springForce = -stiffness * translation;
  const dampingForce = -config.damping * speed;
  const maxForce = config.maxForce * safePower;
  const magnitude = Math.max(-maxForce, Math.min(maxForce, springForce + dampingForce));
  const angle = mechanism.base.getAngle();
  const direction = Vec2(Math.cos(angle), Math.sin(angle));
  mechanism.plunger.applyForceToCenter(Vec2(direction.x * magnitude, direction.y * magnitude), true);
}

export function springCompressionPx(mechanism: SpringMechanism): number {
  return Math.max(0, -mechanism.joint.getJointTranslation() * PHYSICS_SCALE);
}
