import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createJackInTheBoxModelV1 } from './jackInTheBoxV1';
import { attachJackInTheBoxGlbV3 } from './jackInTheBoxGlbV3';

type ReviewCanvas = HTMLCanvasElement & { __kickJackDrive?: () => void };

export function installJackInTheBoxLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab jack-in-the-box-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 14 · REAL CC0 SOURCE MESH</small><h1>Jack-in-the-Box</h1></div>
      <div class="bowling-ball-lab__meta"><span>GLB</span><span>CC0</span><span>507k tris</span><span>v4</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Real CC0 Jack-in-the-Box 3D preview"
        data-asset-version="jack-in-the-box-v4-real-cc0"
        data-source-license="CC0-1.0"
        data-source-key="meshy-cc0-rusted-jack-in-the-box"
        data-render-source="real-cc0-glb"
        data-render-loaded="false"
        data-render-triangles="0"
        data-studio-lighting="pmrem-soft"
        data-motion="rotation-threshold-latch-spring-contact"></canvas>
      <p>В игре загружается реальная CC0-сетка исходного ассета — не Three.js-примитивы и не концепт-рендер. Planck-физика привода, защёлки и пружины остаётся отдельным слоем.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0xdfe3e5, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xf8fafb, 0x4b5053, 0.58));

  const key = new THREE.DirectionalLight(0xfff4e8, 1.22);
  key.position.set(-4.8, 6.2, 7.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcbd9e0, 0.30);
  fill.position.set(4.2, 1.2, 5.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.28);
  rim.position.set(3.4, 5.0, -4.8);
  scene.add(rim);

  const model = createJackInTheBoxModelV1();
  const object = model.group;
  object.rotation.set(-0.075, -0.42, 0.015);
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(object);

  void attachJackInTheBoxGlbV3(object).catch((error) => {
    console.error('Real CC0 Jack GLB failed to load; keeping procedural fallback.', error);
  });

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 96),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcf, roughness: 0.97, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(1.28, 0.72, 1);
  floor.position.set(0, -0.67, -0.12);
  floor.receiveShadow = true;
  scene.add(floor);

  canvas.__kickJackDrive = (): void => {
    if (typeof object.userData.kickDrive === 'function') object.userData.kickDrive();
  };

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let velocityX = 0;
  let velocityY = 0;

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
    velocityX = dx * 0.007;
    velocityY = dy * 0.007;
    object.rotation.y += velocityX;
    object.rotation.x += velocityY;
  });

  const activeCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragDistance >= 8) return;

    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, activeCamera);
    const hitDrive = raycaster.intersectObject(object, true).some((hit) => {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        if (current.userData.isJackDrive === true) return true;
        current = current.parent;
      }
      return false;
    });

    // The real CC0 source is one monolithic render mesh, so a tap anywhere on it
    // activates the separate physical drive while drag remains reserved for review rotation.
    if (hitDrive || object.userData.renderLoaded === true) canvas.__kickJackDrive?.();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(activeCamera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (1.05 / limitingTan) * 1.05;
    activeCamera.position.set(0, 0.13, distance);
    activeCamera.lookAt(0.02, 0.20, 0.02);
    activeCamera.aspect = aspect;
    activeCamera.updateProjectionMatrix();
    canvas.dataset.cameraDistance = distance.toFixed(3);
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    fitCamera(width, height);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let previous = performance.now();
  const animate = (now: number): void => {
    const wallDt = Math.min(0.42, Math.max(0, (now - previous) / 1000));
    const renderDt = Math.min(0.032, wallDt);
    previous = now;
    if (typeof object.userData.update === 'function') object.userData.update(wallDt);

    if (pointerId === null) {
      const damping = Math.pow(0.025, renderDt);
      velocityX *= damping;
      velocityY *= damping;
      object.rotation.y += velocityX;
      object.rotation.x += velocityY;
    }

    canvas.dataset.motionState = typeof object.userData.state === 'string' ? object.userData.state : '';
    canvas.dataset.physicsEngine = typeof object.userData.physicsEngine === 'string' ? object.userData.physicsEngine : '';
    canvas.dataset.rotationReceived = typeof object.userData.rotationReceived === 'number' ? object.userData.rotationReceived.toFixed(3) : '0';
    canvas.dataset.driveOmega = typeof object.userData.driveOmega === 'number' ? object.userData.driveOmega.toFixed(3) : '0';
    canvas.dataset.jackY = typeof object.userData.jackY === 'number' ? object.userData.jackY.toFixed(3) : '0';
    canvas.dataset.jackVy = typeof object.userData.jackVy === 'number' ? object.userData.jackVy.toFixed(3) : '0';
    canvas.dataset.maxRise = typeof object.userData.maxRise === 'number' ? object.userData.maxRise.toFixed(3) : '0';
    canvas.dataset.lidAngle = typeof object.userData.lidAngle === 'number' ? object.userData.lidAngle.toFixed(3) : '0';
    canvas.dataset.maxLidAngle = typeof object.userData.maxLidAngle === 'number' ? object.userData.maxLidAngle.toFixed(3) : '0';
    canvas.dataset.maxJackSpeed = typeof object.userData.maxJackSpeed === 'number' ? object.userData.maxJackSpeed.toFixed(3) : '0';
    canvas.dataset.releaseCount = typeof object.userData.releaseCount === 'number' ? String(object.userData.releaseCount) : '0';
    canvas.dataset.oscillationTurns = typeof object.userData.oscillationTurns === 'number' ? String(object.userData.oscillationTurns) : '0';
    canvas.dataset.renderSource = typeof object.userData.renderSource === 'string' ? object.userData.renderSource : '';
    canvas.dataset.renderLoaded = object.userData.renderLoaded === true ? 'true' : 'false';
    canvas.dataset.renderTriangles = typeof object.userData.renderTriangles === 'number' ? String(object.userData.renderTriangles) : '0';
    canvas.dataset.renderBytes = typeof object.userData.renderBytes === 'number' ? String(object.userData.renderBytes) : '0';
    canvas.dataset.renderModelType = typeof object.userData.renderModelType === 'string' ? object.userData.renderModelType : '';
    canvas.dataset.renderError = typeof object.userData.renderError === 'string' ? object.userData.renderError : '';

    renderer.render(scene, activeCamera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
