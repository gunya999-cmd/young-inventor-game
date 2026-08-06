import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createWorkshopEnvironment,
  createRampAsset,
  createLeverAsset,
  createPlatformAsset,
  createHeavyBallAsset,
} from './workshopAssetKit';
import {
  createCampaignStage01Physics,
  type Stage01PartType,
  type Stage01Placement,
  type Stage01Physics,
} from './campaignStage01Physics';

const STAGE_VERSION = 'campaign-stage-01-v1-free-build-275d';
const FIXED_DT = 1 / 120;
const WORK_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const XY_MIN = new THREE.Vector2(-5.45, 0.25);
const XY_MAX = new THREE.Vector2(4.55, 3.80);

type PartInstance = {
  id: string;
  type: Stage01PartType;
  object: THREE.Object3D;
  rotationZ: number;
};

type DragState = {
  pointerId: number;
  source: 'inventory' | 'scene';
  type: Stage01PartType;
  part: PartInstance | null;
  object: THREE.Object3D;
  offset: THREE.Vector2;
  insideCanvas: boolean;
};

type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __stopStage?: () => void;
  __advanceSimulation?: (seconds: number) => void;
  __partCount?: () => number;
};

const INVENTORY_MAX: Record<Stage01PartType, number> = { ramp: 2, lever: 1, platform: 1 };
const LABELS: Record<Stage01PartType, string> = { ramp: 'Рампа', lever: 'Рычаг', platform: 'Платформа' };

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

function syncBody(object: THREE.Object3D, body: any): void {
  const p = body.translation();
  const q = body.rotation();
  object.position.set(p.x, p.y, p.z);
  object.quaternion.set(q.x, q.y, q.z, q.w);
}

