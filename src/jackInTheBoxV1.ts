import * as THREE from 'three';
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
const DRIVE_IMPULSE = 0.24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function springGeometry(topY: number): THREE.TubeGeometry {
  const bottom = new THREE.Vector3(0, -0.48, 0);
  const top = new THREE.Vector3(0, topY - 0.18, 0);
  const length = Math.max(0.12, top.y - bottom.y);
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 72; index += 1) {
    const t = index / 72;
    const angle = t * Math.PI * 2 * 8.5;
    points.push(new THREE.Vector3(
      Math.cos(angle) * 0.105,
      bottom.y + length * t,
      Math.sin(angle) * 0.105
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 108, 0.018, 7, false);
}

export function createJackInTheBoxModelV1(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'jack-in-the-box-3d';
  group.userData.assetVersion = 'jack-in-the-box-v1';
  group.userData.sourceKey = 'sketchfab-vasian-digital3d-jack-in-the-box-cc-by';
  group.userData.sourceUrl = 'https://sketchfab.com/3d-models/jack-in-the-box-32702a813df8489aad2a54be7eb5f86a';
  group.userData.referenceStyle = '2026-premium-mechanical-toy';
  group.userData.motion = 'rotation-threshold-latch-spring-contact';
  group.userData.physicsEngine = 'planck';
  group.userData.snapPoints = [
    { id: 'fan-belt-drive', position: [0.78, 0.00, 0] },
    { id: 'top-contact', position: [0, 0.92, 0] }
  ];

  const bump = createFineBumpTexture(1416, 5200);
  const boxMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x335f74,
    metalness: 0.12,
    roughness: 0.43,
    clearcoat: 0.18,
    clearcoatRoughness: 0.48,
    bumpMap: bump,
    bumpScale: 0.010
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x202b31, metalness: 0.86, roughness: 0.30 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0xa8b5bc, metalness: 0.91, roughness: 0.24 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc74945, metalness: 0.08, roughness: 0.38, clearcoat: 0.22 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xe8d7b5, metalness: 0.02, roughness: 0.52, clearcoat: 0.10 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xe1ae43, metalness: 0.18, roughness: 0.34, clearcoat: 0.12 });
  const springMetal = new THREE.MeshStandardMaterial({ color: 0xbec8ce, metalness: 0.92, roughness: 0.23 });

  // Re-authored premium box using the CC-BY model only as proportion/reference language.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.08, 1.05, 2, 2, 2), boxMaterial);
  box.position.y = -0.05;
  box.name = 'JackBoxV1Housing';
  group.add(box);

  for (const x of [-0.63, 0.63]) {
    for (const z of [-0.53, 0.53]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.12, 0.045), edgeMetal);
      trim.position.set(x, -0.05, z);
      trim.name = 'JackBoxV1CornerTrim';
      group.add(trim);
    }
  }

  const facePanel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.56, 0.035), cream);
  facePanel.position.set(0, -0.05, 0.545);
  facePanel.name = 'JackBoxV1FrontPanel';
  group.add(facePanel);

  const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.29, 0.045), red);
  diamond.position.set(0, -0.05, 0.57);
  diamond.rotation.z = Math.PI / 4;
  group.add(diamond);

  // Dynamic lid, physically hinged in Planck and pushed open by the rising jack.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.58, 0.52, 0);
  lidPivot.name = 'JackBoxV1DynamicLid';
  group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.12, 1.06), boxMaterial);
  lid.position.x = 0.58;
  lid.name = 'JackBoxV1Lid';
  lidPivot.add(lid);
  const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.035, 1.08), edgeMetal);
  lidTrim.position.set(0.58, 0.076, 0);
  lidPivot.add(lidTrim);

  // Input wheel: this is the future fan-belt connection point.
  const driveVisual = new THREE.Group();
  driveVisual.position.set(0.79, -0.03, 0.58);
  driveVisual.name = 'JackBoxV1DrivePulley';
  driveVisual.userData.isJackDrive = true;
  group.add(driveVisual);
  const driveWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.12, 52), darkMetal);
  driveWheel.rotation.x = Math.PI / 2;
  driveVisual.add(driveWheel);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.025, 10, 52), edgeMetal);
  groove.position.z = 0.065;
  driveVisual.add(groove);
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.055), yellow);
  crank.position.x = 0.13;
  crank.position.z = 0.075;
  driveVisual.add(crank);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), red);
  knob.position.set(0.31, 0, 0.075);
  driveVisual.add(knob);

  // Jack head and collar move only from the Planck prismatic body.
  const jackVisual = new THREE.Group();
  jackVisual.position.y = JACK_COMPRESSED_Y;
  jackVisual.name = 'JackBoxV1DynamicJack';
  group.add(jackVisual);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.20, 40), red);
  collar.position.y = -0.10;
  jackVisual.add(collar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), cream);
  head.position.y = 0.18;
  jackVisual.add(head);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.25, 40), yellow);
  cap.position.y = 0.41;
  cap.rotation.z = 0.08;
  jackVisual.add(cap);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 12), red);
  nose.position.set(0, 0.17, 0.215);
  jackVisual.add(nose);

  const spring = new THREE.Mesh(springGeometry(JACK_COMPRESSED_Y), springMetal);
  spring.name = 'JackBoxV1DynamicSpring';
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
      if (elapsedAfterRelease > 2.0 && Math.abs(y - (JACK_REST_Y - GRAVITY / SPRING_K)) < 0.08 && speed < 0.08) {
        state = 'settled';
      }
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

  const selection = makeSelectionBox(new THREE.Vector3(2.15, 2.70, 1.75));
  selection.position.set(0.10, 0.28, 0.08);
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
