import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createBaseballModelV2 } from './baseballV2';
import {
  createTennisBallModel,
  createBalloonModel,
  createTeeterTotterModel,
  createBellowsModel,
  type ReviewAssetModel
} from './parts0408Models';

type AssetKey = 'baseball' | 'tennis-ball' | 'balloon' | 'teeter-totter' | 'bellows';

interface AssetConfig {
  key: AssetKey;
  part: string;
  title: string;
  version: string;
  sourceLicense: string;
  sourceKey: string;
  radius: number;
  initialRotation: [number, number, number];
  create: () => ReviewAssetModel;
}

const CONFIGS: Record<AssetKey, AssetConfig> = {
  baseball: {
    key: 'baseball', part: '04', title: 'Baseball', version: 'baseball-v2',
    sourceLicense: 'CC0', sourceKey: 'opengameart-old-baseball-cc0', radius: 1.34,
    initialRotation: [-0.14, -0.68, 0.12], create: createBaseballModelV2
  },
  'tennis-ball': {
    key: 'tennis-ball', part: '05', title: 'Tennis Ball', version: 'tennis-ball-v1',
    sourceLicense: 'CC0', sourceKey: 'opengameart-hq-pbr-tennis-ball-cc0', radius: 1.2,
    initialRotation: [-0.1, -0.42, 0.16], create: createTennisBallModel
  },
  balloon: {
    key: 'balloon', part: '06', title: 'Balloon', version: 'balloon-v1',
    sourceLicense: 'CC0', sourceKey: 'opengameart-balloons-cc0', radius: 2.05,
    initialRotation: [-0.05, -0.34, 0.05], create: createBalloonModel
  },
  'teeter-totter': {
    key: 'teeter-totter', part: '07', title: 'Teeter-Totter', version: 'teeter-totter-v1',
    sourceLicense: 'CC0', sourceKey: 'opengameart-playground-cc0', radius: 2.15,
    initialRotation: [-0.28, -0.48, -0.02], create: createTeeterTotterModel
  },
  bellows: {
    key: 'bellows', part: '08', title: 'Bellows', version: 'bellows-v1',
    sourceLicense: 'CC-BY', sourceKey: 'sketchfab-nudluria-bellows-cc-by', radius: 3.05,
    initialRotation: [-0.3, -0.48, 0.08], create: createBellowsModel
  }
};

export function isPart0408Asset(value: string | null): value is AssetKey {
  return value !== null && value in CONFIGS;
}

export function installPart0408Lab(key: AssetKey): void {
  const config = CONFIGS[key];
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0408-lab-mode');

  const versionLabel = config.version.split('-').at(-1) ?? config.version;
  const root = document.createElement('section');
  root.className = `bowling-ball-lab parts-0408-lab ${config.key}-lab`;
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART ${config.part} · OPEN-ASSET REVIEW</small><h1>${config.title}</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>${config.sourceLicense}</span><span>${versionLabel}</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="${config.title} 3D preview"
        data-asset-version="${config.version}"
        data-source-license="${config.sourceLicense}"
        data-source-key="${config.sourceKey}"
        data-studio-lighting="pmrem-soft"></canvas>
      <p>Проведи пальцем по предмету, чтобы повернуть его</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  if (config.key === 'baseball') {
    canvas.dataset.seamConstruction = 'surface-integrated';
    canvas.dataset.externalStitchMeshes = '0';
  }

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

  const keyLight = new THREE.DirectionalLight(0xfffbf5, 1.12);
  keyLight.position.set(-4.6, 5.6, 7.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xdce7ef, 0.28);
  fillLight.position.set(4.2, 0.4, 5.3);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.16);
  rimLight.position.set(3.1, 4.8, -4.3);
  scene.add(rimLight);

  const model = config.create();
  const object = model.group;
  object.rotation.set(...config.initialRotation);
  scene.add(object);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.062, depthWrite: false })
  );
  shadow.scale.set(config.radius * 0.78, config.radius * 0.16, 1);
  shadow.position.set(0, -config.radius * 0.82, -config.radius * 0.46);
  scene.add(shadow);

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let velocityX = 0;
  let velocityY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = 0;
    velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = dx * 0.007;
    velocityY = dy * 0.007;
    object.rotation.y += velocityX;
    object.rotation.x += velocityY;
  });
  const release = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) pointerId = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (config.radius / limitingTan) * 1.14;
    camera.position.set(0, 0.04, distance);
    camera.lookAt(0, 0, 0);
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
    if (pointerId === null) {
      const damping = Math.pow(0.025, dt);
      velocityX *= damping;
      velocityY *= damping;
      object.rotation.y += velocityX;
      object.rotation.x += velocityY;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
