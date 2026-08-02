import * as THREE from 'three';
import { createBoxingGloveModelV6 } from './boxingGloveV6';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;
const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const SPRING_ATTACH_X = -0.72;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 3.55;
const AIR_DAMPING = 1.85;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.12);
const MAX_SPEED = 10.5;
const PHYSICS_SLEEP_TIME = 4.9;

function sample(values: number[], t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(scaled));
  const f = THREE.MathUtils.smootherstep(scaled - i, 0, 1);
  return THREE.MathUtils.lerp(values[i], values[i + 1], f);
}

function createClosedFistGeometry(): THREE.BufferGeometry {
  const rings = 72;
  const segments = 88;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Compact real boxing-glove proportions: narrow wrist, deep palm, broad
  // knuckle dome, then a rounded striking nose instead of an open trumpet.
  const xs = [-0.43, -0.35, -0.20, 0.00, 0.20, 0.39, 0.55, 0.68, 0.80, 0.88];
  const ry = [0.14, 0.27, 0.40, 0.50, 0.59, 0.67, 0.71, 0.66, 0.47, 0.10];
  const rz = [0.13, 0.25, 0.37, 0.46, 0.53, 0.59, 0.62, 0.58, 0.43, 0.09];
  const cy = [-0.03, -0.01, 0.02, 0.08, 0.15, 0.21, 0.24, 0.21, 0.14, 0.08];

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const x = sample(xs, t);
    const radiusY = sample(ry, t);
    const radiusZ = sample(rz, t);
    const centerY = sample(cy, t);
    const knuckle = Math.exp(-Math.pow((t - 0.63) / 0.19, 2));

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      const sy = Math.sign(sin) * Math.pow(Math.abs(sin), 0.73);
      const sz = Math.sign(cos) * Math.pow(Math.abs(cos), 0.77);
      let y = centerY + sy * radiusY;
      let z = sz * radiusZ;

      // Thick upper knuckle padding and subtle palm saddle.
      if (sy > 0) y += sy * knuckle * 0.055;
      const seat = Math.exp(-Math.pow((t - 0.43) / 0.18, 2)) * Math.max(0, -sy) * Math.max(0, sz);
      y += seat * 0.028;
      z -= seat * 0.048;

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

  // Close both ends. The front cap is especially important: without it the
  // camera sees nested internal loft rings and the glove looks like a funnel.
  const wristCenter = positions.length / 3;
  positions.push(xs[0] - 0.012, cy[0], 0);
  uvs.push(0, 0.5);
  const noseCenter = positions.length / 3;
  positions.push(xs[xs.length - 1] + 0.035, cy[cy.length - 1], 0);
  uvs.push(1, 0.5);

  for (let s = 0; s < segments; s += 1) {
    const next = (s + 1) % segments;
    indices.push(wristCenter, next, s);
    const last = (rings - 1) * segments;
    indices.push(noseCenter, last + s, last + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createClosedThumbGeometry(): THREE.BufferGeometry {
  const rings = 48;
  const segments = 52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, -0.22, 0.25),
    new THREE.Vector3(0.08, -0.36, 0.34),
    new THREE.Vector3(0.24, -0.40, 0.36),
    new THREE.Vector3(0.40, -0.31, 0.31),
    new THREE.Vector3(0.50, -0.18, 0.22)
  ], false, 'centripetal');

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const root = THREE.MathUtils.smoothstep(t, 0, 0.16);
    const tip = 1 - THREE.MathUtils.smoothstep(t, 0.74, 1);
    const radius = (0.14 + root * 0.085) * (0.32 + tip * 0.68);

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const p = center.clone()
        .addScaledVector(up, Math.cos(a) * radius)
        .addScaledVector(side, Math.sin(a) * radius * 0.86);
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

  const rootCenter = positions.length / 3;
  const rootPos = curve.getPoint(0);
  positions.push(rootPos.x, rootPos.y, rootPos.z);
  uvs.push(0, 0.5);
  const tipCenter = positions.length / 3;
  const tipPos = curve.getPoint(1);
  positions.push(tipPos.x, tipPos.y, tipPos.z);
  uvs.push(1, 0.5);
  for (let s = 0; s < segments; s += 1) {
    const next = (s + 1) % segments;
    indices.push(rootCenter, next, s);
    const last = (rings - 1) * segments;
    indices.push(tipCenter, last + s, last + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createGloveHead(): THREE.Group {
  const group = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc92535,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.045,
    clearcoatRoughness: 0.82,
    sheen: 0.16,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xee6972),
    bumpMap: createFineBumpTexture(0x62677840, 12000),
    bumpScale: 0.0040
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xa91b29,
    roughness: 0.61,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.90
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x8e1421, roughness: 0.74, metalness: 0 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x211619, roughness: 0.98, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8d0d5, roughness: 0.28, metalness: 0.88 });

  const fist = new THREE.Mesh(createClosedFistGeometry(), leather);
  fist.name = 'BoxingGloveV10Fist';
  group.add(fist);

  const thumb = new THREE.Mesh(createClosedThumbGeometry(), leather);
  thumb.name = 'BoxingGloveV10Thumb';
  group.add(thumb);

  // Straight padded cuff deeply overlaps the wrist, so it reads as one glove.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.30, 0.38, 64, 4, true), cuffLeather);
  cuff.rotation.z = Math.PI / 2;
  cuff.position.set(-0.48, -0.025, 0);
  cuff.name = 'BoxingGloveV10Cuff';
  group.add(cuff);

  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.247, 64), innerMat);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.68, -0.025, 0);
  group.add(opening);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.026, 12, 64), cuffLeather);
  rim.rotation.y = Math.PI / 2;
  rim.position.set(-0.68, -0.025, 0);
  group.add(rim);

  // Spring receiver is physically inside the cuff opening.
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(SPRING_ATTACH_X, -0.025, 0);
  receiver.name = 'BoxingGloveV10SpringReceiver';
  group.add(receiver);

  const receiverRim = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 10, 40), steel);
  receiverRim.rotation.y = Math.PI / 2;
  receiverRim.position.set(SPRING_ATTACH_X - 0.09, -0.025, 0);
  group.add(receiverRim);

  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.02, -0.19, 0.385),
    new THREE.Vector3(0.10, -0.31, 0.425),
    new THREE.Vector3(0.27, -0.34, 0.405),
    new THREE.Vector3(0.43, -0.24, 0.33)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 60, 0.0065, 8, false), seamMat);
  seam.name = 'BoxingGloveV10ThumbSeam';
  group.add(seam);

  return group;
}

