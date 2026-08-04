import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type ReviewCanvas = HTMLCanvasElement & {
  __pluckRope?: () => void;
};

type RopeNode = {
  p: THREE.Vector3;
  prev: THREE.Vector3;
  pinned?: THREE.Vector3;
};

const NODE_COUNT = 34;
const ROPE_LENGTH = 4.1;
const REST_LENGTH = ROPE_LENGTH / (NODE_COUNT - 1);
const STRAND_RADIUS = 0.032;
const BRAID_RADIUS = 0.046;

function makeInitialNodes(): RopeNode[] {
  const nodes: RopeNode[] = [];
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const t = i / (NODE_COUNT - 1);
    const x = THREE.MathUtils.lerp(-1.62, 1.62, t);
    const y = 0.68 - Math.sin(Math.PI * t) * 0.92;
    const z = Math.sin(Math.PI * t * 2) * 0.025;
    const p = new THREE.Vector3(x, y, z);
    nodes.push({ p: p.clone(), prev: p.clone() });
  }
  nodes[0].pinned = nodes[0].p.clone();
  nodes[NODE_COUNT - 1].pinned = nodes[NODE_COUNT - 1].p.clone();
  return nodes;
}

function solveDistance(a: RopeNode, b: RopeNode): void {
  const delta = b.p.clone().sub(a.p);
  const distance = Math.max(0.0001, delta.length());
  const error = (distance - REST_LENGTH) / distance;
  const correction = delta.multiplyScalar(0.5 * error);
  if (!a.pinned) a.p.add(correction);
  if (!b.pinned) b.p.sub(correction);
}

function createStrandPoints(nodes: RopeNode[], phase: number): THREE.Vector3[] {
  return nodes.map((node, index) => {
    const prev = nodes[Math.max(0, index - 1)].p;
    const next = nodes[Math.min(nodes.length - 1, index + 1)].p;
    const tangent = next.clone().sub(prev).normalize();

    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0);
    if (normal.lengthSq() < 0.0001) normal.set(0, 1, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const twist = phase + index * 1.18;
    return node.p.clone()
      .addScaledVector(normal, Math.cos(twist) * BRAID_RADIUS)
      .addScaledVector(binormal, Math.sin(twist) * BRAID_RADIUS);
  });
}

function replaceTubeGeometry(mesh: THREE.Mesh, points: THREE.Vector3[]): void {
  const oldGeometry = mesh.geometry;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
  mesh.geometry = new THREE.TubeGeometry(curve, 112, STRAND_RADIUS, 7, false);
  oldGeometry.dispose();
}

function makeEndWrap(position: THREE.Vector3, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.026, 10, 28), material);
  wrap.rotation.x = Math.PI / 2;
  group.add(wrap);

  const short = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.22, 18), material);
  short.rotation.z = Math.PI / 2;
  short.position.x = position.x < 0 ? 0.08 : -0.08;
  group.add(short);
  group.position.copy(position);
  return group;
}

