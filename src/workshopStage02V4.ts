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

const STAGE_VERSION = 'workshop-stage-02-v4-ipad-pointer';
const FIXED_DT = 1 / 120;

type AssetKey = 'ramp' | 'lever' | 'pulley' | 'platform';
type Placeable = { type: AssetKey; object: THREE.Object3D; snapped: boolean; yaw: number };
type Zone = { type: AssetKey; position: THREE.Vector3; radius: number };
type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __resetStage?: () => void;
  __advanceSimulation?: (seconds: number) => void;
  __partScreenPosition?: (type: AssetKey) => { x: number; y: number } | null;
};
type DragState = {
  pointerId: number;
  pointerType: string;
  type: AssetKey;
  source: 'inventory' | 'scene';
  object: THREE.Object3D;
  part: Placeable | null;
  offset: THREE.Vector3;
  lastClientX: number;
  lastClientY: number;
  insideCanvas: boolean;
};

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

function ropeGeometry(weightY: number): THREE.BufferGeometry {
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
  for (const child of [...copy.children]) {
    copy.remove(child);
    (child.position.y >= 0.27 ? moving : fixed).add(child);
  }
  return { fixed, moving };
}

function pointerKind(event: PointerEvent): string {
  return event.pointerType || 'mouse';
}

export async function installWorkshopStage02V4(): Promise<void> {
  await RAPIER.init();
  document.documentElement.classList.add('aaa-workshop-mode');
  document.body.classList.add('aaa-workshop-mode');
  const qaMode = new URLSearchParams(location.search).get('qa') === 'physics';

  document.body.innerHTML = `
    <main class="aaa-workshop">
      <section class="aaa-loading"><span class="aaa-loading__gear">⚙</span><strong>Открываем лабораторию изобретателя…</strong><small>PBR-мастерская · Rapier 3D · touch ready</small></section>
      <header class="aaa-topbar">
        <div class="aaa-stage-badge"><small>STAGE</small><strong>02</strong><span>БАЛАНС И РЕАКЦИЯ</span></div>
        <div class="aaa-goal"><small>ЗАДАЧА</small><strong>Собери цепочку и запусти финальную машину</strong><span>Масса → рычаг → трос → груз → кнопка</span></div>
        <div class="aaa-top-actions"><button data-action="camera">⌂ Камера</button><button data-action="reset">↻ Сброс</button><button class="aaa-play" data-action="play" disabled>▶ PLAY</button></div>
      </header>
      <section class="aaa-view">
        <canvas aria-label="Bright child friendly 3D physics workshop" data-stage-version="${STAGE_VERSION}" data-stage-state="loading"></canvas>
        <aside class="aaa-objectives"><strong>ЦЕЛИ</strong><ol>
          <li data-step="build"><i>1</i><span>Перетащи 4 детали</span></li>
          <li data-step="lever"><i>2</i><span>Качни рычаг тяжёлым шаром</span></li>
          <li data-step="rope"><i>3</i><span>Дёрни трос лёгким шаром</span></li>
          <li data-step="weight"><i>4</i><span>Освободи груз</span></li>
          <li data-step="goal"><i>5</i><span>Нажми кнопку грузом</span></li>
        </ol></aside>
        <aside class="aaa-physics-card"><span>☝️</span><div><strong>Хватай предмет пальцем</strong><small>мышь · touch · Apple Pencil</small></div></aside>
        <div class="aaa-selection" hidden><strong data-selected>Деталь</strong><button data-edit="left">↶</button><button data-edit="right">↷</button><button data-edit="delete">✕</button></div>
        <section class="aaa-win" hidden><div>★</div><small>STAGE 02 COMPLETE</small><h2>Машина заработала!</h2><p>Тяжёлый шар передал импульс рычагу, лёгкий шар дёрнул трос, груз упал на кнопку и запустил финальный механизм.</p><button data-action="again">Собрать ещё раз</button></section>
        <div class="aaa-toast" hidden></div>
      </section>
      <footer class="aaa-inventory">
        <div class="aaa-controls"><button data-action="play" disabled>▶</button><button data-action="reset">↻</button></div>
        <div class="aaa-parts">
          <button class="aaa-part" data-part="ramp"><span class="aaa-thumb" data-thumb="ramp"></span><b>РАМПА</b><em>1</em></button>
          <button class="aaa-part" data-part="lever"><span class="aaa-thumb" data-thumb="lever"></span><b>РЫЧАГ</b><em>1</em></button>
          <button class="aaa-part" data-part="pulley"><span class="aaa-thumb" data-thumb="pulley"></span><b>БЛОК</b><em>1</em></button>
          <button class="aaa-part" data-part="platform"><span class="aaa-thumb" data-thumb="platform"></span><b>ПЛАТФОРМА</b><em>1</em></button>
        </div>
        <div class="aaa-hint"><strong>УПРАВЛЕНИЕ</strong><span>зажми → веди → отпусти</span></div>
      </footer>
    </main>`;

  const root = document.querySelector<HTMLElement>('.aaa-workshop');
  const canvas = document.querySelector<StageCanvas>('.aaa-workshop canvas');
  if (!root || !canvas) throw new Error('Stage 02 DOM missing');

  const touchStyle = document.createElement('style');
  touchStyle.textContent = `
    .aaa-part,.aaa-parts,.aaa-inventory{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
    .aaa-part{touch-action:none}
    .aaa-view canvas{touch-action:none}
    .aaa-part.is-dragging{transform:scale(.97);box-shadow:0 2px 8px rgba(24,93,135,.2)}
  `;
  document.head.appendChild(touchStyle);

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
  const sun = new THREE.DirectionalLight(0xfff0c8, 5.6);
  sun.position.set(7, 9.5, 5.3);
  sun.castShadow = !qaMode;
  sun.shadow.mapSize.set(qaMode ? 256 : 2048, qaMode ? 256 : 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const cool = new THREE.RectAreaLight(0xbfeeff, 8, 5, 5);
  cool.position.set(5.2, 3.4, -3.2); cool.lookAt(0, 1.3, 0); scene.add(cool);
  const warm = new THREE.PointLight(0xffc568, 12, 8, 2);
  warm.position.set(-2.2, 4.2, -1.4); scene.add(warm);

  scene.add(createWorkshopEnvironment());
  const templates: Record<AssetKey, THREE.Object3D> = {
    ramp: createRampAsset(), lever: createLeverAsset(), pulley: createPulleyAsset(), platform: createPlatformAsset(),
  };
  const heavyTemplate = createHeavyBallAsset();
  const lightTemplate = createLightBallAsset();
  const weightVisual = createWeightAsset(); weightVisual.position.set(3.18, 1.92, 0); scene.add(weightVisual);
  const buttonVisual = createButtonAsset(); buttonVisual.position.set(3.18, 0.20, 0); scene.add(buttonVisual);
  const goalVisual = createFinalDeviceAsset(); goalVisual.position.set(5.05, 0.06, 0); scene.add(goalVisual);
  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 14, 42), new THREE.MeshPhysicalMaterial({ color: 0xf6bd36, roughness: 0.32, metalness: 0.24, clearcoat: 0.32 }));
  pullRing.position.set(1.22, 1.46, 0); pullRing.castShadow = true; scene.add(pullRing);
  const ropeLine = new THREE.Line(ropeGeometry(1.92), new THREE.LineBasicMaterial({ color: 0xb77f47 }));
  scene.add(ropeLine);

  const placeables: Placeable[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let selected: Placeable | null = null;
  let drag: DragState | null = null;

  const zoneFor = (type: AssetKey): Zone => ZONES.find((zone) => zone.type === type)!;
  const canvasContains = (x: number, y: number): boolean => {
    const r = canvas.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const screenToWorld = (x: number, y: number, type: AssetKey): THREE.Vector3 | null => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, point)) return null;
    point.x = THREE.MathUtils.clamp(point.x, -5.5, 4.2);
    point.z = THREE.MathUtils.clamp(point.z, -1.7, 1.7);
    point.y = zoneFor(type).position.y;
    return point;
  };
  const snap = (part: Placeable): void => {
    const zone = zoneFor(part.type);
    part.snapped = part.object.position.distanceTo(zone.position) < zone.radius;
    if (part.snapped) {
      part.object.position.copy(zone.position);
      part.yaw = 0;
      part.object.rotation.set(0, 0, part.type === 'ramp' ? -0.19 : 0);
    }
  };
  const buildReady = (): boolean => ZONES.every((zone) => placeables.some((part) => part.type === zone.type && part.snapped));
  const select = (part: Placeable | null): void => {
    selected = part;
    const panel = root.querySelector<HTMLElement>('.aaa-selection');
    if (!panel) return;
    panel.hidden = !part;
    const label = panel.querySelector<HTMLElement>('[data-selected]');
    if (label && part) label.textContent = LABELS[part.type];
  };
  const refresh = (): void => {
    const ready = buildReady();
    canvas.dataset.buildReady = ready ? 'true' : 'false';
    canvas.dataset.placeableCount = String(placeables.length);
    root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((button) => { button.disabled = !ready || canvas.dataset.stageState === 'running'; });
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', ready);
    (Object.keys(templates) as AssetKey[]).forEach((type) => {
      const used = placeables.some((part) => part.type === type);
      const button = root.querySelector<HTMLButtonElement>(`.aaa-part[data-part="${type}"]`);
      if (button) {
        button.disabled = used || canvas.dataset.stageState === 'running';
        const count = button.querySelector('em'); if (count) count.textContent = used ? '0' : '1';
      }
    });
  };
  const makeGhost = (type: AssetKey): THREE.Object3D => {
    const ghost = cloneAsset(templates[type]);
    ghost.visible = false;
    ghost.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const base = Array.isArray(node.material) ? node.material[0] : node.material;
        const material = base.clone(); material.transparent = true; material.opacity = 0.66; node.material = material;
      }
    });
    scene.add(ghost);
    return ghost;
  };
  const beginInventoryDrag = (event: PointerEvent, type: AssetKey, button: HTMLButtonElement): void => {
    if (drag || canvas.dataset.stageState === 'running' || placeables.some((part) => part.type === type)) return;
    event.preventDefault();
    event.stopPropagation();
    try { button.setPointerCapture(event.pointerId); } catch { /* Safari may reject synthetic capture */ }
    button.classList.add('is-dragging');
    drag = { pointerId: event.pointerId, pointerType: pointerKind(event), type, source: 'inventory', object: makeGhost(type), part: null, offset: new THREE.Vector3(), lastClientX: event.clientX, lastClientY: event.clientY, insideCanvas: false };
    controls.enabled = false;
    canvas.dataset.dragging = 'true';
    canvas.dataset.lastDragSource = `inventory-${pointerKind(event)}`;
  };
  const beginSceneDrag = (event: PointerEvent, part: Placeable, point: THREE.Vector3): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try { canvas.setPointerCapture(event.pointerId); } catch { /* no-op */ }
    select(part);
    drag = { pointerId: event.pointerId, pointerType: pointerKind(event), type: part.type, source: 'scene', object: part.object, part, offset: part.object.position.clone().sub(point), lastClientX: event.clientX, lastClientY: event.clientY, insideCanvas: true };
    controls.enabled = false;
    canvas.dataset.dragging = 'true';
    canvas.dataset.lastDragSource = `scene-${pointerKind(event)}`;
  };
  const moveActiveDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.lastClientX = event.clientX; drag.lastClientY = event.clientY;
    drag.insideCanvas = canvasContains(event.clientX, event.clientY);
    if (!drag.insideCanvas) { if (drag.source === 'inventory') drag.object.visible = false; return; }
    const point = screenToWorld(event.clientX, event.clientY, drag.type);
    if (!point) return;
    drag.object.visible = true;
    drag.object.position.copy(point.add(drag.offset));
    const zone = zoneFor(drag.type);
    if (drag.object.position.distanceTo(zone.position) < zone.radius * 0.72) drag.object.position.lerp(zone.position, 0.64);
  };
  const endActiveDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const current = drag;
    drag = null;
    root.querySelectorAll('.aaa-part.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
    canvas.dataset.dragging = 'false';
    controls.enabled = true;
    if (current.source === 'inventory') {
      scene.remove(current.object);
      if (current.insideCanvas) {
        const object = cloneAsset(templates[current.type]); object.position.copy(current.object.position); object.visible = true; scene.add(object);
        const part: Placeable = { type: current.type, object, snapped: false, yaw: 0 }; snap(part); placeables.push(part); select(part);
      }
    } else if (current.part) {
      snap(current.part);
      select(current.part);
    }
    refresh();
  };

  root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => {
    button.addEventListener('pointerdown', (event) => beginInventoryDrag(event, button.dataset.part as AssetKey, button));
  });
  window.addEventListener('pointermove', moveActiveDrag, { passive: false });
  window.addEventListener('pointerup', endActiveDrag, { passive: false });
  window.addEventListener('pointercancel', endActiveDrag, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (drag || canvas.dataset.stageState === 'running') return;
    const point = screenToWorld(event.clientX, event.clientY, 'platform');
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const lookup = new Map<THREE.Object3D, Placeable>();
    const meshes: THREE.Object3D[] = [];
    for (const part of placeables) part.object.traverse((node) => { if (node instanceof THREE.Mesh) { lookup.set(node, part); meshes.push(node); } });
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const part = hit ? lookup.get(hit.object) ?? null : null;
    if (part && point) beginSceneDrag(event, part, screenToWorld(event.clientX, event.clientY, part.type) ?? point);
    else select(null);
  }, { capture: true });

  let simulation: Stage02Physics | null = null;
  let heavyVisual: THREE.Object3D | null = null;
  let lightVisual: THREE.Object3D | null = null;
  let leverFixed: THREE.Group | null = null;
  let leverMoving: THREE.Group | null = null;
  let leverPart: Placeable | null = null;
  let previousLever = false, previousRope = false, previousWeight = false;
  let accumulator = 0;
  let previousTime = performance.now();

  const setStep = (step: string, active = false): void => {
    const el = root.querySelector<HTMLElement>(`[data-step="${step}"]`); if (!el) return;
    if (active) el.classList.add('active'); else { el.classList.add('done'); el.classList.remove('active'); }
  };
  const cleanupRun = (): void => {
    simulation?.free(); simulation = null;
    if (heavyVisual) scene.remove(heavyVisual); if (lightVisual) scene.remove(lightVisual); if (leverFixed) scene.remove(leverFixed); if (leverMoving) scene.remove(leverMoving);
    heavyVisual = null; lightVisual = null; leverFixed = null; leverMoving = null;
    if (leverPart) leverPart.object.visible = true;
  };
  const sync = (): void => {
    if (!simulation) return;
    if (heavyVisual) syncTransform(heavyVisual, simulation.heavyBody);
    if (lightVisual) syncTransform(lightVisual, simulation.lightBody);
    if (leverMoving) syncTransform(leverMoving, simulation.leverBody);
    syncTransform(weightVisual, simulation.weightBody);
    const state = simulation.state;
    canvas.dataset.leverActivated = state.leverActivated ? 'true' : 'false';
    canvas.dataset.ropePulled = state.ropePulled ? 'true' : 'false';
    canvas.dataset.weightPressed = state.weightPressed ? 'true' : 'false';
    canvas.dataset.goalPowered = state.goalPowered ? 'true' : 'false';
    const weightY = simulation.weightBody.translation().y;
    ropeLine.geometry.dispose(); ropeLine.geometry = ropeGeometry(weightY);
    if (state.leverActivated && !previousLever) { setStep('lever'); setStep('rope', true); }
    if (state.ropePulled && !previousRope) { setStep('rope'); setStep('weight', true); }
    if (state.weightPressed && !previousWeight) { setStep('weight'); setStep('goal'); }
    previousLever = state.leverActivated; previousRope = state.ropePulled; previousWeight = state.weightPressed;
    if (state.goalPowered && canvas.dataset.stageState !== 'won') {
      canvas.dataset.stageState = 'won'; root.querySelector<HTMLElement>('.aaa-win')!.hidden = false; refresh();
    }
  };
  const start = (): void => {
    if (!buildReady() || simulation) return;
    simulation = createStage02Physics(); accumulator = 0; previousLever = false; previousRope = false; previousWeight = false;
    canvas.dataset.stageState = 'running'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
    heavyVisual = cloneAsset(heavyTemplate); lightVisual = cloneAsset(lightTemplate); scene.add(heavyVisual, lightVisual);
    leverPart = placeables.find((part) => part.type === 'lever') ?? null;
    if (leverPart) {
      leverPart.object.visible = false;
      const split = splitLeverVisual(templates.lever); leverFixed = split.fixed; leverMoving = split.moving;
      leverFixed.position.set(-0.75, 0.74, 0); scene.add(leverFixed, leverMoving);
    }
    setStep('lever', true); refresh(); sync();
  };
  const reset = (): void => {
    cleanupRun(); weightVisual.position.set(3.18, 1.92, 0); weightVisual.quaternion.identity(); ropeLine.geometry.dispose(); ropeLine.geometry = ropeGeometry(1.92);
    canvas.dataset.stageState = 'build'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
    root.querySelector<HTMLElement>('.aaa-win')!.hidden = true; root.querySelectorAll('.aaa-objectives li').forEach((el) => el.classList.remove('done', 'active')); refresh();
  };
  const canonical = (): void => {
    if (simulation) return;
    for (const part of placeables) scene.remove(part.object); placeables.length = 0;
    for (const zone of ZONES) {
      const object = cloneAsset(templates[zone.type]); object.position.copy(zone.position); object.rotation.set(0, 0, zone.type === 'ramp' ? -0.19 : 0); scene.add(object);
      placeables.push({ type: zone.type, object, snapped: true, yaw: 0 });
    }
    select(null); refresh();
  };
  canvas.__applyCanonicalSolution = canonical;
  canvas.__startStage = start;
  canvas.__resetStage = reset;
  canvas.__advanceSimulation = (seconds: number): void => { if (!simulation) return; simulation.advance(seconds); sync(); };
  canvas.__partScreenPosition = (type: AssetKey) => {
    const part = placeables.find((item) => item.type === type); if (!part) return null;
    const p = part.object.position.clone().project(camera); const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'play') start();
    if (action === 'reset' || action === 'again') reset();
    if (action === 'camera') { camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update(); }
    if (edit && selected && !simulation) {
      if (edit === 'left') selected.yaw += Math.PI / 12;
      if (edit === 'right') selected.yaw -= Math.PI / 12;
      if (edit === 'delete') { scene.remove(selected.object); placeables.splice(placeables.indexOf(selected), 1); select(null); refresh(); return; }
      selected.object.rotation.y = selected.yaw; selected.snapped = false; refresh();
    }
  });

  const resize = (): void => {
    const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();
  canvas.dataset.stageState = 'build'; canvas.dataset.buildReady = 'false'; canvas.dataset.physics = 'rapier3d-0.19.3-shared-stage02-physics-v1'; canvas.dataset.assetPipeline = 'original-pbr-mesh-kit-v1'; canvas.dataset.visualTarget = 'bright-child-aaa-workshop-v1'; canvas.dataset.inputSystem = 'unified-pointer-events-v1'; canvas.dataset.touchReady = 'true'; canvas.dataset.dragging = 'false'; canvas.dataset.placeableCount = '0'; canvas.dataset.qaMode = qaMode ? 'physics' : 'off';
  canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
  root.querySelector<HTMLElement>('.aaa-loading')?.classList.add('ready'); refresh();

  const loop = (now: number): void => {
    requestAnimationFrame(loop);
    const dt = Math.min((now - previousTime) / 1000, 0.12); previousTime = now;
    if (simulation && canvas.dataset.stageState === 'running') {
      accumulator += dt;
      while (accumulator >= FIXED_DT) { simulation.step(); accumulator -= FIXED_DT; }
      sync();
    }
    controls.update(); renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
}
