import * as THREE from 'three';
import { createFineBumpTexture, makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;
const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const CUFF_LOCAL_X = -0.60;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 2.65;
const AIR_DAMPING = 0.62;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.15);
const MAX_SPEED = 10.5;

class UnitHelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly turns: number) {
    super();
  }

  override getPoint(t: number): THREE.Vector3 {
    const angle = t * this.turns * TAU;
    return new THREE.Vector3(t, Math.cos(angle) * 0.115, Math.sin(angle) * 0.115);
  }
}

function sample(values: number[], t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(scaled));
  const f = THREE.MathUtils.smootherstep(scaled - i, 0, 1);
  return THREE.MathUtils.lerp(values[i], values[i + 1], f);
}

function createGloveBodyGeometry(): THREE.BufferGeometry {
  const rings = 78;
  const segments = 88;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const xs = [-0.56, -0.50, -0.34, -0.12, 0.12, 0.36, 0.58, 0.75, 0.88, 0.94];
  const ry = [0.08, 0.31, 0.43, 0.53, 0.62, 0.69, 0.72, 0.66, 0.47, 0.06];
  const rz = [0.07, 0.29, 0.39, 0.47, 0.54, 0.59, 0.61, 0.57, 0.42, 0.05];
  const cy = [-0.01, -0.01, 0.00, 0.035, 0.085, 0.145, 0.18, 0.16, 0.09, 0.04];

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const x = sample(xs, t);
    const radiusY = sample(ry, t);
    const radiusZ = sample(rz, t);
    const centerY = sample(cy, t);
    const knuckle = Math.exp(-Math.pow((t - 0.63) / 0.20, 2));
    const palm = Math.exp(-Math.pow((t - 0.40) / 0.25, 2));

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const angle = v * TAU;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const softY = Math.sign(sin) * Math.pow(Math.abs(sin), 0.80);
      const softZ = Math.sign(cos) * Math.pow(Math.abs(cos), 0.84);
      let y = centerY + softY * radiusY;
      let z = softZ * radiusZ;

      if (softY > 0) y += softY * knuckle * 0.055;
      if (softY < 0) y += (-softY) * palm * 0.028;

      // Create a shallow palm saddle where the thumb folds into the glove.
      const thumbSeat = Math.exp(-Math.pow((t - 0.40) / 0.19, 2)) * Math.max(0, -softY) * Math.max(0, softZ);
      y += thumbSeat * 0.025;
      z -= thumbSeat * 0.045;

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
  const rings = 46;
  const segments = 52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.19, -0.24, 0.28),
    new THREE.Vector3(0.00, -0.39, 0.37),
    new THREE.Vector3(0.25, -0.46, 0.38),
    new THREE.Vector3(0.47, -0.36, 0.31),
    new THREE.Vector3(0.60, -0.20, 0.22)
  ], false, 'centripetal');

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const root = THREE.MathUtils.smoothstep(t, 0, 0.16);
    const tip = 1 - THREE.MathUtils.smoothstep(t, 0.72, 1);
    const radiusY = (0.14 + root * 0.12) * (0.22 + tip * 0.78);
    const radiusZ = (0.13 + root * 0.105) * (0.22 + tip * 0.78);

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const angle = v * TAU;
      const p = center.clone()
        .addScaledVector(up, Math.cos(angle) * radiusY)
        .addScaledVector(side, Math.sin(angle) * radiusZ);
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

function createGloveHead(): THREE.Group {
  const group = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc82e3b,
    roughness: 0.57,
    metalness: 0,
    clearcoat: 0.055,
    clearcoatRoughness: 0.82,
    sheen: 0.14,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xf27679),
    bumpMap: createFineBumpTexture(0x62677836, 9800),
    bumpScale: 0.0045
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xa9212f,
    roughness: 0.61,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.88
  });

  const body = new THREE.Mesh(createGloveBodyGeometry(), leather);
  body.name = 'BoxingGloveV6AnatomicalBody';
  group.add(body);

  const thumb = new THREE.Mesh(createThumbGeometry(), leather);
  thumb.name = 'BoxingGloveV6TuckedThumb';
  group.add(thumb);

  // Short padded cuff, clearly subordinate to the glove silhouette.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.34, 64, 3, true), cuffLeather);
  cuff.rotation.z = Math.PI / 2;
  cuff.position.x = -0.55;
  cuff.name = 'BoxingGloveV6PaddedCuff';
  group.add(cuff);

  const cuffOpening = new THREE.Mesh(
    new THREE.CircleGeometry(0.258, 64),
    new THREE.MeshStandardMaterial({ color: 0x211619, roughness: 0.97, metalness: 0, side: THREE.DoubleSide })
  );
  cuffOpening.rotation.y = Math.PI / 2;
  cuffOpening.position.x = -0.73;
  cuffOpening.name = 'BoxingGloveV6CuffOpening';
  group.add(cuffOpening);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 12, 64), cuffLeather);
  rim.rotation.y = Math.PI / 2;
  rim.position.x = -0.73;
  rim.name = 'BoxingGloveV6CuffRim';
  group.add(rim);

  return group;
}

