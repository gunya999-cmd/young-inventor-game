import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';

const FIXED_DT = 1 / 60;
const MAX_CATCHUP = 0.18;
const STAGE_VERSION = 'vertical-slice-01-v1';

type StageCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __startStage?: () => void;
  __resetStage?: () => void;
};

type RampPart = {
  id: string;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  body: any;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  placed: boolean;
};

type DynamicBinding = { body: any; object: THREE.Object3D };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function composeRampQuaternion(yaw: number, pitch: number): THREE.Quaternion {
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch);
  return yawQ.multiply(pitchQ);
}

function setObjectFromBody(object: THREE.Object3D, body: any): void {
  const p = body.translation();
  const q = body.rotation();
  object.position.set(p.x, p.y, p.z);
  object.quaternion.set(q.x, q.y, q.z, q.w);
}

function makeRoundedBox(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth, 4, 2, 2), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeRampVisual(wood: THREE.Material, edge: THREE.Material, rubber: THREE.Material): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();
  const deck = makeRoundedBox(2.8, 0.15, 1.05, wood);
  deck.userData.rampHit = true;
  group.add(deck);

  for (const z of [-0.49, 0.49]) {
    const rail = makeRoundedBox(2.82, 0.18, 0.07, edge);
    rail.position.set(0, 0.10, z);
    group.add(rail);
  }
  for (const x of [-1.19, 0, 1.19]) {
    const grip = makeRoundedBox(0.12, 0.035, 0.88, rubber);
    grip.position.set(x, 0.095, 0);
    group.add(grip);
  }
  for (const x of [-1.12, 1.12]) {
    const bracket = makeRoundedBox(0.26, 0.26, 1.17, edge);
    bracket.position.set(x, -0.15, 0);
    group.add(bracket);
  }
  return { group, hitMesh: deck };
}

function makeWorkshopBackdrop(scene: THREE.Scene, materials: { wall: THREE.Material; wood: THREE.Material; dark: THREE.Material; metal: THREE.Material }): void {
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), materials.wall);
  backWall.position.set(0, 3.0, -4.35);
  scene.add(backWall);

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), materials.wall);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-7.25, 3.0, 0.6);
  scene.add(sideWall);

  const bench = makeRoundedBox(13.7, 0.34, 7.0, materials.wood);
  bench.position.set(0, -0.23, 0);
  scene.add(bench);

  const benchFront = makeRoundedBox(13.7, 1.15, 0.22, materials.dark);
  benchFront.position.set(0, -0.73, 3.33);
  scene.add(benchFront);

  const pegboard = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.1, 0.12), materials.wood);
  pegboard.position.set(0.7, 3.35, -4.18);
  pegboard.castShadow = true;
  pegboard.receiveShadow = true;
  scene.add(pegboard);

  const pegMaterial = materials.dark;
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 20; col += 1) {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.04, 12), pegMaterial);
      peg.rotation.x = Math.PI / 2;
      peg.position.set(-3.2 + col * 0.41, 2.15 + row * 0.38, -4.08);
      scene.add(peg);
    }
  }

  for (const x of [-4.8, 4.7]) {
    const shelf = makeRoundedBox(1.9, 0.12, 0.72, materials.metal);
    shelf.position.set(x, 2.25, -3.75);
    scene.add(shelf);
    const box = makeRoundedBox(0.72, 0.58, 0.58, materials.dark);
    box.position.set(x, 2.60, -3.72);
    scene.add(box);
  }

  const blueprint = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.45),
    new THREE.MeshPhysicalMaterial({ color: 0x31566d, roughness: 0.58, metalness: 0.02, clearcoat: 0.05 })
  );
  blueprint.position.set(2.55, 3.55, -4.08);
  scene.add(blueprint);
  for (const offset of [-0.46, 0, 0.46]) {
    const line = makeRoundedBox(1.72, 0.018, 0.018, materials.metal);
    line.position.set(2.55, 3.55 + offset, -4.01);
    scene.add(line);
  }
}

function createBell(materials: { brass: THREE.Material; dark: THREE.Material }): { group: THREE.Group; swing: THREE.Group } {
  const group = new THREE.Group();
  group.position.set(5.38, 1.45, 1.42);

  const frameLeft = makeRoundedBox(0.12, 1.95, 0.16, materials.dark);
  frameLeft.position.set(-0.58, -0.42, 0);
  group.add(frameLeft);
  const frameRight = frameLeft.clone();
  frameRight.position.x = 0.58;
  group.add(frameRight);
  const top = makeRoundedBox(1.28, 0.12, 0.18, materials.dark);
  top.position.set(0, 0.51, 0);
  group.add(top);

  const swing = new THREE.Group();
  swing.position.set(0, 0.38, 0);
  group.add(swing);

  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, 0.62, 48, 1, true), materials.brass);
  bell.position.y = -0.36;
  bell.castShadow = true;
  swing.add(bell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.052, 14, 56), materials.brass);
  rim.position.y = -0.67;
  rim.rotation.x = Math.PI / 2;
  swing.add(rim);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), materials.dark);
  clapper.position.y = -0.60;
  swing.add(clapper);
  return { group, swing };
}

