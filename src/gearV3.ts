import * as THREE from 'three';
import { Circle, RevoluteJoint, Vec2, World } from 'planck';
import { createGearModelV2 } from './gearV2';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.4;
const BEARING_DRAG = 0.055;
const SPIN_IMPULSE = 0.72;
const BODY_RADIUS = 1.0;

export function createGearModelV3(): PremiumReviewAssetModel {
  const model = createGearModelV2();
  const group = model.group;
  group.userData.assetVersion = 'gear-v3';
  group.userData.referenceStyle = '2026-machined-pbr-physical-inertia';
  group.userData.physicsEngine = 'planck';
  group.userData.motion = 'angular-impulse-inertia-bearing-drag';

  const bodyMesh = group.getObjectByName('GearV2MachinedBody') as THREE.Mesh | undefined;
  if (!bodyMesh) throw new Error('Gear v3 requires the v2 machined body.');
  bodyMesh.userData.isGearSpinTarget = true;

  const bump = createFineBumpTexture(0x8a31f2, 8600);
  bump.repeat.set(8, 8);
  if (bodyMesh.material instanceof THREE.MeshPhysicalMaterial) {
    bodyMesh.material.bumpMap = bump;
    bodyMesh.material.bumpScale = 0.012;
    bodyMesh.material.roughness = 0.27;
    bodyMesh.material.clearcoat = 0.055;
    bodyMesh.material.clearcoatRoughness = 0.46;
    bodyMesh.material.needsUpdate = true;
  }

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x20292f, metalness: 0.9, roughness: 0.26 });
  const polished = new THREE.MeshPhysicalMaterial({ color: 0xaeb8bd, metalness: 0.95, roughness: 0.19, clearcoat: 0.06 });

  // Keyway insert gives the axle bore a clear mechanical orientation and makes
  // rotation readable even at phone scale.
  const keyway = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.18, 0.34), darkMetal);
  keyway.position.set(0.205, 0, 0);
  keyway.name = 'GearV3AxleKeyway';
  group.add(keyway);

  // Fine face witness marks: restrained machining detail rather than decoration.
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.014), polished);
    tick.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0.184);
    tick.rotation.z = angle;
    tick.name = 'GearV3MachiningWitness';
    group.add(tick);
  }

  const world = new World({ gravity: Vec2(0, 0), allowSleep: true });
  const pin = world.createBody({ type: 'static', position: Vec2(0, 0) });
  const body = world.createBody({ type: 'dynamic', position: Vec2(0, 0), angularDamping: 0, allowSleep: true });
  body.createFixture({ shape: Circle(BODY_RADIUS), density: 1.8, friction: 0.4 });
  world.createJoint(new RevoluteJoint({ bodyA: pin, bodyB: body, localAnchorA: Vec2(0, 0), localAnchorB: Vec2(0, 0) }));

  type MotionState = 'ready' | 'spinning' | 'coasting' | 'settled';
  let state: MotionState = 'ready';
  let accumulator = 0;
  let totalAngle = 0;
  let peakOmega = 0;
  let spinCount = 0;
  let quietTime = 0;

  const kick = (): void => {
    body.applyAngularImpulse(SPIN_IMPULSE, true);
    state = 'spinning';
    spinCount += 1;
    quietTime = 0;
  };

  const update = (dt = 0): void => {
    accumulator = Math.min(MAX_CATCHUP, accumulator + Math.max(0, dt));
    while (accumulator >= FIXED_STEP) {
      const omegaBefore = body.getAngularVelocity();
      body.applyTorque(-omegaBefore * BEARING_DRAG, true);
      world.step(FIXED_STEP, 10, 6);
      const omega = body.getAngularVelocity();
      totalAngle += omega * FIXED_STEP;
      peakOmega = Math.max(peakOmega, Math.abs(omega));
      if (state === 'spinning' && Math.abs(totalAngle) > 0.55) state = 'coasting';
      if (spinCount > 0 && Math.abs(omega) < 0.055) quietTime += FIXED_STEP;
      else quietTime = 0;
      if (spinCount > 0 && quietTime > 0.35) state = 'settled';
      accumulator -= FIXED_STEP;
    }
    group.rotation.z = body.getAngle();
    group.userData.state = state;
    group.userData.omega = body.getAngularVelocity();
    group.userData.totalAngle = totalAngle;
    group.userData.peakOmega = peakOmega;
    group.userData.spinCount = spinCount;
  };

  const reset = (): void => {
    accumulator = 0;
    totalAngle = 0;
    peakOmega = 0;
    spinCount = 0;
    quietTime = 0;
    state = 'ready';
    body.setTransform(Vec2(0, 0), 0);
    body.setAngularVelocity(0);
    group.rotation.z = 0;
    group.userData.state = state;
    group.userData.omega = 0;
    group.userData.totalAngle = 0;
    group.userData.peakOmega = 0;
    group.userData.spinCount = 0;
  };

  group.userData.kickGear = kick;
  group.userData.update = update;
  group.userData.reset = reset;
  reset();
  return model;
}
