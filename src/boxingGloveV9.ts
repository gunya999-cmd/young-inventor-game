import * as THREE from 'three';
import { createBoxingGloveModelV6 } from './boxingGloveV6';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;
const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const CUFF_LOCAL_X = -0.54;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 3.55;
const AIR_DAMPING = 1.85;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.12);
const MAX_SPEED = 10.5;
const PHYSICS_SLEEP_TIME = 4.8;

function sample(values: number[], t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(scaled));
  const f = THREE.MathUtils.smootherstep(scaled - i, 0, 1);
  return THREE.MathUtils.lerp(values[i], values[i + 1], f);
}

function createFistGeometry(): THREE.BufferGeometry {
  const rings = 76;
  const segments = 92;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Deliberately short and broad. The large upper radii form the padded
  // knuckle dome while the wrist stays narrow. This avoids the old mitten/
  // teardrop silhouette and gives the characteristic boxing-glove profile.
  const xs = [-0.42, -0.36, -0.22, -0.03, 0.18, 0.38, 0.54, 0.67, 0.76, 0.80];
  const ry = [0.15, 0.27, 0.39, 0.49, 0.58, 0.66, 0.70, 0.64, 0.45, 0.08];
  const rz = [0.14, 0.25, 0.36, 0.45, 0.52, 0.58, 0.61, 0.57, 0.41, 0.07];
  const cy = [-0.02, -0.01, 0.01, 0.07, 0.14, 0.20, 0.23, 0.20, 0.11, 0.05];

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const x = sample(xs, t);
    const radiusY = sample(ry, t);
    const radiusZ = sample(rz, t);
    const centerY = sample(cy, t);
    const knuckle = Math.exp(-Math.pow((t - 0.63) / 0.19, 2));
    const front = Math.exp(-Math.pow((t - 0.82) / 0.13, 2));

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const sin = Math.sin(a);
      const cos = Math.cos(a);

      // Superellipse-ish section: padded/boxy without looking low-poly.
      const sy = Math.sign(sin) * Math.pow(Math.abs(sin), 0.72);
      const sz = Math.sign(cos) * Math.pow(Math.abs(cos), 0.76);
      let y = centerY + sy * radiusY;
      let z = sz * radiusZ;

      if (sy > 0) y += sy * knuckle * 0.055;
      if (sy < 0) y += sy * front * 0.020;

      // Palm-side thumb seat. This shallow shaping helps the thumb read as
      // tucked into the glove instead of glued onto a ball.
      const seat = Math.exp(-Math.pow((t - 0.44) / 0.18, 2)) * Math.max(0, -sy) * Math.max(0, sz);
      y += seat * 0.035;
      z -= seat * 0.050;

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
  const rings = 52;
  const segments = 56;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, -0.23, 0.25),
    new THREE.Vector3(0.09, -0.38, 0.34),
    new THREE.Vector3(0.27, -0.42, 0.35),
    new THREE.Vector3(0.43, -0.33, 0.30),
    new THREE.Vector3(0.52, -0.20, 0.22)
  ], false, 'centripetal');

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const root = THREE.MathUtils.smoothstep(t, 0, 0.18);
    const tip = 1 - THREE.MathUtils.smoothstep(t, 0.73, 1);
    const radius = (0.13 + root * 0.10) * (0.28 + tip * 0.72);

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const a = v * TAU;
      const p = center.clone()
        .addScaledVector(up, Math.cos(a) * radius)
        .addScaledVector(side, Math.sin(a) * radius * 0.88);
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

