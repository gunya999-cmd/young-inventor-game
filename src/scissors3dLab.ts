import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const OPEN_ANGLE = 0.36;
const CLOSED_ANGLE = 0.025;

function ellipseRingShape(rx: number, ry: number, holeRx: number, holeRy: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, holeRx, holeRy, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  return shape;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.035): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function bladeShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(-2.75, 0.015 * s);
  shape.bezierCurveTo(-2.25, 0.11 * s, -1.35, 0.27 * s, -0.46, 0.35 * s);
  shape.bezierCurveTo(-0.20, 0.37 * s, 0.02, 0.31 * s, 0.18, 0.22 * s);
  shape.lineTo(0.20, -0.17 * s);
  shape.bezierCurveTo(-0.24, -0.12 * s, -0.82, -0.075 * s, -1.55, -0.045 * s);
  shape.bezierCurveTo(-2.15, -0.018 * s, -2.56, -0.002 * s, -2.75, 0.015 * s);
  shape.closePath();
  return shape;
}

function bladeEdgeShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(-2.69, 0.012 * s);
  shape.bezierCurveTo(-2.15, 0.015 * s, -1.26, 0.055 * s, -0.34, 0.125 * s);
  shape.lineTo(0.08, 0.17 * s);
  shape.lineTo(-0.33, 0.235 * s);
  shape.bezierCurveTo(-1.24, 0.17 * s, -2.08, 0.08 * s, -2.69, 0.012 * s);
  shape.closePath();
  return shape;
}

function neckShape(sign: number): THREE.Shape {
  const s = sign;
  const shape = new THREE.Shape();
  shape.moveTo(-0.02, -0.24 * s);
  shape.lineTo(0.82, -0.34 * s);
  shape.lineTo(1.10, -0.24 * s);
  shape.lineTo(1.08, 0.24 * s);
  shape.lineTo(0.82, 0.35 * s);
  shape.lineTo(-0.02, 0.27 * s);
  shape.closePath();
  return shape;
}

function makeScissorHalf(sign: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = sign > 0 ? 'Scissors_UpperHalf' : 'Scissors_LowerHalf';

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xb9c2c8,
    metalness: 1,
    roughness: 0.20,
    clearcoat: 0.16,
    clearcoatRoughness: 0.24,
  });
  const cuttingSteel = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f7,
    metalness: 1,
    roughness: 0.10,
    clearcoat: 0.22,
    clearcoatRoughness: 0.14,
  });
  const red = new THREE.MeshPhysicalMaterial({
    color: 0xb80d15,
    metalness: 0.03,
    roughness: 0.24,
    clearcoat: 0.92,
    clearcoatRoughness: 0.16,
  });
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x101417,
    metalness: 0.02,
    roughness: 0.72,
    clearcoat: 0.08,
  });

  const blade = new THREE.Mesh(extrude(bladeShape(sign), 0.105, 0.018), steel);
  blade.name = 'Scissors_Blade';
  blade.position.z = z;
  group.add(blade);

  const edge = new THREE.Mesh(extrude(bladeEdgeShape(sign), 0.018, 0.006), cuttingSteel);
  edge.name = 'Scissors_CuttingBevel';
  edge.position.z = z + (sign > 0 ? 0.062 : -0.062);
  group.add(edge);

  const neck = new THREE.Mesh(extrude(neckShape(sign), 0.19, 0.038), red);
  neck.name = 'Scissors_HandleNeck';
  neck.position.set(0.58, 0, z);
  group.add(neck);

  const handleOuter = new THREE.Mesh(extrude(ellipseRingShape(0.92, 0.61, 0.59, 0.35), 0.22, 0.052), red);
  handleOuter.name = 'Scissors_RedHandle';
  handleOuter.position.set(1.72, 0, z);
  group.add(handleOuter);

  const grip = new THREE.Mesh(extrude(ellipseRingShape(0.61, 0.37, 0.47, 0.265), 0.245, 0.038), rubber);
  grip.name = 'Scissors_RubberGrip';
  grip.position.set(1.72, 0, z + (sign > 0 ? 0.012 : -0.012));
  group.add(grip);

  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.15, 64), steel);
  ferrule.rotation.x = Math.PI / 2;
  ferrule.position.set(0, 0, z);
  ferrule.name = 'Scissors_PivotFerrule';
  group.add(ferrule);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return group;
}

function makePivotScrew(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Scissors_PivotScrew';
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xd9e0e4,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0.22,
    clearcoatRoughness: 0.18,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: 0.72, roughness: 0.30 });

  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.10, 72), dark);
  washer.rotation.x = Math.PI / 2;
  group.add(washer);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.18, 72), metal);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.065;
  group.add(head);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.045, 0.035), dark);
  slot.position.set(0, 0, 0.175);
  slot.rotation.z = -0.18;
  group.add(slot);
  return group;
}

function makeRopeSegment(x0: number, x1: number, y: number): THREE.Mesh {
  const points = [
    new THREE.Vector3(x0, y, -0.18),
    new THREE.Vector3((x0 + x1) * 0.5, y - 0.02, -0.18),
    new THREE.Vector3(x1, y, -0.18),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const material = new THREE.MeshPhysicalMaterial({ color: 0x9b6a38, roughness: 0.93, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.055, 10, false), material);
  mesh.castShadow = true;
  return mesh;
}

function makeWeight(): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x3d464d, metalness: 0.88, roughness: 0.35, clearcoat: 0.10 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.48, 0.72, 36), metal);
  body.castShadow = true;
  group.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 12, 36), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.44;
  ring.castShadow = true;
  group.add(ring);
  return group;
}

