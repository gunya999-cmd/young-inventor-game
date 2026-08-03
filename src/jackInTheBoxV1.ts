import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Box, Circle, PrismaticJoint, RevoluteJoint, Vec2, World } from 'planck';
import { createFineBumpTexture, makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.42;
const GRAVITY = 5.0;
const JACK_COMPRESSED_Y = -0.02;
const JACK_REST_Y = 0.68;
const JACK_MAX_TRAVEL = 1.25;
const SPRING_K = 17.5;
const SPRING_DAMPING = 2.15;
const MAX_SPRING_FORCE = 14.5;
const DRIVE_THRESHOLD = 4.25;
const DRIVE_IMPULSE = 0.32;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function springGeometry(topY: number): THREE.TubeGeometry {
  const bottom = new THREE.Vector3(0, -0.48, 0);
  const top = new THREE.Vector3(0, topY - 0.18, 0);
  const length = Math.max(0.12, top.y - bottom.y);
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 112; index += 1) {
    const t = index / 112;
    const angle = t * Math.PI * 2 * 10.5;
    points.push(new THREE.Vector3(
      Math.cos(angle) * 0.112,
      bottom.y + length * t,
      Math.sin(angle) * 0.112
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 180, 0.014, 10, false);
}

function addScrew(parent: THREE.Object3D, x: number, y: number, z: number, material: THREE.Material): void {
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.018, 28), material);
  screw.rotation.x = Math.PI / 2;
  screw.position.set(x, y, z);
  screw.name = 'JackBoxV2Fastener';
  parent.add(screw);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.006, 0.008), material);
  slot.position.set(x, y, z + 0.011);
  slot.rotation.z = Math.PI / 4;
  parent.add(slot);
}

function addPanelSeam(parent: THREE.Object3D, width: number, height: number, z: number, material: THREE.Material): void {
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, 0.012), material);
  top.position.set(0, height / 2, z);
  parent.add(top);
  const bottom = top.clone();
  bottom.position.y = -height / 2;
  parent.add(bottom);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.012, height, 0.012), material);
  left.position.set(-width / 2, 0, z);
  parent.add(left);
  const right = left.clone();
  right.position.x = width / 2;
  parent.add(right);
}

function createClownHead(
  skin: THREE.Material,
  red: THREE.Material,
  blue: THREE.Material,
  yellow: THREE.Material,
  dark: THREE.Material,
  fabric: THREE.Material
): THREE.Group {
  const headGroup = new THREE.Group();
  headGroup.name = 'JackBoxV2RealisticJack';

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.07, 18, 64), fabric);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.04;
  headGroup.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.18, 40), skin);
  neck.position.y = 0.07;
  headGroup.add(neck);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.225, 64, 40), skin);
  face.scale.set(0.92, 1.08, 0.88);
  face.position.y = 0.29;
  headGroup.add(face);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 28), skin);
  jaw.scale.set(1.0, 0.62, 0.88);
  jaw.position.set(0, 0.185, 0.055);
  headGroup.add(jaw);

  for (const x of [-0.085, 0.085]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.041, 28, 18), new THREE.MeshPhysicalMaterial({ color: 0xf4f0e8, roughness: 0.38 }));
    eyeWhite.scale.set(0.90, 1.18, 0.50);
    eyeWhite.position.set(x, 0.335, 0.188);
    headGroup.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 14), dark);
    pupil.position.set(x, 0.332, 0.222);
    headGroup.add(pupil);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 32, 20), red);
  nose.position.set(0, 0.275, 0.225);
  headGroup.add(nose);

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.011, 10, 40, Math.PI * 0.82), dark);
  smile.position.set(0, 0.205, 0.215);
  smile.rotation.z = Math.PI * 0.09;
  headGroup.add(smile);

  for (const side of [-1, 1]) {
    const hair = new THREE.Group();
    hair.position.set(side * 0.19, 0.35, 0);
    for (let index = 0; index < 5; index += 1) {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.022, 12, 28, Math.PI * 1.65), red);
      curl.rotation.set(Math.PI / 2, index * 0.35, side * 0.45);
      curl.position.set(side * 0.018 * index, (index - 2) * 0.045, -0.01 * index);
      hair.add(curl);
    }
    headGroup.add(hair);
  }

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.205, 0.31, 56), blue);
  cap.position.set(-0.025, 0.59, -0.015);
  cap.rotation.z = 0.13;
  headGroup.add(cap);
  const capBand = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 14, 56), yellow);
  capBand.rotation.x = Math.PI / 2;
  capBand.position.set(-0.01, 0.465, 0);
  headGroup.add(capBand);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.052, 28, 18), yellow);
  pom.position.set(-0.067, 0.745, -0.01);
  headGroup.add(pom);

  return headGroup;
}

