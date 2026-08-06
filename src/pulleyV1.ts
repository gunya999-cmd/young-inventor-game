import * as THREE from 'three';
import { Box, Circle, PulleyJoint, RevoluteJoint, Vec2, World } from 'planck';
import { createFineBumpTexture, makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.45;
const GRAVITY = 5.2;
const WHEEL_RADIUS = 0.46;
const WHEEL_Y = 0.58;
const LEFT_X = -0.72;
const RIGHT_X = 0.72;
const START_Y = -0.22;
const CLUTCH_RESPONSE = 2.6;
const MAX_CLUTCH_TORQUE = 4.8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeRopeGeometry(leftY: number, rightY: number): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  points.push(new THREE.Vector3(LEFT_X, leftY + 0.22, 0));
  points.push(new THREE.Vector3(-WHEEL_RADIUS, WHEEL_Y, 0));
  for (let index = 1; index <= 28; index += 1) {
    const angle = Math.PI - (index / 28) * Math.PI;
    points.push(new THREE.Vector3(
      Math.cos(angle) * WHEEL_RADIUS,
      WHEEL_Y + Math.sin(angle) * WHEEL_RADIUS,
      0
    ));
  }
  points.push(new THREE.Vector3(RIGHT_X, rightY + 0.22, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 92, 0.028, 8, false);
}

function createWeightVisual(color: number, labelBand: number): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.68,
    roughness: 0.34,
    clearcoat: 0.055,
    clearcoatRoughness: 0.58
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20292f, metalness: 0.78, roughness: 0.34 });
  const accent = new THREE.MeshStandardMaterial({ color: labelBand, metalness: 0.44, roughness: 0.40 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34, 2, 2, 2), bodyMaterial);
  body.name = 'PulleyV1TestWeight';
  group.add(body);

  const band = new THREE.Mesh(new THREE.BoxGeometry(0.355, 0.07, 0.355), accent);
  band.position.y = 0.04;
  group.add(band);

  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.018, 10, 32), dark);
  eye.position.y = 0.245;
  group.add(eye);
  return group;
}

