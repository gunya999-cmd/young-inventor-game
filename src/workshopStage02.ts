import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const STAGE_VERSION = 'workshop-stage-02-v1';
const FIXED_DT = 1 / 60;
const ASSET_ROOT = '/assets/workshop/';

type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __resetStage?: () => void;
};

type AssetKey = 'ramp' | 'lever' | 'pulley' | 'platform';

type Placeable = {
  id: string;
  type: AssetKey;
  object: THREE.Object3D;
  yaw: number;
  snapped: boolean;
};

type DynamicBinding = { body: any; object: THREE.Object3D };

type SnapZone = {
  type: AssetKey;
  position: THREE.Vector3;
  yaw: number;
  radius: number;
};

const SNAP_ZONES: SnapZone[] = [
  { type: 'ramp', position: new THREE.Vector3(-3.55, 1.05, 0), yaw: 0, radius: 1.45 },
  { type: 'lever', position: new THREE.Vector3(-0.75, 0.76, 0), yaw: 0, radius: 1.20 },
  { type: 'pulley', position: new THREE.Vector3(2.20, 2.60, 0), yaw: 0, radius: 1.25 },
  { type: 'platform', position: new THREE.Vector3(0.62, 0.52, 0), yaw: 0, radius: 1.10 },
];

const inventoryLabel: Record<AssetKey, string> = {
  ramp: 'Рампа',
  lever: 'Рычаг',
  pulley: 'Блок',
  platform: 'Платформа',
};

function setFromBody(object: THREE.Object3D, body: any): void {
  const p = body.translation();
  const q = body.rotation();
  object.position.set(p.x, p.y, p.z);
  object.quaternion.set(q.x, q.y, q.z, q.w);
}

function setShadowFlags(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (Array.isArray(node.material)) {
        for (const material of node.material) material.needsUpdate = true;
      } else if (node.material) {
        node.material.needsUpdate = true;
      }
    }
  });
}

function cloneAsset(template: THREE.Object3D): THREE.Object3D {
  const clone = template.clone(true);
  setShadowFlags(clone);
  return clone;
}

function makeTextSprite(text: string, background: string, foreground = '#17324d'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = foreground;
  ctx.font = '700 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 90);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.84, 1);
  return sprite;
}

function createRopeLine(): { line: THREE.Line; update: (weightY: number) => void } {
  const material = new THREE.LineBasicMaterial({ color: 0xb9874c });
  const geometry = new THREE.BufferGeometry();
  const line = new THREE.Line(geometry, material);
  const update = (weightY: number): void => {
    geometry.setFromPoints([
      new THREE.Vector3(1.28, 1.88, 0),
      new THREE.Vector3(2.20, 3.05, 0),
      new THREE.Vector3(3.16, 3.05, 0),
      new THREE.Vector3(3.16, weightY + 0.48, 0),
    ]);
  };
  update(1.92);
  return { line, update };
}

