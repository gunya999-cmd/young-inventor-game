import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, RevoluteJoint, Vec2, World, type Body } from 'planck';

const OPEN_HALF_ANGLE = 0.285;
const CLOSED_HALF_ANGLE = 0.018;
const FIXED_DT = 1 / 180;
const ROPE_NODES = 35;
const ROPE_START = new THREE.Vector2(-4.15, 0.06);
const ROPE_END = new THREE.Vector2(3.55, -0.08);
const ROPE_SAG = 0.18;
const ROPE_RADIUS = 0.045;
const ROPE_GRAVITY = -4.8;

type RopeNode = {
  p: THREE.Vector2;
  prev: THREE.Vector2;
  pinned?: THREE.Vector2;
};

function ringShape(rx: number, ry: number, holeRx: number, holeRy: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, holeRx, holeRy, 0, Math.PI * 2, true, 0);
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
  group.name = sign > 0 ? 'Scissors_Upper' : 'Scissors_Lower';

  const steel = new THREE.MeshPhysicalMaterial({ color: 0xaeb8bf, metalness: 1, roughness: 0.24, clearcoat: 0.10, clearcoatRoughness: 0.28 });
  const cuttingSteel = new THREE.MeshPhysicalMaterial({ color: 0xe9eef1, metalness: 1, roughness: 0.11, clearcoat: 0.13, clearcoatRoughness: 0.18 });
  const handle = new THREE.MeshPhysicalMaterial({ color: 0x8f1820, metalness: 0.02, roughness: 0.34, clearcoat: 0.56, clearcoatRoughness: 0.22 });
  const gripMaterial = new THREE.MeshPhysicalMaterial({ color: 0x121618, metalness: 0, roughness: 0.78, clearcoat: 0.04 });

  const blade = new THREE.Mesh(extrude(bladeShape(sign), 0.078, 0.012), steel);
  blade.position.z = z;
  group.add(blade);

  const facet = new THREE.Mesh(extrude(cuttingFacetShape(sign), 0.022, 0.004), cuttingSteel);
  facet.position.z = z + (sign > 0 ? 0.047 : -0.047);
  group.add(facet);

  const neck = new THREE.Mesh(extrude(neckShape(sign), 0.105, 0.018), handle);
  neck.position.z = z;
  group.add(neck);

  const outerRx = sign > 0 ? 0.73 : 0.78;
  const outerRy = sign > 0 ? 0.405 : 0.43;
  const innerRx = sign > 0 ? 0.565 : 0.605;
  const innerRy = sign > 0 ? 0.285 : 0.305;

  const handleRing = new THREE.Mesh(extrude(ringShape(outerRx, outerRy, innerRx, innerRy), 0.125, 0.022), handle);
  handleRing.position.set(1.74, 0, z);
  group.add(handleRing);

  const grip = new THREE.Mesh(extrude(ringShape(innerRx + 0.035, innerRy + 0.032, innerRx - 0.025, innerRy - 0.025), 0.139, 0.012), gripMaterial);
  grip.position.set(1.74, 0, z + (sign > 0 ? 0.004 : -0.004));
  group.add(grip);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.088, 64), steel);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0, z);
  group.add(collar);

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

function makeAnchorVisual(): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x555f66, metalness: 0.9, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.038, 10, 32), metal);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 20), metal);
  pin.rotation.z = Math.PI / 2;
  pin.position.x = -0.12;
  group.add(pin);
  return group;
}

function initialRopeNodes(): RopeNode[] {
  return Array.from({ length: ROPE_NODES }, (_, i) => {
    const t = i / (ROPE_NODES - 1);
    const x = THREE.MathUtils.lerp(ROPE_START.x, ROPE_END.x, t);
    const baseY = THREE.MathUtils.lerp(ROPE_START.y, ROPE_END.y, t);
    const y = baseY - Math.sin(Math.PI * t) * ROPE_SAG;
    const p = new THREE.Vector2(x, y);
    const node: RopeNode = { p: p.clone(), prev: p.clone() };
    if (i === 0 || i === ROPE_NODES - 1) node.pinned = p.clone();
    return node;
  });
}