function createStartShelfVisual(): THREE.Object3D {
  const g = new THREE.Group();
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x218ed0, roughness: 0.34, metalness: 0.16, clearcoat: 0.28 });
  const wood = new THREE.MeshPhysicalMaterial({ color: 0xc68d55, roughness: 0.62, clearcoat: 0.10 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xa8b4bb, roughness: 0.24, metalness: 0.84 });
  const deck = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.17, 0.90, 5, 0.055), wood);
  g.add(deck);
  for (const x of [-0.78, 0.78]) {
    const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.72, 0.12, 4, 0.025), blue);
    bracket.position.set(x, -0.42, 0);
    g.add(bracket);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 28), steel);
    foot.position.set(x, -0.81, 0);
    g.add(foot);
  }
  g.rotation.z = -0.10;
  g.position.set(-4.75, 2.72, 0);
  g.traverse((n) => { if (n instanceof THREE.Mesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}

function createGoalReceiverVisual(): THREE.Object3D {
  const g = new THREE.Group();
  const teal = new THREE.MeshPhysicalMaterial({ color: 0x1aa7aa, roughness: 0.34, metalness: 0.12, clearcoat: 0.30 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf6bd36, roughness: 0.38, metalness: 0.08, clearcoat: 0.20 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xa2afb7, roughness: 0.24, metalness: 0.86 });
  const green = new THREE.MeshStandardMaterial({ color: 0x65da72, emissive: 0x32d85a, emissiveIntensity: 0.35, roughness: 0.34 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.20, 1.02, 5, 0.07), teal);
  base.position.y = -0.42;
  g.add(base);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.18, 1.02, 5, 0.055), yellow);
  back.position.set(0.70, 0.04, 0);
  g.add(back);
  for (const z of [-0.46, 0.46]) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(1.46, 0.10, 0.09, 4, 0.025), steel);
    rail.position.set(-0.02, 0.00, z);
    g.add(rail);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 16, 56), green);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-0.10, 0.03, 0);
  ring.name = 'GoalGlow';
  g.add(ring);
  const label = new THREE.Mesh(new RoundedBoxGeometry(0.70, 0.22, 0.05, 4, 0.045), yellow);
  label.position.set(0.27, 0.46, 0.54);
  g.add(label);
  g.position.set(4.55, 0.62, 0);
  g.traverse((n) => { if (n instanceof THREE.Mesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}

export async function installCampaignStage01(): Promise<void> {
  await RAPIER.init();
  document.documentElement.classList.add('aaa-workshop-mode');
  document.body.classList.add('aaa-workshop-mode');
  const qaMode = new URLSearchParams(location.search).get('qa') === 'physics';

  document.body.innerHTML = `
    <main class="aaa-workshop campaign-stage01">
      <section class="aaa-loading"><span class="aaa-loading__gear">⚙</span><strong>Готовим первую машину…</strong><small>Свободная сборка · Rapier 3D · iPad ready</small></section>
      <header class="aaa-topbar">
        <div class="aaa-stage-badge"><small>ЭТАП</small><strong>01</strong><span>ПЕРВЫЙ МАРШРУТ</span></div>
        <div class="aaa-goal"><small>ЗАДАЧА</small><strong>Доставь стальной шар в зелёный приёмник</strong><span>Поставь детали как хочешь. Единственного решения нет.</span></div>
        <div class="aaa-top-actions"><button data-action="camera">⌂ Вид</button><button data-action="clear">Очистить</button><button class="aaa-play" data-action="run" disabled>▶ ПУСК</button></div>
      </header>
      <section class="aaa-view">
        <canvas aria-label="Young Inventor campaign stage 01" data-stage-version="${STAGE_VERSION}" data-stage-state="loading"></canvas>
        <aside class="aaa-objectives"><strong>ПЕРВЫЙ ЭКСПЕРИМЕНТ</strong><ol>
          <li class="done"><i>1</i><span>Шар уже готов к старту</span></li>
          <li data-step="build"><i>2</i><span>Построй для него маршрут</span></li>
          <li data-step="run"><i>3</i><span>Запусти и наблюдай</span></li>
          <li data-step="goal"><i>4</i><span>Попади в зелёный приёмник</span></li>
        </ol></aside>
        <aside class="aaa-physics-card"><span>💡</span><div><strong>Подумай о наклоне</strong><small>выше → больше потенциальной энергии</small></div></aside>
        <div class="aaa-selection" hidden>
          <strong data-selected>Деталь</strong>
          <button data-edit="left" aria-label="Повернуть против часовой">↶</button>
          <button data-edit="right" aria-label="Повернуть по часовой">↷</button>
          <button data-edit="delete" aria-label="Удалить">✕</button>
        </div>
        <section class="aaa-win" hidden><div>★</div><small>ЭТАП 01 ПРОЙДЕН</small><h2>Маршрут работает!</h2><p>Ты направил движение шара настоящей физикой. Попробуй теперь перестроить механизм и найти другой способ.</p><button data-action="again">Попробовать другое решение</button></section>
        <div class="aaa-toast" hidden></div>
      </section>
      <footer class="aaa-inventory">
        <div class="aaa-controls"><button data-action="run" disabled>▶</button><button data-action="stop">■</button></div>
        <div class="aaa-parts campaign-stage01__parts">
          <button class="aaa-part" data-part="ramp"><span class="aaa-thumb" data-thumb="ramp"></span><b>РАМПА</b><em data-count="ramp">2</em></button>
          <button class="aaa-part" data-part="lever"><span class="aaa-thumb" data-thumb="lever"></span><b>РЫЧАГ</b><em data-count="lever">1</em></button>
          <button class="aaa-part" data-part="platform"><span class="aaa-thumb" data-thumb="platform"></span><b>ПЛАТФОРМА</b><em data-count="platform">1</em></button>
        </div>
        <div class="aaa-hint"><strong>УПРАВЛЕНИЕ</strong><span>перетащи · поверни · ПУСК · измени</span></div>
      </footer>
    </main>`;

  const root = document.querySelector<HTMLElement>('.campaign-stage01');
  const canvas = document.querySelector<StageCanvas>('.campaign-stage01 canvas');
  if (!root || !canvas) throw new Error('Campaign Stage 01 DOM missing');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !qaMode, powerPreference: 'high-performance' });
  renderer.setPixelRatio(qaMode ? 0.65 : Math.min(devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = !qaMode;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdff3ff);
  scene.fog = new THREE.Fog(0xdff3ff, 17, 30);

  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 70);
  const homePosition = new THREE.Vector3(0.3, 3.35, 12.9);
  const homeTarget = new THREE.Vector3(-0.25, 1.72, 0);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 9.5;
  controls.maxDistance = 16.5;
  controls.minAzimuthAngle = -0.13;
  controls.maxAzimuthAngle = 0.13;
  controls.minPolarAngle = 1.30;
  controls.maxPolarAngle = 1.52;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf1fbff, 0xc99964, 2.25));
  const sunlight = new THREE.DirectionalLight(0xffefc8, 5.4);
  sunlight.position.set(6.5, 9.2, 5.2);
  sunlight.castShadow = !qaMode;
  sunlight.shadow.mapSize.set(qaMode ? 256 : 2048, qaMode ? 256 : 2048);
  sunlight.shadow.camera.left = -9;
  sunlight.shadow.camera.right = 9;
  sunlight.shadow.camera.top = 7;
  sunlight.shadow.camera.bottom = -3;
  sunlight.shadow.bias = -0.0003;
  scene.add(sunlight);
  const windowFill = new THREE.RectAreaLight(0xbfeeff, 7.5, 5, 5);
  windowFill.position.set(5, 3.5, -3.0);
  windowFill.lookAt(0, 1.4, 0);
  scene.add(windowFill);
  const warmFill = new THREE.PointLight(0xffc567, 10, 8, 2);
  warmFill.position.set(-3.4, 4.2, -1.6);
  scene.add(warmFill);

  scene.add(createWorkshopEnvironment());
  scene.add(createStartShelfVisual());
  const goalVisual = createGoalReceiverVisual();
  scene.add(goalVisual);

  const templates: Record<Stage01PartType, THREE.Object3D> = {
    ramp: createRampAsset(),
    lever: createLeverAsset(),
    platform: createPlatformAsset(),
  };
  const ballVisual = createHeavyBallAsset();
  ballVisual.position.set(-5.18, 3.14, 0);
  scene.add(ballVisual);

  const parts: PartInstance[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected: PartInstance | null = null;
  let drag: DragState | null = null;
  let nextId = 1;
  let simulation: Stage01Physics | null = null;
  const runLeverVisuals = new Map<string, { fixed: THREE.Group; moving: THREE.Group }>();
  let accumulator = 0;
  let previousTime = performance.now();

  const countUsed = (type: Stage01PartType): number => parts.filter((part) => part.type === type).length;
  const remaining = (type: Stage01PartType): number => INVENTORY_MAX[type] - countUsed(type);
  const canvasContains = (x: number, y: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };
  const screenToXY = (x: number, y: number): THREE.Vector2 | null => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(WORK_PLANE, point)) return null;
    return new THREE.Vector2(
      THREE.MathUtils.clamp(point.x, XY_MIN.x, XY_MAX.x),
      THREE.MathUtils.clamp(point.y, XY_MIN.y, XY_MAX.y)
    );
  };
  const setSelection = (part: PartInstance | null): void => {
    selected = part;
    const panel = root.querySelector<HTMLElement>('.aaa-selection');
    if (!panel) return;
    panel.hidden = !part || canvas.dataset.stageState !== 'build';
    const label = panel.querySelector<HTMLElement>('[data-selected]');
    if (label && part) label.textContent = LABELS[part.type];
  };
  const setToast = (message: string): void => {
    const toast = root.querySelector<HTMLElement>('.aaa-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 1450);
  };
  const refreshUi = (): void => {
    const build = canvas.dataset.stageState === 'build';
    const canRun = build && parts.length > 0;
    root.querySelectorAll<HTMLButtonElement>('[data-action="run"]').forEach((button) => { button.disabled = !canRun; });
    root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => {
      const type = button.dataset.part as Stage01PartType;
      const left = remaining(type);
      button.disabled = !build || left <= 0;
      const count = button.querySelector<HTMLElement>(`[data-count="${type}"]`);
      if (count) count.textContent = String(left);
    });
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', parts.length > 0);
    canvas.dataset.partCount = String(parts.length);
  };
  const placementSnapshot = (): Stage01Placement[] => parts.map((part) => ({
    id: part.id,
    type: part.type,
    x: part.object.position.x,
    y: part.object.position.y,
    rotationZ: part.rotationZ,
  }));
  const makeGhost = (type: Stage01PartType): THREE.Object3D => {
    const ghost = cloneAsset(templates[type]);
    ghost.visible = false;
    ghost.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const source = Array.isArray(node.material) ? node.material[0] : node.material;
        const mat = source.clone();
        mat.transparent = true;
        mat.opacity = 0.62;
        node.material = mat;
      }
    });
    scene.add(ghost);
    return ghost;
  };
  const beginInventoryDrag = (event: PointerEvent, type: Stage01PartType, button: HTMLButtonElement): void => {
    if (drag || simulation || remaining(type) <= 0) return;
    event.preventDefault();
    try { button.setPointerCapture(event.pointerId); } catch { /* Safari */ }
    const ghost = makeGhost(type);
    drag = { pointerId: event.pointerId, source: 'inventory', type, part: null, object: ghost, offset: new THREE.Vector2(), insideCanvas: false };
    controls.enabled = false;
    button.classList.add('is-dragging');
    canvas.dataset.dragging = 'true';
  };
  const beginSceneDrag = (event: PointerEvent, part: PartInstance, point: THREE.Vector2): void => {
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Safari */ }
    setSelection(part);
    drag = {
      pointerId: event.pointerId,
      source: 'scene',
      type: part.type,
      part,
      object: part.object,
      offset: new THREE.Vector2(part.object.position.x - point.x, part.object.position.y - point.y),
      insideCanvas: true,
    };
    controls.enabled = false;
    canvas.dataset.dragging = 'true';
  };
  const moveDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.insideCanvas = canvasContains(event.clientX, event.clientY);
    if (!drag.insideCanvas) {
      if (drag.source === 'inventory') drag.object.visible = false;
      return;
    }
    const xy = screenToXY(event.clientX, event.clientY);
    if (!xy) return;
    drag.object.visible = true;
    drag.object.position.set(xy.x + drag.offset.x, xy.y + drag.offset.y, 0);
  };
  const endDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const current = drag;
    drag = null;
    controls.enabled = true;
    canvas.dataset.dragging = 'false';
    root.querySelectorAll('.aaa-part.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
    if (current.source === 'inventory') {
      scene.remove(current.object);
      if (current.insideCanvas) {
        const object = cloneAsset(templates[current.type]);
        object.position.copy(current.object.position);
        object.rotation.z = 0;
        scene.add(object);
        const part: PartInstance = { id: `stage01-part-${nextId++}`, type: current.type, object, rotationZ: 0 };
        parts.push(part);
        setSelection(part);
      }
    }
    refreshUi();
  };

  root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => {
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', (event) => beginInventoryDrag(event, button.dataset.part as Stage01PartType, button));
  });
  window.addEventListener('pointermove', moveDrag, { passive: false });
  window.addEventListener('pointerup', endDrag, { passive: false });
  window.addEventListener('pointercancel', endDrag, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (drag || simulation) return;
    const xy = screenToXY(event.clientX, event.clientY);
    if (!xy) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.Object3D[] = [];
    const lookup = new Map<THREE.Object3D, PartInstance>();
    for (const part of parts) part.object.traverse((node) => {
      if (node instanceof THREE.Mesh) { meshes.push(node); lookup.set(node, part); }
    });
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const part = hit ? lookup.get(hit.object) ?? null : null;
    if (part) beginSceneDrag(event, part, xy);
    else setSelection(null);
  }, { capture: true });

  const removeRunLeverVisuals = (): void => {
    for (const visual of runLeverVisuals.values()) {
      scene.remove(visual.fixed);
      scene.remove(visual.moving);
    }
    runLeverVisuals.clear();
    for (const part of parts) if (part.type === 'lever') part.object.visible = true;
  };
  const syncSimulation = (): void => {
    if (!simulation) return;
    syncBody(ballVisual, simulation.ballBody);
    for (const [id, body] of simulation.leverBodies.entries()) {
      const visual = runLeverVisuals.get(id);
      if (visual) syncBody(visual.moving, body);
    }
    const state = simulation.state;
    canvas.dataset.goalContact = state.goalContact ? 'true' : 'false';
    canvas.dataset.leverMoved = state.leverMoved ? 'true' : 'false';
    canvas.dataset.ballOut = state.ballOut ? 'true' : 'false';
    const p = simulation.ballBody.translation();
    canvas.dataset.ballPosition = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    if (state.won && canvas.dataset.stageState !== 'won') {
      canvas.dataset.stageState = 'won';
      root.querySelector<HTMLElement>('[data-step="goal"]')?.classList.add('done');
      root.querySelector<HTMLElement>('.aaa-win')!.hidden = false;
      const glow = goalVisual.getObjectByName('GoalGlow');
      if (glow) glow.scale.setScalar(1.18);
      refreshUi();
    }
  };
  const startStage = (): void => {
    if (simulation || parts.length === 0) return;
    setSelection(null);
    simulation = createCampaignStage01Physics(placementSnapshot());
    canvas.dataset.stageState = 'running';
    canvas.dataset.goalContact = 'false';
    canvas.dataset.ballOut = 'false';
    canvas.dataset.leverMoved = 'false';
    accumulator = 0;
    ballVisual.position.set(-5.18, 3.14, 0);
    ballVisual.quaternion.identity();
    root.querySelector<HTMLElement>('[data-step="run"]')?.classList.add('done');
    for (const part of parts) {
      if (part.type !== 'lever') continue;
      part.object.visible = false;
      const split = splitLeverVisual(templates.lever);
      split.fixed.position.copy(part.object.position);
      split.fixed.rotation.z = part.rotationZ;
      split.moving.position.copy(part.object.position);
      split.moving.rotation.z = part.rotationZ;
      scene.add(split.fixed, split.moving);
      runLeverVisuals.set(part.id, split);
    }
    refreshUi();
    syncSimulation();
  };
  const stopStage = (): void => {
    simulation?.free();
    simulation = null;
    removeRunLeverVisuals();
    canvas.dataset.stageState = 'build';
    canvas.dataset.goalContact = 'false';
    canvas.dataset.ballOut = 'false';
    canvas.dataset.leverMoved = 'false';
    ballVisual.position.set(-5.18, 3.14, 0);
    ballVisual.quaternion.identity();
    const glow = goalVisual.getObjectByName('GoalGlow');
    if (glow) glow.scale.setScalar(1);
    root.querySelector<HTMLElement>('.aaa-win')!.hidden = true;
    setSelection(selected);
    refreshUi();
  };
  const clearBuild = (): void => {
    stopStage();
    for (const part of parts) scene.remove(part.object);
    parts.length = 0;
    setSelection(null);
    refreshUi();
  };
  const canonicalSolution = (): void => {
    clearBuild();
    const solution: Array<{ type: Stage01PartType; x: number; y: number; r: number }> = [
      { type: 'ramp', x: -3.08, y: 2.29, r: -0.25 },
      { type: 'ramp', x: -0.28, y: 1.56, r: -0.25 },
      { type: 'platform', x: 2.25, y: 0.52, r: 0 },
    ];
    for (const item of solution) {
      const object = cloneAsset(templates[item.type]);
      object.position.set(item.x, item.y, 0);
      object.rotation.z = item.r;
      scene.add(object);
      parts.push({ id: `stage01-part-${nextId++}`, type: item.type, object, rotationZ: item.r });
    }
    refreshUi();
  };

  canvas.__applyCanonicalSolution = canonicalSolution;
  canvas.__startStage = startStage;
  canvas.__stopStage = stopStage;
  canvas.__advanceSimulation = (seconds: number): void => {
    if (!simulation) return;
    simulation.advance(seconds);
    syncSimulation();
  };
  canvas.__partCount = () => parts.length;

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'run') startStage();
    if (action === 'stop') stopStage();
    if (action === 'clear') clearBuild();
    if (action === 'again') stopStage();
    if (action === 'camera') {
      camera.position.copy(homePosition);
      controls.target.copy(homeTarget);
      controls.update();
    }
    if (edit && selected && !simulation) {
      if (edit === 'delete') {
        scene.remove(selected.object);
        parts.splice(parts.indexOf(selected), 1);
        setSelection(null);
        refreshUi();
        return;
      }
      const delta = Math.PI / 12;
      selected.rotationZ += edit === 'left' ? delta : -delta;
      selected.object.rotation.z = selected.rotationZ;
      refreshUi();
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
  canvas.dataset.physics = 'rapier3d-0.19.3-free-build-stage01-v1';
  canvas.dataset.editor = 'free-xy-275d-pointer-v1';
  canvas.dataset.cleanroom = 'true';
  canvas.dataset.partCount = '0';
  canvas.dataset.goalContact = 'false';
  canvas.dataset.ballOut = 'false';
  canvas.dataset.leverMoved = 'false';
  canvas.dataset.qaMode = qaMode ? 'physics' : 'off';
  root.querySelector<HTMLElement>('.aaa-loading')?.classList.add('ready');
  refreshUi();

  const animate = (now: number): void => {
    requestAnimationFrame(animate);
    const elapsed = Math.min((now - previousTime) / 1000, 0.10);
    previousTime = now;
    if (!qaMode && simulation && canvas.dataset.stageState === 'running') {
      accumulator += elapsed;
      while (accumulator >= FIXED_DT && !simulation.state.won) {
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
