import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCannonballModel } from './cannonballModel';

export function installCannonballLab(): void {
  if (new URLSearchParams(location.search).get('asset') !== 'cannonball') return;

  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab cannonball-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART 03 · 3D ASSET REVIEW</small><h1>Cannonball</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>CC0 base</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Cannonball 3D preview" data-asset-version="cannonball-v2" data-surface="seamless-gunmetal-cast-iron" data-casting-seam="0" data-source="kenney-tower-defense-cc0" data-lighting="soft-studio-environment"></canvas>
      <p>Проведи пальцем по ядру, чтобы повернуть его</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xedf1f4, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // A neutral PMREM studio environment gives metal a single broad, controlled
  // reflection instead of the hard disconnected spots produced by v1 lights.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xf7f9fb, 0x5f6469, 0.48));

  const key = new THREE.DirectionalLight(0xffffff, 0.82);
  key.position.set(-3.6, 4.8, 5.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe7ebef, 0.22);
  fill.position.set(3.8, 0.8, 4.0);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xf8fafc, 0.1);
  rim.position.set(3.6, 2.8, -2.2);
  scene.add(rim);

  const model = createCannonballModel();
  const ball = model.group;
  ball.rotation.set(-0.1, -0.28, 0.04);
  scene.add(ball);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.03, 72),
    new THREE.MeshBasicMaterial({ color: 0x59616a, transparent: true, opacity: 0.055, depthWrite: false })
  );
  shadow.scale.set(1.08, 0.16, 1);
  shadow.position.set(0, -1.15, -0.72);
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
    ball.rotation.y += velocityX;
    ball.rotation.x += velocityY;
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
    const modelRadiusWithMargin = 1.18;
    const distance = modelRadiusWithMargin / limitingTan * 1.12;
    camera.position.set(0, 0.02, distance);
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
      ball.rotation.y += velocityX;
      ball.rotation.x += velocityY;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