function pointSegmentDistance(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): number {
  const ab = b.clone().sub(a);
  const denom = ab.lengthSq();
  if (denom < 1e-9) return p.distanceTo(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / denom, 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

function orient(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, d: THREE.Vector2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 <= 0 && o3 * o4 <= 0;
}

function segmentDistance(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, d: THREE.Vector2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function bodyPoint(body: Body, x: number, y: number): THREE.Vector2 {
  const p = body.getWorldPoint(Vec2(x, y));
  return new THREE.Vector2(p.x, p.y);
}

export function installScissors3DLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const style = document.createElement('style');
  style.textContent = `
    .scissors3d-lab .bowling-ball-lab__stage { position:relative; }
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
      <div class="bowling-ball-lab__meta"><span>slender geometry</span><span>PBR</span><span>Planck hinge</span><span>Verlet rope</span><span>v5</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Scissors physical 3D preview" data-asset-version="scissors-3d-v5-hinge-verlet"></canvas>
      <div class="scissors3d-controls"><button class="primary" data-action="toggle">Сжать ручки</button><button data-action="reset">Сбросить</button></div>
      <div class="scissors3d-status">Открыты · верёвка натянута</div>
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

  const leftAnchorVisual = makeAnchorVisual();
  leftAnchorVisual.position.set(ROPE_START.x, ROPE_START.y, -0.14);
  assembly.add(leftAnchorVisual);

  const rightAnchorVisual = makeAnchorVisual();
  rightAnchorVisual.rotation.z = Math.PI;
  rightAnchorVisual.position.set(ROPE_END.x, ROPE_END.y, -0.14);
  assembly.add(rightAnchorVisual);

  const world = new World({ gravity: Vec2(0, 0), allowSleep: false });
  const ground = world.createBody();

  // Create bodies at zero angle first so revolute-joint reference angles are exactly zero.
  const upperBody = world.createBody({ type: 'dynamic', position: Vec2(0, 0), angle: 0, angularDamping: 1.7, linearDamping: 4 });
  upperBody.createFixture({ shape: Box(1.66, 0.095, Vec2(-1.64, 0.055), 0), density: 1.1, friction: 0.36 });
  upperBody.createFixture({ shape: Box(0.88, 0.28, Vec2(1.50, 0), 0), density: 0.55, friction: 0.45 });

  const lowerBody = world.createBody({ type: 'dynamic', position: Vec2(0, 0), angle: 0, angularDamping: 1.7, linearDamping: 4 });
  lowerBody.createFixture({ shape: Box(1.66, 0.095, Vec2(-1.64, -0.055), 0), density: 1.1, friction: 0.36 });
  lowerBody.createFixture({ shape: Box(0.90, 0.29, Vec2(1.50, 0), 0), density: 0.58, friction: 0.45 });

  const upperJoint = world.createJoint(RevoluteJoint({
    enableLimit: true,
    lowerAngle: CLOSED_HALF_ANGLE,
    upperAngle: OPEN_HALF_ANGLE,
    enableMotor: true,
    motorSpeed: 0,
    maxMotorTorque: 28,
  }, ground, upperBody, Vec2(0, 0)))!;

  const lowerJoint = world.createJoint(RevoluteJoint({
    enableLimit: true,
    lowerAngle: -OPEN_HALF_ANGLE,
    upperAngle: -CLOSED_HALF_ANGLE,
    enableMotor: true,
    motorSpeed: 0,
    maxMotorTorque: 28,
  }, ground, lowerBody, Vec2(0, 0)))!;

  let ropeNodes = initialRopeNodes();
  const restLengths = Array.from({ length: ROPE_NODES - 1 }, (_, i) => ropeNodes[i].p.distanceTo(ropeNodes[i + 1].p));
  const activeLinks = Array.from({ length: ROPE_NODES - 1 }, () => true);
  let cutLink = -1;
  let closingRequested = false;

  const ropeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xa97843, roughness: 0.92, metalness: 0, clearcoat: 0.02 });
  const ropeWholeMesh = new THREE.Mesh(new THREE.BufferGeometry(), ropeMaterial);
  const ropeLeftMesh = new THREE.Mesh(new THREE.BufferGeometry(), ropeMaterial);
  const ropeRightMesh = new THREE.Mesh(new THREE.BufferGeometry(), ropeMaterial);
  for (const mesh of [ropeWholeMesh, ropeLeftMesh, ropeRightMesh]) {
    mesh.castShadow = true;
    assembly.add(mesh);
  }
  ropeLeftMesh.visible = false;
  ropeRightMesh.visible = false;

  const setTube = (mesh: THREE.Mesh, points: THREE.Vector3[]): void => {
    const old = mesh.geometry;
    if (points.length < 2) {
      mesh.visible = false;
      old.dispose();
      return;
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
    mesh.geometry = new THREE.TubeGeometry(curve, Math.max(36, points.length * 5), ROPE_RADIUS, 10, false);
    old.dispose();
    mesh.visible = true;
  };

  const ropePoints3 = (from: number, toInclusive: number): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = from; i <= toInclusive; i += 1) {
      points.push(new THREE.Vector3(ropeNodes[i].p.x, ropeNodes[i].p.y, -0.14));
    }
    return points;
  };

  const solveRope = (dt: number): void => {
    const damping = 0.997;
    for (const node of ropeNodes) {
      if (node.pinned) {
        node.p.copy(node.pinned);
        node.prev.copy(node.pinned);
        continue;
      }
      const velocity = node.p.clone().sub(node.prev).multiplyScalar(damping);
      const current = node.p.clone();
      node.p.add(velocity);
      node.p.y += ROPE_GRAVITY * dt * dt;
      node.prev.copy(current);
    }

    for (let iteration = 0; iteration < 14; iteration += 1) {
      for (let i = 0; i < ROPE_NODES - 1; i += 1) {
        if (!activeLinks[i]) continue;
        const a = ropeNodes[i];
        const b = ropeNodes[i + 1];
        const delta = b.p.clone().sub(a.p);
        const distance = Math.max(1e-7, delta.length());
        const error = (distance - restLengths[i]) / distance;

        if (a.pinned && b.pinned) continue;
        if (a.pinned) {
          b.p.addScaledVector(delta, -error);
        } else if (b.pinned) {
          a.p.addScaledVector(delta, error);
        } else {
          a.p.addScaledVector(delta, error * 0.5);
          b.p.addScaledVector(delta, -error * 0.5);
        }
      }

      for (const node of ropeNodes) {
        if (node.pinned) node.p.copy(node.pinned);
      }
    }
  };

  const commandJoint = (joint: any, target: number): void => {
    const current = joint.getJointAngle();
    const error = target - current;
    const speed = THREE.MathUtils.clamp(error * 14, -4.8, 4.8);
    joint.setMotorSpeed(speed);
    joint.setMaxMotorTorque(28);
    joint.enableMotor(true);
  };

  const cuttingEdges = (): { upperA: THREE.Vector2; upperB: THREE.Vector2; lowerA: THREE.Vector2; lowerB: THREE.Vector2 } => ({
    upperA: bodyPoint(upperBody, -3.10, -0.015),
    upperB: bodyPoint(upperBody, -0.38, -0.070),
    lowerA: bodyPoint(lowerBody, -3.10, 0.015),
    lowerB: bodyPoint(lowerBody, -0.38, 0.070),
  });

  const maybeCutRope = (): void => {
    if (cutLink >= 0 || !closingRequested) return;

    const opening = Math.abs(upperBody.getAngle() - lowerBody.getAngle());
    if (opening > 0.15) return;

    const edges = cuttingEdges();
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < ROPE_NODES - 1; i += 1) {
      if (!activeLinks[i]) continue;
      const a = ropeNodes[i].p;
      const b = ropeNodes[i + 1].p;
      const upperDistance = segmentDistance(a, b, edges.upperA, edges.upperB);
      const lowerDistance = segmentDistance(a, b, edges.lowerA, edges.lowerB);
      const score = Math.max(upperDistance, lowerDistance);
      if (score < ROPE_RADIUS * 1.45 && score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      activeLinks[bestIndex] = false;
      cutLink = bestIndex;
      ropeWholeMesh.visible = false;
      ropeLeftMesh.visible = true;
      ropeRightMesh.visible = true;
    }
  };

  const resetPhysics = (): void => {
    upperBody.setTransform(Vec2(0, 0), OPEN_HALF_ANGLE);
    lowerBody.setTransform(Vec2(0, 0), -OPEN_HALF_ANGLE);
    upperBody.setAngularVelocity(0);
    lowerBody.setAngularVelocity(0);
    upperBody.setLinearVelocity(Vec2(0, 0));
    lowerBody.setLinearVelocity(Vec2(0, 0));

    ropeNodes = initialRopeNodes();
    activeLinks.fill(true);
    cutLink = -1;
    closingRequested = false;
    toggleButton.textContent = 'Сжать ручки';
    status.textContent = 'Открыты · верёвка натянута';
    ropeWholeMesh.visible = true;
    ropeLeftMesh.visible = false;
    ropeRightMesh.visible = false;
    canvas.dataset.command = 'open';
  };

  toggleButton.addEventListener('click', () => {
    closingRequested = !closingRequested;
    toggleButton.textContent = closingRequested ? 'Отпустить ручки' : 'Сжать ручки';
    canvas.dataset.command = closingRequested ? 'closing' : 'opening';
  });

  resetButton.addEventListener('click', resetPhysics);

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

  const updateRopeVisual = (): void => {
    if (cutLink < 0) {
      setTube(ropeWholeMesh, ropePoints3(0, ROPE_NODES - 1));
      return;
    }
    setTube(ropeLeftMesh, ropePoints3(0, cutLink));
    setTube(ropeRightMesh, ropePoints3(cutLink + 1, ROPE_NODES - 1));
  };

  resetPhysics();

  let previous = performance.now();
  let accumulator = 0;
  let lastRopeRender = 0;

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
      solveRope(FIXED_DT);
      maybeCutRope();
      accumulator -= FIXED_DT;
    }

    upperVisual.rotation.z = upperBody.getAngle();
    lowerVisual.rotation.z = lowerBody.getAngle();

    if (now - lastRopeRender >= 16) {
      updateRopeVisual();
      lastRopeRender = now;
    }

    const relativeOpening = Math.abs(upperBody.getAngle() - lowerBody.getAngle());
    const state = relativeOpening < 0.07 ? 'Закрыты' : relativeOpening > 0.50 ? 'Открыты' : 'Движение';
    status.textContent = `${state} · ${cutLink >= 0 ? 'верёвка физически разрезана' : 'верёвка натянута и цела'}`;

    canvas.dataset.upperAngle = upperBody.getAngle().toFixed(4);
    canvas.dataset.lowerAngle = lowerBody.getAngle().toFixed(4);
    canvas.dataset.relativeOpening = relativeOpening.toFixed(4);
    canvas.dataset.ropeCut = cutLink >= 0 ? 'true' : 'false';
    canvas.dataset.physics = 'planck-zero-reference-hinge+verlet-rope-v5';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}