export function createPulleyModelV1(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'pulley-block-3d';
  group.userData.assetVersion = 'pulley-v1';
  group.userData.sourceKey = 'sketchfab-fuglee-pulley-cc-by';
  group.userData.referenceStyle = '2026-industrial-pulley-block';
  group.userData.motion = 'planck-pulley-joint-clutch';
  group.userData.physicsEngine = 'planck';
  group.userData.snapPoints = [
    { id: 'rope-left', position: [LEFT_X, WHEEL_Y, 0] },
    { id: 'rope-right', position: [RIGHT_X, WHEEL_Y, 0] },
    { id: 'mount', position: [0, 1.28, 0] }
  ];

  const bump = createFineBumpTexture(1414, 5200);
  const frameMetal = new THREE.MeshPhysicalMaterial({
    color: 0x566772,
    metalness: 0.88,
    roughness: 0.29,
    clearcoat: 0.045,
    clearcoatRoughness: 0.48,
    bumpMap: bump,
    bumpScale: 0.013
  });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0x9aa7ae, metalness: 0.93, roughness: 0.22 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x202b31, metalness: 0.86, roughness: 0.31 });
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8935f, roughness: 0.92, metalness: 0 });

  for (const z of [-0.18, 0.18]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.46, 0.105), frameMetal);
    cheek.position.set(0, 0.60, z);
    cheek.name = 'PulleyV1ForgedCheek';
    group.add(cheek);

    const lowerCut = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.055, 12, 64), edgeMetal);
    lowerCut.position.set(0, WHEEL_Y, z * 1.03);
    lowerCut.name = 'PulleyV1CheekEdge';
    group.add(lowerCut);
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.22, 0.46), frameMetal);
  bridge.position.y = 1.27;
  bridge.name = 'PulleyV1TopBridge';
  group.add(bridge);

  const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.052, 14, 52), darkMetal);
  hanger.position.y = 1.49;
  hanger.name = 'PulleyV1MountEye';
  group.add(hanger);

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 36), darkMetal);
  axle.rotation.x = Math.PI / 2;
  axle.position.y = WHEEL_Y;
  axle.name = 'PulleyV1Axle';
  group.add(axle);

  const wheelVisual = new THREE.Group();
  wheelVisual.position.y = WHEEL_Y;
  wheelVisual.name = 'PulleyV1DynamicSheave';
  group.add(wheelVisual);

  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 72, 1, false), frameMetal);
  sheave.rotation.x = Math.PI / 2;
  wheelVisual.add(sheave);

  for (const z of [-0.145, 0.145]) {
    const flange = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS * 0.94, 0.047, 12, 72), edgeMetal);
    flange.position.z = z;
    wheelVisual.add(flange);
  }
  const groove = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS * 0.93, 0.032, 12, 72), darkMetal);
  groove.position.z = 0;
  wheelVisual.add(groove);

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.15, 0.30), edgeMetal);
    mark.position.set(Math.cos(angle) * 0.30, Math.sin(angle) * 0.30, 0);
    mark.rotation.z = angle;
    wheelVisual.add(mark);
  }

  const leftWeight = createWeightVisual(0xc07b45, 0xe4bd55);
  const rightWeight = createWeightVisual(0x48545c, 0xc15348);
  leftWeight.position.set(LEFT_X, START_Y, 0);
  rightWeight.position.set(RIGHT_X, START_Y, 0);
  group.add(leftWeight, rightWeight);

  const rope = new THREE.Mesh(makeRopeGeometry(START_Y, START_Y), ropeMaterial);
  rope.name = 'PulleyV1DynamicRope';
  group.add(rope);

  const world = new World({ gravity: Vec2(0, -GRAVITY), allowSleep: true });
  const pin = world.createBody({ type: 'static', position: Vec2(0, WHEEL_Y) });
  const wheelBody = world.createBody({
    type: 'dynamic', position: Vec2(0, WHEEL_Y), angularDamping: 0.025,
    gravityScale: 0, allowSleep: false, userData: { kind: 'pulley-wheel' }
  });
  wheelBody.createFixture({ shape: Circle(WHEEL_RADIUS), density: 2.6, friction: 0.34, restitution: 0.01 });
  world.createJoint(new RevoluteJoint({}, pin, wheelBody, Vec2(0, WHEEL_Y)));

  const leftBody = world.createBody({
    type: 'dynamic', position: Vec2(LEFT_X, START_Y), fixedRotation: true,
    gravityScale: 0, linearDamping: 0.015, allowSleep: false, userData: { kind: 'pulley-light-weight' }
  });
  leftBody.createFixture({ shape: Box(0.17, 0.21), density: 0.82, friction: 0.55, restitution: 0.01 });

  const rightBody = world.createBody({
    type: 'dynamic', position: Vec2(RIGHT_X, START_Y), fixedRotation: true,
    gravityScale: 0, linearDamping: 0.015, allowSleep: false, userData: { kind: 'pulley-heavy-weight' }
  });
  rightBody.createFixture({ shape: Box(0.17, 0.21), density: 2.25, friction: 0.55, restitution: 0.01 });

  const groundAnchorA = Vec2(-WHEEL_RADIUS, WHEEL_Y);
  const groundAnchorB = Vec2(WHEEL_RADIUS, WHEEL_Y);
  const pulleyJoint = world.createJoint(new PulleyJoint(
    { collideConnected: false },
    leftBody,
    rightBody,
    groundAnchorA,
    groundAnchorB,
    leftBody.getWorldCenter(),
    rightBody.getWorldCenter(),
    1
  ))!;
  const ropeConstant = pulleyJoint.getLengthA() + pulleyJoint.getLengthB();

  const floor = world.createBody({ type: 'static', position: Vec2(0, -1.14) });
  floor.createFixture({ shape: Box(1.45, 0.06), friction: 0.72, restitution: 0.01 });

  type MotionState = 'ready' | 'running' | 'complete';
  let state: MotionState = 'ready';
  let accumulator = 0;
  let elapsed = 0;
  let started = false;
  let maxTravel = 0;
  let maxWheelOmega = 0;
  let maxSlip = 0;

  const startDemo = (): void => {
    if (started) return;
    started = true;
    state = 'running';
    leftBody.setGravityScale(1);
    rightBody.setGravityScale(1);
    leftBody.setAwake(true);
    rightBody.setAwake(true);
    wheelBody.setAwake(true);
  };

  const applyClutchTorque = (): void => {
    if (!started) return;
    const leftVy = leftBody.getLinearVelocity().y;
    const rightVy = rightBody.getLinearVelocity().y;
    const ropeSpeed = (leftVy - rightVy) * 0.5;
    const targetOmega = ropeSpeed / WHEEL_RADIUS;
    const omega = wheelBody.getAngularVelocity();
    const slip = targetOmega - omega;
    const torque = clamp(slip * CLUTCH_RESPONSE, -MAX_CLUTCH_TORQUE, MAX_CLUTCH_TORQUE);
    wheelBody.applyTorque(torque, true);
    maxSlip = Math.max(maxSlip, Math.abs(slip));
  };

  const syncVisuals = (): void => {
    const leftPosition = leftBody.getPosition();
    const rightPosition = rightBody.getPosition();
    leftWeight.position.set(leftPosition.x, leftPosition.y, 0);
    rightWeight.position.set(rightPosition.x, rightPosition.y, 0);
    wheelVisual.rotation.z = wheelBody.getAngle();

    rope.geometry.dispose();
    rope.geometry = makeRopeGeometry(leftPosition.y, rightPosition.y);

    const leftVy = leftBody.getLinearVelocity().y;
    const rightVy = rightBody.getLinearVelocity().y;
    const travel = Math.max(0, START_Y - rightPosition.y);
    maxTravel = Math.max(maxTravel, travel);
    maxWheelOmega = Math.max(maxWheelOmega, Math.abs(wheelBody.getAngularVelocity()));
    const ropeError = Math.abs((pulleyJoint.getLengthA() + pulleyJoint.getLengthB()) - ropeConstant);

    if (started && (travel > 0.68 || elapsed > 4.8)) state = 'complete';

    group.userData.state = state;
    group.userData.leftY = leftPosition.y;
    group.userData.rightY = rightPosition.y;
    group.userData.leftVy = leftVy;
    group.userData.rightVy = rightVy;
    group.userData.travel = travel;
    group.userData.maxTravel = maxTravel;
    group.userData.wheelOmega = wheelBody.getAngularVelocity();
    group.userData.maxWheelOmega = maxWheelOmega;
    group.userData.ropeError = ropeError;
    group.userData.maxSlip = maxSlip;
    group.userData.opposedMotion = leftVy > 0.08 && rightVy < -0.08;
  };

  const update = (dt = 0): void => {
    accumulator = Math.min(accumulator + Math.max(0, dt), MAX_CATCHUP);
    while (accumulator >= FIXED_STEP) {
      applyClutchTorque();
      world.step(FIXED_STEP, 10, 6);
      accumulator -= FIXED_STEP;
      if (started) elapsed += FIXED_STEP;
    }
    syncVisuals();
  };

  group.userData.startDemo = startDemo;
  group.userData.update = update;
  group.userData.state = state;
  group.userData.ropeRatio = 1;
  syncVisuals();

  const selection = makeSelectionBox(new THREE.Vector3(2.25, 3.15, 1.05));
  selection.position.y = 0.18;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