function createPremiumGloveHead(): THREE.Group {
  const group = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc82737,
    roughness: 0.54,
    metalness: 0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.80,
    sheen: 0.16,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xef6871),
    bumpMap: createFineBumpTexture(0x62677839, 12000),
    bumpScale: 0.0042
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x8f1724, roughness: 0.72, metalness: 0 });
  const cuffMat = new THREE.MeshPhysicalMaterial({
    color: 0xa91d2b,
    roughness: 0.60,
    metalness: 0,
    clearcoat: 0.03,
    clearcoatRoughness: 0.88
  });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x1f1517, roughness: 0.98, metalness: 0, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8d0d5, roughness: 0.28, metalness: 0.88 });

  const body = new THREE.Mesh(createFistGeometry(), leather);
  body.name = 'BoxingGloveV9FistShell';
  group.add(body);

  const thumb = new THREE.Mesh(createThumbGeometry(), leather);
  thumb.name = 'BoxingGloveV9TuckedThumb';
  group.add(thumb);

  // A short straight padded cuff, deliberately not flared. It overlaps the
  // wrist shell so there is no floating skirt/disconnected red part.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.305, 0.34, 64, 3, true), cuffMat);
  cuff.rotation.z = Math.PI / 2;
  cuff.position.set(-0.49, -0.02, 0);
  cuff.name = 'BoxingGloveV9IntegratedCuff';
  group.add(cuff);

  const cuffOpening = new THREE.Mesh(new THREE.CircleGeometry(0.244, 64), innerMat);
  cuffOpening.rotation.y = Math.PI / 2;
  cuffOpening.position.set(-0.67, -0.02, 0);
  cuffOpening.name = 'BoxingGloveV9CuffOpening';
  group.add(cuffOpening);

  const cuffRim = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.024, 12, 64), cuffMat);
  cuffRim.rotation.y = Math.PI / 2;
  cuffRim.position.set(-0.67, -0.02, 0);
  cuffRim.name = 'BoxingGloveV9CuffRim';
  group.add(cuffRim);

  // Mechanical spring receiver sits inside the cuff, visually joining spring
  // and glove into one assembly instead of three floating objects.
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.16, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(-0.70, -0.02, 0);
  receiver.name = 'BoxingGloveV9SpringReceiver';
  group.add(receiver);

  const receiverCap = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 10, 40), steel);
  receiverCap.rotation.y = Math.PI / 2;
  receiverCap.position.set(-0.78, -0.02, 0);
  group.add(receiverCap);

  // Thin embedded thumb seam provides a real glove construction cue. It is
  // intentionally tiny and intersects the surface, not a floating wire.
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.03, -0.20, 0.39),
    new THREE.Vector3(0.12, -0.34, 0.44),
    new THREE.Vector3(0.31, -0.36, 0.41),
    new THREE.Vector3(0.47, -0.25, 0.34)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 64, 0.007, 8, false), seamMat);
  seam.name = 'BoxingGloveV9EmbeddedThumbSeam';
  group.add(seam);

  return group;
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

export function createBoxingGloveModelV9(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV6();
  const group = model.group;
  group.userData.assetVersion = 'boxing-glove-v9';
  group.userData.referenceStyle = 'premium-boxing-glove-tim-spring-mass';
  group.userData.motion = 'impulse-spring-gravity-damping';

  const legacyHead = group.getObjectByName('BoxingGloveV6DynamicHead') as THREE.Group | undefined;
  const spring = group.getObjectByName('BoxingGloveV6PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV6TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;

  if (!legacyHead || !spring || !button) throw new Error('Boxing Glove v9 mechanism parts were not found.');

  // Replace the complete old red head, including its old flared cuff.
  group.remove(legacyHead);
  const glove = createPremiumGloveHead();
  glove.name = 'BoxingGloveV9DynamicHead';
  group.add(glove);
  spring.name = 'BoxingGloveV9PhysicalSpring';
  button.name = 'BoxingGloveV9TriggerButton';

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

  const sleepAtGravityEquilibrium = (): void => {
    const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
    center.set(ANCHOR.x, ANCHOR.y - equilibriumLength);
    velocity.set(0, 0);
    state = 'settled';
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

      if (elapsedFree > 2.8 && velocity.length() < 0.24) lowEnergyTime += dt;
      else lowEnergyTime = 0;
      if (lowEnergyTime > 0.38 || elapsedFree >= PHYSICS_SLEEP_TIME) sleepAtGravityEquilibrium();
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
