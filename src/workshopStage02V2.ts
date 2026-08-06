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

const STAGE_VERSION = 'workshop-stage-02-v2';
const FIXED_DT = 1 / 60;

type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __resetStage?: () => void;
};

type AssetKey = 'ramp' | 'lever' | 'pulley' | 'platform';
type Placeable = { type: AssetKey; object: THREE.Object3D; snapped: boolean; yaw: number };
type DynamicBinding = { body: any; object: THREE.Object3D };
type Zone = { type: AssetKey; position: THREE.Vector3; radius: number };

const ZONES: Zone[] = [
  { type: 'ramp', position: new THREE.Vector3(-3.55, 1.05, 0), radius: 1.45 },
  { type: 'lever', position: new THREE.Vector3(-0.75, 0.74, 0), radius: 1.18 },
  { type: 'platform', position: new THREE.Vector3(0.60, 0.50, 0), radius: 1.05 },
  { type: 'pulley', position: new THREE.Vector3(2.20, 2.55, 0), radius: 1.30 },
];
const NAMES: Record<AssetKey, string> = { ramp: 'Рампа', lever: 'Рычаг', pulley: 'Блок', platform: 'Платформа' };

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

function syncBody(object: THREE.Object3D, body: any): void {
  const p = body.translation(); const q = body.rotation();
  object.position.set(p.x, p.y, p.z);
  object.quaternion.set(q.x, q.y, q.z, q.w);
}

function ropeGeometry(weightY: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(1.42, 1.52, 0),
    new THREE.Vector3(2.20, 3.02, 0),
    new THREE.Vector3(3.18, 3.02, 0),
    new THREE.Vector3(3.18, weightY + 0.48, 0),
  ]);
}

