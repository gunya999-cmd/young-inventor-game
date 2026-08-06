import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createWorkshopEnvironment,
  createRampAsset,
  createLeverAsset,
  createPulleyAsset,
  createPlatformAsset,
  createHeavyBallAsset,
  createLightBallAsset,
  createWeightAsset,
  createButtonAsset,
  createFinalDeviceAsset,
} from './workshopAssetKit';
import { createStage02Physics, type Stage02Physics } from './workshopStage02Physics';

const STAGE_VERSION = 'workshop-stage-02-v3';
const FIXED_DT = 1 / 120;

type AssetKey = 'ramp' | 'lever' | 'pulley' | 'platform';
type Placeable = { type: AssetKey; object: THREE.Object3D; snapped: boolean; yaw: number };
type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __resetStage?: () => void;
  __advanceSimulation?: (seconds: number) => void;
};
type Zone = { type: AssetKey; position: THREE.Vector3; radius: number };

const ZONES: Zone[] = [
  { type: 'ramp', position: new THREE.Vector3(-3.55, 1.05, 0), radius: 1.45 },
  { type: 'lever', position: new THREE.Vector3(-0.75, 0.74, 0), radius: 1.18 },
  { type: 'platform', position: new THREE.Vector3(0.76, 0.50, 0), radius: 1.05 },
  { type: 'pulley', position: new THREE.Vector3(2.20, 2.55, 0), radius: 1.30 },
];
const LABELS: Record<AssetKey, string> = { ramp: 'Рампа', lever: 'Рычаг', pulley: 'Блок', platform: 'Платформа' };

function cloneAsset(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  clone.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return clone;
}

function syncTransform(object: THREE.Object3D, body: any): void {
  const p = body.translation();
  const q = body.rotation();
  object.position.set(p.x, p.y, p.z);
  object.quaternion.set(q.x, q.y, q.z, q.w);
}

function makeRopeGeometry(weightY: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(1.22, 1.46, 0),
    new THREE.Vector3(2.20, 3.02, 0),
    new THREE.Vector3(3.18, 3.02, 0),
    new THREE.Vector3(3.18, weightY + 0.48, 0),
  ]);
}

function splitLeverVisual(source: THREE.Object3D): { fixed: THREE.Group; moving: THREE.Group } {
  const copy = cloneAsset(source);
  const fixed = new THREE.Group();
  const moving = new THREE.Group();
  const children = [...copy.children];
  for (const child of children) {
    copy.remove(child);
    // Beam, wooden cap and end pads live at y >= 0.28 in the authored kit.
    (child.position.y >= 0.27 ? moving : fixed).add(child);
  }
  return { fixed, moving };
}

