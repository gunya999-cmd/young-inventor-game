import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPulleyModelV1 } from './pulleyV1';

type ReviewCanvas = HTMLCanvasElement & { __startPulleyDemo?: () => void };

export function installPart14PulleyLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab pulley-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART 14 · 3D ASSET REVIEW</small><h1>Pulley</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>CC-BY</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Pulley 3D preview"
        data-asset-version="pulley-v1"
        data-source-license="CC-BY"
        data-source-key="sketchfab-fuglee-pulley-cc-by"
        data-studio-lighting="pmrem-soft"
        data-motion="planck-pulley-joint-clutch"></canvas>
      <p>Нажми на блок: тяжёлый груз пойдёт вниз, лёгкий — вверх. Канат сохраняет длину через PulleyJoint, а шкив раскручивается через конечное сцепление с канатом.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0xedf1f4, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x6f777d, 0.86));

  const key = new THREE.DirectionalLight(0xfffbf5, 1.20);
  key.position.set(-4.8, 6.2, 7.0);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe7ef, 0.32);
  fill.position.set(4.0, 1.0, 5.0);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.20);
  rim.position.set(3.0, 5.2, -4.6);
  scene.add(rim);

  const model = createPulleyModelV1();
  const object = model.group;
  object.rotation.set(-0.07, -0.30, 0.015);
  scene.add(object);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.052, depthWrite: false })
  );
  shadow.scale.set(1.15, 0.20, 1);
  shadow.position.set(0, -1.03, -0.42);
  scene.add(shadow);

  canvas.__startPulleyDemo = (): void => {
    if (typeof object.userData.startDemo === 'function') object.userData.startDemo();
  };

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
  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragDistance < 8) canvas.__startPulleyDemo?.();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 120);
  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (2.05 / limitingTan) * 1.13;
    camera.position.set(0, 0.18, distance);
    camera.lookAt(0, 0.12, 0);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    canvas.dataset.cameraDistance = distance.toFixed(3);
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(1.7, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    fitCamera(width, height);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let previous = performance.now();
  const animate = (now: number): void => {
    const wallDt = Math.min(0.45, Math.max(0, (now - previous) / 1000));
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
    canvas.dataset.leftY = typeof object.userData.leftY === 'number' ? object.userData.leftY.toFixed(3) : '0';
    canvas.dataset.rightY = typeof object.userData.rightY === 'number' ? object.userData.rightY.toFixed(3) : '0';
    canvas.dataset.leftVy = typeof object.userData.leftVy === 'number' ? object.userData.leftVy.toFixed(3) : '0';
    canvas.dataset.rightVy = typeof object.userData.rightVy === 'number' ? object.userData.rightVy.toFixed(3) : '0';
    canvas.dataset.travel = typeof object.userData.travel === 'number' ? object.userData.travel.toFixed(3) : '0';
    canvas.dataset.maxTravel = typeof object.userData.maxTravel === 'number' ? object.userData.maxTravel.toFixed(3) : '0';
    canvas.dataset.wheelOmega = typeof object.userData.wheelOmega === 'number' ? object.userData.wheelOmega.toFixed(3) : '0';
    canvas.dataset.maxWheelOmega = typeof object.userData.maxWheelOmega === 'number' ? object.userData.maxWheelOmega.toFixed(3) : '0';
    canvas.dataset.ropeError = typeof object.userData.ropeError === 'number' ? object.userData.ropeError.toFixed(4) : '0';
    canvas.dataset.maxSlip = typeof object.userData.maxSlip === 'number' ? object.userData.maxSlip.toFixed(3) : '0';
    canvas.dataset.opposedMotion = object.userData.opposedMotion === true ? 'true' : 'false';
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
