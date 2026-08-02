import * as THREE from 'three';
import { createBoxingGloveModelV6 } from './boxingGloveV6';
import type { PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;
const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const CUFF_LOCAL_X = -0.60;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 3.2;
const AIR_DAMPING = 1.15;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.15);
const MAX_SPEED = 10.5;

function sample(values: number[], t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(scaled));
  const f = THREE.MathUtils.smootherstep(scaled - i, 0, 1);
  return THREE.MathUtils.lerp(values[i], values[i + 1], f);
}

function createBodyGeometry(): THREE.BufferGeometry {
  const rings = 86;
  const segments = 92;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Boxing-glove silhouette: narrow wrist -> padded palm -> dominant knuckle
  // dome -> rounded striking face. The cap closes gradually so it never reads
  // as a trumpet or cup from the front three-quarter camera.
  const xs = [-0.54, -0.46, -0.28, -0.04, 0.22, 0.47, 0.69, 0.86, 1.00, 1.10, 1.16];
  const ry = [0.10, 0.29, 0.43, 0.54, 0.63, 0.70, 0.72, 0.67, 0.53, 0.31, 0.055];
  const rz = [0.09, 0.27, 0.38, 0.47, 0.54, 0.59, 0.61, 0.58, 0.48, 0.29, 0.05];
  const cy = [-0.025, -0.02, 0.00, 0.045, 0.105, 0.165, 0.205, 0.20, 0.155, 0.10, 0.06];

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const baseX = sample(xs, t);
    const radiusY = sample(ry, t);
    const radiusZ = sample(rz, t);
    const centerY = sample(cy, t);
    const knuckle = Math.exp(-Math.pow((t - 0.62) / 0.22, 2));
    const palm = Math.exp(-Math.pow((t - 0.34) / 0.22, 2));

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      const sy = Math.sign(sin) * Math.pow(Math.abs(sin), 0.86);
      const sz = Math.sign(cos) * Math.pow(Math.abs(cos), 0.90);
      let x = baseX;
      let y = centerY + sy * radiusY;
      let z = sz * radiusZ;

      // Fuller padded knuckles on top/front; lower palm remains slightly flatter.
      if (sy > 0) y += sy * knuckle * 0.050;
      if (sy < 0) y += (-sy) * palm * 0.020;

      // Very gentle convex striking face instead of a circular rim.
      const face = THREE.MathUtils.smoothstep(t, 0.70, 1);
      x += face * (1 - Math.abs(sy) * 0.18 - Math.abs(sz) * 0.14) * 0.028;

      // Tucked thumb saddle on the palm-side quadrant.
      const thumbSeat = Math.exp(-Math.pow((t - 0.35) / 0.17, 2)) * Math.max(0, -sy) * Math.max(0, sz);
      y += thumbSeat * 0.018;
      z -= thumbSeat * 0.050;

      positions.push(x, y, z);
      uvs.push(t, v);
    }
  }

  for (let r = 0; r < rings - 1; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const next = (s + 1) % segments;
      const a = r * segments + s;
      const b = r * segments + next;
      const c = (r + 1) * segments + next;
      const d = (r + 1) * segments + s;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createThumbGeometry(): THREE.BufferGeometry {
  const rings = 48;
  const segments = 52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17, -0.24, 0.27),
    new THREE.Vector3(0.00, -0.34, 0.33),
    new THREE.Vector3(0.18, -0.38, 0.32),
    new THREE.Vector3(0.35, -0.32, 0.27),
    new THREE.Vector3(0.48, -0.20, 0.20)
  ], false, 'centripetal');

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const root = THREE.MathUtils.smoothstep(t, 0, 0.18);
    const tip = 1 - THREE.MathUtils.smoothstep(t, 0.72, 1);
    const radiusY = (0.105 + root * 0.075) * (0.25 + tip * 0.75);
    const radiusZ = (0.095 + root * 0.070) * (0.25 + tip * 0.75);

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const p = center.clone()
        .addScaledVector(up, Math.cos(a) * radiusY)
        .addScaledVector(side, Math.sin(a) * radiusZ);
      positions.push(p.x, p.y, p.z);
      uvs.push(t, v);
    }
  }

  for (let r = 0; r < rings - 1; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const next = (s + 1) % segments;
      const a = r * segments + s;
      const b = r * segments + next;
      const c = (r + 1) * segments + next;
      const d = (r + 1) * segments + s;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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

export function createBoxingGloveModelV7(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV6();
  const group = model.group;
  group.userData.assetVersion = 'boxing-glove-v7';
  group.userData.referenceStyle = 'anatomical-tim-free-spring-mass';
  group.userData.motion = 'impulse-spring-gravity-damping';

  const glove = group.getObjectByName('BoxingGloveV6DynamicHead') as THREE.Group | undefined;
  const body = group.getObjectByName('BoxingGloveV6AnatomicalBody') as THREE.Mesh | undefined;
  const thumb = group.getObjectByName('BoxingGloveV6TuckedThumb') as THREE.Mesh | undefined;
  const spring = group.getObjectByName('BoxingGloveV6PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV6TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;

  if (!glove || !body || !thumb || !spring || !button) {
    throw new Error('Boxing Glove v7 could not resolve the v6 mechanism parts.');
  }

  body.geometry.dispose();
  body.geometry = createBodyGeometry();
  body.name = 'BoxingGloveV7AnatomicalBody';
  thumb.geometry.dispose();
  thumb.geometry = createThumbGeometry();
  thumb.name = 'BoxingGloveV7TuckedThumb';
  glove.name = 'BoxingGloveV7DynamicHead';
  spring.name = 'BoxingGloveV7PhysicalSpring';
  button.name = 'BoxingGloveV7TriggerButton';

  let state: 'armed' | 'free' | 'settled' = 'armed';
  const center = ARMED_CENTER.clone();
  const velocity = new THREE.Vector2();
  let triggerPressed = false;
  let triggerLatched = false;
  let elapsedFree = 0;

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

      const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
      const dx = Math.abs(center.x - ANCHOR.x);
      const dy = Math.abs(center.y - (ANCHOR.y - equilibriumLength));
      if (elapsedFree > 2.4 && velocity.length() < 0.08 && dx < 0.10 && dy < 0.10) {
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
    triggerPressed = false;
    triggerLatched = false;
    applyPose();
  };

  applyPose();
  return model;
}
