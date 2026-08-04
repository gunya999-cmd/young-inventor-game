import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, Circle, RevoluteJoint, Vec2, World, type Body, type Fixture } from 'planck';

const OPEN_HALF_ANGLE = 0.285;
const CLOSED_HALF_ANGLE = 0.018;
const FIXED_DT = 1 / 180;
const ROPE_SEGMENTS = 24;
const ROPE_START_X = -4.15;
const ROPE_END_X = 3.25;
const ROPE_Y = 0.02;

type EdgeSide = 'upper' | 'lower';
type FixtureTag = { kind: 'cut-edge'; side: EdgeSide };
type BodyTag = { kind: 'rope'; index: number } | { kind: 'weight' } | { kind: 'scissor-half'; side: EdgeSide };

function ringShape(rx: number, ry: number, holeRx: number, holeRy: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, holeRx, holeRy, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 64,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function bladeShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(-3.34, 0.005 * s);
  shape.bezierCurveTo(-2.72, 0.075 * s, -1.72, 0.175 * s, -0.72, 0.205 * s);
  shape.bezierCurveTo(-0.36, 0.215 * s, -0.08, 0.175 * s, 0.24, 0.105 * s);
  shape.lineTo(0.27, -0.085 * s);
  shape.bezierCurveTo(-0.25, -0.065 * s, -0.95, -0.045 * s, -1.78, -0.028 * s);
  shape.bezierCurveTo(-2.57, -0.012 * s, -3.06, -0.003 * s, -3.34, 0.005 * s);
  shape.closePath();
  return shape;
}

function cuttingFacetShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(-3.25, 0.004 * s);
  shape.bezierCurveTo(-2.55, 0.018 * s, -1.45, 0.055 * s, -0.42, 0.095 * s);
  shape.lineTo(0.12, 0.10 * s);
  shape.lineTo(-0.32, 0.145 * s);
  shape.bezierCurveTo(-1.35, 0.12 * s, -2.47, 0.055 * s, -3.25, 0.004 * s);
  shape.closePath();
  return shape;
}

function neckShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(0.13, -0.15 * s);
  shape.bezierCurveTo(0.50, -0.20 * s, 0.76, -0.24 * s, 1.03, -0.24 * s);
  shape.lineTo(1.19, -0.17 * s);
  shape.lineTo(1.20, 0.17 * s);
  shape.lineTo(1.02, 0.24 * s);
  shape.bezierCurveTo(0.73, 0.23 * s, 0.47, 0.19 * s, 0.13, 0.15 * s);
  shape.closePath();
  return shape;
}

function makeScissorHalf(sign: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const side: EdgeSide = sign > 0 ? 'upper' : 'lower';
  group.name = `Scissors_${side}`;

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xaeb8bf,
    metalness: 1,
    roughness: 0.24,
    clearcoat: 0.10,
    clearcoatRoughness: 0.28,
  });
  const cuttingSteel = new THREE.MeshPhysicalMaterial({
    color: 0xe9eef1,
    metalness: 1,
    roughness: 0.11,
    clearcoat: 0.13,
    clearcoatRoughness: 0.18,
  });
  const handle = new THREE.MeshPhysicalMaterial({
    color: 0x8f1820,
    metalness: 0.02,
    roughness: 0.34,
    clearcoat: 0.56,
    clearcoatRoughness: 0.22,
  });
  const gripMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x121618,
    metalness: 0,
    roughness: 0.78,
    clearcoat: 0.04,
  });

  const blade = new THREE.Mesh(extrude(bladeShape(sign), 0.078, 0.012), steel);
  blade.position.z = z;
  blade.name = 'Blade';
  group.add(blade);

  const facet = new THREE.Mesh(extrude(cuttingFacetShape(sign), 0.022, 0.004), cuttingSteel);
  facet.position.z = z + (sign > 0 ? 0.047 : -0.047);
  facet.name = 'CuttingFacet';
  group.add(facet);

  const neck = new THREE.Mesh(extrude(neckShape(sign), 0.105, 0.018), handle);
  neck.position.z = z;
  neck.name = 'HandleNeck';
  group.add(neck);

  const outerRx = sign > 0 ? 0.73 : 0.78;
  const outerRy = sign > 0 ? 0.405 : 0.43;
  const innerRx = sign > 0 ? 0.565 : 0.605;
  const innerRy = sign > 0 ? 0.285 : 0.305;
  const handleRing = new THREE.Mesh(extrude(ringShape(outerRx, outerRy, innerRx, innerRy), 0.125, 0.022), handle);
  handleRing.position.set(1.74, 0, z);
  handleRing.name = 'HandleRing';
  group.add(handleRing);

  const grip = new THREE.Mesh(extrude(ringShape(innerRx + 0.035, innerRy + 0.032, innerRx - 0.025, innerRy - 0.025), 0.139, 0.012), gripMaterial);
  grip.position.set(1.74, 0, z + (sign > 0 ? 0.004 : -0.004));
  grip.name = 'GripInsert';
  group.add(grip);

  const pivotCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.088, 64), steel);
  pivotCollar.rotation.x = Math.PI / 2;
  pivotCollar.position.set(0, 0, z);
  pivotCollar.name = 'PivotCollar';
  group.add(pivotCollar);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return group;
}

