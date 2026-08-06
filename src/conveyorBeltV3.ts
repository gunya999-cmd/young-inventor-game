import * as THREE from 'three';
import { Box, Circle, RevoluteJoint, Vec2, World } from 'planck';
import { createConveyorBeltModelV2 } from './conveyorBeltV2';
import type { PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.45;
const DRUM_RADIUS = 0.265;
const DRUM_X = 1.55;
const DRUM_Y = 0.16;
const MOTOR_TARGET_OMEGA = 8.2;
const MOTOR_TORQUE = 0.72;
const BELT_COUPLING = 4.2;
const MAX_BELT_FORCE = 1.4;
const BEARING_DRAG = 0.025;
const TOP_Y = 0.526;
const SURFACE_HALF_WIDTH = 1.56;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

export function createConveyorBeltModelV3(): PremiumReviewAssetModel {
  const model = createConveyorBeltModelV2();
  const group = model.group;
  group.userData.assetVersion = 'conveyor-belt-v3';
  group.userData.referenceStyle = '2026-industrial-pbr-physical-transport';
  group.userData.physicsEngine = 'planck';
  group.userData.motion = 'motor-drum-belt-friction-transport';

  const beltMesh = group.getObjectByName('ConveyorV2ContinuousRubberLoop') as THREE.Mesh | undefined;
  const leftDrum = group.getObjectByName('ConveyorV2DriveDrumLeft') as THREE.Mesh | undefined;
  const rightDrum = group.getObjectByName('ConveyorV2DriveDrumRight') as THREE.Mesh | undefined;
  const supportRollers = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'ConveyorV2SupportRoller');
  const treads = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'ConveyorV2TreadLine');
  const motorVisual = group.getObjectByName('ConveyorV2Motor');
  const couplerVisual = group.getObjectByName('ConveyorV2DriveCoupler');
  if (!beltMesh || !leftDrum || !rightDrum) throw new Error('Conveyor v3 requires v2 belt and drive drums.');
  beltMesh.userData.isConveyorControl = true;
  if (motorVisual) motorVisual.userData.isConveyorControl = true;
  if (couplerVisual) couplerVisual.userData.isConveyorControl = true;

  if (beltMesh.material instanceof THREE.MeshPhysicalMaterial) {
    beltMesh.material.roughness = 0.76;
    beltMesh.material.clearcoat = 0.035;
    beltMesh.material.clearcoatRoughness = 0.9;
    beltMesh.material.sheen = 0.08;
    beltMesh.material.sheenRoughness = 0.86;
    beltMesh.material.needsUpdate = true;
  }

  const crate = new THREE.Group();
  crate.name = 'ConveyorV3PhysicsCrate';
  const crateBodyMat = new THREE.MeshPhysicalMaterial({ color: 0xb9824a, roughness: 0.62, metalness: 0, clearcoat: 0.025 });
  const crateEdgeMat = new THREE.MeshStandardMaterial({ color: 0x5d4430, roughness: 0.68, metalness: 0 });
  const crateBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.58), crateBodyMat);
  crate.add(crateBody);
  for (const y of [-0.19, 0.19]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.035, 0.61), crateEdgeMat);
    band.position.y = y;
    crate.add(band);
  }
  crate.visible = false;
  group.add(crate);

  const statusLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x314148, emissive: 0x000000, roughness: 0.32, metalness: 0.15 })
  );
  statusLamp.position.set(1.55, 0.47, 1.18);
  statusLamp.name = 'ConveyorV3StatusLamp';
  group.add(statusLamp);

  const world = new World({ gravity: Vec2(0, -4.8), allowSleep: true });
  const surface = world.createBody({ type: 'static', position: Vec2(0, TOP_Y - 0.04) });
  surface.createFixture({ shape: Box(SURFACE_HALF_WIDTH, 0.04), friction: 0.72, restitution: 0.02 });

  const leftPin = world.createBody({ type: 'static', position: Vec2(-DRUM_X, DRUM_Y) });
  const rightPin = world.createBody({ type: 'static', position: Vec2(DRUM_X, DRUM_Y) });
  const leftBody = world.createBody({ type: 'dynamic', position: Vec2(-DRUM_X, DRUM_Y), fixedRotation: false, allowSleep: true });
  const rightBody = world.createBody({ type: 'dynamic', position: Vec2(DRUM_X, DRUM_Y), fixedRotation: false, allowSleep: true });
  leftBody.createFixture({ shape: Circle(DRUM_RADIUS), density: 1.6, friction: 0.4 });
  rightBody.createFixture({ shape: Circle(DRUM_RADIUS), density: 1.6, friction: 0.4 });
  world.createJoint(new RevoluteJoint({ bodyA: leftPin, bodyB: leftBody, localAnchorA: Vec2(0, 0), localAnchorB: Vec2(0, 0) }));
  world.createJoint(new RevoluteJoint({ bodyA: rightPin, bodyB: rightBody, localAnchorA: Vec2(0, 0), localAnchorB: Vec2(0, 0) }));

  const cratePhysics = world.createBody({
    type: 'dynamic',
    position: Vec2(-1.05, 0.95),
    fixedRotation: false,
    linearDamping: 0.02,
    angularDamping: 0.12,
    allowSleep: true
  });
  cratePhysics.createFixture({ shape: Box(0.23, 0.21), density: 0.75, friction: 0.68, restitution: 0.015 });

  type MotionState = 'ready' | 'starting' | 'transporting' | 'delivered' | 'settled';
  let state: MotionState = 'ready';
  let accumulator = 0;
  let running = false;
  let beltTravel = 0;
  let maxCrateX = -1.05;
  let peakBeltSpeed = 0;
  let delivered = false;

  const resetCrate = (): void => {
    cratePhysics.setTransform(Vec2(-1.05, 0.95), 0);
    cratePhysics.setLinearVelocity(Vec2(0, 0));
    cratePhysics.setAngularVelocity(0);
    cratePhysics.setAwake(true);
    crate.visible = true;
    maxCrateX = -1.05;
    delivered = false;
  };

  const start = (): void => {
    leftBody.setAngularVelocity(0);
    rightBody.setAngularVelocity(0);
    resetCrate();
    running = true;
    state = 'starting';
  };

  const stepFixed = (): void => {
    const leftOmega = leftBody.getAngularVelocity();
    const rightOmega = rightBody.getAngularVelocity();

    if (running && rightOmega < MOTOR_TARGET_OMEGA) rightBody.applyTorque(MOTOR_TORQUE, true);
    rightBody.applyTorque(-rightOmega * BEARING_DRAG, true);
    leftBody.applyTorque(-leftOmega * BEARING_DRAG, true);

    const slip = rightOmega * DRUM_RADIUS - leftOmega * DRUM_RADIUS;
    const beltForce = clamp(BELT_COUPLING * slip, MAX_BELT_FORCE);
    rightBody.applyTorque(-beltForce * DRUM_RADIUS, true);
    leftBody.applyTorque(beltForce * DRUM_RADIUS, true);

    const beltSpeed = (rightOmega * DRUM_RADIUS + leftOmega * DRUM_RADIUS) * 0.5;
    const cratePosition = cratePhysics.getPosition();
    const crateVelocity = cratePhysics.getLinearVelocity();
    const nearTop = cratePosition.y > TOP_Y - 0.05 && cratePosition.y < TOP_Y + 0.38 && Math.abs(cratePosition.x) < SURFACE_HALF_WIDTH + 0.2;
    if (nearTop && beltSpeed > 0.05) {
      // Coulomb-like traction toward the belt surface speed. The crate remains a
      // normal dynamic Planck body, so gravity, impact, inertia and overshoot are real.
      const relative = beltSpeed - crateVelocity.x;
      const maxTraction = cratePhysics.getMass() * 7.5;
      const traction = clamp(relative * cratePhysics.getMass() * 12, maxTraction);
      cratePhysics.applyForceToCenter(Vec2(traction, 0), true);
    }

    world.step(FIXED_STEP, 10, 6);
    const nextLeft = leftBody.getAngularVelocity();
    const nextRight = rightBody.getAngularVelocity();
    const nextBeltSpeed = (nextRight * DRUM_RADIUS + nextLeft * DRUM_RADIUS) * 0.5;
    beltTravel += nextBeltSpeed * FIXED_STEP;
    peakBeltSpeed = Math.max(peakBeltSpeed, Math.abs(nextBeltSpeed));
    maxCrateX = Math.max(maxCrateX, cratePhysics.getPosition().x);
    if (state === 'starting' && Math.abs(nextBeltSpeed) > 0.55) state = 'transporting';
    if (!delivered && cratePhysics.getPosition().x > 1.22) {
      delivered = true;
      state = 'delivered';
    }
  };

  const applyVisualPose = (): void => {
    leftDrum.rotation.z = leftBody.getAngle();
    rightDrum.rotation.z = rightBody.getAngle();
    const beltSpeed = (rightBody.getAngularVelocity() * DRUM_RADIUS + leftBody.getAngularVelocity() * DRUM_RADIUS) * 0.5;
    for (let index = 0; index < supportRollers.length; index += 1) {
      supportRollers[index].rotation.z = beltTravel / 0.075;
    }

    const topLength = 2.8;
    for (let index = 0; index < treads.length; index += 1) {
      const base = -1.29 + index * 0.215;
      const shifted = ((base + beltTravel + 1.4) % topLength + topLength) % topLength - 1.4;
      treads[index].position.x = shifted;
    }

    const p = cratePhysics.getPosition();
    crate.position.set(p.x, p.y, 0);
    crate.rotation.z = cratePhysics.getAngle();

    const lampMaterial = statusLamp.material as THREE.MeshStandardMaterial;
    lampMaterial.emissive.setHex(running ? 0x2ca86a : 0x000000);
    lampMaterial.color.setHex(running ? 0x4ed18a : 0x314148);

    group.userData.state = state;
    group.userData.running = running;
    group.userData.beltSpeed = beltSpeed;
    group.userData.beltTravel = beltTravel;
    group.userData.leftOmega = leftBody.getAngularVelocity();
    group.userData.rightOmega = rightBody.getAngularVelocity();
    group.userData.crateX = p.x;
    group.userData.crateY = p.y;
    group.userData.crateVx = cratePhysics.getLinearVelocity().x;
    group.userData.maxCrateX = maxCrateX;
    group.userData.peakBeltSpeed = peakBeltSpeed;
    group.userData.delivered = delivered;
  };

  const update = (dt = 0): void => {
    accumulator = Math.min(MAX_CATCHUP, accumulator + Math.max(0, dt));
    while (accumulator >= FIXED_STEP) {
      stepFixed();
      accumulator -= FIXED_STEP;
    }
    applyVisualPose();
  };

  const reset = (): void => {
    accumulator = 0;
    running = false;
    beltTravel = 0;
    peakBeltSpeed = 0;
    maxCrateX = -1.05;
    delivered = false;
    state = 'ready';
    leftBody.setTransform(Vec2(-DRUM_X, DRUM_Y), 0);
    rightBody.setTransform(Vec2(DRUM_X, DRUM_Y), 0);
    leftBody.setAngularVelocity(0);
    rightBody.setAngularVelocity(0);
    cratePhysics.setTransform(Vec2(-1.05, 0.95), 0);
    cratePhysics.setLinearVelocity(Vec2(0, 0));
    cratePhysics.setAngularVelocity(0);
    cratePhysics.setAwake(false);
    crate.visible = false;
    applyVisualPose();
  };

  group.userData.startConveyor = start;
  group.userData.update = update;
  group.userData.reset = reset;
  reset();
  return model;
}