export function installScissors3DLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const style = document.createElement('style');
  style.textContent = `
    .scissors3d-lab .bowling-ball-lab__stage { position: relative; }
    .scissors3d-lab canvas { width: 100%; height: min(72vh, 760px); display:block; touch-action:none; }
    .scissors3d-controls { position:absolute; left:50%; bottom:26px; transform:translateX(-50%); display:flex; gap:12px; z-index:5; }
    .scissors3d-controls button { border:1px solid rgba(255,255,255,.18); border-radius:14px; padding:12px 22px; background:#11161b; color:#fff; font:700 15px/1 system-ui; box-shadow:0 10px 30px rgba(0,0,0,.28); }
    .scissors3d-controls button.primary { background:#e5ad37; color:#15120a; border-color:#ffd66e; }
    .scissors3d-status { position:absolute; right:22px; bottom:24px; z-index:5; padding:10px 14px; border-radius:12px; color:#eef3f6; background:rgba(10,13,16,.80); font:600 13px/1.35 system-ui; backdrop-filter:blur(8px); }
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab scissors3d-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 20 · FULL 3D REVIEW</small><h1>Scissors / Ножницы</h1></div>
      <div class="bowling-ball-lab__meta"><span>real geometry</span><span>PBR</span><span>free 3D orbit</span><span>separate halves</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Scissors full 3D preview" data-asset-version="scissors-3d-v2"></canvas>
      <div class="scissors3d-controls"><button class="primary" data-action="toggle">Закрыть</button><button data-action="reset">Сбросить камеру</button></div>
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
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x30363b, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xf7fbff, 0x555e66, 1.10));

  const key = new THREE.DirectionalLight(0xfff2df, 2.5);
  key.position.set(-4.2, 6.0, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe7f5, 0.95);
  fill.position.set(5.0, 1.5, 5.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffcfaa, 0.78);
  rim.position.set(3.0, 5.0, -5.0);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({ color: 0x343a3f, roughness: 0.92, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.05;
  floor.receiveShadow = true;
  scene.add(floor);

  const assembly = new THREE.Group();
  assembly.rotation.x = -0.08;
  assembly.rotation.y = 0.16;
  scene.add(assembly);

  const upper = makeScissorHalf(1, 0.07);
  const lower = makeScissorHalf(-1, -0.07);
  assembly.add(lower, upper, makePivotScrew());

  const ropeLeft = makeRopeSegment(-3.6, -0.16, -0.05);
  const ropeRight = makeRopeSegment(0.16, 3.5, -0.05);
  assembly.add(ropeLeft, ropeRight);
  const bridge = makeRopeSegment(-0.18, 0.18, -0.05);
  assembly.add(bridge);

  const weight = makeWeight();
  weight.position.set(3.55, -0.78, -0.18);
  assembly.add(weight);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  const defaultCamera = new THREE.Vector3(0.3, 1.1, 8.8);
  camera.position.copy(defaultCamera);
  camera.lookAt(0.1, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 5.2;
  controls.maxDistance = 13;
  controls.target.set(0.2, -0.05, 0);
  controls.update();

  let angle = OPEN_ANGLE;
  let angularVelocity = 0;
  let targetAngle = OPEN_ANGLE;
  let ropeCut = false;
  let weightVy = 0;
  let weightY = weight.position.y;

  const resetState = (): void => {
    angle = OPEN_ANGLE;
    angularVelocity = 0;
    targetAngle = OPEN_ANGLE;
    ropeCut = false;
    bridge.visible = true;
    weightVy = 0;
    weightY = -0.78;
    weight.position.y = weightY;
    toggleButton.textContent = 'Закрыть';
    status.textContent = 'Открыты · верёвка цела';
  };

  toggleButton.addEventListener('click', () => {
    const closing = targetAngle > 0.1;
    targetAngle = closing ? CLOSED_ANGLE : OPEN_ANGLE;
    toggleButton.textContent = closing ? 'Открыть' : 'Закрыть';
  });
  resetButton.addEventListener('click', () => {
    camera.position.copy(defaultCamera);
    controls.target.set(0.2, -0.05, 0);
    controls.update();
    resetState();
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

  let previous = performance.now();
  const animate = (now: number): void => {
    const dt = Math.min(0.033, Math.max(0, (now - previous) / 1000));
    previous = now;

    const stiffness = 52;
    const damping = 11.5;
    const acceleration = (targetAngle - angle) * stiffness - angularVelocity * damping;
    angularVelocity += acceleration * dt;
    angle += angularVelocity * dt;
    angle = THREE.MathUtils.clamp(angle, CLOSED_ANGLE, OPEN_ANGLE + 0.03);

    upper.rotation.z = angle;
    lower.rotation.z = -angle;

    if (!ropeCut && angle < 0.075) {
      ropeCut = true;
      bridge.visible = false;
      weightVy = -0.25;
    }

    if (ropeCut) {
      weightVy -= 3.8 * dt;
      weightY += weightVy * dt;
      if (weightY < -1.58) {
        weightY = -1.58;
        weightVy *= -0.12;
      }
      weight.position.y = weightY;
    }

    const state = angle < 0.08 ? 'Закрыты' : angle > 0.30 ? 'Открыты' : 'Движение';
    status.textContent = `${state} · ${ropeCut ? 'верёвка перерезана' : 'верёвка цела'}`;
    canvas.dataset.openAngle = angle.toFixed(4);
    canvas.dataset.ropeCut = ropeCut ? 'true' : 'false';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}