function playBellSound(): void {
  try {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    gain.connect(ctx.destination);
    for (const [freq, volume] of [[620, 1], [930, 0.46], [1240, 0.24]] as Array<[number, number]>) {
      const osc = ctx.createOscillator();
      const localGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      localGain.gain.value = volume;
      osc.connect(localGain);
      localGain.connect(gain);
      osc.start(now);
      osc.stop(now + 1.5);
    }
  } catch {
    // Audio is decorative only; gameplay must never depend on it.
  }
}

export async function installVerticalSliceStage(): Promise<void> {
  document.documentElement.classList.add('vertical-slice-mode');
  document.body.classList.add('vertical-slice-mode');

  const root = document.createElement('main');
  root.className = 'vs-stage';
  root.innerHTML = `
    <section class="vs-loading"><div class="vs-loading__mark">⚙</div><strong>Собираем физическую мастерскую…</strong><span>Инициализация 3D-физики</span></section>
    <header class="vs-topbar">
      <div class="vs-brand"><span class="vs-brand__mark">R</span><div><small>RUBE LAB · STAGE 01</small><strong>Первый импульс</strong></div></div>
      <div class="vs-objective"><small>ЦЕЛЬ</small><strong>Запусти цепочку и заставь колокол прозвенеть</strong></div>
      <div class="vs-actions"><button data-action="hint">Подсказка</button><button data-action="reset">Сбросить</button><button class="primary" data-action="run" disabled>▶ Запустить</button></div>
    </header>
    <section class="vs-viewport">
      <canvas aria-label="Full 3D physics puzzle stage" data-stage-version="${STAGE_VERSION}" data-stage-state="loading"></canvas>
      <aside class="vs-mission">
        <small>ЦЕПОЧКА</small>
        <ol>
          <li data-step="build"><i>1</i><span><b>Построй путь</b><em>Установи 2 направляющие</em></span></li>
          <li data-step="ball"><i>2</i><span><b>Используй гравитацию</b><em>Шар должен нажать площадку</em></span></li>
          <li data-step="domino"><i>3</i><span><b>Передай импульс</b><em>Запусти цепочку домино</em></span></li>
          <li data-step="bell"><i>4</i><span><b>Финиш</b><em>Ударь в колокол</em></span></li>
        </ol>
      </aside>
      <div class="vs-selection" hidden>
        <div><small>ВЫБРАНО</small><strong data-selected-name>Направляющая</strong></div>
        <div class="vs-selection__buttons">
          <button data-edit="left" title="Повернуть влево">↶</button><button data-edit="right" title="Повернуть вправо">↷</button>
          <button data-edit="up" title="Поднять">↑</button><button data-edit="down" title="Опустить">↓</button>
          <button data-edit="steeper" title="Увеличить наклон">∠+</button><button data-edit="flatter" title="Уменьшить наклон">∠−</button>
        </div>
      </div>
      <div class="vs-toast" hidden></div>
      <section class="vs-win" hidden><div class="vs-win__ring">✓</div><small>ЭТАП ПРОЙДЕН</small><h2>Цепочка работает!</h2><p>Потенциальная энергия шара превратилась в движение, столкновение передало импульс дальше, и цепь закончилась ударом по колоколу.</p><div><button data-action="again">Улучшить конструкцию</button></div></section>
    </section>
    <footer class="vs-inventory">
      <div class="vs-inventory__label"><small>ДЕТАЛИ</small><strong>Перетащи в мастерскую</strong></div>
      <button class="vs-part" data-part="ramp-1"><span class="vs-part__icon">▱</span><span><b>Направляющая</b><small>металл + дерево</small></span><em data-count="ramp-1">1</em></button>
      <button class="vs-part" data-part="ramp-2"><span class="vs-part__icon">▱</span><span><b>Направляющая</b><small>металл + дерево</small></span><em data-count="ramp-2">1</em></button>
      <div class="vs-physics-note"><i>●</i><span><b>Физика в реальном времени</b><small>масса · трение · гравитация · импульс</small></span></div>
    </footer>
  `;
  document.body.innerHTML = '';
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `
    :root{color-scheme:dark}.vertical-slice-mode,body.vertical-slice-mode{margin:0;width:100%;height:100%;overflow:hidden;background:#101417;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eef3f4}.vs-stage{height:100dvh;display:grid;grid-template-rows:76px minmax(0,1fr) 104px;background:radial-gradient(circle at 50% 0,#273139 0,#13191d 54%,#0b0e10 100%)}
    .vs-loading{position:fixed;inset:0;z-index:100;display:grid;place-content:center;justify-items:center;gap:9px;background:#11171a;transition:.35s opacity}.vs-loading.ready{opacity:0;pointer-events:none}.vs-loading__mark{font-size:52px;animation:vs-spin 2s linear infinite;color:#e8b95c}.vs-loading strong{font-size:20px}.vs-loading span{color:#87949a;font-size:13px}@keyframes vs-spin{to{transform:rotate(360deg)}}
    .vs-topbar{z-index:20;display:grid;grid-template-columns:280px minmax(340px,1fr) auto;align-items:center;gap:20px;padding:0 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,18,21,.88);backdrop-filter:blur(18px)}.vs-brand{display:flex;align-items:center;gap:12px}.vs-brand__mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(145deg,#efc36a,#8c5e25);color:#17120a;font-weight:950;font-size:22px;box-shadow:inset 0 1px 0 #ffe7aa,0 6px 24px #0006}.vs-brand small,.vs-objective small,.vs-mission>small,.vs-selection small,.vs-win small,.vs-inventory__label small{display:block;color:#89969c;font-size:10px;font-weight:800;letter-spacing:.15em}.vs-brand strong{font-size:15px}.vs-objective{padding-left:18px;border-left:1px solid #ffffff14}.vs-objective strong{display:block;margin-top:3px;font-size:14px}.vs-actions{display:flex;gap:8px}.vs-actions button,.vs-selection button,.vs-win button{border:1px solid #ffffff18;border-radius:11px;background:#20282d;color:#e8eef0;padding:10px 13px;font-weight:750;cursor:pointer}.vs-actions button.primary{background:linear-gradient(180deg,#f0c266,#c98d35);border-color:#f8d98e;color:#211507;box-shadow:0 5px 18px #0005}.vs-actions button:disabled{opacity:.38;cursor:not-allowed;filter:saturate(.4)}
    .vs-viewport{position:relative;min-height:0;overflow:hidden}.vs-viewport canvas{width:100%;height:100%;display:block;touch-action:none;outline:none}.vs-mission{position:absolute;left:18px;top:18px;width:235px;padding:15px;border:1px solid #ffffff13;border-radius:16px;background:rgba(14,19,22,.78);backdrop-filter:blur(16px);box-shadow:0 14px 40px #0004}.vs-mission ol{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}.vs-mission li{display:flex;align-items:center;gap:10px;padding:8px;border-radius:11px;color:#89969c;transition:.25s}.vs-mission li i{display:grid;place-items:center;width:25px;height:25px;border:1px solid #ffffff18;border-radius:8px;font-size:11px;font-style:normal;font-weight:850}.vs-mission li span{display:grid;gap:2px}.vs-mission li b{font-size:12px;color:#ccd4d7}.vs-mission li em{font-size:10px;font-style:normal}.vs-mission li.done{background:#365f4938;color:#8bd9ad}.vs-mission li.done i{background:#3b8e62;border-color:#63bf86;color:#fff}.vs-mission li.done b{color:#bff2d1}
    .vs-selection{position:absolute;right:18px;top:18px;width:240px;padding:13px;border-radius:15px;border:1px solid #ffffff16;background:rgba(14,19,22,.84);backdrop-filter:blur(16px);box-shadow:0 14px 40px #0004}.vs-selection>div:first-child{display:flex;align-items:end;justify-content:space-between}.vs-selection strong{font-size:13px}.vs-selection__buttons{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:9px}.vs-selection button{padding:8px 4px;font-size:13px}.vs-toast{position:absolute;left:50%;top:20px;transform:translateX(-50%);z-index:25;padding:11px 16px;border-radius:12px;background:#12191ddd;border:1px solid #ffffff18;box-shadow:0 10px 30px #0006;font-size:13px;font-weight:700}.vs-win{position:absolute;z-index:40;left:50%;top:50%;transform:translate(-50%,-50%);width:min(470px,calc(100% - 40px));padding:28px;border:1px solid #f3ca7855;border-radius:22px;background:linear-gradient(155deg,rgba(23,30,33,.97),rgba(11,15,17,.97));box-shadow:0 35px 100px #000b;text-align:center}.vs-win__ring{display:grid;place-items:center;margin:0 auto 12px;width:58px;height:58px;border-radius:50%;background:#48a875;color:#fff;font-size:28px;font-weight:900;box-shadow:0 0 0 8px #48a87520}.vs-win h2{margin:8px 0 8px;font-size:28px}.vs-win p{margin:0 auto 18px;max-width:390px;color:#aab5ba;font-size:13px;line-height:1.55}
    .vs-inventory{z-index:20;display:flex;align-items:center;gap:12px;padding:12px 20px;border-top:1px solid #ffffff0f;background:linear-gradient(180deg,rgba(17,23,26,.96),rgba(10,14,16,.98));box-shadow:0 -18px 50px #0005}.vs-inventory__label{width:150px}.vs-inventory__label strong{display:block;margin-top:3px;font-size:12px}.vs-part{position:relative;display:flex;align-items:center;gap:11px;min-width:210px;height:72px;padding:8px 13px;border:1px solid #ffffff16;border-radius:14px;background:linear-gradient(160deg,#262f34,#181e22);color:#eef3f4;text-align:left;cursor:grab;box-shadow:inset 0 1px 0 #ffffff0b}.vs-part:hover{border-color:#e8b85e88;transform:translateY(-1px)}.vs-part.used{opacity:.38;pointer-events:none}.vs-part__icon{display:grid;place-items:center;width:48px;height:48px;border-radius:10px;background:linear-gradient(145deg,#715533,#34291d);color:#f0c46e;font-size:29px}.vs-part span:nth-child(2){display:grid;gap:3px}.vs-part b{font-size:13px}.vs-part small{font-size:10px;color:#8d999e}.vs-part em{position:absolute;right:8px;top:8px;display:grid;place-items:center;width:20px;height:20px;border-radius:7px;background:#d9a548;color:#1b1409;font:900 11px/1 system-ui;font-style:normal}.vs-physics-note{margin-left:auto;display:flex;align-items:center;gap:9px;padding:10px 13px;border-radius:13px;background:#11171a;border:1px solid #ffffff0d}.vs-physics-note i{color:#57c68c;font-style:normal;text-shadow:0 0 12px #57c68c}.vs-physics-note span{display:grid;gap:2px}.vs-physics-note b{font-size:11px}.vs-physics-note small{font-size:9px;color:#829097}
    @media(max-width:900px){.vs-stage{grid-template-rows:68px minmax(0,1fr) 94px}.vs-topbar{grid-template-columns:1fr auto;padding:0 12px}.vs-objective{display:none}.vs-brand__mark{width:34px;height:34px}.vs-actions button:not(.primary){display:none}.vs-mission{left:9px;top:9px;width:190px;padding:10px}.vs-mission li{padding:5px}.vs-mission li em{display:none}.vs-selection{right:9px;top:9px;width:205px}.vs-inventory{padding:9px;gap:7px}.vs-inventory__label,.vs-physics-note{display:none}.vs-part{min-width:0;flex:1;height:66px;padding:7px}.vs-part__icon{width:40px;height:40px}.vs-part small{display:none}}
  `;
  document.head.appendChild(style);

  await RAPIER.init();

  const loading = root.querySelector<HTMLElement>('.vs-loading')!;
  const canvas = root.querySelector<StageCanvas>('canvas')!;
  const runButton = root.querySelector<HTMLButtonElement>('[data-action="run"]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const hintButton = root.querySelector<HTMLButtonElement>('[data-action="hint"]')!;
  const againButton = root.querySelector<HTMLButtonElement>('[data-action="again"]')!;
  const selectionPanel = root.querySelector<HTMLElement>('.vs-selection')!;
  const toast = root.querySelector<HTMLElement>('.vs-toast')!;
  const winPanel = root.querySelector<HTMLElement>('.vs-win')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x172027, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x172027, 0.028);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;

  scene.add(new THREE.HemisphereLight(0xeaf2f3, 0x30383d, 1.25));
  const key = new THREE.DirectionalLight(0xffe5b8, 3.0);
  key.position.set(-4.5, 8.5, 5.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9dcf1, 1.1);
  rim.position.set(6.2, 5.2, -4.0);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffb85f, 38, 8.5, 2);
  warm.position.set(-5.4, 3.8, -2.4);
  scene.add(warm);

  const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x354148, roughness: 0.92, metalness: 0.02 });
  const woodMat = new THREE.MeshPhysicalMaterial({ color: 0x7d5b39, roughness: 0.58, metalness: 0.02, clearcoat: 0.08, clearcoatRoughness: 0.68 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x20282d, roughness: 0.42, metalness: 0.72 });
  const metalMat = new THREE.MeshPhysicalMaterial({ color: 0xa8b1b5, roughness: 0.25, metalness: 0.95 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.87, metalness: 0.02 });
  const brassMat = new THREE.MeshPhysicalMaterial({ color: 0xc18a33, roughness: 0.24, metalness: 0.90, clearcoat: 0.08 });
  const steelBallMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa5aa, metalness: 1, roughness: 0.17, clearcoat: 0.08 });
  const dominoMat = new THREE.MeshPhysicalMaterial({ color: 0xefe7d7, roughness: 0.38, metalness: 0.02, clearcoat: 0.12 });
  const accentMat = new THREE.MeshPhysicalMaterial({ color: 0xc7483f, roughness: 0.32, metalness: 0.48, clearcoat: 0.12 });

  makeWorkshopBackdrop(scene, { wall: wallMat, wood: woodMat, dark: darkMat, metal: metalMat });

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(7.9, 7.0, 11.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-0.2, 1.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8.5;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.enablePan = false;
  controls.update();

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  const eventQueue = new RAPIER.EventQueue(true);
  const bindings: DynamicBinding[] = [];

  const createFixedBox = (x: number, y: number, z: number, hx: number, hy: number, hz: number, quaternion?: THREE.Quaternion): any => {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (quaternion) desc.setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
    const body = world.createRigidBody(desc);
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.72).setRestitution(0.02), body);
    return body;
  };

  createFixedBox(0, -0.17, 0, 6.82, 0.17, 3.48);

  const startRampQ = composeRampQuaternion(0, -0.20);
  createFixedBox(-4.2, 2.60, -1.40, 1.2, 0.075, 0.53, startRampQ);
  const startRamp = makeRampVisual(woodMat, metalMat, rubberMat).group;
  startRamp.scale.x = 2.4 / 2.8;
  startRamp.position.set(-4.2, 2.60, -1.40);
  startRamp.quaternion.copy(startRampQ);
  scene.add(startRamp);

  const startStand = makeRoundedBox(0.58, 2.42, 0.84, darkMat);
  startStand.position.set(-5.25, 1.18, -1.40);
  scene.add(startStand);
  createFixedBox(-5.25, 1.18, -1.40, 0.29, 1.21, 0.42);

  const padVisual = new THREE.Group();
  padVisual.position.set(2.78, 0.17, -1.40);
  scene.add(padVisual);
  const padBase = makeRoundedBox(0.88, 0.24, 0.92, darkMat);
  padVisual.add(padBase);
  const padTop = makeRoundedBox(0.67, 0.12, 0.70, accentMat);
  padTop.position.y = 0.17;
  padVisual.add(padTop);
  createFixedBox(2.78, 0.12, -1.40, 0.44, 0.12, 0.46);
  const switchSensorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2.78, 0.61, -1.40));
  const switchSensor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.49, 0.50, 0.52).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    switchSensorBody
  );

  const secondRampQ = composeRampQuaternion(0, -0.18);
  createFixedBox(1.05, 0.82, 1.42, 1.45, 0.075, 0.52, secondRampQ);
  const secondRampVisual = makeRampVisual(woodMat, metalMat, rubberMat).group;
  secondRampVisual.scale.x = 2.9 / 2.8;
  secondRampVisual.position.set(1.05, 0.82, 1.42);
  secondRampVisual.quaternion.copy(secondRampQ);
  scene.add(secondRampVisual);

  const gate = makeRoundedBox(0.10, 0.82, 0.84, accentMat);
  gate.position.set(-0.17, 1.31, 1.42);
  scene.add(gate);

  const secondBallMesh = new THREE.Mesh(new THREE.SphereGeometry(0.29, 42, 28), steelBallMat);
  secondBallMesh.castShadow = true;
  secondBallMesh.position.set(-0.42, 1.45, 1.42);
  scene.add(secondBallMesh);

  const dominoInitial: Array<{ x: number; y: number; z: number; rot: THREE.Quaternion }> = [];
  const dominoBodies: any[] = [];
  for (let index = 0; index < 8; index += 1) {
    const x = 2.25 + index * 0.43;
    const z = 1.42;
    const y = 0.54;
    const mesh = makeRoundedBox(0.13, 1.02, 0.47, dominoMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.05).setAngularDamping(0.08).setCanSleep(false)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.065, 0.51, 0.235).setDensity(0.85).setFriction(0.64).setRestitution(0.02), body);
    bindings.push({ body, object: mesh });
    dominoBodies.push(body);
    dominoInitial.push({ x, y, z, rot: new THREE.Quaternion() });
  }

  const bell = createBell({ brass: brassMat, dark: darkMat });
  scene.add(bell.group);
  const bellPlate = makeRoundedBox(0.16, 0.98, 0.78, brassMat);
  bellPlate.position.set(5.18, 0.55, 1.42);
  scene.add(bellPlate);
  createFixedBox(5.18, 0.55, 1.42, 0.08, 0.49, 0.39);
  const bellSensorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(4.98, 0.55, 1.42));
  const bellSensor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.12, 0.52, 0.42).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    bellSensorBody
  );

  const ramps = new Map<string, RampPart>();
  let selectedRamp: RampPart | null = null;
  let dragPointer: number | null = null;
  let dragging = false;
  let dragOffset = new THREE.Vector3();
  let hintVisible = false;
  let running = false;
  let won = false;
  let switchTriggered = false;
  let dominoStarted = false;
  let startBallBody: any | null = null;
  let secondBallBody: any | null = null;
  const dynamicBallBindings: DynamicBinding[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHit = new THREE.Vector3();
  let toastTimer = 0;
  let bellAnimationTime = 0;

  const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0xe6ba61, transparent: true, opacity: 0.16, depthWrite: false, wireframe: true });
  const ghost1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 1.05), ghostMaterial);
  const ghost2 = ghost1.clone();
  scene.add(ghost1, ghost2);
  const setGhost = (mesh: THREE.Mesh, x: number, y: number, z: number, yaw: number, pitch: number): void => {
    mesh.position.set(x, y, z);
    mesh.quaternion.copy(composeRampQuaternion(yaw, pitch));
    mesh.visible = false;
  };
  setGhost(ghost1, -1.6, 1.98, -1.40, 0, -0.23);
  setGhost(ghost2, 1.20, 1.30, -1.40, 0, -0.23);

  const showToast = (message: string): void => {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2200);
  };

  const setStep = (step: string, done: boolean): void => {
    root.querySelector(`[data-step="${step}"]`)?.classList.toggle('done', done);
  };

  const updateBuildState = (): void => {
    const placedCount = [...ramps.values()].filter((part) => part.placed).length;
    setStep('build', placedCount === 2);
    runButton.disabled = placedCount !== 2 || running;
    canvas.dataset.rampsPlaced = String(placedCount);
    canvas.dataset.buildReady = placedCount === 2 ? 'true' : 'false';
  };

  const updateRampTransform = (part: RampPart): void => {
    part.x = clamp(part.x, -3.25, 2.35);
    part.y = clamp(part.y, 0.45, 2.55);
    part.z = clamp(part.z, -2.65, 0.65);
    part.pitch = clamp(part.pitch, -0.40, 0.18);
    const q = composeRampQuaternion(part.yaw, part.pitch);
    part.group.position.set(part.x, part.y, part.z);
    part.group.quaternion.copy(q);
    part.body.setTranslation({ x: part.x, y: part.y, z: part.z }, true);
    part.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  };

  const selectRamp = (part: RampPart | null): void => {
    selectedRamp = part;
    selectionPanel.hidden = !part;
    for (const candidate of ramps.values()) {
      candidate.group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial) {
          object.material.emissive.set(candidate === part ? 0x33220d : 0x000000);
          object.material.emissiveIntensity = candidate === part ? 0.32 : 0;
        }
      });
    }
  };

  const spawnRamp = (id: string): void => {
    if (ramps.has(id)) return;
    const visual = makeRampVisual(woodMat.clone(), metalMat.clone(), rubberMat);
    const defaultIndex = id === 'ramp-1' ? 0 : 1;
    const part: RampPart = {
      id,
      group: visual.group,
      hitMesh: visual.hitMesh,
      body: null,
      x: defaultIndex === 0 ? -1.55 : 1.10,
      y: defaultIndex === 0 ? 1.98 : 1.30,
      z: defaultIndex === 0 ? -0.25 : 0.10,
      yaw: 0,
      pitch: -0.23,
      placed: true,
    };
    part.group.userData.rampId = id;
    part.hitMesh.userData.rampId = id;
    part.group.traverse((object) => { if (object instanceof THREE.Mesh) object.userData.rampId = id; });
    scene.add(part.group);
    const q = composeRampQuaternion(part.yaw, part.pitch);
    part.body = createFixedBox(part.x, part.y, part.z, 1.4, 0.075, 0.525, q);
    ramps.set(id, part);
    root.querySelector<HTMLButtonElement>(`[data-part="${id}"]`)?.classList.add('used');
    const count = root.querySelector<HTMLElement>(`[data-count="${id}"]`); if (count) count.textContent = '0';
    updateRampTransform(part);
    selectRamp(part);
    updateBuildState();
    showToast('Перетаскивай деталь по столу. Поворот и высота — справа.');
  };

  root.querySelectorAll<HTMLButtonElement>('.vs-part').forEach((button) => {
    button.addEventListener('click', () => spawnRamp(button.dataset.part!));
  });

  const editSelected = (action: string): void => {
    if (!selectedRamp || running) return;
    if (action === 'left') selectedRamp.yaw += THREE.MathUtils.degToRad(10);
    if (action === 'right') selectedRamp.yaw -= THREE.MathUtils.degToRad(10);
    if (action === 'up') selectedRamp.y += 0.12;
    if (action === 'down') selectedRamp.y -= 0.12;
    if (action === 'steeper') selectedRamp.pitch -= THREE.MathUtils.degToRad(2.5);
    if (action === 'flatter') selectedRamp.pitch += THREE.MathUtils.degToRad(2.5);
    updateRampTransform(selectedRamp);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => editSelected(button.dataset.edit!)));

  const pointerToNdc = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (running) return;
    pointerToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    const meshes = [...ramps.values()].flatMap((part) => {
      const result: THREE.Mesh[] = [];
      part.group.traverse((object) => { if (object instanceof THREE.Mesh) result.push(object); });
      return result;
    });
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) { selectRamp(null); return; }
    const id = hit.object.userData.rampId as string | undefined;
    const part = id ? ramps.get(id) : undefined;
    if (!part) return;
    selectRamp(part);
    dragPointer = event.pointerId;
    dragging = true;
    controls.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    raycaster.ray.intersectPlane(dragPlane, planeHit);
    dragOffset.set(part.x - planeHit.x, 0, part.z - planeHit.z);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || dragPointer !== event.pointerId || !selectedRamp || running) return;
    pointerToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
    selectedRamp.x = planeHit.x + dragOffset.x;
    selectedRamp.z = planeHit.z + dragOffset.z;
    updateRampTransform(selectedRamp);
  });
  const endDrag = (event: PointerEvent): void => {
    if (dragPointer !== event.pointerId) return;
    dragPointer = null;
    dragging = false;
    controls.enabled = true;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const startBallMesh = new THREE.Mesh(new THREE.SphereGeometry(0.31, 48, 32), steelBallMat);
  startBallMesh.castShadow = true;
  startBallMesh.position.set(-5.04, 3.06, -1.40);
  scene.add(startBallMesh);

  const createBallBody = (mesh: THREE.Mesh, x: number, y: number, z: number, radius: number, density = 4.4): any => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.018).setAngularDamping(0.018).setCanSleep(false).setCcdEnabled(true)
    );
    world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(density).setFriction(0.58).setRestitution(0.06), body);
    dynamicBallBindings.push({ body, object: mesh });
    return body;
  };

  const resetDominoes = (): void => {
    dominoBodies.forEach((body, index) => {
      const p = dominoInitial[index];
      body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });
  };

  const removeBallBody = (body: any | null, mesh: THREE.Mesh): void => {
    if (!body) return;
    const index = dynamicBallBindings.findIndex((binding) => binding.body === body);
    if (index >= 0) dynamicBallBindings.splice(index, 1);
    world.removeRigidBody(body);
    mesh.position.set(mesh === startBallMesh ? -5.04 : -0.42, mesh === startBallMesh ? 3.06 : 1.45, mesh === startBallMesh ? -1.40 : 1.42);
    mesh.quaternion.identity();
  };

  const resetStage = (): void => {
    running = false;
    won = false;
    switchTriggered = false;
    dominoStarted = false;
    bellAnimationTime = 0;
    removeBallBody(startBallBody, startBallMesh); startBallBody = null;
    removeBallBody(secondBallBody, secondBallMesh); secondBallBody = null;
    resetDominoes();
    gate.position.y = 1.31;
    gate.rotation.z = 0;
    padTop.position.y = 0.17;
    bell.swing.rotation.z = 0;
    winPanel.hidden = true;
    setStep('ball', false);
    setStep('domino', false);
    setStep('bell', false);
    runButton.textContent = '▶ Запустить';
    updateBuildState();
    canvas.dataset.stageState = 'build';
    canvas.dataset.switchTriggered = 'false';
    canvas.dataset.dominoStarted = 'false';
    canvas.dataset.bellRung = 'false';
  };

  const releaseSecondBall = (): void => {
    if (secondBallBody) return;
    secondBallBody = createBallBody(secondBallMesh, -0.42, 1.45, 1.42, 0.29, 4.0);
    secondBallBody.setLinvel({ x: 0.22, y: 0, z: 0 }, true);
  };

  const triggerSwitch = (): void => {
    if (switchTriggered) return;
    switchTriggered = true;
    setStep('ball', true);
    canvas.dataset.switchTriggered = 'true';
    canvas.dataset.stageState = 'chain';
    showToast('Есть контакт! Площадка освободила второй шар.');
    releaseSecondBall();
  };

  const winStage = (): void => {
    if (won) return;
    won = true;
    running = false;
    bellAnimationTime = 0.001;
    setStep('bell', true);
    canvas.dataset.bellRung = 'true';
    canvas.dataset.stageState = 'won';
    runButton.disabled = true;
    winPanel.hidden = false;
    playBellSound();
  };

  const startStage = (): void => {
    if (running || won) return;
    if ([...ramps.values()].filter((part) => part.placed).length !== 2) {
      showToast('Сначала установи обе направляющие.');
      return;
    }
    resetDominoes();
    switchTriggered = false;
    dominoStarted = false;
    setStep('ball', false); setStep('domino', false); setStep('bell', false);
    startBallBody = createBallBody(startBallMesh, -5.04, 3.06, -1.40, 0.31, 5.0);
    startBallBody.setLinvel({ x: 0.10, y: 0, z: 0 }, true);
    running = true;
    canvas.dataset.stageState = 'running';
    canvas.dataset.switchTriggered = 'false';
    canvas.dataset.dominoStarted = 'false';
    canvas.dataset.bellRung = 'false';
    runButton.disabled = true;
    runButton.textContent = 'Симуляция…';
    selectRamp(null);
  };

  runButton.addEventListener('click', startStage);
  resetButton.addEventListener('click', resetStage);
  againButton.addEventListener('click', resetStage);
  hintButton.addEventListener('click', () => {
    hintVisible = !hintVisible;
    ghost1.visible = hintVisible;
    ghost2.visible = hintVisible;
    hintButton.textContent = hintVisible ? 'Скрыть подсказку' : 'Подсказка';
    showToast(hintVisible ? 'Золотой контур показывает один рабочий вариант, но решение не единственное.' : 'Подсказка скрыта.');
  });

  canvas.__applyCanonicalSolution = (): void => {
    spawnRamp('ramp-1'); spawnRamp('ramp-2');
    const p1 = ramps.get('ramp-1')!;
    Object.assign(p1, { x: -1.60, y: 1.98, z: -1.40, yaw: 0, pitch: -0.23 });
    updateRampTransform(p1);
    const p2 = ramps.get('ramp-2')!;
    Object.assign(p2, { x: 1.20, y: 1.30, z: -1.40, yaw: 0, pitch: -0.23 });
    updateRampTransform(p2);
    updateBuildState();
    selectRamp(null);
  };
  canvas.__startStage = startStage;
  canvas.__resetStage = resetStage;

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(1.65, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.dataset.physics = 'rapier3d-0.19.3-rigid-body-collisions-v1';
  canvas.dataset.stageState = 'build';
  canvas.dataset.switchTriggered = 'false';
  canvas.dataset.dominoStarted = 'false';
  canvas.dataset.bellRung = 'false';
  canvas.dataset.rampsPlaced = '0';
  canvas.dataset.buildReady = 'false';

  let previous = performance.now();
  let accumulator = 0;
  const animate = (now: number): void => {
    const dt = Math.min(MAX_CATCHUP, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator = Math.min(MAX_CATCHUP, accumulator + dt);

    while (accumulator >= FIXED_DT) {
      world.step(eventQueue);
      eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
        if (!started) return;
        if (handle1 === switchSensor.handle || handle2 === switchSensor.handle) triggerSwitch();
        if (handle1 === bellSensor.handle || handle2 === bellSensor.handle) winStage();
      });
      accumulator -= FIXED_DT;
    }

    for (const binding of bindings) setObjectFromBody(binding.object, binding.body);
    for (const binding of dynamicBallBindings) setObjectFromBody(binding.object, binding.body);

    if (switchTriggered) {
      padTop.position.y += (0.055 - padTop.position.y) * Math.min(1, dt * 12);
      gate.position.y += (2.25 - gate.position.y) * Math.min(1, dt * 7);
      gate.rotation.z += (0.42 - gate.rotation.z) * Math.min(1, dt * 7);
    }

    if (!dominoStarted && secondBallBody && secondBallBody.translation().x > 1.55) {
      dominoStarted = true;
      setStep('domino', true);
      canvas.dataset.dominoStarted = 'true';
      showToast('Импульс передаётся от детали к детали.');
    }

    if (bellAnimationTime > 0) {
      bellAnimationTime += dt;
      bell.swing.rotation.z = Math.sin(bellAnimationTime * 15) * 0.24 * Math.exp(-bellAnimationTime * 1.7);
    }

    if (startBallBody) {
      const p = startBallBody.translation();
      canvas.dataset.startBall = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
      if (running && p.y < -1.1) {
        running = false;
        runButton.textContent = '↻ Попробовать ещё';
        runButton.disabled = false;
        canvas.dataset.stageState = 'failed';
        showToast('Шар упал со стола. Измени положение или наклон направляющих.');
      }
    }
    if (secondBallBody) {
      const p = secondBallBody.translation();
      canvas.dataset.secondBall = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    }
    canvas.dataset.running = running ? 'true' : 'false';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  resetStage();
  loading.classList.add('ready');
  canvas.dataset.stageState = 'build';
  requestAnimationFrame(animate);
}
