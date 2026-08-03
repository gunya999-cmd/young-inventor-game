import * as THREE from 'three';
import { Box, Circle, PrismaticJoint, Vec2, World } from 'planck';
import { createTrampolineModelV2 } from './trampolineV2';
import type { PremiumReviewAssetModel } from './parts0913PremiumShared';

const MAT_REST_Y = 0.16;
const MAT_MIN_TRAVEL = -0.24;
const MAT_MAX_TRAVEL = 0.035;
const MAT_STIFFNESS = 92;
const MAT_DAMPING = 1.45;
const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.5;
const PROBE_RADIUS = 0.22;
const PROBE_START = new THREE.Vector2(-0.88, 2.25);
const PROBE_INITIAL_VX = 0.82;
const GRAVITY = 4.8;

interface SpringVisual {
  mesh: THREE.Mesh;
  inner: THREE.Vector3;
  outer: THREE.Vector3;
}

function createUnitHelixGeometry(turns = 4.4, coilRadius = 0.026, wireRadius = 0.0085): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 64; index += 1) {
    const t = index / 64;
    const angle = t * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(t, Math.cos(angle) * coilRadius, Math.sin(angle) * coilRadius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, wireRadius, 6, false);
}

function setSpringBetween(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const delta = end.clone().sub(start);
  const length = Math.max(0.02, delta.length());
  mesh.position.copy(start);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
}

function springPairs(): Array<[THREE.Vector3, THREE.Vector3]> {
  const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const x of [-1.08, -0.72, -0.36, 0, 0.36, 0.72, 1.08]) {
    pairs.push([new THREE.Vector3(x, 0.155, 0.67), new THREE.Vector3(x, 0.075, 0.89)]);
    pairs.push([new THREE.Vector3(x, 0.155, -0.67), new THREE.Vector3(x, 0.075, -0.89)]);
  }
  for (const z of [-0.42, -0.14, 0.14, 0.42]) {
    pairs.push([new THREE.Vector3(1.34, 0.155, z), new THREE.Vector3(1.57, 0.075, z)]);
    pairs.push([new THREE.Vector3(-1.34, 0.155, z), new THREE.Vector3(-1.57, 0.075, z)]);
  }
  return pairs;
}

