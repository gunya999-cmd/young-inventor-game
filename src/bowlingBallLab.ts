import * as THREE from 'three';

function createReviewBall(): THREE.Group {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 72, 52),
    new THREE.MeshPhysicalMaterial({
      color: 0x101821,
      metalness: 0.06,
      roughness: 0.21,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16
    })
  );
  group.add(shell);

  const cavityMaterial = new THREE.MeshStandardMaterial({ color: 0x020508, roughness: 0.86 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x687786, metalness: 0.72, roughness: 0.24 });
  const holes = [
    { x: -0.22, y: 0.22, radius: 0.125 },
    { x: 0.20, y: 0.22, radius: 0.125 },
    { x: 0, y: -0.15, radius: 0.145 }
  ];
  for (const hole of holes) {
    const cavity = new THREE.Mesh(new THREE.CircleGeometry(hole.radius * 0.82, 48), cavityMaterial);
    cavity.position.set(hole.x, hole.y, 0.994);
    group.add(cavity);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(hole.radius, hole.radius * 0.09, 14, 64), rimMaterial);
    rim.position.set(hole.x, hole.y, 1.002);
    group.add(rim);
  }
  const accent = new THREE.Mesh(
    new THREE.CircleGeometry(0.032, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x526de7, metalness: 0.28, roughness: 0.26, clearcoat: 0.45 })
  );
  accent.position.set(0, -0.56, 0.997);
  group.add(accent);
  return group;
}

export function installBowlingBallLab(): void {
  if (new URLSearchParams(location.search).get('asset') !== 'bowling-ball') return;

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>PART 01 · REAL 3D ASSET</small><h1>Bowling Ball</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>Planck-ready</span></div>
    </header>
    <div class="bowling-ball-lab__stage"><canvas aria-label="Bowling Ball 3D preview"></canvas><p>Проведи пальцем по шару, чтобы повернуть его</p></div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0xe8edf2, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.set(0, 0.05, 6.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x53606d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 5.1);
  key.position.set(-3.6, 4.4, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8ba5ff, 1.15);
  fill.position.set(4, -1.4, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8fe4cf, 0.62);
  rim.position.set(3.2, 3.6, -1);
  scene.add(rim);

  const ball = createReviewBall();
  ball.rotation.set(-0.08, -0.12, -0.06);
  scene.add(ball);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 64),
    new THREE.MeshBasicMaterial({ color: 0x66717d, transparent: true, opacity: 0.12, depthWrite: false })
  );
  shadow.scale.set(1.25, 0.22, 1);
  shadow.position.set(0, -1.28, -0.8);
  scene.add(shadow);

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    ball.rotation.y += dx * 0.008;
    ball.rotation.x += dy * 0.008;
  });
  const release = (event: PointerEvent) => { if (pointerId === event.pointerId) pointerId = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(1.8, window.devicePixelRatio || 1));
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const animate = () => {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
}