export function createJackInTheBoxModelV1(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'jack-in-the-box-3d';
  group.userData.assetVersion = 'jack-in-the-box-v2-realistic';
  group.userData.sourceKey = 'sketchfab-evan-cg-jack-in-the-box-cc-by';
  group.userData.sourceUrl = 'https://sketchfab.com/3d-models/jack-in-the-box-8c96dd839bc14a289a3c857a9a41ba0b';
  group.userData.referenceStyle = '2026-realistic-mechanical-toy-pbr';
  group.userData.motion = 'rotation-threshold-latch-spring-contact';
  group.userData.physicsEngine = 'planck';
  group.userData.snapPoints = [
    { id: 'fan-belt-drive', position: [0.82, -0.02, 0.57] },
    { id: 'top-contact', position: [0, 1.02, 0] }
  ];

  const paintBump = createFineBumpTexture(1416, 6200);
  const paintedSteel = new THREE.MeshPhysicalMaterial({
    color: 0x315f73,
    metalness: 0.56,
    roughness: 0.28,
    clearcoat: 0.20,
    clearcoatRoughness: 0.36,
    bumpMap: paintBump,
    bumpScale: 0.012
  });
  const innerSteel = new THREE.MeshStandardMaterial({ color: 0x273238, metalness: 0.82, roughness: 0.36 });
  const brushedSteel = new THREE.MeshStandardMaterial({ color: 0xaeb9be, metalness: 0.94, roughness: 0.20 });
  const agedBrass = new THREE.MeshPhysicalMaterial({ color: 0xa8782d, metalness: 0.83, roughness: 0.29, clearcoat: 0.05 });
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x7d4c2d, metalness: 0.01, roughness: 0.53, clearcoat: 0.17, clearcoatRoughness: 0.40, bumpMap: paintBump, bumpScale: 0.018 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xb93832, metalness: 0.10, roughness: 0.30, clearcoat: 0.25 });
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x255e92, metalness: 0.05, roughness: 0.42, clearcoat: 0.12 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xe8d7b8, metalness: 0.01, roughness: 0.49, clearcoat: 0.09 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xd49b31, metalness: 0.22, roughness: 0.31, clearcoat: 0.13 });
  const darkRubber = new THREE.MeshStandardMaterial({ color: 0x151a1c, metalness: 0.04, roughness: 0.82 });
  const springMetal = new THREE.MeshStandardMaterial({ color: 0xc1c9cd, metalness: 0.96, roughness: 0.18 });
  const fabric = new THREE.MeshPhysicalMaterial({ color: 0x7b1f2d, metalness: 0.0, roughness: 0.78, bumpMap: paintBump, bumpScale: 0.020 });
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xd5aa87, metalness: 0.0, roughness: 0.58, sheen: 0.08 });

  const housing = new THREE.Group();
  housing.name = 'JackBoxV2RealisticHousing';
  group.add(housing);

  // Six separately modelled panels: no single Minecraft cube.
  const panelThickness = 0.065;
  const front = new THREE.Mesh(new RoundedBoxGeometry(1.22, 1.04, panelThickness, 6, 0.045), paintedSteel);
  front.position.set(0, -0.05, 0.525);
  housing.add(front);
  const back = front.clone();
  back.position.z = -0.525;
  housing.add(back);
  for (const x of [-0.61, 0.61]) {
    const side = new THREE.Mesh(new RoundedBoxGeometry(panelThickness, 1.04, 1.00, 6, 0.038), paintedSteel);
    side.position.set(x, -0.05, 0);
    housing.add(side);
  }
  const floor = new THREE.Mesh(new RoundedBoxGeometry(1.22, panelThickness, 1.00, 6, 0.04), innerSteel);
  floor.position.y = -0.57;
  housing.add(floor);

  // Structural angle trims and fasteners.
  for (const x of [-0.635, 0.635]) {
    for (const z of [-0.55, 0.55]) {
      const trim = new THREE.Mesh(new RoundedBoxGeometry(0.055, 1.13, 0.055, 4, 0.018), brushedSteel);
      trim.position.set(x, -0.04, z);
      housing.add(trim);
    }
  }
  for (const x of [-0.50, 0.50]) {
    for (const y of [-0.43, 0.34]) addScrew(housing, x, y, 0.566, agedBrass);
  }

  const frontInset = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.55, 0.026, 5, 0.035), wood);
  frontInset.position.set(0, -0.06, 0.572);
  housing.add(frontInset);
  addPanelSeam(housing, 0.72, 0.45, 0.591, agedBrass);

  const emblem = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.27, 0.025, 4, 0.025), red);
  emblem.position.set(0, -0.06, 0.608);
  emblem.rotation.z = Math.PI / 4;
  housing.add(emblem);

  // Rubber feet and underside clearances.
  for (const x of [-0.48, 0.48]) {
    for (const z of [-0.40, 0.40]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.055, 32), darkRubber);
      foot.position.set(x, -0.625, z);
      housing.add(foot);
    }
  }

  // Dynamic multi-layer lid with actual hinge barrels.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.58, 0.52, 0);
  lidPivot.name = 'JackBoxV2DynamicLid';
  group.add(lidPivot);
  const lidSkin = new THREE.Mesh(new RoundedBoxGeometry(1.19, 0.105, 1.08, 7, 0.045), paintedSteel);
  lidSkin.position.x = 0.58;
  lidPivot.add(lidSkin);
  const lidInner = new THREE.Mesh(new RoundedBoxGeometry(1.10, 0.034, 0.98, 5, 0.025), innerSteel);
  lidInner.position.set(0.58, -0.067, 0);
  lidPivot.add(lidInner);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.01, 6, 18), brushedSteel);
  lidRim.visible = false;
  lidPivot.add(lidRim);
  for (const z of [-0.34, 0.34]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.27, 32), agedBrass);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.0, -0.01, z);
    lidPivot.add(barrel);
  }

  // Realistic side drive assembly: cast pulley, axle, bearing plate and crank.
  const bearingPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.055, 64), brushedSteel);
  bearingPlate.rotation.x = Math.PI / 2;
  bearingPlate.position.set(0.66, -0.03, 0.57);
  group.add(bearingPlate);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.075, 64), innerSteel);
  bearing.rotation.x = Math.PI / 2;
  bearing.position.set(0.69, -0.03, 0.605);
  group.add(bearing);

  const driveVisual = new THREE.Group();
  driveVisual.position.set(0.79, -0.03, 0.64);
  driveVisual.name = 'JackBoxV2DrivePulley';
  driveVisual.userData.isJackDrive = true;
  group.add(driveVisual);
  const driveWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.115, 72), agedBrass);
  driveWheel.rotation.x = Math.PI / 2;
  driveVisual.add(driveWheel);
  for (const z of [-0.058, 0.058]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.028, 14, 72), brushedSteel);
    lip.position.z = z;
    driveVisual.add(lip);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 40), brushedSteel);
  hub.rotation.x = Math.PI / 2;
  driveVisual.add(hub);
  const crank = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.055, 0.048, 4, 0.018), agedBrass);
  crank.position.set(0.14, 0, 0.10);
  driveVisual.add(crank);
  const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.10, 24), brushedSteel);
  knobStem.rotation.x = Math.PI / 2;
  knobStem.position.set(0.31, 0, 0.125);
  driveVisual.add(knobStem);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.078, 40, 24), red);
  knob.scale.z = 1.18;
  knob.position.set(0.31, 0, 0.19);
  driveVisual.add(knob);

  const jackVisual = new THREE.Group();
  jackVisual.position.y = JACK_COMPRESSED_Y;
  jackVisual.name = 'JackBoxV2DynamicJack';
  group.add(jackVisual);
  jackVisual.add(createClownHead(skin, red, blue, yellow, innerSteel, fabric));

  const spring = new THREE.Mesh(springGeometry(JACK_COMPRESSED_Y), springMetal);
  spring.name = 'JackBoxV2DynamicSpring';
  group.add(spring);

  const world = new World({ gravity: Vec2(0, -GRAVITY), allowSleep: true });
  const frame = world.createBody({ type: 'static', position: Vec2(0, 0) });

  const driveBody = world.createBody({
    type: 'dynamic', position: Vec2(0.79, -0.03), gravityScale: 0,
    angularDamping: 0.32, allowSleep: false, userData: { kind: 'jack-drive' }
  });
  driveBody.createFixture({ shape: Circle(0.255), density: 2.4, friction: 0.35, restitution: 0.01 });
  world.createJoint(new RevoluteJoint({}, frame, driveBody, Vec2(0.79, -0.03)));

  const jackBody = world.createBody({
    type: 'dynamic', position: Vec2(0, JACK_COMPRESSED_Y), fixedRotation: true,
    linearDamping: 0.04, allowSleep: false, userData: { kind: 'jack-head' }
  });
  jackBody.createFixture({ shape: Box(0.17, 0.24), density: 5.0, friction: 0.28, restitution: 0.04 });
  world.createJoint(new PrismaticJoint({
    enableLimit: true,
    lowerTranslation: 0,
    upperTranslation: JACK_MAX_TRAVEL,
    collideConnected: false
  }, frame, jackBody, Vec2(0, JACK_COMPRESSED_Y), Vec2(0, 1)));
  let latchJoint = world.createJoint(new RevoluteJoint({}, frame, jackBody, Vec2(0, JACK_COMPRESSED_Y)))!;

  const lidBody = world.createBody({
    type: 'dynamic', position: Vec2(0, 0.52), angularDamping: 0.16,
    gravityScale: 0.7, allowSleep: false, userData: { kind: 'jack-lid' }
  });
  lidBody.createFixture({ shape: Box(0.58, 0.06), density: 1.15, friction: 0.35, restitution: 0.02 });
  world.createJoint(new RevoluteJoint({
    enableLimit: true,
    lowerAngle: 0,
    upperAngle: 1.28,
    collideConnected: false
  }, frame, lidBody, Vec2(-0.58, 0.52)));

  type MotionState = 'latched' | 'released' | 'settled';
  let state: MotionState = 'latched';
  let accumulator = 0;
  let rotationReceived = 0;
  let previousDriveAngle = driveBody.getAngle();
  let maxRise = 0;
  let maxLidAngle = 0;
  let maxJackSpeed = 0;
  let releaseCount = 0;
  let oscillationTurns = 0;
  let previousVy = 0;
  let elapsedAfterRelease = 0;

  const releaseLatch = (): void => {
    if (!latchJoint) return;
    world.destroyJoint(latchJoint);
    latchJoint = null as unknown as typeof latchJoint;
    state = 'released';
    releaseCount += 1;
    jackBody.setAwake(true);
    lidBody.setAwake(true);
  };

  const kickDrive = (): void => {
    driveBody.applyAngularImpulse(DRIVE_IMPULSE, true);
    driveBody.setAwake(true);
  };

  const applySpring = (): void => {
    const y = jackBody.getPosition().y;
    const vy = jackBody.getLinearVelocity().y;
    const force = clamp(SPRING_K * (JACK_REST_Y - y) - SPRING_DAMPING * vy, -MAX_SPRING_FORCE, MAX_SPRING_FORCE);
    jackBody.applyForceToCenter(Vec2(0, force), true);
  };

  const stepPhysics = (): void => {
    applySpring();
    world.step(FIXED_STEP, 10, 6);

    const angle = driveBody.getAngle();
    const delta = angle - previousDriveAngle;
    previousDriveAngle = angle;
    rotationReceived += Math.abs(delta);
    if (state === 'latched' && rotationReceived >= DRIVE_THRESHOLD) releaseLatch();

    if (state !== 'latched') {
      elapsedAfterRelease += FIXED_STEP;
      const vy = jackBody.getLinearVelocity().y;
      if (previousVy !== 0 && Math.sign(previousVy) !== Math.sign(vy) && Math.abs(previousVy) > 0.08) oscillationTurns += 1;
      previousVy = vy;
      const y = jackBody.getPosition().y;
      const speed = Math.abs(vy);
      if (elapsedAfterRelease > 2.0 && Math.abs(y - (JACK_REST_Y - GRAVITY / SPRING_K)) < 0.08 && speed < 0.08) state = 'settled';
    }
  };

  const syncVisuals = (): void => {
    const jackY = jackBody.getPosition().y;
    const jackVy = jackBody.getLinearVelocity().y;
    jackVisual.position.y = jackY;
    driveVisual.rotation.z = driveBody.getAngle();
    lidPivot.rotation.z = lidBody.getAngle();

    spring.geometry.dispose();
    spring.geometry = springGeometry(jackY);

    maxRise = Math.max(maxRise, jackY - JACK_COMPRESSED_Y);
    maxLidAngle = Math.max(maxLidAngle, lidBody.getAngle());
    maxJackSpeed = Math.max(maxJackSpeed, Math.abs(jackVy));

    group.userData.state = state;
    group.userData.rotationReceived = rotationReceived;
    group.userData.driveOmega = driveBody.getAngularVelocity();
    group.userData.jackY = jackY;
    group.userData.jackVy = jackVy;
    group.userData.maxRise = maxRise;
    group.userData.lidAngle = lidBody.getAngle();
    group.userData.maxLidAngle = maxLidAngle;
    group.userData.maxJackSpeed = maxJackSpeed;
    group.userData.releaseCount = releaseCount;
    group.userData.oscillationTurns = oscillationTurns;
  };

  const update = (dt = 0): void => {
    accumulator = Math.min(accumulator + Math.max(0, dt), MAX_CATCHUP);
    while (accumulator >= FIXED_STEP) {
      stepPhysics();
      accumulator -= FIXED_STEP;
    }
    syncVisuals();
  };

  group.userData.kickDrive = kickDrive;
  group.userData.update = update;
  group.userData.driveThreshold = DRIVE_THRESHOLD;
  syncVisuals();

  const selection = makeSelectionBox(new THREE.Vector3(2.20, 2.90, 1.90));
  selection.position.set(0.10, 0.34, 0.09);
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