export function createTrampolineModelV3(): PremiumReviewAssetModel {
  const model = createTrampolineModelV2();
  const group = model.group;
  const mat = group.getObjectByName('TrampolineV2TautFabric') as THREE.Mesh | undefined;
  if (!mat) throw new Error('Trampoline v3 could not find the trampoline mat.');

  mat.name = 'TrampolineV3DynamicMat';
  mat.userData.isTrampolineSurface = true;

  const matTabs = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'TrampolineV2MatSpringTab');

  // Replace the fixed v2 coils with reusable local-space coils whose inner
  // endpoints follow the real Planck mat body. This keeps the visible springs
  // mechanically connected while the trampoline compresses and rebounds.
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || !child.name.startsWith('TrampolineV2Spring')) continue;
    group.remove(child);
    child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material.dispose();
  }

  const coilGeometry = createUnitHelixGeometry();
  const coilMaterial = new THREE.MeshStandardMaterial({ color: 0xb6c1c8, metalness: 0.88, roughness: 0.27 });
  const springs: SpringVisual[] = springPairs().map(([inner, outer], index) => {
    const mesh = new THREE.Mesh(coilGeometry, coilMaterial);
    mesh.name = `TrampolineV3DynamicSpring${index + 1}`;
    group.add(mesh);
    return { mesh, inner, outer };
  });

  const probeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe4bf39,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.82
  });
  const probe = new THREE.Mesh(new THREE.SphereGeometry(PROBE_RADIUS, 48, 32), probeMaterial);
  probe.name = 'TrampolineV3PhysicsProbe';
  probe.visible = false;
  group.add(probe);

  const world = new World({ gravity: Vec2(0, -GRAVITY), allowSleep: true });
  const baseBody = world.createBody({ type: 'static', position: Vec2(0, MAT_REST_Y), userData: { kind: 'trampoline-frame' } });
  const matBody = world.createBody({
    type: 'dynamic',
    position: Vec2(0, MAT_REST_Y),
    fixedRotation: true,
    gravityScale: 0,
    // A trampoline membrane has very little effective moving mass compared
    // with its frame. Keeping this low is what lets impact energy enter the
    // spring instead of disappearing in an effectively heavy inelastic plate.
    linearDamping: 0.025,
    allowSleep: false,
    userData: { kind: 'trampoline-mat' }
  });
  matBody.createFixture({
    shape: Box(1.31, 0.045),
    density: 0.42,
    friction: 0.018,
    restitution: 0.06,
    userData: { kind: 'trampoline-mat' }
  });

  const joint = new PrismaticJoint({
    enableLimit: true,
    lowerTranslation: MAT_MIN_TRAVEL,
    upperTranslation: MAT_MAX_TRAVEL,
    collideConnected: false
  }, baseBody, matBody, Vec2(0, MAT_REST_Y), Vec2(0, 1));
  world.createJoint(joint);

  const probeBody = world.createBody({
    type: 'dynamic',
    position: Vec2(50, 50),
    fixedRotation: false,
    linearDamping: 0.012,
    angularDamping: 0.04,
    bullet: true,
    allowSleep: true,
    awake: false,
    userData: { kind: 'trampoline-probe' }
  });
  probeBody.createFixture({
    shape: Circle(PROBE_RADIUS),
    density: 1.2,
    friction: 0.018,
    restitution: 0.03,
    userData: { kind: 'trampoline-probe' }
  });

  type MotionState = 'ready' | 'falling' | 'compressed' | 'bounced' | 'complete';
  let state: MotionState = 'ready';
  let probeActive = false;
  let accumulator = 0;
  let elapsed = 0;
  let maxCompression = 0;
  let impactSpeed = 0;
  let bounceCount = 0;
  let peakAfterBounce = 0;
  let horizontalRetention = 1;
  let hadCompression = false;
  let hasBounced = false;
  let previousProbeVy = 0;

  const applyMatSpring = (): void => {
    const translation = joint.getJointTranslation();
    const speed = joint.getJointSpeed();
    const force = -MAT_STIFFNESS * translation - MAT_DAMPING * speed;
    matBody.applyForceToCenter(Vec2(0, force), true);
  };

  const updateMotionState = (): void => {
    if (!probeActive) return;
    const compression = Math.max(0, -joint.getJointTranslation());
    maxCompression = Math.max(maxCompression, compression);
    if (compression > 0.025) {
      hadCompression = true;
      if (!hasBounced) state = 'compressed';
    }

    const probePosition = probeBody.getPosition();
    const velocity = probeBody.getLinearVelocity();
    if (!hasBounced && velocity.y < previousProbeVy && velocity.y < -0.5) {
      impactSpeed = Math.max(impactSpeed, -velocity.y);
    }

    const matY = matBody.getPosition().y;
    if (hadCompression && !hasBounced && velocity.y > 0.45 && probePosition.y > matY + PROBE_RADIUS * 0.72) {
      hasBounced = true;
      bounceCount += 1;
      state = 'bounced';
      horizontalRetention = Math.abs(velocity.x) / PROBE_INITIAL_VX;
      peakAfterBounce = probePosition.y;
    }
    if (hasBounced) peakAfterBounce = Math.max(peakAfterBounce, probePosition.y);
    previousProbeVy = velocity.y;

    if (elapsed > 5.6 || Math.abs(probePosition.x) > 3.8 || probePosition.y < -1.2 || probePosition.y > 3.7) {
      state = 'complete';
      probeActive = false;
      probeBody.setLinearVelocity(Vec2(0, 0));
      probeBody.setAngularVelocity(0);
      probeBody.setAwake(false);
    }
  };

  const stepPhysics = (dt: number): void => {
    accumulator = Math.min(accumulator + dt, MAX_CATCHUP);
    while (accumulator >= FIXED_STEP) {
      applyMatSpring();
      world.step(FIXED_STEP, 10, 6);
      accumulator -= FIXED_STEP;
      if (probeActive) elapsed += FIXED_STEP;
      updateMotionState();
    }
  };

  const applyVisualPose = (): void => {
    const matY = matBody.getPosition().y;
    const dy = matY - MAT_REST_Y;
    const compression = Math.max(0, -joint.getJointTranslation());
    mat.position.y = matY;
    const stretch = 1 + compression * 0.055;
    mat.scale.set(stretch, 1, stretch);
    for (const tab of matTabs) tab.position.y = 0.158 + dy;
    for (const spring of springs) {
      const inner = spring.inner.clone();
      inner.y += dy;
      setSpringBetween(spring.mesh, inner, spring.outer);
    }

    const probePosition = probeBody.getPosition();
    probe.position.set(probePosition.x, probePosition.y, 0);
    probe.rotation.z = probeBody.getAngle();

    const velocity = probeBody.getLinearVelocity();
    group.userData.state = state;
    group.userData.physicsEngine = 'planck';
    group.userData.compression = compression;
    group.userData.maxCompression = maxCompression;
    group.userData.matVelocity = matBody.getLinearVelocity().y;
    group.userData.probeX = probePosition.x;
    group.userData.probeY = probePosition.y;
    group.userData.probeVx = velocity.x;
    group.userData.probeVy = velocity.y;
    group.userData.impactSpeed = impactSpeed;
    group.userData.bounceCount = bounceCount;
    group.userData.peakAfterBounce = peakAfterBounce;
    group.userData.horizontalRetention = horizontalRetention;
    group.userData.probeActive = probeActive;
  };

  const resetBodies = (): void => {
    accumulator = 0;
    elapsed = 0;
    maxCompression = 0;
    impactSpeed = 0;
    bounceCount = 0;
    peakAfterBounce = 0;
    horizontalRetention = 1;
    hadCompression = false;
    hasBounced = false;
    previousProbeVy = 0;
    matBody.setTransform(Vec2(0, MAT_REST_Y), 0);
    matBody.setLinearVelocity(Vec2(0, 0));
    matBody.setAngularVelocity(0);
    probeBody.setTransform(Vec2(50, 50), 0);
    probeBody.setLinearVelocity(Vec2(0, 0));
    probeBody.setAngularVelocity(0);
    probeBody.setAwake(false);
    probe.visible = false;
    probeActive = false;
    state = 'ready';
    applyVisualPose();
  };

  const dropProbe = (): void => {
    // Asset-lab diagnostic reset only: every run starts with an identical ball.
    // Once released, all motion is produced by Planck contacts and spring forces.
    accumulator = 0;
    elapsed = 0;
    maxCompression = 0;
    impactSpeed = 0;
    bounceCount = 0;
    peakAfterBounce = 0;
    horizontalRetention = 1;
    hadCompression = false;
    hasBounced = false;
    previousProbeVy = 0;
    matBody.setTransform(Vec2(0, MAT_REST_Y), 0);
    matBody.setLinearVelocity(Vec2(0, 0));
    matBody.setAngularVelocity(0);
    probeBody.setTransform(Vec2(PROBE_START.x, PROBE_START.y), 0);
    probeBody.setLinearVelocity(Vec2(PROBE_INITIAL_VX, 0));
    probeBody.setAngularVelocity(-1.2);
    probeBody.setAwake(true);
    probe.visible = true;
    probeActive = true;
    state = 'falling';
    applyVisualPose();
  };

  const update = (dt = 0): void => {
    const safeDt = Math.min(MAX_CATCHUP, Math.max(0, dt));
    stepPhysics(safeDt);
    applyVisualPose();
  };

  group.userData.kind = 'trampoline-3d';
  group.userData.assetVersion = 'trampoline-v3';
  group.userData.referenceStyle = 'tim-trampoline-planck-contact-spring';
  group.userData.motion = 'planck-contact-compression-bounce';
  group.userData.physicsEngine = 'planck';
  group.userData.dropProbe = dropProbe;
  group.userData.update = update;
  group.userData.reset = resetBodies;

  resetBodies();
  return model;
}