function setSpringPose(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const delta = end.clone().sub(start);
  const length = Math.max(0.08, delta.length());
  mesh.position.copy(start);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
}

function springReceiverWorld(center: THREE.Vector2, angle: number): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.cos(angle) * SPRING_ATTACH_X,
    center.y + Math.sin(angle) * SPRING_ATTACH_X,
    0
  );
}

export function createBoxingGloveModelV10(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV6();
  const group = model.group;
  group.userData.assetVersion = 'boxing-glove-v10';
  group.userData.referenceStyle = 'premium-boxing-glove-tim-physics';
  group.userData.motion = 'impulse-spring-gravity-damping';

  const legacyHead = group.getObjectByName('BoxingGloveV6DynamicHead') as THREE.Group | undefined;
  const spring = group.getObjectByName('BoxingGloveV6PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV6TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;
  if (!legacyHead || !spring || !button) throw new Error('Boxing Glove v10 mechanism parts were not found.');

  group.remove(legacyHead);
  const glove = createGloveHead();
  glove.name = 'BoxingGloveV10DynamicHead';
  group.add(glove);
  spring.name = 'BoxingGloveV10PhysicalSpring';
  button.name = 'BoxingGloveV10TriggerButton';

  let state: 'armed' | 'free' | 'settled' = 'armed';
  const center = ARMED_CENTER.clone();
  const velocity = new THREE.Vector2();
  let triggerPressed = false;
  let triggerLatched = false;
  let elapsedFree = 0;
  let lowEnergyTime = 0;
  let lastWallTime = performance.now();

  const applyPose = (): void => {
    const radial = center.clone().sub(ANCHOR);
    const angle = Math.atan2(radial.y, radial.x);
    glove.position.set(center.x, center.y, 0);
    glove.rotation.z = angle;
    setSpringPose(spring, new THREE.Vector3(ANCHOR.x, ANCHOR.y, 0), springReceiverWorld(center, angle));

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

  const integrate = (dt: number): void => {
    const radial = center.clone().sub(ANCHOR);
    const distance = Math.max(0.0001, radial.length());
    const direction = radial.multiplyScalar(1 / distance);
    const radialSpeed = velocity.dot(direction);
    const springForce = direction.clone().multiplyScalar(-SPRING_K * (distance - REST_LENGTH));
    const springDamping = direction.clone().multiplyScalar(-SPRING_DAMPING * radialSpeed);
    const airForce = velocity.clone().multiplyScalar(-AIR_DAMPING);
    const gravityForce = new THREE.Vector2(0, -MASS * GRAVITY);
    const acceleration = springForce.add(springDamping).add(airForce).add(gravityForce).multiplyScalar(1 / MASS);
    velocity.addScaledVector(acceleration, dt);
    if (velocity.length() > MAX_SPEED) velocity.setLength(MAX_SPEED);
    center.addScaledVector(velocity, dt);
  };

  const sleepAtEquilibrium = (): void => {
    const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
    center.set(ANCHOR.x, ANCHOR.y - equilibriumLength);
    velocity.set(0, 0);
    state = 'settled';
  };

  const releaseWithImpulse = (): void => {
    if (triggerLatched) return;
    triggerLatched = true;
    state = 'free';
    elapsedFree = 0;
    lowEnergyTime = 0;
    lastWallTime = performance.now();
    velocity.copy(LAUNCH_VELOCITY);
  };

  const setTriggerPressed = (pressed: boolean): void => {
    const next = Boolean(pressed);
    if (next && !triggerPressed) releaseWithImpulse();
    triggerPressed = next;
    if (!next) triggerLatched = false;
    applyPose();
  };

  const update = (): void => {
    const now = performance.now();
    const wallDt = Math.min(0.12, Math.max(0, (now - lastWallTime) / 1000));
    lastWallTime = now;
    if (state === 'free') {
      elapsedFree += wallDt;
      let remaining = wallDt;
      const fixed = 1 / 180;
      while (remaining > 0) {
        const step = Math.min(fixed, remaining);
        integrate(step);
        remaining -= step;
      }

      if (elapsedFree > 2.8 && velocity.length() < 0.24) lowEnergyTime += wallDt;
      else lowEnergyTime = 0;
      if (lowEnergyTime > 0.38 || elapsedFree >= PHYSICS_SLEEP_TIME) sleepAtEquilibrium();
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
    lastWallTime = performance.now();
    applyPose();
  };

  applyPose();
  return model;
}
