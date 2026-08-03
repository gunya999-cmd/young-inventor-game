import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMotorModelV1 } from './motorV1';

type ReviewCanvas = HTMLCanvasElement & {
  __startMotorDemo?: () => void;
  __engageMotorLoad?: () => void;
};

export function installPart15MotorLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab motor-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART 15 · 3D ASSET REVIEW</small><h1>Electric Motor</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>CC-BY</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Electric Motor 3D preview"
        data-asset-version="motor-v1"
        data-source-license="CC-BY"
        data-source-key="sketchfab-joh-mackell-simple-dc-motor-cc-by"
        data-studio-lighting="pmrem-soft"
        data-motion="finite-torque-revolute-motor-load-clutch"></canvas>
      <p>Первое нажатие запускает мотор. Второе подключает инерционный маховик через ограниченную фрикционную муфту: вал должен просесть по скорости, а нагрузка — раскрутиться.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0xedf1f4, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x6c757b, 0.88));

  const key = new THREE.DirectionalLight(0xfffbf5, 1.22);
  key.position.set(-4.8, 6.0, 7.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd9e7ef, 0.34);
  fill.position.set(4.2, 1.1, 5.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.21);
  rim.position.set(3.3, 4.9, -4.7);
  scene.add(rim);

  const model = createMotorModelV1();
  const object = model.group;
  object.rotation.set(-0.18, -0.44, 0.035);
  scene.add(object);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.052, depthWrite: false })
  );
  shadow.scale.set(1.20, 0.20, 1);
  shadow.position.set(-0.12, -0.76, -0.34);
  scene.add(shadow);

  canvas.__startMotorDemo = (): void => {
    if (typeof object.userData.startMotor === 'function') object.userData.startMotor();
  };
  canvas.__engageMotorLoad = (): void => {
    if (typeof object.userData.engageLoad === 'function') object.userData.engageLoad();
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
    if (dragDistance >= 8) return;
    if (object.userData.powered === true) canvas.__engageMotorLoad?.();
    else canvas.__startMotorDemo?.();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 120);
  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (1.58 / limitingTan) * 1.16;
    camera.position.set(0, 0.02, distance);
    camera.lookAt(0, -0.02, 0.30);
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
    const wallDt = Math.min(0.40, Math.max(0, (now - previous) / 1000));
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
    canvas.dataset.powered = object.userData.powered === true ? 'true' : 'false';
    canvas.dataset.loadEngaged = object.userData.loadEngaged === true ? 'true' : 'false';
    canvas.dataset.shaftOmega = typeof object.userData.shaftOmega === 'number' ? object.userData.shaftOmega.toFixed(3) : '0';
    canvas.dataset.loadOmega = typeof object.userData.loadOmega === 'number' ? object.userData.loadOmega.toFixed(3) : '0';
    canvas.dataset.maxFreeOmega = typeof object.userData.maxFreeOmega === 'number' ? object.userData.maxFreeOmega.toFixed(3) : '0';
    canvas.dataset.maxLoadOmega = typeof object.userData.maxLoadOmega === 'number' ? object.userData.maxLoadOmega.toFixed(3) : '0';
    canvas.dataset.motorTorque = typeof object.userData.motorTorque === 'number' ? object.userData.motorTorque.toFixed(3) : '0';
    canvas.dataset.maxMotorTorqueSeen = typeof object.userData.maxMotorTorqueSeen === 'number' ? object.userData.maxMotorTorqueSeen.toFixed(3) : '0';
    canvas.dataset.clutchSlip = typeof object.userData.clutchSlip === 'number' ? object.userData.clutchSlip.toFixed(3) : '0';
    canvas.dataset.maxClutchSlip = typeof object.userData.maxClutchSlip === 'number' ? object.userData.maxClutchSlip.toFixed(3) : '0';
    canvas.dataset.speedDropRatio = typeof object.userData.speedDropRatio === 'number' ? object.userData.speedDropRatio.toFixed(3) : '0';
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
