import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type ReviewCanvas = HTMLCanvasElement & {
  __kickLoad?: () => void;
};

type RopeNode = {
  p: THREE.Vector3;
  prev: THREE.Vector3;
  pinned?: THREE.Vector3;
};

const NODE_COUNT = 24;
const REST_LENGTH = 0.095;
const FIXED_DT = 1 / 100;

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function buildHook(): { group: THREE.Group; anchor: THREE.Vector3 } {
  const group = new THREE.Group();
  group.name = 'MetalLoopHookV1';

  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0x4e555b,
    roughness: 0.48,
    metalness: 0.88,
    clearcoat: 0.12,
    clearcoatRoughness: 0.34,
  });
  const forgedMat = new THREE.MeshPhysicalMaterial({
    color: 0x687077,
    roughness: 0.34,
    metalness: 0.94,
    clearcoat: 0.16,
    clearcoatRoughness: 0.28,
  });
  const boltMat = new THREE.MeshPhysicalMaterial({
    color: 0x858d93,
    roughness: 0.28,
    metalness: 0.98,
    clearcoat: 0.18,
  });

  const plateGeometry = new THREE.ExtrudeGeometry(roundedRectShape(1.38, 1.12, 0.17), {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 4,
    curveSegments: 18,
  });
  plateGeometry.translate(0, 0, -0.24);
  const plate = new THREE.Mesh(plateGeometry, plateMat);
  plate.name = 'Hook_MountingPlate';
  group.add(plate);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.082, 18, 72), forgedMat);
  ring.name = 'Hook_ForgedEye';
  ring.position.set(0, 0.03, 0.06);
  ring.scale.y = 1.13;
  group.add(ring);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.30, 24), forgedMat);
  neck.name = 'Hook_Neck';
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, 0.03, -0.055);
  group.add(neck);

  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.10, 36), forgedMat);
  boss.name = 'Hook_ReinforcementBoss';
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0.03, -0.105);
  group.add(boss);

  const boltPositions: Array<[number, number]> = [
    [-0.49, -0.35], [0.49, -0.35], [-0.49, 0.35], [0.49, 0.35],
  ];
  for (const [x, y] of boltPositions) {
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 28), boltMat);
    washer.rotation.x = Math.PI / 2;
    washer.position.set(x, y, -0.115);
    group.add(washer);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.065, 6), boltMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(x, y, -0.085);
    head.rotation.z = Math.PI / 6;
    group.add(head);
  }

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return { group, anchor: new THREE.Vector3(0, -0.35, 0.10) };
}

function makeRopeNodes(anchor: THREE.Vector3): RopeNode[] {
  const nodes: RopeNode[] = [];
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const p = anchor.clone().add(new THREE.Vector3(0.015 * Math.sin(i * 0.4), -REST_LENGTH * i, 0));
    nodes.push({ p: p.clone(), prev: p.clone() });
  }
  nodes[0].pinned = anchor.clone();
  return nodes;
}

function solveDistance(a: RopeNode, b: RopeNode): void {
  const delta = b.p.clone().sub(a.p);
  const distance = Math.max(0.00001, delta.length());
  const error = (distance - REST_LENGTH) / distance;
  const correction = delta.multiplyScalar(0.5 * error);
  if (!a.pinned) a.p.add(correction);
  if (!b.pinned) b.p.sub(correction);
}

function updateRopeGeometry(mesh: THREE.Mesh, nodes: RopeNode[]): void {
  const old = mesh.geometry;
  const curve = new THREE.CatmullRomCurve3(nodes.map((n) => n.p.clone()), false, 'centripetal', 0.45);
  mesh.geometry = new THREE.TubeGeometry(curve, 92, 0.035, 8, false);
  old.dispose();
}

