import * as THREE from 'three';
import { createBowlingBallModel } from './bowlingBallModel';

export function installBowlingBallLab(): void {
  if (new URLSearchParams(location.search).get('asset') !== 'bowling-ball') return;

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART 01 · 3D ASSET REVIEW</small><h1>Bowling Ball</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Bowling Ball 3D preview" data-asset-version="bowling-ball-v2"></canvas>
      <p>Проведи пальцем по шару, чтобы повернуть его</p>
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

  // Neutral studio light: clean reflections without blue/green glowing dots.
  scene.add(new THREE.HemisphereLight(0xfbfcfd, 0x60646a, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.35);
  key.position.set(-3.8, 4.8, 6.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe3e7eb, 0.82);
  fill.position.set(4.5, -1.2, 4.0);
  scene.add(fill);
  const edge = new THREE.DirectionalLight(0xffffff, 0.34);
  edge.position.set(3.6, 3.2, -0.5);
  scene.add(edge);

  const model = createBowlingBallModel();
  const ball = model.group;
  ball.rotation.set(-0.11, -0.18, -0.035);
  scene.add(ball);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 72),
    new THREE.MeshBasicMaterial({ color: 0x55606b, transparent: true, opacity: 0.08, depthWrite: false })
  );
  shadow.scale.set(1.08, 0.16, 1);
  shadow.position.set(0, -1.14, -0.72);
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
  const release = (event: PointerEvent) => { if (pointerId === event.pointerId) pointerId = null; };
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

  const resize = () => {
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
  const animate = (now: number) => {
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
