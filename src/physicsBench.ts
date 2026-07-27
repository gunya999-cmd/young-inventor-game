import { PhysicsEngine } from './physics';
import { PARTS, type MachineSnapshot, type PartState, type Point } from './model';

const STEP = 1 / 120;

interface Viewport { x: number; y: number; width: number; height: number }
interface Metric { label: string; value: string }
interface Scenario {
  title: string;
  note: string;
  viewport: Viewport;
  createSnapshot: () => MachineSnapshot;
  metrics: (engine: PhysicsEngine, elapsed: number) => Metric[];
}

const baseSnapshot = (parts: PartState[], extra: Partial<MachineSnapshot> = {}): MachineSnapshot => ({
  parts,
  ropes: extra.ropes ?? [],
  hinges: extra.hinges ?? [],
  signals: extra.signals ?? []
});

const scenarios: Scenario[] = [
  {
    title: '01 · Сталь и резина — отскок',
    note: 'Стальной шар быстро теряет энергию. Резиновый мяч сохраняет большую часть энергии удара.',
    viewport: { x: 560, y: 250, width: 480, height: 360 },
    createSnapshot: () => baseSnapshot([
      { id: 'floor', kind: 'plank', x: 800, y: 540, angle: 0, fixed: true },
      { id: 'steel', kind: 'ball', x: 710, y: 330, angle: 0, fixed: false },
      { id: 'rubber', kind: 'rubberball', x: 890, y: 330, angle: 0, fixed: false }
    ]),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'v steel', value: `${Math.round(engine.partKinematics('steel')?.velocity.y ?? 0)} px/s` },
      { label: 'v rubber', value: `${Math.round(engine.partKinematics('rubber')?.velocity.y ?? 0)} px/s` }
    ]
  },
  {
    title: '02 · Качение по направляющей',
    note: 'Шар должен катиться, а не ехать по наклонной плоскости как не вращающийся брусок.',
    viewport: { x: 520, y: 330, width: 600, height: 330 },
    createSnapshot: () => baseSnapshot([
      { id: 'ramp', kind: 'plank', x: 800, y: 520, angle: 0.16, fixed: true },
      { id: 'ball', kind: 'ball', x: 705, y: 440, angle: 0, fixed: false }
    ]),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'vx', value: `${Math.round(engine.partKinematics('ball')?.velocity.x ?? 0)} px/s` },
      { label: 'ω', value: `${(engine.partKinematics('ball')?.angularVelocity ?? 0).toFixed(2)} rad/s` }
    ]
  },
  {
    title: '03 · Шкив 1:1',
    note: 'Тяжёлый груз опускается, лёгкий поднимается; суммарная длина двух ветвей остаётся постоянной.',
    viewport: { x: 500, y: 110, width: 600, height: 590 },
    createSnapshot: () => baseSnapshot([
      { id: 'heavy', kind: 'weight', x: 620, y: 380, angle: 0, fixed: false },
      { id: 'light', kind: 'rubberball', x: 980, y: 380, angle: 0, fixed: false },
      { id: 'sheave', kind: 'sheave', x: 800, y: 190, angle: 0, fixed: true }
    ], {
      ropes: [{
        id: 'rope',
        a: { partId: 'heavy', localX: 0, localY: 0 },
        b: { partId: 'light', localX: 0, localY: 0 },
        maxLength: 560,
        pulleyPartId: 'sheave', ratio: 1
      }]
    }),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'heavy y', value: `${Math.round(engine.partTransform('heavy')?.position.y ?? 0)}` },
      { label: 'light y', value: `${Math.round(engine.partTransform('light')?.position.y ?? 0)}` }
    ]
  },
  {
    title: '04 · Момент силы',
    note: 'Груз приложен далеко от оси. Рычаг должен уверенно поворачиваться вокруг выбранной точки опоры.',
    viewport: { x: 540, y: 350, width: 560, height: 330 },
    createSnapshot: () => baseSnapshot([
      { id: 'lever', kind: 'lever', x: 800, y: 540, angle: 0, fixed: false },
      { id: 'weight', kind: 'weight', x: 680, y: 455, angle: 0, fixed: false }
    ], {
      hinges: [{ id: 'hinge', partId: 'lever', localX: 0, localY: 0, referenceAngle: 0, lowerAngle: -1.2, upperAngle: 1.2 }]
    }),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'angle', value: `${((engine.partTransform('lever')?.angle ?? 0) * 180 / Math.PI).toFixed(1)}°` },
      { label: 'ω', value: `${(engine.partKinematics('lever')?.angularVelocity ?? 0).toFixed(2)} rad/s` }
    ]
  },
  {
    title: '05 · Сжатие пружины',
    note: 'Груз сжимает шток; деформация ограничена, после чего накопленная энергия возвращается грузу.',
    viewport: { x: 730, y: 390, width: 340, height: 370 },
    createSnapshot: () => baseSnapshot([
      { id: 'spring', kind: 'spring', x: 900, y: 670, angle: -Math.PI / 2, fixed: true },
      { id: 'weight', kind: 'weight', x: 900, y: 465, angle: 0, fixed: false }
    ]),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'Δx', value: `${engine.springCompression('spring').toFixed(1)} px` },
      { label: 'vy', value: `${Math.round(engine.partKinematics('weight')?.velocity.y ?? 0)} px/s` }
    ]
  },
  {
    title: '06 · Порог опрокидывания',
    note: 'Высокая костяшка стартует за геометрическим порогом устойчивости и должна опрокинуться, а не самовыпрямиться.',
    viewport: { x: 650, y: 470, width: 300, height: 290 },
    createSnapshot: () => baseSnapshot([
      { id: 'floor', kind: 'plank', x: 800, y: 700, angle: 0, fixed: true },
      { id: 'domino', kind: 'domino', x: 800, y: 632, angle: 0.38, fixed: false }
    ]),
    metrics: (engine, elapsed) => [
      { label: 't', value: `${elapsed.toFixed(2)} s` },
      { label: 'angle', value: `${((engine.partTransform('domino')?.angle ?? 0) * 180 / Math.PI).toFixed(1)}°` },
      { label: 'ω', value: `${(engine.partKinematics('domino')?.angularVelocity ?? 0).toFixed(2)} rad/s` }
    ]
  }
];

