import * as THREE from 'three';
import { Circle, RevoluteJoint, Vec2, World } from 'planck';
import { createFanBeltModelV2 } from './fanBeltV2';
import type { PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.45;
const PULLEY_RADIUS = 0.48;
const LEFT_X = -0.95;
const RIGHT_X = 0.95;
const BELT_COUPLING = 3.2;
const MAX_BELT_FORCE = 1.2;
const BEARING_DRAG = 0.035;
const DRIVER_IMPULSE = 0.65;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

interface LoopSampler {
  sample(distance: number): { point: THREE.Vector3; tangent: THREE.Vector3 };
  length: number;
}

function createCapsuleSampler(halfStraight = 0.95, radius = 0.56, segments = 160): LoopSampler {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const perimeter = 4 * halfStraight + Math.PI * 2 * radius;
    const d = t * perimeter;
    const top = 2 * halfStraight;
    const arc = Math.PI * radius;
    let p: THREE.Vector3;
    if (d <= top) {
      p = new THREE.Vector3(-halfStraight + d, radius, 0);
    } else if (d <= top + arc) {
      const u = (d - top) / radius;
      p = new THREE.Vector3(halfStraight + Math.sin(u) * radius, Math.cos(u) * radius, 0);
    } else if (d <= top + arc + top) {
      const u = d - top - arc;
      p = new THREE.Vector3(halfStraight - u, -radius, 0);
    } else {
      const u = (d - top - arc - top) / radius;
      p = new THREE.Vector3(-halfStraight - Math.sin(u) * radius, -Math.cos(u) * radius, 0);
    }
    points.push(p);
  }
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + points[index].distanceTo(points[index - 1]));
  }
  const total = cumulative[cumulative.length - 1];
  return {
    length: total,
    sample(distance: number) {
      const wrapped = ((distance % total) + total) % total;
      let hi = 1;
      while (hi < cumulative.length && cumulative[hi] < wrapped) hi += 1;
      hi = Math.min(hi, cumulative.length - 1);
      const lo = Math.max(0, hi - 1);
      const span = Math.max(1e-6, cumulative[hi] - cumulative[lo]);
      const alpha = (wrapped - cumulative[lo]) / span;
      const point = points[lo].clone().lerp(points[hi], alpha);
      const tangent = points[hi].clone().sub(points[lo]).normalize();
      return { point, tangent };
    }
  };
}

function addPulleyFaceDetail(pulley: THREE.Group, prefix: string): void {
  const spokeMaterial = new THREE.MeshStandardMaterial({ color: 0x4f606a, metalness: 0.82, roughness: 0.28 });
  for (let index = 0; index < 6; index += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.045, 0.055), spokeMaterial);
    spoke.rotation.z = index * Math.PI / 3;
    spoke.position.z = 0.19;
    spoke.name = `${prefix}Spoke${index + 1}`;
    pulley.add(spoke);
  }
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.092, 0.092, 0.055, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x202a31, metalness: 0.86, roughness: 0.23, clearcoat: 0.08 })
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.215;
  cap.name = `${prefix}HubCap`;
  pulley.add(cap);
}