export async function installWorkshopStage02(): Promise<void> {
  document.documentElement.classList.add('aaa-workshop-mode');
  document.body.classList.add('aaa-workshop-mode');

  const root = document.createElement('main');
  root.className = 'aaa-workshop';
  root.innerHTML = `
    <section class="aaa-loading"><span class="aaa-loading__gear">⚙</span><strong>Открываем лабораторию изобретателя…</strong><small>Загружаем game-ready 3D assets</small></section>
    <header class="aaa-topbar">
      <div class="aaa-stage-badge"><small>STAGE</small><strong>02</strong><span>БАЛАНС И РЕАКЦИЯ</span></div>
      <div class="aaa-goal"><small>ЗАДАЧА</small><strong>Собери цепочку и запусти финальную машину</strong><span>Используй массу, рычаг, блок и силу тяжести</span></div>
      <div class="aaa-top-actions"><button data-action="camera">⌂ Камера</button><button data-action="reset">↻ Сброс</button><button class="aaa-play" data-action="play" disabled>▶ PLAY</button></div>
    </header>
    <section class="aaa-view">
      <canvas aria-label="AAA child workshop stage 02" data-stage-version="${STAGE_VERSION}" data-stage-state="loading"></canvas>
      <aside class="aaa-objectives"><strong>ЦЕЛИ</strong><ol>
        <li data-step="build"><i>1</i><span>Поставь детали</span></li>
        <li data-step="lever"><i>2</i><span>Тяжёлый шар должен качнуть рычаг</span></li>
        <li data-step="rope"><i>3</i><span>Лёгкий шар должен дёрнуть трос</span></li>
        <li data-step="weight"><i>4</i><span>Освободи груз</span></li>
        <li data-step="goal"><i>5</i><span>Нажми кнопку грузом</span></li>
      </ol></aside>
      <aside class="aaa-physics-card"><span>💡</span><div><strong>Физика работает сама</strong><small>масса · гравитация · момент силы · столкновения</small></div></aside>
      <div class="aaa-selection" hidden><strong data-selected>Деталь</strong><button data-edit="left">↶</button><button data-edit="right">↷</button><button data-edit="delete">✕</button></div>
      <section class="aaa-win" hidden><div>★</div><small>STAGE 02 COMPLETE</small><h2>Машина заработала!</h2><p>Ты передал энергию через рычаг и цепочку столкновений, освободил груз и замкнул финальный механизм.</p><button data-action="again">Собрать ещё раз</button></section>
      <div class="aaa-toast" hidden></div>
    </section>
    <footer class="aaa-inventory">
      <div class="aaa-controls"><button data-action="play" disabled>▶</button><button data-action="reset">↻</button></div>
      <div class="aaa-parts" role="toolbar" aria-label="Детали уровня">
        <button class="aaa-part" draggable="true" data-part="ramp"><span class="aaa-thumb" data-thumb="ramp"></span><b>РАМПА</b><em>1</em></button>
        <button class="aaa-part" draggable="true" data-part="lever"><span class="aaa-thumb" data-thumb="lever"></span><b>РЫЧАГ</b><em>1</em></button>
        <button class="aaa-part" draggable="true" data-part="pulley"><span class="aaa-thumb" data-thumb="pulley"></span><b>БЛОК</b><em>1</em></button>
        <button class="aaa-part" draggable="true" data-part="platform"><span class="aaa-thumb" data-thumb="platform"></span><b>ПЛАТФОРМА</b><em>1</em></button>
      </div>
      <div class="aaa-hint"><strong>ЦЕПОЧКА</strong><span>● → ⚖ → ○ → ◉ → ▼ → 🔴 → ⚙</span></div>
    </footer>`;
  document.body.innerHTML = '';
  document.body.appendChild(root);

  const canvas = root.querySelector<StageCanvas>('canvas');
  if (!canvas) throw new Error('Stage 02 canvas missing');
  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdff3ff);
  scene.fog = new THREE.Fog(0xdff3ff, 15, 30);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const homePosition = new THREE.Vector3(8.9, 6.15, 10.4);
  const homeTarget = new THREE.Vector3(-0.1, 1.15, 0);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 7.5;
  controls.maxDistance = 16.5;
  controls.minPolarAngle = 0.62;
  controls.maxPolarAngle = 1.28;
  controls.enablePan = false;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0xc58d5c, 2.0));
  const sun = new THREE.DirectionalLight(0xfff1c9, 5.4);
  sun.position.set(6.5, 9.5, 5.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.00035;
  scene.add(sun);
  const windowFill = new THREE.RectAreaLight(0xbde9ff, 9, 5.2, 5.2);
  windowFill.position.set(5.2, 3.4, -3.3); windowFill.lookAt(0, 1.2, 0); scene.add(windowFill);
  const warmFill = new THREE.PointLight(0xffc46a, 14, 9, 2); warmFill.position.set(-2.0, 4.2, -1.8); scene.add(warmFill);

  const loader = new GLTFLoader();
  const loadObject = async (file: string): Promise<THREE.Object3D> => {
    const gltf = await loader.loadAsync(`${ASSET_ROOT}${file}`);
    setShadowFlags(gltf.scene);
    return gltf.scene;
  };
  const [environment, rampTemplate, leverTemplate, pulleyTemplate, platformTemplate, heavyTemplate, lightTemplate, weightTemplate, buttonTemplate, finalTemplate] = await Promise.all([
    loadObject('aaa-child-workshop.glb'), loadObject('ramp.glb'), loadObject('lever.glb'), loadObject('pulley.glb'), loadObject('platform.glb'),
    loadObject('heavy-ball.glb'), loadObject('light-ball.glb'), loadObject('weight.glb'), loadObject('button.glb'), loadObject('final-device.glb'),
  ]);
  scene.add(environment);
  const templates: Record<AssetKey, THREE.Object3D> = { ramp: rampTemplate, lever: leverTemplate, pulley: pulleyTemplate, platform: platformTemplate };
  const buttonObject = cloneAsset(buttonTemplate); buttonObject.position.set(3.18, 0.18, 0); scene.add(buttonObject);
  const finalObject = cloneAsset(finalTemplate); finalObject.position.set(5.02, 0.08, 0); scene.add(finalObject);
  const weightObject = cloneAsset(weightTemplate); weightObject.position.set(3.16, 1.92, 0); scene.add(weightObject);

  const eventQueue = new RAPIER.EventQueue(true);
  const bindings: DynamicBinding[] = [];
  let heavyBody: any | null = null, lightBody: any | null = null, leverBody: any | null = null, weightBody: any | null = null;
  let ropeHandleSensor: any | null = null, buttonSensor: any | null = null;
  let heavyObject: THREE.Object3D | null = null, lightObject: THREE.Object3D | null = null;
  let running = false, won = false, ropeReleased = false, leverActivated = false, ropePulled = false, weightPressed = false;
  let accumulator = 0, lastFrame = performance.now();

  const ropeVisual = createRopeLine(); scene.add(ropeVisual.line);
  const ropeHandleVisual = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 14, 36), new THREE.MeshStandardMaterial({ color: 0xf3bc43, roughness: 0.35, metalness: 0.12 }));
  ropeHandleVisual.position.set(1.28, 1.88, 0); ropeHandleVisual.castShadow = true; scene.add(ropeHandleVisual);
  const stageLabel = makeTextSprite('ИНЖЕНЕРНАЯ ЛАБОРАТОРИЯ', '#f7ca50'); stageLabel.position.set(-1.1, 4.45, -4.00); scene.add(stageLabel);

  const placeables: Placeable[] = [];
  let selected: Placeable | null = null, draggingType: AssetKey | null = null, draggingObject: THREE.Object3D | null = null, placementCounter = 0;
  const floorRayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const setPointerFromEvent = (clientX: number, clientY: number): void => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };
  const setSelection = (part: Placeable | null): void => {
    selected = part; const panel = root.querySelector<HTMLElement>('.aaa-selection'); if (!panel) return;
    panel.hidden = !part; const name = panel.querySelector<HTMLElement>('[data-selected]'); if (name) name.textContent = part ? inventoryLabel[part.type] : '';
  };
  const snapPart = (part: Placeable): void => {
    const zone = SNAP_ZONES.find((candidate) => candidate.type === part.type); if (!zone) return;
    if (part.object.position.distanceTo(zone.position) <= zone.radius) {
      part.object.position.copy(zone.position); part.yaw = zone.yaw; part.object.rotation.set(0, part.yaw, 0); part.snapped = true;
    } else part.snapped = false;
  };
  const updateBuildReady = (): void => {
    const ready = SNAP_ZONES.every((zone) => placeables.some((part) => part.type === zone.type && part.snapped));
    canvas.dataset.buildReady = ready ? 'true' : 'false';
    root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((button) => { button.disabled = !ready || running; });
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', ready);
  };
  const updateInventory = (): void => {
    for (const type of Object.keys(templates) as AssetKey[]) {
      const used = placeables.some((part) => part.type === type);
      const button = root.querySelector<HTMLButtonElement>(`.aaa-part[data-part="${type}"]`);
      if (button) { button.disabled = used || running; button.classList.toggle('used', used); const count = button.querySelector('em'); if (count) count.textContent = used ? '0' : '1'; }
    }
  };
  const beginDrag = (type: AssetKey): void => {
    if (running || placeables.some((part) => part.type === type)) return;
    draggingType = type; draggingObject = cloneAsset(templates[type]);
    draggingObject.traverse((node) => { if (node instanceof THREE.Mesh) { const mats = Array.isArray(node.material) ? node.material : [node.material]; node.material = mats.map((material) => { const copy = material.clone(); copy.transparent = true; copy.opacity = 0.62; return copy; }); } });
    scene.add(draggingObject); controls.enabled = false;
  };
  const moveDrag = (clientX: number, clientY: number): void => {
    if (!draggingObject) return; setPointerFromEvent(clientX, clientY); const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(floorRayPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -5.4, 4.3); hit.z = THREE.MathUtils.clamp(hit.z, -1.9, 1.9); draggingObject.position.copy(hit);
      const zone = SNAP_ZONES.find((candidate) => candidate.type === draggingType); if (zone && hit.distanceTo(zone.position) < zone.radius) draggingObject.position.lerp(zone.position, 0.48);
    }
  };
  const endDrag = (): void => {
    if (!draggingObject || !draggingType) return;
    const object = draggingObject, type = draggingType; scene.remove(object); const final = cloneAsset(templates[type]); final.position.copy(object.position); final.rotation.copy(object.rotation); scene.add(final);
    const part: Placeable = { id: `p-${++placementCounter}`, type, object: final, yaw: 0, snapped: false }; snapPart(part); placeables.push(part);
    draggingObject = null; draggingType = null; controls.enabled = true; setSelection(part); updateInventory(); updateBuildReady();
  };
  const removeDynamicVisuals = (): void => { if (heavyObject) scene.remove(heavyObject); if (lightObject) scene.remove(lightObject); heavyObject = null; lightObject = null; };
  const resetStateFlags = (): void => {
    running = false; won = false; ropeReleased = false; leverActivated = false; ropePulled = false; weightPressed = false;
    canvas.dataset.stageState = 'build'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.ropeReleased = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
    root.querySelectorAll('.aaa-objectives li').forEach((node) => node.classList.remove('done', 'active'));
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', canvas.dataset.buildReady === 'true'); root.querySelector<HTMLElement>('.aaa-win')!.hidden = true;
    weightObject.position.set(3.16, 1.92, 0); ropeVisual.update(1.92);
  };

  const buildSimulation = (): void => {
    const oldWorld = (canvas as any).__world as any; if (oldWorld) { try { oldWorld.free(); } catch { /* ignore */ } }
    const world: any = new (RAPIER.World as any)({ x: 0, y: -9.81, z: 0 }); (canvas as any).__world = world; bindings.length = 0;
    world.createCollider(RAPIER.ColliderDesc.cuboid(7.0, 0.08, 4.5).setTranslation(0, -0.08, 0).setFriction(0.75));
    const ramp = placeables.find((part) => part.type === 'ramp'), lever = placeables.find((part) => part.type === 'lever'); if (!ramp || !lever) return;
    const rampQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.19));
    const rampBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-3.55, 1.05, 0).setRotation({ x: rampQ.x, y: rampQ.y, z: rampQ.z, w: rampQ.w }));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.48, 0.09, 0.50).setFriction(0.55).setRestitution(0.03), rampBody); ramp.object.position.set(-3.55, 1.05, 0); ramp.object.quaternion.copy(rampQ);
    const anchorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-0.75, 0.76, 0));
    leverBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-0.75, 0.76, 0).setAngularDamping(0.65).setCanSleep(false).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.60, 0.10, 0.22).setDensity(2.0).setFriction(0.48).setRestitution(0.08), leverBody);
    const revolute = RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }); const leverJoint = world.createImpulseJoint(revolute, anchorBody, leverBody, true) as any; leverJoint.setLimits(-0.42, 0.42); bindings.push({ body: leverBody, object: lever.object });
    heavyObject = cloneAsset(heavyTemplate); scene.add(heavyObject); heavyBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-4.72, 1.92, 0).setCcdEnabled(true).setLinearDamping(0.02).setAngularDamping(0.02)); world.createCollider(RAPIER.ColliderDesc.ball(0.34).setDensity(8.2).setFriction(0.62).setRestitution(0.05), heavyBody); bindings.push({ body: heavyBody, object: heavyObject });
    lightObject = cloneAsset(lightTemplate); scene.add(lightObject); lightBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.58, 1.26, 0).setCcdEnabled(true).setLinearDamping(0.015)); world.createCollider(RAPIER.ColliderDesc.ball(0.24).setDensity(0.82).setFriction(0.44).setRestitution(0.36), lightBody); bindings.push({ body: lightBody, object: lightObject });
    const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.62, 0.94, 0)); world.createCollider(RAPIER.ColliderDesc.cuboid(0.50, 0.06, 0.39).setFriction(0.48), platformBody);
    const ropeHandleBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1.28, 1.88, 0)); ropeHandleSensor = world.createCollider(RAPIER.ColliderDesc.ball(0.22).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ropeHandleBody);
    weightBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(3.16, 1.92, 0).setGravityScale(0).setLinearDamping(0.08).setCcdEnabled(true)); world.createCollider(RAPIER.ColliderDesc.cylinder(0.34, 0.32).setDensity(6.0).setFriction(0.62).setRestitution(0.02), weightBody); bindings.push({ body: weightBody, object: weightObject });
    const buttonBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(3.18, 0.30, 0)); buttonSensor = world.createCollider(RAPIER.ColliderDesc.cuboid(0.34, 0.12, 0.30).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), buttonBody);
  };

  const applyCanonicalSolution = (): void => {
    if (running) return; for (const part of [...placeables]) scene.remove(part.object); placeables.length = 0; setSelection(null);
    for (const zone of SNAP_ZONES) { const object = cloneAsset(templates[zone.type]); object.position.copy(zone.position); object.rotation.y = zone.yaw; scene.add(object); placeables.push({ id: `p-${++placementCounter}`, type: zone.type, object, yaw: zone.yaw, snapped: true }); }
    updateInventory(); updateBuildReady();
  };
  const startStage = (): void => {
    if (running || canvas.dataset.buildReady !== 'true') return; running = true; won = false; canvas.dataset.stageState = 'running';
    root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((button) => { button.disabled = true; }); root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => { button.disabled = true; }); root.querySelector<HTMLElement>('[data-step="lever"]')?.classList.add('active');
    removeDynamicVisuals(); buildSimulation();
  };
  const resetStage = (): void => {
    const world = (canvas as any).__world as any; if (world) { try { world.free(); } catch { /* ignore */ } delete (canvas as any).__world; }
    removeDynamicVisuals(); resetStateFlags(); updateInventory(); updateBuildReady();
  };
  canvas.__applyCanonicalSolution = applyCanonicalSolution; canvas.__startStage = startStage; canvas.__resetStage = resetStage;
  const showToast = (message: string): void => { const toast = root.querySelector<HTMLElement>('.aaa-toast'); if (!toast) return; toast.textContent = message; toast.hidden = false; window.setTimeout(() => { toast.hidden = true; }, 1800); };

  root.addEventListener('dragstart', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.aaa-part'); if (!button) return; const type = button.dataset.part as AssetKey; event.dataTransfer?.setData('text/plain', type); beginDrag(type); });
  root.addEventListener('dragend', () => endDrag());
  canvas.addEventListener('dragover', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); });
  canvas.addEventListener('drop', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); endDrag(); });
  root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((button) => { button.addEventListener('pointerdown', (event) => { if (event.pointerType === 'mouse') return; event.preventDefault(); beginDrag(button.dataset.part as AssetKey); moveDrag(event.clientX, event.clientY); const move = (moveEvent: PointerEvent): void => moveDrag(moveEvent.clientX, moveEvent.clientY); const up = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endDrag(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); }); });
  canvas.addEventListener('pointerdown', (event) => {
    if (running || draggingObject) return; setPointerFromEvent(event.clientX, event.clientY);
    const hitObjects = placeables.flatMap((part) => { const list: THREE.Object3D[] = []; part.object.traverse((node) => { if (node instanceof THREE.Mesh) list.push(node); }); return list; });
    const hits = raycaster.intersectObjects(hitObjects, false); if (!hits.length) { setSelection(null); return; } const hit = hits[0].object;
    const part = placeables.find((candidate) => { let found = false; candidate.object.traverse((node) => { if (node === hit) found = true; }); return found; }); setSelection(part ?? null);
  });
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-action]')?.dataset.action; const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'play') startStage(); if (action === 'reset' || action === 'again') resetStage(); if (action === 'camera') { camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update(); }
    if (edit && selected && !running) { if (edit === 'left') selected.yaw += Math.PI / 12; if (edit === 'right') selected.yaw -= Math.PI / 12; if (edit === 'delete') { scene.remove(selected.object); const index = placeables.indexOf(selected); if (index >= 0) placeables.splice(index, 1); setSelection(null); updateInventory(); updateBuildReady(); return; } selected.object.rotation.y = selected.yaw; snapPart(selected); updateBuildReady(); }
  });
  window.addEventListener('keydown', (event) => { if (!selected || running) return; if (event.key.toLowerCase() === 'r') { selected.yaw += event.shiftKey ? -Math.PI / 12 : Math.PI / 12; selected.object.rotation.y = selected.yaw; snapPart(selected); updateBuildReady(); } if (event.key === 'Delete' || event.key === 'Backspace') { scene.remove(selected.object); const index = placeables.indexOf(selected); if (index >= 0) placeables.splice(index, 1); setSelection(null); updateInventory(); updateBuildReady(); } });

  const completeStep = (step: string): void => { const node = root.querySelector<HTMLElement>(`[data-step="${step}"]`); node?.classList.add('done'); node?.classList.remove('active'); };
  const updatePhysicsEvents = (world: any): void => {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;
      if (ropeHandleSensor && (handle1 === ropeHandleSensor.handle || handle2 === ropeHandleSensor.handle) && !ropePulled) {
        ropePulled = true; ropeReleased = true; canvas.dataset.ropePulled = 'true'; canvas.dataset.ropeReleased = 'true'; if (weightBody) weightBody.setGravityScale(1.0, true); completeStep('rope'); root.querySelector<HTMLElement>('[data-step="weight"]')?.classList.add('active'); showToast('Трос дёрнут — груз освобождён!');
      }
      if (buttonSensor && (handle1 === buttonSensor.handle || handle2 === buttonSensor.handle) && ropeReleased && !weightPressed) {
        weightPressed = true; won = true; running = false; canvas.dataset.weightPressed = 'true'; canvas.dataset.goalPowered = 'true'; canvas.dataset.stageState = 'won'; completeStep('weight'); completeStep('goal'); root.querySelector<HTMLElement>('.aaa-win')!.hidden = false;
      }
    });
    if (leverBody && !leverActivated) { const w = leverBody.angvel(); if (Math.abs(w.z) > 0.95) { leverActivated = true; canvas.dataset.leverActivated = 'true'; completeStep('lever'); root.querySelector<HTMLElement>('[data-step="rope"]')?.classList.add('active'); } }
    if (lightBody && !ropePulled) { const p = lightBody.translation(); canvas.dataset.lightBall = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; }
    if (heavyBody) { const p = heavyBody.translation(); canvas.dataset.heavyBall = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; }
    if (weightBody) { const p = weightBody.translation(); canvas.dataset.weightY = p.y.toFixed(2); ropeVisual.update(p.y); }
  };

  const resize = (): void => { const rect = canvas.getBoundingClientRect(); const width = Math.max(1, Math.floor(rect.width)), height = Math.max(1, Math.floor(rect.height)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  canvas.dataset.engine = `three.js r${THREE.REVISION}`; canvas.dataset.physics = 'rapier3d-0.19.3-stage02-rigid-body-chain-v1'; canvas.dataset.stageState = 'build'; canvas.dataset.buildReady = 'false'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.ropeReleased = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false'; canvas.dataset.assetPipeline = 'game-ready-glb-pbr-v1';
  root.querySelector<HTMLElement>('.aaa-loading')?.classList.add('ready');

  const animate = (now: number): void => {
    requestAnimationFrame(animate); const dt = Math.min((now - lastFrame) / 1000, 0.12); lastFrame = now; const world = (canvas as any).__world as any;
    if (running && world) { accumulator += dt; while (accumulator >= FIXED_DT) { world.timestep = FIXED_DT; world.step(eventQueue); updatePhysicsEvents(world); accumulator -= FIXED_DT; } for (const binding of bindings) { try { setFromBody(binding.object, binding.body); } catch { /* reset race */ } } }
    controls.update(); renderer.render(scene, camera);
  };
  requestAnimationFrame(animate); updateInventory(); updateBuildReady();
}