export function installMetalLoopHookLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab metal-loop-hook-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 17 · FIXED ROPE ANCHOR</small><h1>Metal Loop / Hook</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>Static</span><span>Rope anchor</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Metal Loop Hook realistic 3D preview"
        data-asset-version="metal-loop-hook-v1"
        data-source-license="PROJECT-ORIGINAL"
        data-source-key="original-forged-eye-anchor-v1"
        data-render-source="procedural-real-geometry"
        data-physics-engine="verlet-rope-static-anchor"
        data-motion="fixed-anchor-rope-tension"
        data-anchor-static="true"
        data-fake-floor="false"></canvas>
      <p>Крюк — неподвижная точка крепления. Нажми на подвешенный груз: он раскачается на верёвке, а металлическая проушина останется зафиксированной и удержит натяжение.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0xe8edf0, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x606a72, 0.80));

  const key = new THREE.DirectionalLight(0xfff8ee, 1.52);
  key.position.set(-4.6, 5.8, 7.0);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7e9f4, 0.46);
  fill.position.set(4.2, 1.0, 5.3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffead8, 0.36);
  rim.position.set(3.6, 4.4, -4.5);
  scene.add(rim);

  const reviewRoot = new THREE.Group();
  reviewRoot.rotation.set(-0.05, -0.30, 0.01);
  reviewRoot.position.y = 0.88;
  scene.add(reviewRoot);

  const hook = buildHook();
  reviewRoot.add(hook.group);

  const ropeNodes = makeRopeNodes(hook.anchor);
  const ropeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb98b56,
    roughness: 0.92,
    metalness: 0,
    clearcoat: 0.015,
  });
  const initialCurve = new THREE.CatmullRomCurve3(ropeNodes.map((n) => n.p.clone()), false, 'centripetal', 0.45);
  const ropeMesh = new THREE.Mesh(new THREE.TubeGeometry(initialCurve, 92, 0.035, 8, false), ropeMaterial);
  ropeMesh.name = 'Hook_DemoRope';
  reviewRoot.add(ropeMesh);

  const weightMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3f474e,
    roughness: 0.39,
    metalness: 0.92,
    clearcoat: 0.10,
  });
  const weight = new THREE.Group();
  weight.name = 'Hook_DemoWeight';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.44, 30), weightMaterial);
  body.userData.isHookDemoLoad = true;
  weight.add(body);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.035, 12, 28), weightMaterial);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 0.26;
  cap.userData.isHookDemoLoad = true;
  weight.add(cap);
  reviewRoot.add(weight);

  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
  camera.position.set(0, -0.16, 6.4);
  camera.lookAt(0, -0.28, 0);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let velocityX = 0;
  let velocityY = 0;
  let accumulator = 0;
  let previous = performance.now();
  let lastGeometryUpdate = 0;

  const kickLoad = (): void => {
    const last = ropeNodes[ropeNodes.length - 1];
    last.prev.x -= 0.34;
    last.prev.z += 0.13;
  };
  canvas.__kickLoad = kickLoad;

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
    if (dragDistance >= 8) return;

    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(weight, true);
    if (hits.some((hit) => hit.object.userData.isHookDemoLoad === true)) kickLoad();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const stepPhysics = (dt: number): void => {
    const gravity = new THREE.Vector3(0, -5.15, 0);
    for (let i = 0; i < ropeNodes.length; i += 1) {
      const node = ropeNodes[i];
      if (node.pinned) {
        node.p.copy(node.pinned);
        node.prev.copy(node.pinned);
        continue;
      }
      const damping = i === ropeNodes.length - 1 ? 0.997 : 0.992;
      const velocity = node.p.clone().sub(node.prev).multiplyScalar(damping);
      const current = node.p.clone();
      const gravityScale = i === ropeNodes.length - 1 ? 1.45 : 1;
      node.p.add(velocity).addScaledVector(gravity, gravityScale * dt * dt);
      node.prev.copy(current);
    }

    for (let iteration = 0; iteration < 11; iteration += 1) {
      for (let i = 0; i < ropeNodes.length - 1; i += 1) solveDistance(ropeNodes[i], ropeNodes[i + 1]);
      ropeNodes[0].p.copy(hook.anchor);
    }
  };

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

  const animate = (now: number): void => {
    const wallDt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator += wallDt;
    while (accumulator >= FIXED_DT) {
      stepPhysics(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    const last = ropeNodes[ropeNodes.length - 1];
    weight.position.copy(last.p);
    weight.position.y -= 0.24;

    if (now - lastGeometryUpdate > 16) {
      updateRopeGeometry(ropeMesh, ropeNodes);
      lastGeometryUpdate = now;
    }

    if (pointerId === null) {
      const damping = Math.pow(0.03, wallDt);
      velocityX *= damping;
      velocityY *= damping;
      reviewRoot.rotation.y += velocityX;
      reviewRoot.rotation.x += velocityY;
    }

    const first = ropeNodes[0];
    const anchorError = first.p.distanceTo(hook.anchor);
    const loadSpeed = last.p.distanceTo(last.prev) / FIXED_DT;
    const straightDistance = hook.anchor.distanceTo(last.p);
    const ropeLength = REST_LENGTH * (NODE_COUNT - 1);
    const tensionRatio = THREE.MathUtils.clamp(straightDistance / ropeLength, 0, 1);

    canvas.dataset.anchorError = anchorError.toFixed(6);
    canvas.dataset.loadSpeed = loadSpeed.toFixed(3);
    canvas.dataset.tensionRatio = tensionRatio.toFixed(3);
    canvas.dataset.motionState = loadSpeed > 0.16 ? 'swinging' : 'settling';
    canvas.dataset.reviewRotationX = reviewRoot.rotation.x.toFixed(4);
    canvas.dataset.reviewRotationY = reviewRoot.rotation.y.toFixed(4);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
