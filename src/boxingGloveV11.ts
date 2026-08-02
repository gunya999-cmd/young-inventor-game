import * as THREE from 'three';
import { createBoxingGloveModelV6 } from './boxingGloveV6';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const SPRING_ATTACH_X = -0.68;
const REST_LENGTH = 1.08;
const MASS = 0.92;
const SPRING_K = 31.5;
const SPRING_DAMPING = 3.55;
const AIR_DAMPING = 1.85;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.12);
const MAX_SPEED = 10.5;
const PHYSICS_SLEEP_TIME = 4.9;

function createGloveBodyGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.42, 0.22);
  shape.bezierCurveTo(-0.28, 0.40, -0.04, 0.54, 0.28, 0.61);
  shape.bezierCurveTo(0.56, 0.67, 0.80, 0.58, 0.90, 0.35);
  shape.bezierCurveTo(0.98, 0.17, 0.94, -0.11, 0.82, -0.31);
  shape.bezierCurveTo(0.70, -0.50, 0.48, -0.60, 0.25, -0.60);
  shape.bezierCurveTo(0.04, -0.60, -0.15, -0.50, -0.27, -0.38);
  shape.bezierCurveTo(-0.34, -0.31, -0.39, -0.28, -0.42, -0.26);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.62,
    steps: 2,
    curveSegments: 28,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.10,
    bevelSegments: 10
  });
  geometry.center();
  // Slightly fuller through depth than a flat icon, still clean and readable.
  geometry.scale(1, 1, 1.05);
  geometry.computeVertexNormals();
  return geometry;
}

function createThumbGeometry(): THREE.ExtrudeGeometry {
  const thumb = new THREE.Shape();
  thumb.moveTo(-0.02, -0.12);
  thumb.bezierCurveTo(0.10, -0.26, 0.18, -0.45, 0.34, -0.49);
  thumb.bezierCurveTo(0.50, -0.53, 0.62, -0.42, 0.62, -0.27);
  thumb.bezierCurveTo(0.62, -0.13, 0.51, -0.05, 0.38, -0.04);
  thumb.bezierCurveTo(0.21, -0.03, 0.09, -0.06, -0.02, -0.12);
  thumb.closePath();

  const geometry = new THREE.ExtrudeGeometry(thumb, {
    depth: 0.34,
    steps: 2,
    curveSegments: 24,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.065,
    bevelSegments: 8
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width * 0.5;
  const h = height * 0.5;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function createCuffGeometry(): THREE.ExtrudeGeometry {
  const shape = roundedRectShape(0.56, 0.60, 0.16);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    steps: 1,
    curveSegments: 16,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 6
  });
  geometry.center();
  // Extrusion comes out on Z; rotate so cuff depth lies on punch axis X.
  geometry.rotateY(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createGloveHead(): THREE.Group {
  const group = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc92838,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.045,
    clearcoatRoughness: 0.82,
    sheen: 0.18,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xef6d75),
    bumpMap: createFineBumpTexture(0x62677841, 13000),
    bumpScale: 0.0038
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xa91c2a,
    roughness: 0.61,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.90
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x82141f, roughness: 0.76, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d1d6, roughness: 0.28, metalness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23171a, roughness: 0.96, metalness: 0 });

  const body = new THREE.Mesh(createGloveBodyGeometry(), leather);
  body.name = 'BoxingGloveV11Body';
  body.position.set(0.12, 0.02, 0);
  group.add(body);

  // Thumb sits on the near side and overlaps deeply with the palm; this gives
  // the unmistakable boxing-glove teardrop/thumb silhouette.
  const thumb = new THREE.Mesh(createThumbGeometry(), leather);
  thumb.name = 'BoxingGloveV11Thumb';
  thumb.position.set(0.18, -0.02, 0.37);
  thumb.rotation.y = -0.08;
  group.add(thumb);

  const cuff = new THREE.Mesh(createCuffGeometry(), cuffLeather);
  cuff.name = 'BoxingGloveV11Cuff';
  cuff.position.set(-0.48, -0.02, 0);
  group.add(cuff);

  // Dark wrist line visually separates padded glove from cuff, like a real
  // glove construction seam, while remaining part of one coherent assembly.
  const cuffBand = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.020, 10, 64), seamMat);
  cuffBand.rotation.y = Math.PI / 2;
  cuffBand.scale.set(1, 1.0, 0.92);
  cuffBand.position.set(-0.31, -0.02, 0);
  group.add(cuffBand);

  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.235, 64), dark);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.69, -0.02, 0);
  group.add(opening);

  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(SPRING_ATTACH_X, -0.02, 0);
  receiver.name = 'BoxingGloveV11SpringReceiver';
  group.add(receiver);

  const receiverRim = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 10, 40), steel);
  receiverRim.rotation.y = Math.PI / 2;
  receiverRim.position.set(SPRING_ATTACH_X - 0.09, -0.02, 0);
  group.add(receiverRim);

  // A thin embedded thumb seam is enough to communicate leather construction
  // without the floating-wire problem of early versions.
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.04, -0.15, 0.555),
    new THREE.Vector3(0.15, -0.28, 0.58),
    new THREE.Vector3(0.30, -0.35, 0.57),
    new THREE.Vector3(0.45, -0.24, 0.52)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 56, 0.006, 8, false), seamMat);
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

function receiverWorld(center: THREE.Vector2, angle: number): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.cos(angle) * SPRING_ATTACH_X,
    center.y + Math.sin(angle) * SPRING_ATTACH_X,
    0
  );
}

export function createBoxingGloveModelV11(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV6();
  const group = model.group;
  group.userData.assetVersion = 'boxing-glove-v11';
  group.userData.referenceStyle = 'sculpted-boxing-glove-tim-physics';
  group.userData.motion = 'impulse-spring-gravity-damping';

  const legacyHead = group.getObjectByName('BoxingGloveV6DynamicHead') as THREE.Group | undefined;
  const spring = group.getObjectByName('BoxingGloveV6PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV6TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;
  if (!legacyHead || !spring || !button) throw new Error('Boxing Glove v11 mechanism parts were not found.');

  group.remove(legacyHead);
  const glove = createGloveHead();
  glove.name = 'BoxingGloveV11DynamicHead';
  group.add(glove);
  spring.name = 'BoxingGloveV11PhysicalSpring';
  button.name = 'BoxingGloveV11TriggerButton';

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
    setSpringPose(spring, new THREE.Vector3(ANCHOR.x, ANCHOR.y, 0), receiverWorld(center, angle));

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