function createBase(): { group: THREE.Group; button: THREE.Mesh; buttonStem: THREE.Mesh } {
  const group = new THREE.Group();
  const blue = new THREE.MeshPhysicalMaterial({
    color: 0x354f9b,
    roughness: 0.42,
    metalness: 0.36,
    clearcoat: 0.07,
    clearcoatRoughness: 0.58
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x213367, roughness: 0.48, metalness: 0.52 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbfc8cd, roughness: 0.29, metalness: 0.82 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xe33a43, roughness: 0.44, metalness: 0.02, clearcoat: 0.08 });

  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.44, 56, 2), blue);
  housing.rotation.z = Math.PI / 2;
  housing.position.set(-1.56, 0.06, 0);
  housing.name = 'BoxingGloveV6CompactBase';
  group.add(housing);

  const face = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.040, 12, 56), steel);
  face.rotation.y = Math.PI / 2;
  face.position.set(ANCHOR.x, ANCHOR.y, 0);
  face.name = 'BoxingGloveV6SpringSocket';
  group.add(face);

  const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.065, 56), dark);
  rear.rotation.z = Math.PI / 2;
  rear.position.set(-1.80, 0.06, 0);
  rear.name = 'BoxingGloveV6RearPlate';
  group.add(rear);

  const buttonStem = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.12, 28), steel);
  buttonStem.rotation.z = Math.PI / 2;
  buttonStem.position.set(-1.88, 0.06, 0);
  group.add(buttonStem);

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.082, 40), red);
  button.rotation.z = Math.PI / 2;
  button.position.set(-1.98, 0.06, 0);
  button.name = 'BoxingGloveV6TriggerButton';
  button.userData.isBoxingGloveTrigger = true;
  group.add(button);

  const skid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.085, 0.46), dark);
  skid.position.set(-1.56, -0.31, 0);
  skid.name = 'BoxingGloveV6MountSkid';
  group.add(skid);

  return { group, button, buttonStem };
}

function setSpringPose(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const delta = end.clone().sub(start);
  const length = Math.max(0.08, delta.length());
  const direction = delta.normalize();
  mesh.position.copy(start);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
}

function gloveCuffWorld(center: THREE.Vector2, angle: number): THREE.Vector3 {
  const x = center.x + Math.cos(angle) * CUFF_LOCAL_X;
  const y = center.y + Math.sin(angle) * CUFF_LOCAL_X;
  return new THREE.Vector3(x, y, 0);
}

export function createBoxingGloveModelV6(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v6';
  group.userData.sourceKey = 'sketchfab-incg5764-boxing-glove-cc-by';
  group.userData.referenceStyle = 'tim-triggered-free-spring-mass';
  group.userData.dynamic = true;
  group.userData.gravity = true;
  group.userData.motion = 'impulse-spring-gravity-damping';
  group.userData.triggerZone = { center: [-1.98, 0.06, 0], size: [0.14, 0.30, 0.30] };
  group.userData.snapPoints = [
    { id: 'trigger', position: [-2.02, 0.06, 0] },
    { id: 'mount', position: [-1.56, -0.35, 0] },
    { id: 'spring-anchor', position: [ANCHOR.x, ANCHOR.y, 0] },
    { id: 'impact', position: [0.80, 0.12, 0] }
  ];

  const base = createBase();
  group.add(base.group);

  const glove = createGloveHead();
  glove.name = 'BoxingGloveV6DynamicHead';
  group.add(glove);

  const springMaterial = new THREE.MeshStandardMaterial({ color: 0xd6dde1, metalness: 0.91, roughness: 0.25 });
  const spring = new THREE.Mesh(
    new THREE.TubeGeometry(new UnitHelixCurve(11.5), 220, 0.022, 8, false),
    springMaterial
  );
  spring.name = 'BoxingGloveV6PhysicalSpring';
  group.add(spring);

  const selection = makeSelectionBox(new THREE.Vector3(5.15, 4.10, 1.78));
  selection.position.set(-0.35, -0.72, 0);
  group.add(selection);

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

    const springStart = new THREE.Vector3(ANCHOR.x, ANCHOR.y, 0);
    const springEnd = gloveCuffWorld(center, angle);
    setSpringPose(spring, springStart, springEnd);

    const buttonTravel = triggerPressed ? 0.055 : 0;
    base.button.position.x = -1.98 + buttonTravel;
    base.buttonStem.position.x = -1.88 + buttonTravel * 0.55;

    const distance = radial.length();
    const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
    group.userData.state = state;
    group.userData.centerX = center.x;
    group.userData.centerY = center.y;
    group.userData.speed = velocity.length();
    group.userData.springLength = distance;
    group.userData.equilibriumLength = equilibriumLength;
    group.userData.extension = Math.max(0, distance - ARMED_CENTER.distanceTo(ANCHOR));
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
    const stretch = distance - REST_LENGTH;
    const radialSpeed = velocity.dot(direction);

    const springForce = direction.clone().multiplyScalar(-SPRING_K * stretch);
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
      if (elapsedFree > 2.4 && velocity.length() < 0.045 && dx < 0.055 && dy < 0.055) {
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
  group.userData.setReviewState = (mode: 'armed' | 'impulse' | 'hanging'): void => {
    if (mode === 'armed') {
      group.userData.reset();
    } else if (mode === 'impulse') {
      group.userData.reset();
      releaseWithImpulse();
    } else {
      const equilibriumLength = REST_LENGTH + (MASS * GRAVITY) / SPRING_K;
      state = 'settled';
      center.set(ANCHOR.x, ANCHOR.y - equilibriumLength);
      velocity.set(0, 0);
      applyPose();
    }
  };

  applyPose();
  return { group, selectionMeshes: [selection] };
}
