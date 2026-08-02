import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { createBoxingGloveModelV6 } from './boxingGloveV6';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const CUFF_LOCAL_X = -0.60;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 3.35;
const AIR_DAMPING = 1.55;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.12);
const MAX_SPEED = 10.5;

function createOrganicGloveSurface(): MarchingCubes {
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc42c3a,
    roughness: 0.60,
    metalness: 0,
    clearcoat: 0.045,
    clearcoatRoughness: 0.84,
    sheen: 0.14,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xf16e75),
    bumpMap: createFineBumpTexture(0x62677838, 10400),
    bumpScale: 0.0042
  });

  const surface = new MarchingCubes(58, leather, true, false, 55000);
  surface.isolation = 80;
  surface.reset();

  // Wrist and palm core. These are deliberately smaller than the knuckle
  // masses so the silhouette narrows naturally into the cuff.
  surface.addBall(0.25, 0.50, 0.50, 0.72, 18);
  surface.addBall(0.38, 0.50, 0.50, 1.00, 18);
  surface.addBall(0.49, 0.53, 0.50, 1.22, 18);

  // Padded fist/knuckle block. Multiple overlapping masses create the broad,
  // rounded top and front of a boxing glove without a trumpet-like cap.
  surface.addBall(0.60, 0.60, 0.43, 1.30, 18);
  surface.addBall(0.60, 0.60, 0.57, 1.30, 18);
  surface.addBall(0.70, 0.58, 0.44, 1.18, 18);
  surface.addBall(0.70, 0.58, 0.56, 1.18, 18);
  surface.addBall(0.77, 0.54, 0.50, 1.05, 18);

  // Lower palm keeps the glove deep and padded rather than top-heavy.
  surface.addBall(0.54, 0.43, 0.48, 0.94, 18);

  // Tucked thumb: two compact masses fuse into the palm-side quadrant. This
  // avoids the dangling-ball thumb that made previous versions look toy-like.
  surface.addBall(0.44, 0.35, 0.64, 0.58, 20);
  surface.addBall(0.56, 0.34, 0.62, 0.54, 20);
  surface.addBall(0.61, 0.38, 0.59, 0.42, 20);

  surface.blur(1.1);
  surface.update();
  surface.scale.set(1.02, 0.78, 0.68);
  surface.position.set(0.14, 0.02, 0);
  surface.name = 'BoxingGloveV8OrganicLeatherShell';
  return surface;
}

function setSpringPose(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const delta = end.clone().sub(start);
  const length = Math.max(0.08, delta.length());
  const direction = delta.normalize();
  mesh.position.copy(start);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
}

function cuffWorld(center: THREE.Vector2, angle: number): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.cos(angle) * CUFF_LOCAL_X,
    center.y + Math.sin(angle) * CUFF_LOCAL_X,
    0
  );
}

