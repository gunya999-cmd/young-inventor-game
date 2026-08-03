import * as THREE from 'three';
import { Circle, RevoluteJoint, Vec2, World } from 'planck';
import { createFineBumpTexture, makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.40;
const TARGET_SPEED = 11.5;
const MAX_MOTOR_TORQUE = 4.4;
const SHAFT_RADIUS = 0.26;
const LOAD_RADIUS = 0.42;
const CLUTCH_RESPONSE = 1.75;
const MAX_CLUTCH_TORQUE = 5.2;
const LOAD_RESISTANCE = 0.62;
const MAX_LOAD_RESISTANCE_TORQUE = 4.2;
const BEARING_DRAG = 0.045;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeVentRing(material: THREE.Material, radius: number, z: number): THREE.Group {
  const ring = new THREE.Group();
  ring.position.z = z;
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.035), material);
    vent.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    vent.rotation.z = angle;
    vent.name = 'MotorV1CoolingVent';
    ring.add(vent);
  }
  return ring;
}

export function createMotorModelV1(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'electric-motor-3d';
  group.userData.assetVersion = 'motor-v1';
  group.userData.sourceKey = 'sketchfab-joh-mackell-simple-dc-motor-cc-by';
  group.userData.sourceUrl = 'https://sketchfab.com/3d-models/simple-dc-motor-design-b909f3ece8b04f489207bbdd3eadcb1d';
  group.userData.referenceStyle = '2026-game-ready-dc-motor';
  group.userData.motion = 'finite-torque-revolute-motor-load-clutch';
  group.userData.physicsEngine = 'planck';
  group.userData.snapPoints = [
    { id: 'output-shaft', position: [0, 0, 1.08] },
    { id: 'mount-left', position: [-0.54, -0.62, -0.18] },
    { id: 'mount-right', position: [0.54, -0.62, -0.18] }
  ];

  const bump = createFineBumpTexture(1515, 5600);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x356577,
    metalness: 0.74,
    roughness: 0.31,
    clearcoat: 0.055,
    clearcoatRoughness: 0.49,
    bumpMap: bump,
    bumpScale: 0.012
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x202c32, metalness: 0.88, roughness: 0.30 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0xa8b6bd, metalness: 0.94, roughness: 0.21 });
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xb96d3d, metalness: 0.78, roughness: 0.28, clearcoat: 0.04 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171d20, roughness: 0.84, metalness: 0.04 });
  const accent = new THREE.MeshPhysicalMaterial({
    color: 0xe1a842,
    emissive: 0x2a1905,
    emissiveIntensity: 0.18,
    metalness: 0.42,
    roughness: 0.34,
    clearcoat: 0.05
  });

  // Compact cylindrical housing derived from the lightweight CC-BY reference,
  // rebuilt as a deliberately readable game asset rather than a CAD replica.
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.60, 1.15, 72, 1, false), bodyMaterial);
  housing.rotation.x = Math.PI / 2;
  housing.name = 'MotorV1MainHousing';
  group.add(housing);

  for (const z of [-0.60, 0.60]) {
    const endBell = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.16, 72), darkMetal);
    endBell.rotation.x = Math.PI / 2;
    endBell.position.z = z;
    endBell.name = 'MotorV1EndBell';
    group.add(endBell);

    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 12, 72), edgeMetal);
    edge.position.z = z + (z > 0 ? 0.085 : -0.085);
    edge.name = 'MotorV1MachinedEdge';
    group.add(edge);
  }

  group.add(makeVentRing(darkMetal, 0.47, -0.37));
  group.add(makeVentRing(darkMetal, 0.47, 0.37));

  // Mounting feet make the asset visually and functionally placeable.
  for (const x of [-0.43, 0.43]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.13, 0.72), bodyMaterial);
    foot.position.set(x, -0.62, -0.08);
    foot.name = 'MotorV1MountingFoot';
    group.add(foot);

    const isolator = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 28), rubber);
    isolator.position.set(x, -0.72, -0.08);
    isolator.name = 'MotorV1RubberIsolator';
    group.add(isolator);
  }

  const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.40), darkMetal);
  terminalBox.position.set(0, 0.66, -0.04);
  terminalBox.name = 'MotorV1TerminalBox';
  group.add(terminalBox);

  for (const x of [-0.115, 0.115]) {
    const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 24), copper);
    terminal.position.set(x, 0.84, -0.04);
    terminal.name = 'MotorV1CopperTerminal';
    group.add(terminal);
  }

  const statusLamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), accent);
  statusLamp.position.set(0.28, 0.70, 0.205);
  statusLamp.name = 'MotorV1StatusLamp';
  group.add(statusLamp);

  // Dynamic output assembly. Rotation is read directly from the Planck shaft body.
  const shaftVisual = new THREE.Group();
  shaftVisual.position.z = 0.72;
  shaftVisual.name = 'MotorV1DynamicShaft';
  group.add(shaftVisual);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.72, 40), edgeMetal);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.28;
  shaftVisual.add(shaft);

  const outputHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 52), darkMetal);
  outputHub.rotation.x = Math.PI / 2;
  outputHub.position.z = 0.08;
  shaftVisual.add(outputHub);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.035), edgeMetal);
    mark.position.set(Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0.15);
    mark.rotation.z = angle;
    shaftVisual.add(mark);
  }

  // Demo load: a separate inertial flywheel connected only by finite friction.
  // It is deliberately outside the motor body so the player can read the load transfer.
  const loadVisual = new THREE.Group();
  loadVisual.position.z = 1.22;
  loadVisual.name = 'MotorV1DynamicLoadFlywheel';
  group.add(loadVisual);

  const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(LOAD_RADIUS, LOAD_RADIUS, 0.13, 64), darkMetal);
  flywheel.rotation.x = Math.PI / 2;
  loadVisual.add(flywheel);
  const flywheelRing = new THREE.Mesh(new THREE.TorusGeometry(LOAD_RADIUS * 0.79, 0.055, 12, 64), copper);
  flywheelRing.position.z = 0.07;
  loadVisual.add(flywheelRing);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.045), edgeMetal);
    spoke.rotation.z = angle;
    spoke.position.z = 0.075;
    loadVisual.add(spoke);
  }

  const world = new World({ gravity: Vec2(0, 0), allowSleep: false });
  const frame = world.createBody({ type: 'static', position: Vec2(0, 0) });

  const shaftBody = world.createBody({
    type: 'dynamic', position: Vec2(0, 0), angularDamping: BEARING_DRAG,
    gravityScale: 0, allowSleep: false, userData: { kind: 'motor-shaft' }
  });
  shaftBody.createFixture({ shape: Circle(SHAFT_RADIUS), density: 2.2, friction: 0.30, restitution: 0.01 });

  const motorJoint = world.createJoint(new RevoluteJoint({
    enableMotor: false,
    motorSpeed: TARGET_SPEED,
    maxMotorTorque: MAX_MOTOR_TORQUE,
    collideConnected: false
  }, frame, shaftBody, Vec2(0, 0)))!;

  const loadBody = world.createBody({
    type: 'dynamic', position: Vec2(0, 0), angularDamping: 0.075,
    gravityScale: 0, allowSleep: false, userData: { kind: 'motor-load-flywheel' }
  });
  loadBody.createFixture({ shape: Circle(LOAD_RADIUS), density: 4.8, friction: 0.35, restitution: 0.01 });
  world.createJoint(new RevoluteJoint({ collideConnected: false }, frame, loadBody, Vec2(0, 0)));

  type MotionState = 'off' | 'spinning' | 'loaded';
  let state: MotionState = 'off';
  let accumulator = 0;
  let powered = false;
  let loadEngaged = false;
  let freeReferenceSpeed = 0;
  let maxFreeOmega = 0;
  let maxLoadOmega = 0;
  let maxMotorTorqueSeen = 0;
  let maxClutchSlip = 0;
  let maxSpeedDropRatio = 0;
  let loadResistanceTorque = 0;

  const startMotor = (): void => {
    if (powered) return;
    powered = true;
    state = 'spinning';
    accent.emissiveIntensity = 1.05;
    motorJoint.enableMotor(true);
    motorJoint.setMotorSpeed(TARGET_SPEED);
    motorJoint.setMaxMotorTorque(MAX_MOTOR_TORQUE);
    shaftBody.setAwake(true);
  };

  const engageLoad = (): void => {
    if (!powered) startMotor();
    if (loadEngaged) return;
    freeReferenceSpeed = Math.max(freeReferenceSpeed, Math.abs(shaftBody.getAngularVelocity()), maxFreeOmega);
    loadEngaged = true;
    state = 'loaded';
    loadBody.setAwake(true);
    shaftBody.setAwake(true);
  };

  const applyClutchAndLoad = (): void => {
    if (!loadEngaged) return;
    const shaftOmega = shaftBody.getAngularVelocity();
    const loadOmega = loadBody.getAngularVelocity();
    const slip = shaftOmega - loadOmega;
    const clutchTorque = clamp(slip * CLUTCH_RESPONSE, -MAX_CLUTCH_TORQUE, MAX_CLUTCH_TORQUE);
    shaftBody.applyTorque(-clutchTorque, true);
    loadBody.applyTorque(clutchTorque, true);

    // Generator/load resistance is velocity-proportional and capped. It is a real
    // opposing torque on the load body, so the motor can slow when its finite
    // maxMotorTorque is insufficient to hold no-load speed.
    loadResistanceTorque = clamp(-loadOmega * LOAD_RESISTANCE, -MAX_LOAD_RESISTANCE_TORQUE, MAX_LOAD_RESISTANCE_TORQUE);
    loadBody.applyTorque(loadResistanceTorque, true);
    maxClutchSlip = Math.max(maxClutchSlip, Math.abs(slip));
  };

  const syncVisuals = (): void => {
    shaftVisual.rotation.z = shaftBody.getAngle();
    loadVisual.rotation.z = loadBody.getAngle();

    const shaftOmega = shaftBody.getAngularVelocity();
    const loadOmega = loadBody.getAngularVelocity();
    const motorTorque = powered ? Math.abs(motorJoint.getMotorTorque(1 / FIXED_STEP)) : 0;
    if (!loadEngaged) maxFreeOmega = Math.max(maxFreeOmega, Math.abs(shaftOmega));
    if (loadEngaged) maxLoadOmega = Math.max(maxLoadOmega, Math.abs(loadOmega));
    maxMotorTorqueSeen = Math.max(maxMotorTorqueSeen, motorTorque);

    const reference = Math.max(0.001, freeReferenceSpeed || maxFreeOmega);
    const speedDropRatio = loadEngaged ? Math.max(0, 1 - Math.abs(shaftOmega) / reference) : 0;
    maxSpeedDropRatio = Math.max(maxSpeedDropRatio, speedDropRatio);

    group.userData.state = state;
    group.userData.powered = powered;
    group.userData.loadEngaged = loadEngaged;
    group.userData.shaftOmega = shaftOmega;
    group.userData.loadOmega = loadOmega;
    group.userData.maxFreeOmega = maxFreeOmega;
    group.userData.maxLoadOmega = maxLoadOmega;
    group.userData.motorTorque = motorTorque;
    group.userData.maxMotorTorqueSeen = maxMotorTorqueSeen;
    group.userData.clutchSlip = shaftOmega - loadOmega;
    group.userData.maxClutchSlip = maxClutchSlip;
    group.userData.speedDropRatio = speedDropRatio;
    group.userData.maxSpeedDropRatio = maxSpeedDropRatio;
    group.userData.loadResistanceTorque = loadResistanceTorque;
  };

  const update = (dt = 0): void => {
    accumulator = Math.min(accumulator + Math.max(0, dt), MAX_CATCHUP);
    while (accumulator >= FIXED_STEP) {
      applyClutchAndLoad();
      world.step(FIXED_STEP, 10, 6);
      accumulator -= FIXED_STEP;
    }
    syncVisuals();
  };

  group.userData.startMotor = startMotor;
  group.userData.engageLoad = engageLoad;
  group.userData.update = update;
  group.userData.targetSpeed = TARGET_SPEED;
  group.userData.maxMotorTorque = MAX_MOTOR_TORQUE;
  syncVisuals();

  const selection = makeSelectionBox(new THREE.Vector3(1.75, 1.75, 2.15));
  selection.position.z = 0.28;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
