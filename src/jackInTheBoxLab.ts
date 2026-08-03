import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createJackInTheBoxModelV1 } from './jackInTheBoxV1';

type ReviewCanvas = HTMLCanvasElement & { __kickJackDrive?: () => void };

export function installJackInTheBoxLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab jack-in-the-box-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 14 · REALISTIC 3D ASSET REVIEW</small><h1>Jack-in-the-Box</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>Realistic PBR</span><span>CC-BY</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Realistic Jack-in-the-Box 3D preview"
        data-asset-version="jack-in-the-box-v2-realistic"
        data-source-license="CC-BY"
        data-source-key="sketchfab-evan-cg-jack-in-the-box-cc-by"
        data-studio-lighting="pmrem-soft"
        data-motion="rotation-threshold-latch-spring-contact"></canvas>
      <p>Реалистичная игровая модель: отдельные металлические панели, крепёж, петли, подшипниковый узел, литой шкив и детализированная фигурка. Нажми на привод — защёлка освободит физическую пружину.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0xe7ebee, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x60686d, 0.74));

  const key = new THREE.DirectionalLight(0xfff7ed, 1.38);
  key.position.set(-4.8, 6.2, 7.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcddfea, 0.38);
  fill.position.set(4.2, 1.2, 5.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.28);
  rim.position.set(3.4, 5.0, -4.8);
  scene.add(rim);

  const model = createJackInTheBoxModelV1();
  const object = model.group;
  object.rotation.set(-0.08, -0.46, 0.02);
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(object);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 96),
    new THREE.MeshStandardMaterial({ color: 0xd7dde0, roughness: 0.92, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(1.25, 0.72, 1);
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
    if (hitDrive) canvas.__kickJackDrive?.();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(activeCamera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (1.82 / limitingTan) * 1.12;
    activeCamera.position.set(0, 0.12, distance);
    activeCamera.lookAt(0.05, 0.15, 0.08);
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

    renderer.render(scene, activeCamera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