export async function installWorkshopStage02V2(): Promise<void> {
  document.documentElement.classList.add('aaa-workshop-mode');
  document.body.classList.add('aaa-workshop-mode');
  document.body.innerHTML = `
    <main class="aaa-workshop">
      <section class="aaa-loading"><span class="aaa-loading__gear">⚙</span><strong>Открываем лабораторию изобретателя…</strong><small>Создаём PBR-мастерскую и 3D-физику</small></section>
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
        <aside class="aaa-physics-card"><span>💡</span><div><strong>Настоящая 3D-физика</strong><small>Rapier · масса · трение · момент силы · столкновения</small></div></aside>
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
  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdff3ff);
  scene.fog = new THREE.Fog(0xdff3ff, 16, 29);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 70);
  const homePos = new THREE.Vector3(8.8, 5.8, 10.1);
  const homeTarget = new THREE.Vector3(-0.2, 1.2, 0);
  camera.position.copy(homePos);
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
  sun.position.set(7, 9.5, 5.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -4; sun.shadow.bias = -0.0003;
  scene.add(sun);
  const cool = new THREE.RectAreaLight(0xbfeeff, 8, 5, 5); cool.position.set(5.2, 3.4, -3.2); cool.lookAt(0, 1.3, 0); scene.add(cool);
  const warm = new THREE.PointLight(0xffc568, 12, 8, 2); warm.position.set(-2.2, 4.2, -1.4); scene.add(warm);

  const environment = createWorkshopEnvironment(); scene.add(environment);
  const templates: Record<AssetKey, THREE.Object3D> = {
    ramp: createRampAsset(), lever: createLeverAsset(), pulley: createPulleyAsset(), platform: createPlatformAsset(),
  };
  const heavyTemplate = createHeavyBallAsset();
  const lightTemplate = createLightBallAsset();
  const weightVisual = createWeightAsset(); weightVisual.position.set(3.18, 1.92, 0); scene.add(weightVisual);
  const buttonVisual = createButtonAsset(); buttonVisual.position.set(3.18, 0.20, 0); scene.add(buttonVisual);
  const goalVisual = createFinalDeviceAsset(); goalVisual.position.set(5.05, 0.06, 0); scene.add(goalVisual);
  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.038, 14, 42), new THREE.MeshPhysicalMaterial({ color: 0xf6bd36, roughness: 0.32, metalness: 0.24, clearcoat: 0.32 }));
  pullRing.position.set(1.42, 1.52, 0); pullRing.castShadow = true; scene.add(pullRing);
  const ropeMaterial = new THREE.LineBasicMaterial({ color: 0xb77f47 });
  const ropeLine = new THREE.Line(ropeGeometry(1.92), ropeMaterial); scene.add(ropeLine);

  const placeables: Placeable[] = [];
  let selected: Placeable | null = null;
  let dragType: AssetKey | null = null;
  let dragGhost: THREE.Object3D | null = null;
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const updatePointer = (x: number, y: number): void => {
    const rect = canvas.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height * 2 - 1)); raycaster.setFromCamera(pointer, camera);
  };
  const zoneFor = (type: AssetKey): Zone => ZONES.find((z) => z.type === type)!;
  const snap = (part: Placeable): void => {
    const zone = zoneFor(part.type); part.snapped = part.object.position.distanceTo(zone.position) < zone.radius;
    if (part.snapped) { part.object.position.copy(zone.position); part.object.rotation.set(0, 0, 0); part.yaw = 0; }
  };
  const ready = (): boolean => ZONES.every((zone) => placeables.some((part) => part.type === zone.type && part.snapped));
  const refreshUi = (): void => {
    const isReady = ready(); canvas.dataset.buildReady = isReady ? 'true' : 'false';
    root.querySelectorAll<HTMLButtonElement>('[data-action="play"]').forEach((b) => { b.disabled = !isReady || canvas.dataset.stageState === 'running'; });
    root.querySelector<HTMLElement>('[data-step="build"]')?.classList.toggle('done', isReady);
    (Object.keys(templates) as AssetKey[]).forEach((type) => {
      const used = placeables.some((p) => p.type === type); const b = root.querySelector<HTMLButtonElement>(`.aaa-part[data-part="${type}"]`);
      if (b) { b.disabled = used || canvas.dataset.stageState === 'running'; const count = b.querySelector('em'); if (count) count.textContent = used ? '0' : '1'; }
    });
  };
  const select = (part: Placeable | null): void => {
    selected = part; const panel = root.querySelector<HTMLElement>('.aaa-selection'); if (!panel) return; panel.hidden = !part;
    const label = panel.querySelector<HTMLElement>('[data-selected]'); if (label && part) label.textContent = NAMES[part.type];
  };
  const beginDrag = (type: AssetKey): void => {
    if (canvas.dataset.stageState === 'running' || placeables.some((p) => p.type === type)) return;
    dragType = type; dragGhost = cloneAsset(templates[type]);
    dragGhost.traverse((node) => { if (node instanceof THREE.Mesh) { const original = Array.isArray(node.material) ? node.material[0] : node.material; const ghost = original.clone(); ghost.transparent = true; ghost.opacity = 0.62; node.material = ghost; } });
    scene.add(dragGhost); controls.enabled = false;
  };
  const moveDrag = (x: number, y: number): void => {
    if (!dragGhost || !dragType) return; updatePointer(x, y); const point = new THREE.Vector3(); if (!raycaster.ray.intersectPlane(floorPlane, point)) return;
    point.x = THREE.MathUtils.clamp(point.x, -5.5, 4.2); point.z = THREE.MathUtils.clamp(point.z, -1.7, 1.7); dragGhost.position.copy(point);
    const zone = zoneFor(dragType); if (point.distanceTo(zone.position) < zone.radius) dragGhost.position.lerp(zone.position, 0.58);
  };
  const endDrag = (): void => {
    if (!dragGhost || !dragType) return; const final = cloneAsset(templates[dragType]); final.position.copy(dragGhost.position); scene.remove(dragGhost); scene.add(final);
    const part: Placeable = { type: dragType, object: final, snapped: false, yaw: 0 }; snap(part); placeables.push(part); dragGhost = null; dragType = null; controls.enabled = true; select(part); refreshUi();
  };

  root.addEventListener('dragstart', (event) => { const b = (event.target as HTMLElement).closest<HTMLButtonElement>('.aaa-part'); if (!b) return; beginDrag(b.dataset.part as AssetKey); });
  root.addEventListener('dragend', () => endDrag());
  canvas.addEventListener('dragover', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); });
  canvas.addEventListener('drop', (event) => { event.preventDefault(); moveDrag(event.clientX, event.clientY); endDrag(); });
  root.querySelectorAll<HTMLButtonElement>('.aaa-part').forEach((b) => b.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return; beginDrag(b.dataset.part as AssetKey); moveDrag(event.clientX, event.clientY);
    const move = (e: PointerEvent): void => moveDrag(e.clientX, e.clientY); const up = (): void => { window.removeEventListener('pointermove', move); endDrag(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }));
  canvas.addEventListener('pointerdown', (event) => {
    if (canvas.dataset.stageState === 'running' || dragGhost) return; updatePointer(event.clientX, event.clientY);
    const meshToPart = new Map<THREE.Object3D, Placeable>(); const meshes: THREE.Object3D[] = [];
    placeables.forEach((part) => part.object.traverse((node) => { if (node instanceof THREE.Mesh) { meshes.push(node); meshToPart.set(node, part); } }));
    const hit = raycaster.intersectObjects(meshes, false)[0]; select(hit ? meshToPart.get(hit.object) ?? null : null);
  });

  let world: any | null = null; const events = new RAPIER.EventQueue(true); const bindings: DynamicBinding[] = [];
  let heavyBody: any = null, lightBody: any = null, leverBody: any = null, weightBody: any = null, ropeSensor: any = null, buttonSensor: any = null;
  let heavyVisual: THREE.Object3D | null = null, lightVisual: THREE.Object3D | null = null;
  let running = false, ropePulled = false, weightPressed = false, leverActivated = false, accumulator = 0, previous = performance.now();

  const setStep = (step: string, active = false): void => { const el = root.querySelector<HTMLElement>(`[data-step="${step}"]`); if (!el) return; if (active) el.classList.add('active'); else { el.classList.add('done'); el.classList.remove('active'); } };
  const toast = (text: string): void => { const el = root.querySelector<HTMLElement>('.aaa-toast'); if (!el) return; el.textContent = text; el.hidden = false; setTimeout(() => { el.hidden = true; }, 1600); };
  const cleanupWorld = (): void => { if (world) { try { world.free(); } catch { /* no-op */ } world = null; } if (heavyVisual) scene.remove(heavyVisual); if (lightVisual) scene.remove(lightVisual); heavyVisual = null; lightVisual = null; bindings.length = 0; };

  const buildWorld = (): void => {
    cleanupWorld(); world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(7, 0.08, 4.5).setTranslation(0, -0.08, 0).setFriction(0.72));
    const ramp = placeables.find((p) => p.type === 'ramp')!; const lever = placeables.find((p) => p.type === 'lever')!;
    const rampAngle = -0.19; const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rampAngle);
    ramp.object.position.set(-3.55, 1.05, 0); ramp.object.quaternion.copy(rq);
    const rampBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-3.55, 1.05, 0).setRotation({ x: rq.x, y: rq.y, z: rq.z, w: rq.w }));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.48, 0.09, 0.50).setFriction(0.62), rampBody);

    const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-0.75, 0.74, 0));
    leverBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-0.75, 0.74, 0).setAngularDamping(0.55).setCanSleep(false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.60, 0.10, 0.22).setTranslation(0, 0.30, 0).setDensity(1.65).setFriction(0.50), leverBody);
    const jointDesc = RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const joint = world.createImpulseJoint(jointDesc, anchor, leverBody, true) as any; joint.setLimits(-0.40, 0.40); bindings.push({ body: leverBody, object: lever.object });

    heavyVisual = cloneAsset(heavyTemplate); scene.add(heavyVisual);
    heavyBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-4.72, 1.78, 0).setCcdEnabled(true).setLinearDamping(0.012));
    world.createCollider(RAPIER.ColliderDesc.ball(0.34).setDensity(8.8).setFriction(0.60).setRestitution(0.04), heavyBody); bindings.push({ body: heavyBody, object: heavyVisual });

    lightVisual = cloneAsset(lightTemplate); scene.add(lightVisual);
    lightBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.54, 1.31, 0).setCcdEnabled(true).setLinearDamping(0.012));
    world.createCollider(RAPIER.ColliderDesc.ball(0.24).setDensity(0.72).setFriction(0.42).setRestitution(0.32), lightBody); bindings.push({ body: lightBody, object: lightVisual });

    const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.60, 0.86, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.48, 0.05, 0.36).setFriction(0.45), platformBody);

    const pullBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1.42, 1.52, 0));
    ropeSensor = world.createCollider(RAPIER.ColliderDesc.ball(0.31).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), pullBody);
    weightBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(3.18, 1.92, 0).setGravityScale(0).setCcdEnabled(true).setLinearDamping(0.06));
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.34, 0.32).setDensity(6.5).setFriction(0.60), weightBody); bindings.push({ body: weightBody, object: weightVisual });
    const buttonBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(3.18, 0.30, 0));
    buttonSensor = world.createCollider(RAPIER.ColliderDesc.cuboid(0.34, 0.12, 0.30).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), buttonBody);
  };

  const canonical = (): void => {
    if (running) return; placeables.forEach((p) => scene.remove(p.object)); placeables.length = 0; select(null);
    ZONES.forEach((zone) => { const object = cloneAsset(templates[zone.type]); object.position.copy(zone.position); scene.add(object); placeables.push({ type: zone.type, object, snapped: true, yaw: 0 }); }); refreshUi();
  };
  const start = (): void => {
    if (!ready() || running) return; running = true; ropePulled = false; weightPressed = false; leverActivated = false; accumulator = 0;
    canvas.dataset.stageState = 'running'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
    root.querySelectorAll('.aaa-objectives li').forEach((el) => { if ((el as HTMLElement).dataset.step !== 'build') el.classList.remove('done', 'active'); }); setStep('lever', true); buildWorld(); refreshUi();
  };
  const reset = (): void => {
    running = false; cleanupWorld(); weightVisual.position.set(3.18, 1.92, 0); weightVisual.quaternion.identity(); ropeLine.geometry.dispose(); ropeLine.geometry = ropeGeometry(1.92);
    canvas.dataset.stageState = 'build'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false'; root.querySelector<HTMLElement>('.aaa-win')!.hidden = true;
    root.querySelectorAll('.aaa-objectives li').forEach((el) => el.classList.remove('done', 'active')); refreshUi();
  };
  canvas.__applyCanonicalSolution = canonical; canvas.__startStage = start; canvas.__resetStage = reset;

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-action]')?.dataset.action; const edit = target.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'play') start(); if (action === 'reset' || action === 'again') reset(); if (action === 'camera') { camera.position.copy(homePos); controls.target.copy(homeTarget); controls.update(); }
    if (edit && selected && !running) {
      if (edit === 'left') selected.yaw += Math.PI / 12; if (edit === 'right') selected.yaw -= Math.PI / 12;
      if (edit === 'delete') { scene.remove(selected.object); placeables.splice(placeables.indexOf(selected), 1); select(null); refreshUi(); return; }
      selected.object.rotation.y = selected.yaw; snap(selected); refreshUi();
    }
  });
  window.addEventListener('keydown', (event) => { if (!selected || running) return; if (event.key.toLowerCase() === 'r') { selected.yaw += event.shiftKey ? -Math.PI / 12 : Math.PI / 12; selected.object.rotation.y = selected.yaw; snap(selected); refreshUi(); } });

  const inspectEvents = (): void => {
    if (!world) return;
    events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      if (ropeSensor && (a === ropeSensor.handle || b === ropeSensor.handle) && !ropePulled) {
        ropePulled = true; canvas.dataset.ropePulled = 'true'; setStep('rope'); setStep('weight', true); weightBody.setGravityScale(1, true); toast('Трос дёрнут — груз освобождён!');
      }
      if (buttonSensor && (a === buttonSensor.handle || b === buttonSensor.handle) && ropePulled && !weightPressed) {
        weightPressed = true; running = false; canvas.dataset.weightPressed = 'true'; canvas.dataset.goalPowered = 'true'; canvas.dataset.stageState = 'won'; setStep('weight'); setStep('goal'); root.querySelector<HTMLElement>('.aaa-win')!.hidden = false;
      }
    });
    if (leverBody && !leverActivated) { const av = leverBody.angvel(); if (Math.abs(av.z) > 0.72) { leverActivated = true; canvas.dataset.leverActivated = 'true'; setStep('lever'); setStep('rope', true); } }
    if (heavyBody) { const p = heavyBody.translation(); canvas.dataset.heavyBall = `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }
    if (lightBody) { const p = lightBody.translation(); canvas.dataset.lightBall = `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }
    if (weightBody) { const p = weightBody.translation(); canvas.dataset.weightY = p.y.toFixed(2); ropeLine.geometry.dispose(); ropeLine.geometry = ropeGeometry(p.y); }
  };

  const resize = (): void => { const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize();
  canvas.dataset.stageState = 'build'; canvas.dataset.buildReady = 'false'; canvas.dataset.physics = 'rapier3d-0.19.3-stage02-rigid-body-chain-v2'; canvas.dataset.assetPipeline = 'original-pbr-mesh-kit-v1'; canvas.dataset.visualTarget = 'bright-child-aaa-workshop-v1'; canvas.dataset.leverActivated = 'false'; canvas.dataset.ropePulled = 'false'; canvas.dataset.weightPressed = 'false'; canvas.dataset.goalPowered = 'false';
  root.querySelector<HTMLElement>('.aaa-loading')?.classList.add('ready'); refreshUi();

  const loop = (now: number): void => {
    requestAnimationFrame(loop); const dt = Math.min((now - previous) / 1000, 0.12); previous = now;
    if (running && world) { accumulator += dt; while (accumulator >= FIXED_DT) { world.timestep = FIXED_DT; world.step(events); inspectEvents(); accumulator -= FIXED_DT; } bindings.forEach((binding) => { try { syncBody(binding.object, binding.body); } catch { /* reset */ } }); }
    controls.update(); renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
}
