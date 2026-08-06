import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BeltConnection, CONVEYORS, RebootPart, canonicalRebootSolution, createRebootPhysics, type RebootPhysics } from './rebootPhysics';

const VERSION = 'reboot-level-01-v1';
type PartType = 'drive-wheel' | 'ramp';
type Placed = { data: RebootPart; object: THREE.Group };
type DragState = { pointerId: number; type: PartType; object: THREE.Group; source: 'inventory' | 'scene'; placed?: Placed; moved: boolean };

type RebootCanvas = HTMLCanvasElement & {
  __applyCanonicalSolution?: () => void;
  __start?: () => void;
  __advance?: (seconds: number) => void;
};

const COLORS = {
  cream: 0xe8dfca,
  paper: 0xf6f0df,
  ink: 0x26343d,
  steel: 0x77848c,
  dark: 0x30383c,
  teal: 0x3e8f91,
  red: 0xc85c50,
  yellow: 0xdcae4d,
  orange: 0xd78342,
  green: 0x5b8d61,
  ball: 0xe5873f,
};

function mat(color: number, roughness = 0.55, metalness = 0.08): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const M = {
  cream: mat(COLORS.cream, 0.88), paper: mat(COLORS.paper, 0.92), ink: mat(COLORS.ink, 0.66), steel: mat(COLORS.steel, 0.30, 0.72),
  dark: mat(COLORS.dark, 0.48, 0.46), teal: mat(COLORS.teal, 0.42, 0.20), red: mat(COLORS.red, 0.46), yellow: mat(COLORS.yellow, 0.40, 0.14),
  orange: mat(COLORS.orange, 0.44), green: mat(COLORS.green, 0.46), ball: mat(COLORS.ball, 0.36, 0.05), rubber: mat(0x1e2427, 0.90),
};

function finish(root: THREE.Object3D): void {
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
}

function createRamp(): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.16, 0.62), M.steel); g.add(deck);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.035, 0.50), M.rubber); top.position.y = 0.10; g.add(top);
  for (const z of [-0.34, 0.34]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.20, 0.07), M.yellow); rail.position.set(0, 0.16, z); g.add(rail); }
  finish(g); return g;
}

function createDriveWheel(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.58), M.teal); base.position.y = -0.48; g.add(base);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 48), M.red); wheel.rotation.x = Math.PI / 2; wheel.name = 'Rotor'; g.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.30, 32), M.steel); hub.rotation.x = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.045, 0.07), M.yellow); spoke.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.11); spoke.rotation.z = a; g.add(spoke); }
  finish(g); return g;
}

function createConveyor(id: string, width: number): THREE.Group {
  const g = new THREE.Group(); g.userData.kind = 'conveyor'; g.userData.id = id;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width, 0.20, 0.72), M.dark); frame.position.y = -0.05; g.add(frame);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, 0.075, 0.58), M.rubber); belt.position.y = 0.10; belt.name = 'BeltTop'; g.add(belt);
  for (const x of [-width / 2 + 0.18, width / 2 - 0.18]) { const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.62, 32), M.steel); roller.rotation.x = Math.PI / 2; roller.position.set(x, 0.04, 0); roller.name = 'Roller'; g.add(roller); }
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.10, 24), M.yellow); port.rotation.x = Math.PI / 2; port.position.set(-width / 2 + 0.20, -0.20, 0.42); port.name = 'Port'; g.add(port);
  finish(g); return g;
}

function createTarget(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.075, 16, 64), M.red); ring.position.y = 0.12; g.add(ring);
  const cup = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 0.72), M.teal); cup.position.y = -0.43; g.add(cup);
  for (const x of [-0.52, 0.52]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.80, 0.72), M.teal); side.position.set(x, -0.05, 0); g.add(side); }
  finish(g); return g;
}

function createBall(): THREE.Group {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 48, 32), M.ball); g.add(ball);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.012, 8, 64), M.dark); seam.rotation.x = Math.PI / 2; g.add(seam);
  finish(g); return g;
}

function applyPartTransform(placed: Placed): void {
  placed.object.position.set(placed.data.x, placed.data.y, 0);
  if (placed.data.type === 'ramp') placed.object.rotation.z = placed.data.rotationZ;
  else placed.object.rotation.z = 0;
}

