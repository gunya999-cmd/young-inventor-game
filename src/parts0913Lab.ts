import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ReviewAssetModel0913 } from './parts0913Models';
import { createBoxingGloveModelV13 } from './boxingGloveV13';
import { createTrampolineModelV2 } from './trampolineV2';
import { createFanBeltModelV2 } from './fanBeltV2';
import { createGearModelV2 } from './gearV2';
import { createConveyorBeltModelV2 } from './conveyorBeltV2';

type AssetKey0913 = 'boxing-glove' | 'trampoline' | 'fan-belt' | 'gear' | 'conveyor-belt';

type ReviewCanvas = HTMLCanvasElement & {
  __pressBoxingGlove?: () => void;
};

interface AssetConfig0913 {
  key: AssetKey0913;
  part: string;
  title: string;
  version: string;
  sourceLicense: string;
  sourceKey: string;
  radius: number;
  initialRotation: [number, number, number];
  create: () => ReviewAssetModel0913;
}

const CONFIGS: Record<AssetKey0913, AssetConfig0913> = {
  'boxing-glove': {
    key: 'boxing-glove', part: '09', title: 'Boxing Glove', version: 'boxing-glove-v13',
    sourceLicense: 'CC-BY', sourceKey: 'sketchfab-incg5764-boxing-glove-cc-by', radius: 1.78,
    initialRotation: [-0.055, -0.43, 0.012], create: createBoxingGloveModelV13
  },
  trampoline: {
    key: 'trampoline', part: '10', title: 'Trampoline', version: 'trampoline-v2',
    sourceLicense: 'CC-BY', sourceKey: 'sketchfab-simon-laisne-trampoline-cc-by', radius: 2.48,
    initialRotation: [-0.36, -0.50, 0.025], create: createTrampolineModelV2
  },
  'fan-belt': {
    key: 'fan-belt', part: '11', title: 'Fan Belt', version: 'fan-belt-v2',
    sourceLicense: 'CC-BY', sourceKey: 'sketchfab-v-belt-c-type-cc-by', radius: 1.92,
    initialRotation: [-0.18, -0.36, 0.07], create: createFanBeltModelV2
  },
  gear: {
    key: 'gear', part: '12', title: 'Gear', version: 'gear-v2',
    sourceLicense: 'CC0', sourceKey: 'sketchfab-plaggy-cc0-gear', radius: 1.58,
    initialRotation: [-0.15, -0.42, 0.12], create: createGearModelV2
  },
  'conveyor-belt': {
    key: 'conveyor-belt', part: '13', title: 'Conveyor Belt', version: 'conveyor-belt-v2',
    sourceLicense: 'CC-BY', sourceKey: 'sketchfab-jason-kan-conveyor-cc-by', radius: 2.85,
    initialRotation: [-0.30, -0.50, 0.015], create: createConveyorBeltModelV2
  }
};

export function isPart0913Asset(value: string | null): value is AssetKey0913 {
  return value !== null && value in CONFIGS;
}

export function installPart0913Lab(key: AssetKey0913): void {
  const config = CONFIGS[key];
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const versionLabel = config.version.split('-').at(-1) ?? config.version;
  const instruction = config.key === 'boxing-glove'
    ? 'Нажми красную кнопку сзади — импульс выбросит перчатку, затем она свободно колеблется на пружине под действием гравитации'
    : 'Проведи пальцем по предмету, чтобы повернуть его';
  const root = document.createElement('section');
  root.className = `bowling-ball-lab parts-0913-lab ${config.key}-lab`;
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART ${config.part} · 3D ASSET REVIEW</small><h1>${config.title}</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>${config.sourceLicense}</span><span>${versionLabel}</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="${config.title} 3D preview"
        data-asset-version="${config.version}"
        data-source-license="${config.sourceLicense}"
        data-source-key="${config.sourceKey}"
        data-studio-lighting="pmrem-soft"
        data-motion="${config.key === 'boxing-glove' ? 'impulse-spring-gravity' : 'static-review'}"></canvas>
      <p>${instruction}</p>
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

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x737b82, 0.82));

  const keyLight = new THREE.DirectionalLight(0xfffbf5, 1.16);
  keyLight.position.set(-4.6, 5.8, 7.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xdce7ef, 0.30);
  fillLight.position.set(4.2, 0.6, 5.3);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.17);
  rimLight.position.set(3.1, 4.8, -4.3);
  scene.add(rimLight);

  const model = config.create();
  const object = model.group;
  object.rotation.set(...config.initialRotation);
  scene.add(object);

  if (config.key === 'boxing-glove' && typeof object.userData.setTriggerPressed === 'function') {
    canvas.__pressBoxingGlove = (): void => {
      object.userData.setTriggerPressed(true);
      window.setTimeout(() => object.userData.setTriggerPressed(false), 80);
    };
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.052, depthWrite: false })
  );
  shadow.scale.set(config.radius * 0.76, config.radius * 0.14, 1);
  shadow.position.set(-0.30, -config.radius * 0.54, -config.radius * 0.32);
  scene.add(shadow);

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
  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (config.key !== 'boxing-glove' || dragDistance >= 8 || typeof object.userData.setTriggerPressed !== 'function') return;

    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const triggerHit = raycaster.intersectObject(object, true)
      .find((hit) => hit.object.userData.isBoxingGloveTrigger === true);
    if (!triggerHit) return;

    object.userData.setTriggerPressed(true);
    window.setTimeout(() => object.userData.setTriggerPressed(false), 80);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (config.radius / limitingTan) * 1.18;
    camera.position.set(0, 0.04, distance);
    camera.lookAt(config.key === 'boxing-glove' ? -0.42 : -0.18, config.key === 'boxing-glove' ? -0.34 : 0, 0);
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
    const dt = Math.min(0.032, Math.max(0, (now - previous) / 1000));
    previous = now;
    if (typeof object.userData.update === 'function') object.userData.update(dt);
    if (pointerId === null) {
      const damping = Math.pow(0.025, dt);
      velocityX *= damping;
      velocityY *= damping;
      object.rotation.y += velocityX;
      object.rotation.x += velocityY;
    }
    canvas.dataset.motionState = typeof object.userData.state === 'string' ? object.userData.state : '';
    canvas.dataset.extension = typeof object.userData.extension === 'number' ? object.userData.extension.toFixed(3) : '0';
    canvas.dataset.centerY = typeof object.userData.centerY === 'number' ? object.userData.centerY.toFixed(3) : '0';
    canvas.dataset.speed = typeof object.userData.speed === 'number' ? object.userData.speed.toFixed(3) : '0';
    canvas.dataset.triggerPressed = object.userData.triggerPressed === true ? 'true' : 'false';
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