interface RuntimeScenario {
  scenario: Scenario;
  engine: PhysicsEngine;
  canvas: HTMLCanvasElement;
  metricNodes: HTMLElement[];
}

const grid = document.querySelector<HTMLElement>('#bench-grid');
if (!grid) throw new Error('Physics bench grid not found');

function makeRuntime(scenario: Scenario): RuntimeScenario {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `<header><h2>${scenario.title}</h2><span class="status">LIVE</span></header><div class="stage"><canvas width="900" height="394"></canvas></div><div class="metrics"></div><div class="note">${scenario.note}</div>`;
  grid.appendChild(card);
  const canvas = card.querySelector('canvas')!;
  const metrics = card.querySelector<HTMLElement>('.metrics')!;
  const metricNodes = [0, 1, 2].map(() => {
    const node = document.createElement('div');
    node.className = 'metric';
    node.innerHTML = '<small>—</small><b>—</b>';
    metrics.appendChild(node);
    return node;
  });
  return {
    scenario,
    engine: new PhysicsEngine(scenario.createSnapshot(), { includeLevelGeometry: false }),
    canvas,
    metricNodes
  };
}

const runtimes = scenarios.map(makeRuntime);
let paused = false;
let elapsed = 0;
let accumulator = 0;
let previous = performance.now();

function mapPoint(point: Point, viewport: Viewport, canvas: HTMLCanvasElement): Point {
  return {
    x: (point.x - viewport.x) / viewport.width * canvas.width,
    y: (point.y - viewport.y) / viewport.height * canvas.height
  };
}

function scaleFor(viewport: Viewport, canvas: HTMLCanvasElement): number {
  return Math.min(canvas.width / viewport.width, canvas.height / viewport.height);
}