function makePivotScrew(): THREE.Group {
  const group = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd4dce1, metalness: 1, roughness: 0.17, clearcoat: 0.10 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242b2f, metalness: 0.78, roughness: 0.31 });

  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.065, 64), dark);
  washer.rotation.x = Math.PI / 2;
  group.add(washer);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.115, 64), steel);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.055;
  group.add(head);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.026, 0.022), dark);
  slot.position.z = 0.119;
  slot.rotation.z = -0.12;
  group.add(slot);
  return group;
}

function makeWeightVisual(): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x3d474e, metalness: 0.92, roughness: 0.31, clearcoat: 0.08 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.41, 0.64, 40), metal);
  body.castShadow = true;
  group.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.035, 10, 32), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.37;
  ring.castShadow = true;
  group.add(ring);
  return group;
}

function tagFixture(fixture: Fixture, tag: FixtureTag): Fixture {
  fixture.setUserData(tag);
  return fixture;
}

function getFixtureTag(fixture: Fixture): FixtureTag | undefined {
  return fixture.getUserData() as FixtureTag | undefined;
}

function getBodyTag(body: Body): BodyTag | undefined {
  return body.getUserData() as BodyTag | undefined;
}

export function installScissors3DLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const style = document.createElement('style');
  style.textContent = `
    .scissors3d-lab .bowling-ball-lab__stage { position: relative; }
    .scissors3d-lab canvas { width:100%; height:min(72vh,760px); display:block; touch-action:none; }
    .scissors3d-controls { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); display:flex; gap:12px; z-index:5; }
    .scissors3d-controls button { border:1px solid rgba(255,255,255,.18); border-radius:13px; padding:12px 20px; background:#11161b; color:#fff; font:700 14px/1 system-ui; box-shadow:0 10px 30px rgba(0,0,0,.28); }
    .scissors3d-controls button.primary { background:#d8a536; color:#15120a; border-color:#f4cb67; }
    .scissors3d-status { position:absolute; right:20px; bottom:22px; z-index:5; padding:10px 13px; border-radius:11px; color:#eef3f6; background:rgba(10,13,16,.82); font:600 12px/1.35 system-ui; backdrop-filter:blur(8px); }
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab scissors3d-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 20 · PHYSICAL 3D REVIEW</small><h1>Scissors / Ножницы</h1></div>
      <div class="bowling-ball-lab__meta"><span>slender geometry</span><span>PBR</span><span>Planck joints</span><span>physical rope</span><span>v3</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Scissors physical 3D preview" data-asset-version="scissors-3d-v3-physical"></canvas>
      <div class="scissors3d-controls"><button class="primary" data-action="toggle">Сжать ручки</button><button data-action="reset">Сбросить</button></div>
      <div class="scissors3d-status">Открыты · верёвка цела</div>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const status = root.querySelector<HTMLElement>('.scissors3d-status')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0x2d3338, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xf5f9fb, 0x4d565d, 1.0));

  const key = new THREE.DirectionalLight(0xfff3e3, 2.05);
  key.position.set(-4.4, 5.6, 6.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd4e6f0, 0.72);
  fill.position.set(4.5, 1.8, 4.7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd5ba, 0.48);
  rim.position.set(3.2, 4.4, -4.3);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.95, metalness: 0.01 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.25;
  floor.receiveShadow = true;
  scene.add(floor);

  const assembly = new THREE.Group();
  assembly.rotation.x = -0.055;
  assembly.rotation.y = 0.105;
  scene.add(assembly);

  const upperVisual = makeScissorHalf(1, 0.045);
  const lowerVisual = makeScissorHalf(-1, -0.045);
  assembly.add(lowerVisual, upperVisual, makePivotScrew());

  const ropeMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9b6b3e, roughness: 0.95, metalness: 0 });
  const segmentLength = (ROPE_END_X - ROPE_START_X) / ROPE_SEGMENTS;
  const ropeMeshes: THREE.Mesh[] = [];
  const ropeBodies: Body[] = [];
  const ropeJoints: any[] = [];

  const world = new World({ gravity: Vec2(0, -5.0), allowSleep: false });
  const ground = world.createBody();

  const upperBody = world.createBody({ type: 'dynamic', position: Vec2(0, 0), angle: OPEN_HALF_ANGLE, angularDamping: 1.4, linearDamping: 4 });
  upperBody.setUserData({ kind: 'scissor-half', side: 'upper' } satisfies BodyTag);
  upperBody.createFixture({ shape: Box(1.66, 0.095, Vec2(-1.64, 0.055), 0), density: 1.1, friction: 0.36 });
  upperBody.createFixture({ shape: Box(0.88, 0.28, Vec2(1.50, 0), 0), density: 0.55, friction: 0.45 });
  tagFixture(upperBody.createFixture({ shape: Box(1.43, 0.055, Vec2(-1.75, -0.075), 0), isSensor: true }), { kind: 'cut-edge', side: 'upper' });

  const lowerBody = world.createBody({ type: 'dynamic', position: Vec2(0, 0), angle: -OPEN_HALF_ANGLE, angularDamping: 1.4, linearDamping: 4 });
  lowerBody.setUserData({ kind: 'scissor-half', side: 'lower' } satisfies BodyTag);
  lowerBody.createFixture({ shape: Box(1.66, 0.095, Vec2(-1.64, -0.055), 0), density: 1.1, friction: 0.36 });
  lowerBody.createFixture({ shape: Box(0.90, 0.29, Vec2(1.50, 0), 0), density: 0.58, friction: 0.45 });
  tagFixture(lowerBody.createFixture({ shape: Box(1.43, 0.055, Vec2(-1.75, 0.075), 0), isSensor: true }), { kind: 'cut-edge', side: 'lower' });

  const upperJoint = world.createJoint(RevoluteJoint({
    enableLimit: true,
    lowerAngle: CLOSED_HALF_ANGLE,
    upperAngle: OPEN_HALF_ANGLE,
    enableMotor: true,
    motorSpeed: 0,
    maxMotorTorque: 15,
  }, ground, upperBody, Vec2(0, 0)))!;

  const lowerJoint = world.createJoint(RevoluteJoint({
    enableLimit: true,
    lowerAngle: -OPEN_HALF_ANGLE,
    upperAngle: -CLOSED_HALF_ANGLE,
    enableMotor: true,
    motorSpeed: 0,
    maxMotorTorque: 15,
  }, ground, lowerBody, Vec2(0, 0)))!;

  for (let i = 0; i < ROPE_SEGMENTS; i += 1) {
    const x = ROPE_START_X + segmentLength * (i + 0.5);
    const body = world.createBody({ type: 'dynamic', position: Vec2(x, ROPE_Y), linearDamping: 0.12, angularDamping: 0.05 });
    body.setUserData({ kind: 'rope', index: i } satisfies BodyTag);
    body.createFixture({ shape: Box(segmentLength * 0.49, 0.035), density: 0.16, friction: 0.54, restitution: 0.01 });
    ropeBodies.push(body);

    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, segmentLength * 0.99, 12), ropeMaterial);
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    assembly.add(mesh);
    ropeMeshes.push(mesh);

    if (i === 0) {
      ropeJoints.push(world.createJoint(RevoluteJoint({}, ground, body, Vec2(ROPE_START_X, ROPE_Y)))!);
    } else {
      const anchorX = ROPE_START_X + segmentLength * i;
      ropeJoints.push(world.createJoint(RevoluteJoint({}, ropeBodies[i - 1], body, Vec2(anchorX, ROPE_Y)))!);
    }
  }

  const weightBody = world.createBody({ type: 'dynamic', position: Vec2(3.52, -0.62), linearDamping: 0.03, angularDamping: 0.08 });
  weightBody.setUserData({ kind: 'weight' } satisfies BodyTag);
  weightBody.createFixture({ shape: Box(0.34, 0.34), density: 7.5, friction: 0.65, restitution: 0.04 });
  const weightVisual = makeWeightVisual();
  assembly.add(weightVisual);
  const weightJoint = world.createJoint(RevoluteJoint({}, ropeBodies[ROPE_SEGMENTS - 1], weightBody, Vec2(ROPE_END_X, ROPE_Y)))!;

  const upperContacts = new Set<number>();
  const lowerContacts = new Set<number>();
  let ropeCut = false;
  let cutIndex = -1;

  const processContact = (fixtureA: Fixture, fixtureB: Fixture, entering: boolean): void => {
    const edgeA = getFixtureTag(fixtureA);
    const edgeB = getFixtureTag(fixtureB);
    const ropeA = getBodyTag(fixtureA.getBody());
    const ropeB = getBodyTag(fixtureB.getBody());

    const edge = edgeA?.kind === 'cut-edge' ? edgeA : edgeB?.kind === 'cut-edge' ? edgeB : undefined;
    const rope = ropeA?.kind === 'rope' ? ropeA : ropeB?.kind === 'rope' ? ropeB : undefined;
    if (!edge || !rope) return;

    const set = edge.side === 'upper' ? upperContacts : lowerContacts;
    if (entering) set.add(rope.index);
    else set.delete(rope.index);
  };

  world.on('begin-contact', (contact) => processContact(contact.getFixtureA(), contact.getFixtureB(), true));
  world.on('end-contact', (contact) => processContact(contact.getFixtureA(), contact.getFixtureB(), false));

  let closingRequested = false;

  const resetPhysics = (): void => {
    upperBody.setTransform(Vec2(0, 0), OPEN_HALF_ANGLE);
    lowerBody.setTransform(Vec2(0, 0), -OPEN_HALF_ANGLE);
    upperBody.setAngularVelocity(0);
    lowerBody.setAngularVelocity(0);
    upperBody.setLinearVelocity(Vec2(0, 0));
    lowerBody.setLinearVelocity(Vec2(0, 0));

    for (let i = 0; i < ROPE_SEGMENTS; i += 1) {
      const x = ROPE_START_X + segmentLength * (i + 0.5);
      ropeBodies[i].setTransform(Vec2(x, ROPE_Y), 0);
      ropeBodies[i].setLinearVelocity(Vec2(0, 0));
      ropeBodies[i].setAngularVelocity(0);
    }
    weightBody.setTransform(Vec2(3.52, -0.62), 0);
    weightBody.setLinearVelocity(Vec2(0, 0));
    weightBody.setAngularVelocity(0);

    if (ropeCut && cutIndex >= 0) {
      const left = ropeBodies[cutIndex];
      if (cutIndex < ROPE_SEGMENTS - 1) {
        const right = ropeBodies[cutIndex + 1];
        const anchorX = ROPE_START_X + segmentLength * (cutIndex + 1);
        ropeJoints[cutIndex + 1] = world.createJoint(RevoluteJoint({}, left, right, Vec2(anchorX, ROPE_Y)))!;
      } else {
        world.createJoint(RevoluteJoint({}, left, weightBody, Vec2(ROPE_END_X, ROPE_Y)));
      }
    }

    ropeCut = false;
    cutIndex = -1;
    closingRequested = false;
    upperContacts.clear();
    lowerContacts.clear();
    toggleButton.textContent = 'Сжать ручки';
    status.textContent = 'Открыты · верёвка цела';
  };

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  const defaultCamera = new THREE.Vector3(0.20, 1.05, 9.4);
  camera.position.copy(defaultCamera);
  camera.lookAt(0.0, -0.08, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 5.4;
  controls.maxDistance = 13;
  controls.target.set(0, -0.08, 0);
  controls.update();

  toggleButton.addEventListener('click', () => {
    closingRequested = !closingRequested;
    toggleButton.textContent = closingRequested ? 'Отпустить ручки' : 'Сжать ручки';
  });

  resetButton.addEventListener('click', () => {
    camera.position.copy(defaultCamera);
    controls.target.set(0, -0.08, 0);
    controls.update();
    resetPhysics();
  });

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const commandJoint = (joint: any, target: number): void => {
    const current = joint.getJointAngle();
    const error = target - current;
    const speed = THREE.MathUtils.clamp(error * 11.5, -3.6, 3.6);
    joint.setMotorSpeed(speed);
    joint.setMaxMotorTorque(18);
    joint.enableMotor(true);
  };

  const maybeCutRope = (): void => {
    if (ropeCut || !closingRequested) return;
    const candidates = [...upperContacts].filter((index) => lowerContacts.has(index) || lowerContacts.has(index - 1) || lowerContacts.has(index + 1));
    if (candidates.length === 0) return;

    const index = candidates.sort((a, b) => Math.abs(a - ROPE_SEGMENTS * 0.43) - Math.abs(b - ROPE_SEGMENTS * 0.43))[0];
    cutIndex = Math.min(index, ROPE_SEGMENTS - 1);

    if (cutIndex < ROPE_SEGMENTS - 1) {
      const jointIndex = cutIndex + 1;
      const joint = ropeJoints[jointIndex];
      if (joint) {
        world.destroyJoint(joint);
        ropeJoints[jointIndex] = null;
      }
    } else {
      world.destroyJoint(weightJoint);
    }
    ropeCut = true;
  };

  let previous = performance.now();
  let accumulator = 0;
  const animate = (now: number): void => {
    const wallDt = Math.min(0.045, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator += wallDt;

    const upperTarget = closingRequested ? CLOSED_HALF_ANGLE : OPEN_HALF_ANGLE;
    const lowerTarget = closingRequested ? -CLOSED_HALF_ANGLE : -OPEN_HALF_ANGLE;

    while (accumulator >= FIXED_DT) {
      commandJoint(upperJoint, upperTarget);
      commandJoint(lowerJoint, lowerTarget);
      world.step(FIXED_DT, 12, 5);
      maybeCutRope();
      accumulator -= FIXED_DT;
    }

    upperVisual.rotation.z = upperBody.getAngle();
    lowerVisual.rotation.z = lowerBody.getAngle();

    for (let i = 0; i < ROPE_SEGMENTS; i += 1) {
      const p = ropeBodies[i].getPosition();
      ropeMeshes[i].position.set(p.x, p.y, -0.14);
      ropeMeshes[i].rotation.set(0, 0, ropeBodies[i].getAngle() + Math.PI / 2);
    }

    const wp = weightBody.getPosition();
    weightVisual.position.set(wp.x, wp.y, -0.14);
    weightVisual.rotation.z = weightBody.getAngle();

    const relativeOpening = Math.abs(upperJoint.getJointAngle() - lowerJoint.getJointAngle());
    const state = relativeOpening < 0.09 ? 'Закрыты' : relativeOpening > 0.48 ? 'Открыты' : 'Движение';
    status.textContent = `${state} · ${ropeCut ? 'верёвка физически разорвана' : 'верёвка цела'}`;
    canvas.dataset.relativeOpening = relativeOpening.toFixed(4);
    canvas.dataset.ropeCut = ropeCut ? 'true' : 'false';
    canvas.dataset.physics = 'planck-revolute-motor-chain';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