export function createFanBeltModelV3(): PremiumReviewAssetModel {
  const model = createFanBeltModelV2();
  const group = model.group;
  group.userData.assetVersion = 'fan-belt-v3';
  group.userData.referenceStyle = '2026-pbr-v-belt-physical-slip-coupling';
  group.userData.physicsEngine = 'planck';

  const leftPulley = group.getObjectByName('FanBeltV2PreviewPulleyLeft') as THREE.Group | undefined;
  const rightPulley = group.getObjectByName('FanBeltV2PreviewPulleyRight') as THREE.Group | undefined;
  if (!leftPulley || !rightPulley) throw new Error('Fan Belt v3 requires both v2 preview pulleys.');
  leftPulley.name = 'FanBeltV3DriverPulley';
  rightPulley.name = 'FanBeltV3FollowerPulley';
  leftPulley.userData.isFanBeltDriver = true;
  rightPulley.userData.isFanBeltFollower = true;
  addPulleyFaceDetail(leftPulley, 'FanBeltV3Driver');
  addPulleyFaceDetail(rightPulley, 'FanBeltV3Follower');

  // Small moving sidewall marks make belt travel legible without turning the
  // part into a neon UI element. They represent ordinary printed inspection
  // markings on an industrial V-belt.
  const sampler = createCapsuleSampler();
  const markMaterial = new THREE.MeshStandardMaterial({ color: 0x8c9498, roughness: 0.78, metalness: 0 });
  const marks: THREE.Mesh[] = [];
  for (let index = 0; index < 5; index += 1) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.012), markMaterial);
    mark.position.z = 0.126;
    mark.name = `FanBeltV3InspectionMark${index + 1}`;
    group.add(mark);
    marks.push(mark);
  }

  const world = new World({ gravity: Vec2(0, 0), allowSleep: true });
  const leftPin = world.createBody({ type: 'static', position: Vec2(LEFT_X, 0) });
  const rightPin = world.createBody({ type: 'static', position: Vec2(RIGHT_X, 0) });
  const leftBody = world.createBody({ type: 'dynamic', position: Vec2(LEFT_X, 0), angularDamping: 0, allowSleep: true });
  const rightBody = world.createBody({ type: 'dynamic', position: Vec2(RIGHT_X, 0), angularDamping: 0, allowSleep: true });
  leftBody.createFixture({ shape: Circle(PULLEY_RADIUS), density: 1, friction: 0.3 });
  rightBody.createFixture({ shape: Circle(PULLEY_RADIUS), density: 1, friction: 0.3 });
  world.createJoint(new RevoluteJoint({ bodyA: leftPin, bodyB: leftBody, localAnchorA: Vec2(0, 0), localAnchorB: Vec2(0, 0) }));
  world.createJoint(new RevoluteJoint({ bodyA: rightPin, bodyB: rightBody, localAnchorA: Vec2(0, 0), localAnchorB: Vec2(0, 0) }));

  type MotionState = 'ready' | 'transmitting' | 'coasting' | 'settled';
  let state: MotionState = 'ready';
  let accumulator = 0;
  let beltTravel = 0;
  let peakFollowerSpeed = 0;
  let peakSlip = 0;
  let kickCount = 0;
  let quietTime = 0;

  const kickDriver = (): void => {
    leftBody.applyAngularImpulse(DRIVER_IMPULSE, true);
    state = 'transmitting';
    quietTime = 0;
    kickCount += 1;
  };

  const stepFixed = (): void => {
    const leftOmega = leftBody.getAngularVelocity();
    const rightOmega = rightBody.getAngularVelocity();
    const leftSurface = leftOmega * PULLEY_RADIUS;
    const rightSurface = rightOmega * PULLEY_RADIUS;
    const slip = leftSurface - rightSurface;

    // Belt traction is modeled as a finite friction force proportional to slip.
    // We apply equal belt tensions at each pulley radius; nothing sets the
    // follower angular velocity directly, so overload naturally creates slip.
    const beltForce = clamp(BELT_COUPLING * slip, MAX_BELT_FORCE);
    leftBody.applyTorque(-beltForce * PULLEY_RADIUS - leftOmega * BEARING_DRAG, true);
    rightBody.applyTorque(beltForce * PULLEY_RADIUS - rightOmega * BEARING_DRAG, true);
    world.step(FIXED_STEP, 10, 6);

    const nextLeft = leftBody.getAngularVelocity();
    const nextRight = rightBody.getAngularVelocity();
    const beltSpeed = (nextLeft * PULLEY_RADIUS + nextRight * PULLEY_RADIUS) * 0.5;
    beltTravel += beltSpeed * FIXED_STEP;
    peakFollowerSpeed = Math.max(peakFollowerSpeed, Math.abs(nextRight));
    peakSlip = Math.max(peakSlip, Math.abs(slip));

    if (state === 'transmitting' && Math.abs(nextRight) > 0.7) state = 'coasting';
    const energyLike = Math.abs(nextLeft) + Math.abs(nextRight);
    if (energyLike < 0.16) quietTime += FIXED_STEP;
    else quietTime = 0;
    if (kickCount > 0 && quietTime > 0.45) state = 'settled';
  };

  const applyVisualPose = (): void => {
    leftPulley.rotation.z = leftBody.getAngle();
    rightPulley.rotation.z = rightBody.getAngle();
    for (let index = 0; index < marks.length; index += 1) {
      const { point, tangent } = sampler.sample(beltTravel + index * sampler.length / marks.length);
      const mark = marks[index];
      mark.position.x = point.x;
      mark.position.y = point.y;
      mark.rotation.z = Math.atan2(tangent.y, tangent.x);
    }

    const leftOmega = leftBody.getAngularVelocity();
    const rightOmega = rightBody.getAngularVelocity();
    const slip = leftOmega * PULLEY_RADIUS - rightOmega * PULLEY_RADIUS;
    const beltSpeed = (leftOmega * PULLEY_RADIUS + rightOmega * PULLEY_RADIUS) * 0.5;
    const ratio = Math.abs(leftOmega) > 0.05 ? rightOmega / leftOmega : 0;
    group.userData.state = state;
    group.userData.leftOmega = leftOmega;
    group.userData.rightOmega = rightOmega;
    group.userData.speedRatio = ratio;
    group.userData.slip = slip;
    group.userData.beltSpeed = beltSpeed;
    group.userData.beltTravel = beltTravel;
    group.userData.peakFollowerSpeed = peakFollowerSpeed;
    group.userData.peakSlip = peakSlip;
    group.userData.kickCount = kickCount;
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
    beltTravel = 0;
    peakFollowerSpeed = 0;
    peakSlip = 0;
    kickCount = 0;
    quietTime = 0;
    state = 'ready';
    leftBody.setTransform(Vec2(LEFT_X, 0), 0);
    rightBody.setTransform(Vec2(RIGHT_X, 0), 0);
    leftBody.setAngularVelocity(0);
    rightBody.setAngularVelocity(0);
    applyVisualPose();
  };

  group.userData.motion = 'physical-belt-traction-slip-transfer';
  group.userData.kickDriver = kickDriver;
  group.userData.update = update;
  group.userData.reset = reset;
  reset();
  return model;
}