function drawPart(ctx: CanvasRenderingContext2D, part: PartState, viewport: Viewport, canvas: HTMLCanvasElement): void {
  const spec = PARTS[part.kind];
  const point = mapPoint(part, viewport, canvas);
  const scale = scaleFor(viewport, canvas);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(part.angle);
  ctx.fillStyle = part.kind === 'rubberball' ? '#2c9ed0'
    : part.kind === 'ball' ? '#4d5961'
    : part.kind === 'weight' ? '#785f45'
    : part.kind === 'domino' ? '#d8c7a8'
    : part.kind === 'sheave' ? '#71808a'
    : part.kind === 'lever' ? '#a86a38'
    : part.kind === 'spring' ? '#d3a242'
    : '#9a6941';
  ctx.strokeStyle = '#26333b';
  ctx.lineWidth = 2;
  if (spec.radius) {
    ctx.beginPath();
    ctx.arc(0, 0, spec.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (part.kind === 'sheave') {
      ctx.beginPath();
      ctx.arc(0, 0, spec.radius * scale * .55, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillRect(-spec.width * scale / 2, -spec.height * scale / 2, spec.width * scale, spec.height * scale);
    ctx.strokeRect(-spec.width * scale / 2, -spec.height * scale / 2, spec.width * scale, spec.height * scale);
  }
  ctx.restore();
}

function drawRuntime(runtime: RuntimeScenario): void {
  const { canvas, scenario, engine } = runtime;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f1eee4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(85,102,112,.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  const snap = engine.snapshot();
  for (const rope of snap.ropes) {
    const a = snap.parts.find((part) => part.id === rope.a.partId);
    const b = snap.parts.find((part) => part.id === rope.b.partId);
    if (!a || !b) continue;
    ctx.strokeStyle = '#8d6b43';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const pa = mapPoint(a, scenario.viewport, canvas);
    ctx.moveTo(pa.x, pa.y);
    if (rope.pulleyPartId) {
      const pulley = snap.parts.find((part) => part.id === rope.pulleyPartId);
      if (pulley) {
        const pp = mapPoint(pulley, scenario.viewport, canvas);
        ctx.lineTo(pp.x, pp.y);
      }
    }
    const pb = mapPoint(b, scenario.viewport, canvas);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  for (const part of snap.parts) drawPart(ctx, part, scenario.viewport, canvas);

  for (const hinge of snap.hinges) {
    const part = snap.parts.find((candidate) => candidate.id === hinge.partId);
    if (!part) continue;
    const c = Math.cos(part.angle); const s = Math.sin(part.angle);
    const world = { x: part.x + hinge.localX * c - hinge.localY * s, y: part.y + hinge.localX * s + hinge.localY * c };
    const p = mapPoint(world, scenario.viewport, canvas);
    ctx.fillStyle = '#d89132';
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
  }

  const values = scenario.metrics(engine, elapsed);
  values.forEach((metric, index) => {
    const node = runtime.metricNodes[index];
    node.querySelector('small')!.textContent = metric.label;
    node.querySelector('b')!.textContent = metric.value;
  });
}

function reset(): void {
  elapsed = 0;
  accumulator = 0;
  for (const runtime of runtimes) runtime.engine = new PhysicsEngine(runtime.scenario.createSnapshot(), { includeLevelGeometry: false });
}

document.querySelector<HTMLButtonElement>('#reset')?.addEventListener('click', reset);
document.querySelector<HTMLButtonElement>('#toggle')?.addEventListener('click', (event) => {
  paused = !paused;
  (event.currentTarget as HTMLButtonElement).textContent = paused ? '▶ Продолжить' : 'Ⅱ Пауза';
});

function frame(now: number): void {
  const delta = Math.min(.05, Math.max(0, (now - previous) / 1000));
  previous = now;
  if (!paused) {
    accumulator += delta;
    elapsed += delta;
    while (accumulator >= STEP) {
      for (const runtime of runtimes) runtime.engine.step(STEP);
      accumulator -= STEP;
    }
  }
  for (const runtime of runtimes) drawRuntime(runtime);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