export async function startRebootApp(): Promise<void> {
  await RAPIER.init();
  const host = document.querySelector<HTMLElement>('#app'); if (!host) throw new Error('App root missing');
  host.innerHTML = `
    <main class="rb-shell">
      <header class="rb-top">
        <div class="rb-brand"><b>YOUNG INVENTOR</b><span>clean-room reboot</span></div>
        <div class="rb-goal"><small>УРОВЕНЬ 1 · ПЕРЕДАЧА ДВИЖЕНИЯ</small><strong>Доставь оранжевый шар в приёмник</strong><span>Запусти три конвейера и построй путь из направляющих.</span></div>
        <div class="rb-actions"><button data-action="clear">Очистить</button><button data-action="stop">■ Стоп</button><button class="rb-run" data-action="run">▶ ПУСК</button></div>
      </header>
      <section class="rb-main">
        <aside class="rb-left">
          <h2>ДЕТАЛИ</h2>
          <button class="rb-part" data-part="drive-wheel"><i class="wheel-mini"></i><span><b>ПРИВОДНОЕ КОЛЕСО</b><small>источник вращения</small></span><em data-count="drive-wheel">3</em></button>
          <button class="rb-part" data-part="ramp"><i class="ramp-mini"></i><span><b>НАПРАВЛЯЮЩАЯ</b><small>наклон и траектория</small></span><em data-count="ramp">3</em></button>
          <button class="rb-belt-tool" data-action="belt"><i>∞</i><span><b>ПРИВОДНОЙ РЕМЕНЬ</b><small>колесо → конвейер</small></span><em data-count="belt">3</em></button>
          <div class="rb-help"><b>КАК ИГРАТЬ</b><p>Перетащи детали на поле. Для ремня: нажми «ремень», затем колесо и конвейер. Выбранную деталь можно повернуть или удалить.</p></div>
        </aside>
        <section class="rb-stage-wrap">
          <canvas class="rb-canvas" data-version="${VERSION}" data-state="build" data-parts="0" data-belts="0" aria-label="Physics machine Level 1"></canvas>
          <div class="rb-toolbar" hidden><b data-selected>Деталь</b><button data-edit="left">↶</button><button data-edit="right">↷</button><button data-edit="flip">⇄</button><button data-edit="delete">✕</button></div>
          <div class="rb-belt-status" hidden>РЕМЕНЬ: выбери приводное колесо</div>
          <div class="rb-message">Собери механизм и нажми ПУСК</div>
          <section class="rb-win" hidden><div>★</div><h2>Механизм работает!</h2><p>Шар прошёл весь маршрут благодаря вращению, трению и наклонным поверхностям.</p><button data-action="stop">Вернуться к сборке</button></section>
        </section>
        <aside class="rb-right">
          <h2>СХЕМА</h2>
          <div class="rb-rule"><span>1</span><p>Каждый конвейер должен получить вращение через ремень.</p></div>
          <div class="rb-rule"><span>2</span><p>Направляющие можно ставить свободно и поворачивать.</p></div>
          <div class="rb-rule"><span>3</span><p>Победа только при реальном попадании шара в приёмник.</p></div>
          <div class="rb-meter"><small>ПИТАНИЕ КОНВЕЙЕРОВ</small><div><i data-power="conveyor-a"></i><i data-power="conveyor-b"></i><i data-power="conveyor-c"></i></div></div>
        </aside>
      </section>
    </main>`;

  const canvas = host.querySelector<RebootCanvas>('canvas'); if (!canvas) throw new Error('Canvas missing');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8ccb5);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50); camera.position.set(0, 2.15, 15.4); camera.lookAt(0, 2.0, 0);
  scene.add(new THREE.HemisphereLight(0xfff8e7, 0x776b5e, 2.0));
  const sun = new THREE.DirectionalLight(0xffefd0, 4.5); sun.position.set(-4, 8, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(13.2, 5.9, 0.22), M.cream); panel.position.set(0, 2.1, -0.70); scene.add(panel);
  const grid = new THREE.GridHelper(12.5, 25, 0xa99c85, 0xc8bda8); grid.rotation.x = Math.PI / 2; grid.position.set(0, 2.1, -0.56); scene.add(grid);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.18, 1.30), M.dark); floor.position.set(0, -0.18, 0); scene.add(floor);

  const conveyors = new Map<string, THREE.Group>();
  for (const c of CONVEYORS) { const g = createConveyor(c.id, c.width); g.position.set(c.x, c.y, 0); scene.add(g); conveyors.set(c.id, g); }
  const target = createTarget(); target.position.set(5.72, 3.58, 0); scene.add(target);
  const ballVisual = createBall(); ballVisual.position.set(-5.15, 1.12, 0); scene.add(ballVisual);

  const parts: Placed[] = [];
  const belts: BeltConnection[] = [];
  const beltLines = new Map<string, THREE.Line>();
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let drag: DragState | null = null; let selected: Placed | null = null; let beltMode = false; let beltSource: Placed | null = null; let sim: RebootPhysics | null = null; let idCounter = 1; let previous = performance.now(); let accumulator = 0;

  const partLimit = (type: PartType): number => 3;
  const usedCount = (type: PartType): number => parts.filter((p) => p.data.type === type).length;
  const worldPoint = (clientX: number, clientY: number): THREE.Vector3 | null => {
    const r = canvas.getBoundingClientRect(); ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera); const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null;
  };
  const inCanvas = (x: number, y: number): boolean => { const r = canvas.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const cloneTemplate = (type: PartType): THREE.Group => type === 'ramp' ? createRamp() : createDriveWheel();
  const refresh = (): void => {
    canvas.dataset.parts = String(parts.length); canvas.dataset.belts = String(belts.length);
    for (const type of ['drive-wheel', 'ramp'] as PartType[]) { const remaining = partLimit(type) - usedCount(type); const el = host.querySelector(`[data-count="${type}"]`); if (el) el.textContent = String(remaining); host.querySelector<HTMLButtonElement>(`.rb-part[data-part="${type}"]`)!.disabled = remaining <= 0 || !!sim; }
    const beltCount = host.querySelector('[data-count="belt"]'); if (beltCount) beltCount.textContent = String(3 - belts.length);
    host.querySelector<HTMLButtonElement>('[data-action="belt"]')!.disabled = belts.length >= 3 || !!sim;
    for (const c of CONVEYORS) host.querySelector(`[data-power="${c.id}"]`)?.classList.toggle('on', belts.some((b) => b.conveyorId === c.id));
    const toolbar = host.querySelector<HTMLElement>('.rb-toolbar')!; toolbar.hidden = !selected || !!sim; if (selected) toolbar.querySelector<HTMLElement>('[data-selected]')!.textContent = selected.data.type === 'ramp' ? 'Направляющая' : 'Приводное колесо';
  };
  const select = (p: Placed | null): void => { selected = p; refresh(); };
  const rebuildBeltLine = (belt: BeltConnection): void => {
    const old = beltLines.get(belt.id); if (old) { scene.remove(old); old.geometry.dispose(); }
    const wheel = parts.find((p) => p.data.id === belt.wheelId); const conveyor = conveyors.get(belt.conveyorId); if (!wheel || !conveyor) return;
    const c = CONVEYORS.find((x) => x.id === belt.conveyorId)!;
    const pts = [new THREE.Vector3(wheel.data.x, wheel.data.y, 0.38), new THREE.Vector3(c.x - c.width / 2 + 0.20, c.y - 0.20, 0.38)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x302b27 })); line.renderOrder = 5; scene.add(line); beltLines.set(belt.id, line);
  };
  const rebuildBelts = (): void => belts.forEach(rebuildBeltLine);
  const addPart = (type: PartType, p: THREE.Vector3): Placed | null => {
    if (usedCount(type) >= partLimit(type)) return null; const object = cloneTemplate(type); scene.add(object); const data: RebootPart = type === 'ramp' ? { id: `r${idCounter++}`, type, x: p.x, y: p.y, rotationZ: 0 } : { id: `w${idCounter++}`, type, x: p.x, y: p.y, direction: 1 }; const placed = { data, object }; applyPartTransform(placed); parts.push(placed); refresh(); return placed;
  };
  const deletePart = (p: Placed): void => {
    scene.remove(p.object); parts.splice(parts.indexOf(p), 1); for (const b of [...belts]) if (b.wheelId === p.data.id) { const i = belts.indexOf(b); if (i >= 0) belts.splice(i, 1); const l = beltLines.get(b.id); if (l) scene.remove(l); beltLines.delete(b.id); } if (selected === p) selected = null; refresh();
  };
  const pick = (event: PointerEvent): { part?: Placed; conveyorId?: string } => {
    const r = canvas.getBoundingClientRect(); ndc.set((event.clientX - r.left) / r.width * 2 - 1, -((event.clientY - r.top) / r.height * 2 - 1)); ray.setFromCamera(ndc, camera);
    const map = new Map<THREE.Object3D, Placed>(); const objects: THREE.Object3D[] = [];
    for (const p of parts) p.object.traverse((o) => { if (o instanceof THREE.Mesh) { map.set(o, p); objects.push(o); } });
    for (const [id, g] of conveyors) g.traverse((o) => { if (o instanceof THREE.Mesh) { o.userData.conveyorId = id; objects.push(o); } });
    const hit = ray.intersectObjects(objects, false)[0]; if (!hit) return {}; const p = map.get(hit.object); if (p) return { part: p }; const cid = hit.object.userData.conveyorId as string | undefined; return cid ? { conveyorId: cid } : {};
  };
  const exitBeltMode = (): void => { beltMode = false; beltSource = null; host.querySelector<HTMLElement>('.rb-belt-status')!.hidden = true; host.querySelector('[data-action="belt"]')?.classList.remove('active'); };
  const handleBeltTap = (event: PointerEvent): boolean => {
    if (!beltMode) return false; const hit = pick(event); const status = host.querySelector<HTMLElement>('.rb-belt-status')!;
    if (!beltSource) { if (hit.part?.data.type === 'drive-wheel') { beltSource = hit.part; status.textContent = 'РЕМЕНЬ: теперь выбери конвейер'; } return true; }
    if (hit.conveyorId && !belts.some((b) => b.conveyorId === hit.conveyorId) && !belts.some((b) => b.wheelId === beltSource!.data.id)) { const belt = { id: `b${idCounter++}`, wheelId: beltSource.data.id, conveyorId: hit.conveyorId }; belts.push(belt); rebuildBeltLine(belt); exitBeltMode(); refresh(); } return true;
  };

  host.querySelectorAll<HTMLButtonElement>('.rb-part').forEach((button) => button.addEventListener('pointerdown', (event) => {
    if (sim || drag) return; event.preventDefault(); const type = button.dataset.part as PartType; if (usedCount(type) >= partLimit(type)) return; const object = cloneTemplate(type); object.visible = false; scene.add(object); drag = { pointerId: event.pointerId, type, object, source: 'inventory', moved: false };
  }));
  window.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return; event.preventDefault(); drag.moved = true; const p = worldPoint(event.clientX, event.clientY); if (!p || !inCanvas(event.clientX, event.clientY)) { if (drag.source === 'inventory') drag.object.visible = false; return; } drag.object.visible = true; p.x = THREE.MathUtils.clamp(p.x, -5.9, 5.9); p.y = THREE.MathUtils.clamp(p.y, 0.05, 4.65); drag.object.position.set(p.x, p.y, 0); if (drag.placed) { drag.placed.data.x = p.x; drag.placed.data.y = p.y; rebuildBelts(); }
  }, { passive: false });
  window.addEventListener('pointerup', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return; const d = drag; drag = null; if (d.source === 'inventory') { const p = worldPoint(event.clientX, event.clientY); scene.remove(d.object); if (p && inCanvas(event.clientX, event.clientY)) addPart(d.type, p); } refresh();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (sim) return; if (handleBeltTap(event)) return; const hit = pick(event); if (!hit.part) { select(null); return; } select(hit.part); const p = worldPoint(event.clientX, event.clientY); if (!p) return; drag = { pointerId: event.pointerId, type: hit.part.data.type, object: hit.part.object, source: 'scene', placed: hit.part, moved: false };
  });

  const cleanupSim = (): void => { sim?.free(); sim = null; ballVisual.position.set(-5.15, 1.12, 0); ballVisual.quaternion.identity(); canvas.dataset.state = 'build'; host.querySelector<HTMLElement>('.rb-win')!.hidden = true; refresh(); };
  const start = (): void => { if (sim) return; exitBeltMode(); sim = createRebootPhysics(parts.map((p) => p.data), belts); canvas.dataset.state = 'run'; accumulator = 0; host.querySelector<HTMLElement>('.rb-message')!.textContent = belts.length < 3 ? 'Не все конвейеры подключены — посмотрим, что произойдёт.' : 'Машина запущена'; refresh(); };
  const syncSim = (): void => { if (!sim) return; const p = sim.ballBody.translation(); const q = sim.ballBody.rotation(); ballVisual.position.set(p.x, p.y, p.z); ballVisual.quaternion.set(q.x, q.y, q.z, q.w); for (const [id, body] of sim.wheelBodies) { const placed = parts.find((x) => x.data.id === id); if (placed) { const r = placed.object.getObjectByName('Rotor'); if (r) r.rotation.z = body.rotation().z; } } if (sim.state.won) { canvas.dataset.state = 'won'; host.querySelector<HTMLElement>('.rb-win')!.hidden = false; } if (sim.state.ballOut) host.querySelector<HTMLElement>('.rb-message')!.textContent = 'Шар ушёл с маршрута. Нажми Стоп и перестрой механизм.'; };

  host.addEventListener('click', (event) => {
    const el = event.target as HTMLElement; const action = el.closest<HTMLElement>('[data-action]')?.dataset.action; const edit = el.closest<HTMLElement>('[data-edit]')?.dataset.edit;
    if (action === 'run') start();
    if (action === 'stop') cleanupSim();
    if (action === 'clear' && !sim) { for (const p of [...parts]) deletePart(p); belts.splice(0); for (const l of beltLines.values()) scene.remove(l); beltLines.clear(); exitBeltMode(); refresh(); }
    if (action === 'belt' && !sim) { beltMode = !beltMode; beltSource = null; const status = host.querySelector<HTMLElement>('.rb-belt-status')!; status.hidden = !beltMode; status.textContent = 'РЕМЕНЬ: выбери приводное колесо'; el.closest('[data-action="belt"]')?.classList.toggle('active', beltMode); }
    if (edit && selected && !sim) { if (edit === 'delete') { deletePart(selected); return; } if (selected.data.type === 'ramp') { if (edit === 'left') selected.data.rotationZ += Math.PI / 18; if (edit === 'right') selected.data.rotationZ -= Math.PI / 18; } else if (edit === 'flip') selected.data.direction = selected.data.direction === 1 ? -1 : 1; applyPartTransform(selected); }
  });

  canvas.__applyCanonicalSolution = () => { if (sim) return; for (const p of [...parts]) deletePart(p); belts.splice(0); for (const l of beltLines.values()) scene.remove(l); beltLines.clear(); const c = canonicalRebootSolution(); for (const data of c.parts) { const object = cloneTemplate(data.type); const placed = { data: { ...data } as RebootPart, object }; parts.push(placed); scene.add(object); applyPartTransform(placed); } belts.push(...c.belts.map((b) => ({ ...b }))); rebuildBelts(); refresh(); };
  canvas.__start = start;
  canvas.__advance = (seconds: number) => { sim?.advance(seconds); syncSim(); };
  canvas.dataset.physics = 'rapier3d-cleanroom-reboot-v1'; canvas.dataset.layout = 'original-benchmark-not-tim-level-data';

  const resize = (): void => { const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize(); refresh();
  const loop = (now: number): void => { requestAnimationFrame(loop); const dt = Math.min((now - previous) / 1000, 0.08); previous = now; if (sim && !sim.state.won && !sim.state.ballOut) { accumulator += dt; while (accumulator >= 1 / 120) { sim.step(); accumulator -= 1 / 120; } syncSim(); } renderer.render(scene, camera); };
  requestAnimationFrame(loop);
}