export function createBoxingGloveModelV8(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV6();
  const group = model.group;
  group.userData.assetVersion = 'boxing-glove-v8';
  group.userData.referenceStyle = 'organic-boxing-glove-tim-free-spring-mass';
  group.userData.motion = 'impulse-spring-gravity-damping';

  const glove = group.getObjectByName('BoxingGloveV6DynamicHead') as THREE.Group | undefined;
  const oldBody = group.getObjectByName('BoxingGloveV6AnatomicalBody');
  const oldThumb = group.getObjectByName('BoxingGloveV6TuckedThumb');
  const spring = group.getObjectByName('BoxingGloveV6PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV6TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;

  if (!glove || !spring || !button) throw new Error('Boxing Glove v8 mechanism parts were not found.');
  if (oldBody) glove.remove(oldBody);
  if (oldThumb) glove.remove(oldThumb);

  const organicShell = createOrganicGloveSurface();
  glove.add(organicShell);
  glove.name = 'BoxingGloveV8DynamicHead';
  spring.name = 'BoxingGloveV8PhysicalSpring';
  button.name = 'BoxingGloveV8TriggerButton';

  let state: 'armed' | 'free' | 'settled' = 'armed';
  const center = ARMED_CENTER.clone();
  const velocity = new THREE.Vector2();
  let triggerPressed = false;
  let triggerLatched = false;
  let elapsedFree = 0;
  let lowEnergyTime = 0;

  const applyPose = (): void => {
    const radial = center.clone().sub(ANCHOR);
    const angle = Math.atan2(radial.y, radial.x);
    glove.position.set(center.x, center.y, 0);
    glove.rotation.z = angle;
    setSpringPose(spring, new THREE.Vector3(ANCHOR.x, ANCHOR.y, 0), cuffWorld(center, angle));

    const buttonTravel = triggerPressed ? 0.055 : 0;
    button.position.x = -1.98 + buttonTravel;
    if (buttonStem) buttonStem.position.x = -1.88 + buttonTravel * 0.55;

    const distance = radial.length();
    group.userData.state = state;
    group.userData.centerX = center.x;
    group.userData.centerY = center.y;
    group.userData.speed = velocity.length();
    group.userData.springLength = distance;
    group.userData.equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
    group.userData.extension = Math.max(0, distance - ARMED_CENTER.distanceTo(ANCHOR));
    group.userData.triggerPressed = triggerPressed;
  };

  const releaseWithImpulse = (): void => {
    if (triggerLatched) return;
    triggerLatched = true;
    state = 'free';
    elapsedFree = 0;
    lowEnergyTime = 0;
    velocity.copy(LAUNCH_VELOCITY);
  };

  const setTriggerPressed = (pressed: boolean): void => {
    const next = Boolean(pressed);
    if (next && !triggerPressed) releaseWithImpulse();
    triggerPressed = next;
    if (!next) triggerLatched = false;
    applyPose();
  };

  const integrate = (dt: number): void => {
    const radial = center.clone().sub(ANCHOR);
    const distance = Math.max(0.0001, radial.length());
    const direction = radial.multiplyScalar(1 / distance);
    const radialSpeed = velocity.dot(direction);
    const springForce = direction.clone().multiplyScalar(-SPRING_K * (distance - REST_LENGTH));
    const springDampingForce = direction.clone().multiplyScalar(-SPRING_DAMPING * radialSpeed);
    const airForce = velocity.clone().multiplyScalar(-AIR_DAMPING);
    const gravityForce = new THREE.Vector2(0, -MASS * GRAVITY);
    const acceleration = springForce.add(springDampingForce).add(airForce).add(gravityForce).multiplyScalar(1 / MASS);

    velocity.addScaledVector(acceleration, dt);
    if (velocity.length() > MAX_SPEED) velocity.setLength(MAX_SPEED);
    center.addScaledVector(velocity, dt);
  };

  const update = (dt: number): void => {
    if (state === 'free') {
      elapsedFree += dt;
      let remaining = Math.min(dt, 0.05);
      const fixed = 1 / 180;
      while (remaining > 0) {
        const step = Math.min(fixed, remaining);
        integrate(step);
        remaining -= step;
      }

      // Do not script the trajectory. We only detect when the physically
      // simulated motion has dissipated enough energy to be visually at rest.
      if (elapsedFree > 3.0 && velocity.length() < 0.17) lowEnergyTime += dt;
      else lowEnergyTime = 0;

      if (lowEnergyTime > 0.55) {
        const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
        center.set(ANCHOR.x, ANCHOR.y - equilibriumLength);
        velocity.set(0, 0);
        state = 'settled';
      }
    }
    applyPose();
  };

  group.userData.setTriggerPressed = setTriggerPressed;
  group.userData.trigger = (): void => {
    setTriggerPressed(true);
    window.setTimeout(() => setTriggerPressed(false), 80);
  };
  group.userData.update = update;
  group.userData.reset = (): void => {
    state = 'armed';
    center.copy(ARMED_CENTER);
    velocity.set(0, 0);
    elapsedFree = 0;
    lowEnergyTime = 0;
    triggerPressed = false;
    triggerLatched = false;
    applyPose();
  };

  applyPose();
  return model;
}