export async function installWorkshopStage02V3(): Promise<void> {
  await RAPIER.init();
  document.documentElement.classList.add('aaa-workshop-mode');
  document.body.classList.add('aaa-workshop-mode');
  const qaMode = new URLSearchParams(location.search).get('qa') === 'physics';

  document.body.innerHTML = `
    <main class="aaa-workshop">
      <section class="aaa-loading"><span class="aaa-loading__gear">⚙</span><strong>Открываем лабораторию изобретателя…</strong><small>PBR-мастерская · Rapier 3D</small></section>
      <header class="aaa-topbar">
        <div class="aaa-stage-badge"><small>STAGE</small><strong>02</strong><span>БАЛАНС И РЕАКЦИЯ</span></div>
        <div class="aaa-goal"><small>ЗАДАЧА</small><strong>Собери цепочку и запусти финальную машину</strong><span>Масса → рычаг → трос → груз → кнопка</span></div>
        <div class="aaa-top-actions"><button data-action="camera">⌂ Камера</button><button data-action="reset">↻ Сброс</button><button class="aaa-play" data-action="play" disabled>▶ PLAY</button></div>
      </header>
      <section class="aaa-view">
        <canvas aria-label="Bright child friendly 3D physics workshop" data-stage-version="${STAGE_VERSION}" data-stage-state="loading"></canvas>
        <aside class="aaa-objectives"><strong>ЦЕЛИ</strong><ol>
          <li data-step="build"><i>1</i><span>Поставь 4 детали</span></li>
          <li data-step="lever"><i>2</i><span>Качни рычаг тяжёлым шаром</span></li>
          <li data-step="rope"><i>3</i><span>Дёрни трос лёгким шаром</span></li>
          <li data-step="weight"><i>4</i><span>Освободи груз</span></li>
          <li data-step="goal"><i>5</i><span>Нажми кнопку грузом</span></li>
        </ol></aside>
        <aside class="aaa-physics-card"><span>💡</span><div><strong>Настоящая 3D-физика</strong><small>масса · трение · момент силы · столкновения</small></div></aside>
        <div class="aaa-selection" hidden><strong data-selected>Деталь</strong><button data-edit="left">↶</button><button data-edit="right">↷</button><button data-edit="delete">✕</button></div>
        <section class="aaa-win" hidden><div>★</div><small>STAGE 02 COMPLETE</small><h2>Машина заработала!</h2><p>Тяжёлый шар передал импульс рычагу, лёгкий шар дёрнул трос, груз упал на кнопку и запустил финальный механизм.</p><button data-action="again">Собрать ещё раз</button></section>
        <div class="aaa-toast" hidden></div>
      </section>
      <footer class="aaa-inventory">
        <div class="aaa-controls"><button data-action="play" disabled>▶</button><button data-action="reset">↻</button></div>
        <div class="aaa-parts">
          <button class="aaa-part" draggable="true" data-part="ramp"><span class="aaa-thumb" data-thumb="ramp"></span><b>РАМПА</b><em>1</em></button>
          <button class="aaa-part" draggable="true" data-part="lever"><span class="aaa-thumb" data-thumb="lever"></span><b>РЫЧАГ</b><em>1</em></button>
          <button class="aaa-part" draggable="true" data-part="pulley"><span class="aaa-thumb" data-thumb="pulley"></span><b>БЛОК</b><em>1</em></button>
          <button class="aaa-part" draggable="true" data-part="platform"><span class="aaa-thumb" data-thumb="platform"></span><b>ПЛАТФОРМА</b><em>1</em></button>
        </div>
        <div class="aaa-hint"><strong>ЦЕПОЧКА</strong><span>● → ⚖ → ○ → ◉ → ▼ → 🔴 → ⚙</span></div>
      </footer>
    </main>`;

  const root = document.querySelector<HTMLElement>('.aaa-workshop');
  const canvas = document.querySelector<StageCanvas>('.aaa-workshop canvas');
  if (!root || !canvas) throw new Error('Stage 02 DOM missing');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !qaMode, powerPreference: 'high-performance' });
  renderer.setPixelRatio(qaMode ? 0.7 : Math.min(devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = !qaMode;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdff3ff);
  scene.fog = new THREE.Fog(0xdff3ff, 16, 29);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 70);
  const homePosition = new THREE.Vector3(8.8, 5.8, 10.1);
  const homeTarget = new THREE.Vector3(-0.2, 1.2, 0);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 7.4;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.62;
  controls.maxPolarAngle = 1.27;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf1fbff, 0xc99964, 2.2));
  const sunlight = new THREE.DirectionalLight(0xfff0c8, 5.6);
  sunlight.position.set(7, 9.5, 5.3);
  sunlight.castShadow = !qaMode;
  sunlight.shadow.mapSize.set(qaMode ? 256 : 2048, qaMode ? 256 : 2048);
  sunlight.shadow.camera.left = -9;
  sunlight.shadow.camera.right = 9;
  sunlight.shadow.camera.top = 8;
  sunlight.shadow.camera.bottom = -4;
  sunlight.shadow.bias = -0.0003;
  scene.add(sunlight);
  const windowFill = new THREE.RectAreaLight(0xbfeeff, 8, 5, 5);
  windowFill.position.set(5.2, 3.4, -3.2);
  windowFill.lookAt(0, 1.3, 0);
  scene.add(windowFill);
  const warmFill = new THREE.PointLight(0xffc568, 12, 8, 2);
  warmFill.position.set(-2.2, 4.2, -1.4);
  scene.add(warmFill);

  scene.add(createWorkshopEnvironment());
  const templates: Record<AssetKey, THREE.Object3D> = {
    ramp: createRampAsset(),
    lever: createLeverAsset(),
    pulley: createPulleyAsset(),
    platform: createPlatformAsset(),
  };
  const heavyTemplate = createHeavyBallAsset();
  const lightTemplate = createLightBallAsset();
  const weightVisual = createWeightAsset();
  weightVisual.position.set(3.18, 1.92, 0);
  scene.add(weightVisual);
  const buttonVisual = createButtonAsset();
  buttonVisual.position.set(3.18, 0.20, 0);
  scene.add(buttonVisual);
  const goalVisual = createFinalDeviceAsset();
  goalVisual.position.set(5.05, 0.06, 0);
  scene.add(goalVisual);
  const pullRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.04, 14, 42),
    new THREE.MeshPhysicalMaterial({ color: 0xf6bd36, roughness: 0.32, metalness: 0.24, clearcoat: 0.32 })
  );
  pullRing.position.set(1.22, 1.46, 0);
  pullRing.castShadow = true;
  scene.add(pullRing);
  const ropeLine = new THREE.Line(makeRopeGeometry(1.92), new THREE.LineBasicMaterial({ color: 0xb77f47 }));
  scene.add(ropeLine);

  const placeables: Placeable[] = [];
  let selected: Placeable | null = null;
  let dragType: AssetKey | null = null;
  let dragGhost: THREE.Object3D | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const zoneFor = (type: AssetKey): Zone => ZONES.find((zone) => zone.type === type)!;
  const snap = (part: Placeable): void => {
    const zone = zoneFor(part.type);
    part.snapped = part.object.position.distanceTo(zone.position) < zone.radius;
    if (part.snapped) {
      part.object.position.copy(zone.position);
      part.object.rotation.set(0, 0, 0);
      part.yaw = 0;
    }
  };
  const buildReady = (): boolean => ZONES.every((zone) => placeables.some((part) => part.type === zone.type && part.snapped));
  const updateUi = (): void => {
    const ready = buildReady();
    canvas.dataset.buildReady = ready ? 'true' : 'false';
    root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((button) => { button.disabled = !ready || canvas.dataset.stageState === 'running'; });
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', ready);
    (Object.keys(templates) as AssetKey[]).forEach((type) => {
      const used = placeables.some((part) => part.type === type);
      const button = root.querySelector<HTMLButtonElement>(`.aaa-part[data-part="${type}"]`);
      if (button) {
        button.disabled = used || canvas.dataset.stageState === 'running';
        const count = button.querySelector('em');
        if (count) count.textContent = used ? '0' : '1';
      }
    });
  };
  const setSelection = (part: Placeable | null): void => {
    selected = part;
    const panel = root.querySelector<HTMLElement>('.aaa-selection');
    if (!panel) return;
    panel.hidden = !part;
    const label = panel.querySelector<HTMLElement>('[data-selected]');
    if (label && part) label.textContent = LABELS[part.type];
  };
  const updatePointer = (x: number, y: number): void => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
  };
  const beginDrag = (type: AssetKey): void => {
    if (canvas.dataset.stageState === 'running' || placeables.some((part) => part.type === type)) return;
    dragType = type;
    dragGhost = cloneAsset(templates[type]);
    dragGhost.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const base = Array.isArray(node.material) ? node.material[0] : node.material;
        const ghost = base.clone();
        ghost.transparent = true;
        ghost.opacity = 0.62;
        node.material = ghost;
      }
    });
    scene.add(dragGhost);
    controls.enabled = false;
  };
  const moveDrag = (x: number, y: number): void => {
    if (!dragGhost || !dragType) return;
    updatePointer(x, y);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, point)) return;
    point.x = THREE.MathUtils.clamp(point.x, -5.5, 4.2);
    point.z = THREE.MathUtils.clamp(point.z, -1.7, 1.7);
    dragGhost.position.copy(point);
    const zone = zoneFor(dragType);
    if (point.distanceTo(zone.position) < zone.radius) dragGhost.position.lerp(zone.position, 0.58);
  };
  const endDrag = (): void => {
    if (!dragGhost || !dragType) return;
    const object = cloneAsset(templates[dragType]);
    object.position.copy(dragGhost.position);
    scene.remove(dragGhost);
    scene.add(object);
    const part: Placeable = { type: dragType, object, snapped: false, yaw: 0 };
    snap(part);
    placeables.push(part);
    dragGhost = null;
    dragType = null;
    controls.enabled = true;
    setSelection(part);
    updateUi();
  };

  root.addEventListener('dragstart', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.aaa-part');
    if (button) beginDrag(button.dataset.part as AssetKey);
  });
  root.addEventListener('dragend', endDrag);
  canvas.addEventListener('dragover', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); });
  canvas.addEventListener('drop', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); endDrag(); });
  root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    beginDrag(button.dataset.part as AssetKey);
    moveDrag(event.clientX, event.clientY);
    const move = (moveEvent: PointerEvent): void => moveDrag(moveEvent.clientX, moveEvent.clientY);
    const up = (): void => { window.removeEventListener('pointermove', move); endDrag(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }));
  canvas.addEventListener('pointerdown', (event) => {
    if (canvas.dataset.stageState === 'running' || dragGhost) return;
    updatePointer(event.clientX, event.clientY);
    const lookup = new Map<THREE.Object3D, Placeable>();
    const meshes: THREE.Object3D[] = [];
    placeables.forEach((part) => part.object.traverse((node) => {
      if (node instanceof THREE.Mesh) { lookup.set(node, part); meshes.push(node); }
    }));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    setSelection(hit ? lookup.get(hit.object) ?? null : null);
  });

  let simulation: Stage02Physics | null = null;
  let heavyVisual: THREE.Object3D | null = null;
  let lightVisual: THREE.Object3D | null = null;
  let leverFixed: THREE.Group | null = null;
  let leverMoving: THREE.Group | null = null;
  let leverPlaceable: Placeable | null = null;
  let accumulator = 0;
  let previousTime = performance.now();
  let previousLever = false;
  let previousRope = false;
  let previousWeight = false;

  const setStep = (step: string, active = false): void => {
    const element = root.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!element) return;
    if (active) element.classList.add('active');
    else { element.classList.add('done'); element.classList.remove('active'); }
  };
  const showToast = (message: string): void => {
    const element = root.querySelector<HTMLElement>('.aaa-toast');
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    setTimeout(() => { element.hidden = true; }, 1500);
  };
  const removeRunVisuals = (): void => {
    if (heavyVisual) scene.remove(heavyVisual);
    if (lightVisual) scene.remove(lightVisual);
    if (leverFixed) scene.remove(leverFixed);
    if (leverMoving) scene.remove(leverMoving);
    heavyVisual = null;
    lightVisual = null;
    leverFixed = null;
    leverMoving = null;
    if (leverPlaceable) leverPlaceable.object.visible = true;
  };
  const syncSimulation = (): void => {
    if (!simulation) return;
    if (heavyVisual) syncTransform(heavyVisual, simulation.heavyBody);
    if (lightVisual) syncTransform(lightVisual, simulation.lightBody);
    if (leverMoving) syncTransform(leverMoving, simulation.leverBody);
    syncTransform(weightVisual, simulation.weightBody);
    const weightY = simulation.weightBody.translation().y;
    ropeLine.geometry.dispose();
    ropeLine.geometry = makeRopeGeometry(weightY);
    const state = simulation.state;
    canvas.dataset.leverActivated = state.leverActivated ? 'true' : 'false';
    canvas.dataset.ropePulled = state.ropePulled ? 'true' : 'false';
    canvas.dataset.weightPressed = state.weightPressed ? 'true' : 'false';
    canvas.dataset.goalPowered = state.goalPowered ? 'true' : 'false';
    const hp = simulation.heavyBody.translation();
    const lp = simulation.lightBody.translation();
    canvas.dataset.heavyBall = `${hp.x.toFixed(2)},${hp.y.toFixed(2)}`;
    canvas.dataset.lightBall = `${lp.x.toFixed(2)},${lp.y.toFixed(2)}`;
    canvas.dataset.weightY = weightY.toFixed(2);

    if (state.leverActivated && !previousLever) { setStep('lever'); setStep('rope', true); }
    if (state.ropePulled && !previousRope) { setStep('rope'); setStep('weight', true); showToast('Трос дёрнут — груз освобождён!'); }
    if (state.weightPressed && !previousWeight) { setStep('weight'); setStep('goal'); }
    previousLever = state.leverActivated;
    previousRope = state.ropePulled;
    previousWeight = state.weightPressed;

    if (state.goalPowered && canvas.dataset.stageState !== 'won') {
      canvas.dataset.stageState = 'won';
      root.querySelector<HTMLElement>('.aaa-win')!.hidden = false;
      root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((button) => { button.disabled = true; });
      const beacon = goalVisual.getObjectByName('SuccessBeacon');
      if (beacon) beacon.scale.setScalar(1.32);
    }
  };
  const startStage = (): void => {
    if (!buildReady() || canvas.dataset.stageState === 'running') return;
    simulation?.free();
    simulation = createStage02Physics();
    accumulator = 0;
    previousLever = false;
    previousRope = false;
    previousWeight = false;
    canvas.dataset.stageState = 'running';
    canvas.dataset.leverActivated = 'false';
    canvas.dataset.ropePulled = 'false';
    canvas.dataset.weightPressed = 'false';
    canvas.dataset.goalPowered = 'false';
    root.querySelector<HTMLElement>('.aaa-win')!.hidden = true;
    root.querySelectorAll('.aaa-objectives li').forEach((node) => {
      if ((node as HTMLElement).dataset.step !== 'build') node.classList.remove('done', 'active');
    });
    setStep('lever', true);

    const ramp = placeables.find((part) => part.type === 'ramp');
    if (ramp) {
      ramp.object.position.set(-3.55, 1.05, 0);
      ramp.object.rotation.set(0, 0, -0.19);
    }
    leverPlaceable = placeables.find((part) => part.type === 'lever') ?? null;
    if (leverPlaceable) {
      leverPlaceable.object.visible = false;
      const split = splitLeverVisual(templates.lever);
      leverFixed = split.fixed;
      leverMoving = split.moving;
      leverFixed.position.set(-0.75, 0.74, 0);
      leverMoving.position.set(-0.75, 0.74, 0);
      scene.add(leverFixed, leverMoving);
    }
    heavyVisual = cloneAsset(heavyTemplate);
    lightVisual = cloneAsset(lightTemplate);
    scene.add(heavyVisual, lightVisual);
    syncSimulation();
    updateUi();
  };
  const resetStage = (): void => {
    simulation?.free();
    simulation = null;
    removeRunVisuals();
    weightVisual.position.set(3.18, 1.92, 0);
    weightVisual.quaternion.identity();
    ropeLine.geometry.dispose();
    ropeLine.geometry = makeRopeGeometry(1.92);
    canvas.dataset.stageState = 'build';
    canvas.dataset.leverActivated = 'false';
    canvas.dataset.ropePulled = 'false';
    canvas.dataset.weightPressed = 'false';
    canvas.dataset.goalPowered = 'false';
    root.querySelector<HTMLElement>('.aaa-win')!.hidden = true;
    root.querySelectorAll('.aaa-objectives li').forEach((node) => node.classList.remove('done', 'active'));
    updateUi();
  };
  const canonicalSolution = (): void => {
    if (canvas.dataset.stageState === 'running') return;
    placeables.forEach((part) => scene.remove(part.object));
    placeables.length = 0;
    setSelection(null);
    ZONES.forEach((zone) => {
      const object = cloneAsset(templates[zone.type]);
      object.position.copy(zone.position);
      scene.add(object);
      placeables.push({ type: zone.type, object, snapped: true, yaw: 0 });
    });
    updateUi();
  };
  const advanceSimulation = (seconds: number): void => {
    if (!simulation || canvas.dataset.stageState !== 'running') return;
    simulation.advance(seconds);
    syncSimulation();
  };

  canvas.__applyCanonicalSolution = canonicalSolution;
  canvas.__startStage = startStage;
  canvas.__resetStage = resetStage;
  canvas.__advanceSimulation = advanceSimulation;

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'play') startStage();
    if (action === 'reset' || action === 'again') resetStage();
    if (action === 'camera') { camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update(); }
    if (edit && selected && canvas.dataset.stageState === 'build') {
      if (edit === 'delete') {
        scene.remove(selected.object);
        placeables.splice(placeables.indexOf(selected), 1);
        setSelection(null);
        updateUi();
        return;
      }
      selected.yaw += edit === 'left' ? Math.PI / 12 : -Math.PI / 12;
      selected.object.rotation.y = selected.yaw;
      snap(selected);
      updateUi();
    }
  });

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.dataset.stageState = 'build';
  canvas.dataset.buildReady = 'false';
  canvas.dataset.physics = 'rapier3d-0.19.3-shared-stage02-physics-v1';
  canvas.dataset.assetPipeline = 'original-pbr-mesh-kit-v1';
  canvas.dataset.visualTarget = 'bright-child-aaa-workshop-v1';
  canvas.dataset.leverActivated = 'false';
  canvas.dataset.ropePulled = 'false';
  canvas.dataset.weightPressed = 'false';
  canvas.dataset.goalPowered = 'false';
  canvas.dataset.qaMode = qaMode ? 'physics' : 'off';
  root.querySelector<HTMLElement>('.aaa-loading')?.classList.add('ready');
  updateUi();

  const animate = (now: number): void => {
    requestAnimationFrame(animate);
    const elapsed = Math.min((now - previousTime) / 1000, 0.08);
    previousTime = now;
    if (!qaMode && simulation && canvas.dataset.stageState === 'running') {
      accumulator += elapsed;
      while (accumulator >= FIXED_DT && !simulation.state.goalPowered) {
        simulation.step();
        accumulator -= FIXED_DT;
      }
      syncSimulation();
    }
    controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(animate);
}
