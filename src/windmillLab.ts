import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createWindmillPhysicsV1, type WindmillPhysicsController } from './windmillV1';

type ReviewCanvas = HTMLCanvasElement & {
  __setWind?: (strength: number) => void;
  __startWind?: () => void;
  __reverseWind?: () => void;
};

const MODEL_URL = '/assets/windmill-v1.glb';
const GROUND_Y = -1.145;
const GROUND_CLEARANCE = 0.012;

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry;
    if (geometry.index) triangles += geometry.index.count / 3;
    else if (geometry.attributes.position) triangles += geometry.attributes.position.count / 3;
  });
  return Math.round(triangles);
}

function enableRenderQuality(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if ('envMapIntensity' in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 0.72;
    }
  });
}

export function installWindmillLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab windmill-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 15 · ORIGINAL 3D ASSET</small><h1>Windmill</h1></div>
      <div class="bowling-ball-lab__meta"><span>GLB</span><span>PBR</span><span>Planck</span><span>Original</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Windmill realistic 3D preview"
        data-asset-version="windmill-v1-original-blender"
        data-source-license="PROJECT-ORIGINAL"
        data-source-key="original-blender-windmill-v1"
        data-render-source="original-blender-glb"
        data-render-loaded="false"
        data-render-triangles="0"
        data-render-error=""
        data-ground-intersection="unknown"
        data-physics-engine="planck"
        data-motion="airflow-to-finite-shaft-torque"></canvas>
      <p>Нажми на ветряк: поток воздуха раскручивает реальные инерционные лопасти. Нажми ещё раз — направление воздуха поменяется, и вал должен физически затормозить и раскрутиться обратно.</p>
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
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x657078, 0.78));

  const key = new THREE.DirectionalLight(0xfff8ee, 1.68);
  key.position.set(-4.8, 6.4, 7.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7e9f4, 0.52);
  fill.position.set(4.5, 1.2, 5.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffead6, 0.38);
  rim.position.set(3.4, 5.2, -4.8);
  scene.add(rim);

  // Keep the mechanism physically upright. The old preview tilted the whole object
  // around X/Z while the ground stayed fixed, which visibly drove the base through
  // the floor. We only yaw the review object; elevation belongs to the camera.
  const reviewRoot = new THREE.Group();
  reviewRoot.rotation.set(0, -0.30, 0);
  scene.add(reviewRoot);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 96),
    new THREE.MeshStandardMaterial({ color: 0xdde2e5, roughness: 0.92, metalness: 0.0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(1.45, 1.0, 1.0);
  floor.position.set(0, GROUND_Y, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  let physics: WindmillPhysicsController | null = null;
  let model: THREE.Object3D | null = null;
  let windMode: -1 | 0 | 1 = 0;

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;
      model.name = 'WindmillV1OriginalGLB';
      enableRenderQuality(model);

      // Blender glTF export is Y-up. Scale first, then align the *actual world-space*
      // bottom of the rendered GLB to the ground plane. No guessed floor coordinate.
      const sourceBox = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBox.getSize(new THREE.Vector3());
      const targetHeight = 2.25;
      const scale = targetHeight / Math.max(0.001, sourceSize.y);
      model.scale.setScalar(scale);
      reviewRoot.add(model);
      reviewRoot.updateMatrixWorld(true);

      let worldBox = new THREE.Box3().setFromObject(model);
      const worldCenter = worldBox.getCenter(new THREE.Vector3());
      model.position.x -= worldCenter.x;
      model.position.z -= worldCenter.z;
      reviewRoot.updateMatrixWorld(true);

      worldBox = new THREE.Box3().setFromObject(model);
      model.position.y += (GROUND_Y + GROUND_CLEARANCE) - worldBox.min.y;
      reviewRoot.updateMatrixWorld(true);

      const finalBox = new THREE.Box3().setFromObject(model);
      const clearance = finalBox.min.y - GROUND_Y;
      const intersectsGround = clearance < -0.0005;
      canvas.dataset.groundY = GROUND_Y.toFixed(4);
      canvas.dataset.modelBottomY = finalBox.min.y.toFixed(4);
      canvas.dataset.groundClearance = clearance.toFixed(4);
      canvas.dataset.groundIntersection = intersectsGround ? 'true' : 'false';
      if (intersectsGround) {
        throw new Error(`Windmill geometry intersects the ground plane by ${Math.abs(clearance).toFixed(4)} world units.`);
      }

      const rotor = model.getObjectByName('WM_Rotor');
      const shaft = model.getObjectByName('WM_Shaft');
      const pulley = model.getObjectByName('WM_OutputPulley');
      if (!rotor || !shaft || !pulley) {
        throw new Error('Windmill GLB is missing articulated rotor/shaft/output nodes.');
      }

      physics = createWindmillPhysicsV1(rotor, shaft, pulley);
      canvas.dataset.renderLoaded = 'true';
      canvas.dataset.renderTriangles = countTriangles(model).toString();
      canvas.dataset.renderModelType = 'original-articulated-blender-glb';
      canvas.dataset.renderError = '';
    },
    undefined,
    (error) => {
      canvas.dataset.renderError = error instanceof Error ? error.message : String(error);
      console.error('Windmill GLB failed to load', error);
    },
  );

  canvas.__setWind = (strength: number): void => {
    physics?.setWind(strength);
    if (strength > 0.02) windMode = 1;
    else if (strength < -0.02) windMode = -1;
    else windMode = 0;
  };
  canvas.__startWind = (): void => canvas.__setWind?.(1.20);
  canvas.__reverseWind = (): void => canvas.__setWind?.(-1.20);

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let velocityX = 0;

  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance = 0;
    velocityX = 0;
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
    // Yaw only: preserve the physical up-axis and ground contact.
    reviewRoot.rotation.y += velocityX;
  });
  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragDistance >= 8) return;
    if (windMode > 0) canvas.__reverseWind?.();
    else canvas.__startWind?.();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 120);
  const fitCamera = (width: number, height: number): void => {
    const aspect = width / Math.max(1, height);
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const horizontalTan = verticalTan * aspect;
    const limitingTan = Math.max(0.01, Math.min(verticalTan, horizontalTan));
    const distance = (1.38 / limitingTan) * 1.13;
    // Give the 3/4 product view with the camera, not by tilting the physical object
    // through the support plane.
    camera.position.set(distance * 0.16, 0.18, distance);
    camera.lookAt(0, 0.02, 0.08);
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
    physics?.update(wallDt);

    if (pointerId === null) {
      const damping = Math.pow(0.025, renderDt);
      velocityX *= damping;
      reviewRoot.rotation.y += velocityX;
    }

    if (physics) {
      const t = physics.telemetry();
      canvas.dataset.motionState = t.state;
      canvas.dataset.wind = t.wind.toFixed(3);
      canvas.dataset.rotorOmega = t.rotorOmega.toFixed(3);
      canvas.dataset.rotorAngle = t.rotorAngle.toFixed(3);
      canvas.dataset.aeroTorque = t.aeroTorque.toFixed(3);
      canvas.dataset.maxOmega = t.maxOmega.toFixed(3);
      canvas.dataset.minOmega = t.minOmega.toFixed(3);
      canvas.dataset.maxTorque = t.maxTorque.toFixed(3);
      canvas.dataset.rotationDirection = t.rotationDirection;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