export function installRopeLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab rope-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 16 · REAL 3D / PHYSICS</small><h1>Rope</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>Verlet</span><span>Braided</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Rope realistic 3D preview"
        data-asset-version="rope-v1-braided-physics"
        data-source-license="PROJECT-ORIGINAL"
        data-source-key="original-procedural-braided-rope-v1"
        data-render-source="procedural-real-geometry"
        data-physics-engine="verlet-constraints"
        data-motion="gravity-distance-constraints-damped-oscillation"
        data-fake-floor="false"></canvas>
      <p>Нажми на верёвку — она получает боковой импульс и затем провисает и затухающе колеблется под действием гравитации. Потяни пальцем по сцене, чтобы осмотреть реальное плетение.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0xe8edf0, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x687078, 0.82));

  const key = new THREE.DirectionalLight(0xfff7e8, 1.55);
  key.position.set(-4.2, 5.4, 7.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd9e9f3, 0.48);
  fill.position.set(4.3, 1.4, 5.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffead6, 0.34);
  rim.position.set(3.2, 4.5, -4.6);
  scene.add(rim);

  const reviewRoot = new THREE.Group();
  reviewRoot.rotation.set(-0.10, -0.24, 0.015);
  scene.add(reviewRoot);

  const nodes = makeInitialNodes();
  const ropeMaterials = [
    new THREE.MeshPhysicalMaterial({ color: 0xb8864f, roughness: 0.91, metalness: 0, clearcoat: 0.03 }),
    new THREE.MeshPhysicalMaterial({ color: 0xc99a61, roughness: 0.90, metalness: 0, clearcoat: 0.025 }),
    new THREE.MeshPhysicalMaterial({ color: 0xa8733f, roughness: 0.93, metalness: 0, clearcoat: 0.02 }),
  ];
  const wrapMaterial = new THREE.MeshPhysicalMaterial({ color: 0x8d6339, roughness: 0.88, metalness: 0, clearcoat: 0.02 });

  const strandMeshes = ropeMaterials.map((material, index) => {
    const points = createStrandPoints(nodes, (index / 3) * Math.PI * 2);
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45), 112, STRAND_RADIUS, 7, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Rope_Strand_${index + 1}`;
    reviewRoot.add(mesh);
    return mesh;
  });

  reviewRoot.add(makeEndWrap(nodes[0].p, wrapMaterial));
  reviewRoot.add(makeEndWrap(nodes[nodes.length - 1].p, wrapMaterial));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.08, 6.4);
  camera.lookAt(0, -0.05, 0);

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let velocityX = 0;
  let velocityY = 0;
  let lastGeometryUpdate = 0;

  const pluck = (): void => {
    for (let i = 3; i < nodes.length - 3; i += 1) {
      const influence = Math.sin((i / (nodes.length - 1)) * Math.PI);
      nodes[i].prev.z -= 0.34 * influence;
      nodes[i].prev.y += 0.045 * influence;
    }
  };
  canvas.__pluckRope = pluck;

  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance = 0;
    velocityX = 0;
    velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    dragDistance += Math.hypot(dx, dy);
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = dx * 0.006;
    velocityY = dy * 0.006;
    reviewRoot.rotation.y += velocityX;
    reviewRoot.rotation.x += velocityY;
  });
  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragDistance < 8) pluck();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(1.7, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let previous = performance.now();
  let accumulator = 0;
  const FIXED_DT = 1 / 90;

  const stepPhysics = (dt: number): void => {
    const gravity = new THREE.Vector3(0, -4.35, 0);
    for (const node of nodes) {
      if (node.pinned) {
        node.p.copy(node.pinned);
        node.prev.copy(node.pinned);
        continue;
      }
      const velocity = node.p.clone().sub(node.prev).multiplyScalar(0.994);
      const current = node.p.clone();
      node.p.add(velocity).addScaledVector(gravity, dt * dt);
      node.prev.copy(current);
    }

    for (let iteration = 0; iteration < 9; iteration += 1) {
      for (let i = 0; i < nodes.length - 1; i += 1) solveDistance(nodes[i], nodes[i + 1]);
      for (const node of nodes) {
        if (node.pinned) node.p.copy(node.pinned);
      }
    }
  };

  const animate = (now: number): void => {
    const wallDt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator += wallDt;
    while (accumulator >= FIXED_DT) {
      stepPhysics(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    if (now - lastGeometryUpdate > 16) {
      strandMeshes.forEach((mesh, index) => {
        replaceTubeGeometry(mesh, createStrandPoints(nodes, (index / 3) * Math.PI * 2));
      });
      lastGeometryUpdate = now;
    }

    if (pointerId === null) {
      const damping = Math.pow(0.03, wallDt);
      velocityX *= damping;
      velocityY *= damping;
      reviewRoot.rotation.y += velocityX;
      reviewRoot.rotation.x += velocityY;
    }

    const mid = nodes[Math.floor(nodes.length / 2)];
    const midSpeed = mid.p.distanceTo(mid.prev) / FIXED_DT;
    canvas.dataset.midpointY = mid.p.y.toFixed(3);
    canvas.dataset.midpointSpeed = midSpeed.toFixed(3);
    canvas.dataset.reviewRotationX = reviewRoot.rotation.x.toFixed(4);
    canvas.dataset.reviewRotationY = reviewRoot.rotation.y.toFixed(4);
    canvas.dataset.motionState = midSpeed > 0.18 ? 'moving' : 'settling';

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
