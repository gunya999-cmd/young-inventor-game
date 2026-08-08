import { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import './machineGame.css';
import {
  BALL_START,
  BASKET,
  INVENTORY,
  PART_INFO,
  SCENERY,
  WORLD,
  type PartKind,
} from './timLevel';

type Placed = {
  id: number;
  kind: PartKind;
  body: Matter.Body;
};

const PART_SIZE: Record<PartKind, { w: number; h: number }> = {
  plank: { w: 150, h: 12 },
  trampoline: { w: 100, h: 14 },
  domino: { w: 16, h: 70 },
  weight: { w: 46, h: 46 },
};

function makePart(kind: PartKind, x: number, y: number, angle: number): Matter.Body {
  const { w, h } = PART_SIZE[kind];
  const common = { label: `part:${kind}`, angle };
  if (kind === 'plank')
    return Matter.Bodies.rectangle(x, y, w, h, { ...common, isStatic: true, friction: 0.02 });
  if (kind === 'trampoline')
    return Matter.Bodies.rectangle(x, y, w, h, { ...common, isStatic: true, restitution: 1.35 });
  if (kind === 'domino')
    return Matter.Bodies.rectangle(x, y, w, h, { ...common, density: 0.004, friction: 0.4 });
  return Matter.Bodies.rectangle(x, y, w, h, { ...common, density: 0.02, friction: 0.5 });
}

type Status = 'build' | 'running' | 'won' | 'failed';

export function MachineGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballRef = useRef<Matter.Body | null>(null);
  const placedRef = useRef<Placed[]>([]);
  const runningRef = useRef(false);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const idRef = useRef(1);
  const drawRef = useRef<() => void>(() => {});
  const snapshotRef = useRef<{ id: number; kind: PartKind; x: number; y: number; a: number }[]>([]);

  const [status, setStatus] = useState<Status>('build');
  const [selectedKind, setSelectedKind] = useState<PartKind | null>('plank');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  const remaining = (kind: PartKind) =>
    (INVENTORY.find((i) => i.kind === kind)?.count ?? 0) - (used[kind] ?? 0);

  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0016 } });
    engine.gravity.x = 0;
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0016;
    engineRef.current = engine;

    const walls = [
      Matter.Bodies.rectangle(WORLD.w / 2, WORLD.h + 20, WORLD.w, 40, { isStatic: true, label: 'ground' }),
      Matter.Bodies.rectangle(-20, WORLD.h / 2, 40, WORLD.h, { isStatic: true, label: 'ground' }),
      Matter.Bodies.rectangle(WORLD.w + 20, WORLD.h / 2, 40, WORLD.h, { isStatic: true, label: 'ground' }),
    ];
    const scenery = SCENERY.map((s) =>
      Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        isStatic: true,
        angle: s.a,
        label: 'scenery',
        friction: 0.02,
        restitution: 0.1,
      }),
    );
    const basket = [
      Matter.Bodies.rectangle(BASKET.x, BASKET.y + BASKET.h / 2, BASKET.w, 12, { isStatic: true, label: 'basket' }),
      Matter.Bodies.rectangle(BASKET.x - BASKET.w / 2, BASKET.y + BASKET.h / 4, 12, BASKET.h / 2, {
        isStatic: true,
        label: 'basket',
      }),
      Matter.Bodies.rectangle(BASKET.x + BASKET.w / 2, BASKET.y, 12, BASKET.h, { isStatic: true, label: 'basket' }),
    ];
    const ball = Matter.Bodies.circle(BALL_START.x, BALL_START.y, BALL_START.r, {
      label: 'ball',
      restitution: 0.42,
      friction: 0.02,
      density: 0.008,
      frictionAir: 0.004,
      frictionStatic: 0.05,
    });
    ballRef.current = ball;
    Matter.Composite.add(engine.world, [...walls, ...scenery, ...basket, ball]);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let settled = 0;
    const STEP = 1000 / 60;
    const loop = (now: number) => {
      acc += Math.min(100, now - last);
      last = now;
      if (runningRef.current) {
        let steps = 0;
        while (acc >= STEP && steps < 4) {
          Matter.Engine.update(engine, STEP);
          acc -= STEP;
          steps++;
        }
        const b = ballRef.current!;
        const inBasket =
          Math.abs(b.position.x - BASKET.x) < BASKET.w / 2 &&
          Math.abs(b.position.y - BASKET.y) < BASKET.h / 2;
        const slow = Matter.Vector.magnitude(b.velocity) < 0.35;
        if (inBasket && Matter.Vector.magnitude(b.velocity) < 1.5) {
          runningRef.current = false;
          setStatus('won');
        } else if (slow) {
          settled += STEP;
          if (settled > 2500) {
            runningRef.current = false;
            setStatus('failed');
          }
        } else {
          settled = 0;
        }
      } else {
        acc = 0;
        settled = 0;
      }
      drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      Matter.Engine.clear(engine);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext('2d')!;
    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue('--tim-ink').trim() || '#1c2b3a';
    const line = css.getPropertyValue('--tim-line').trim() || '#7fa8c9';
    const brass = css.getPropertyValue('--tim-brass').trim() || '#c98a2b';
    const wood = css.getPropertyValue('--tim-wood').trim() || '#9a6b3f';
    const paper = css.getPropertyValue('--tim-paper').trim() || '#f3ead6';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WORLD.w, WORLD.h);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.h);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const bodies = Matter.Composite.allBodies(engine.world);
    const selBody = placedRef.current.find((p) => p.id === selectedId)?.body;

    for (const body of bodies) {
      if (body.label === 'ball') continue;
      const kind = body.label.startsWith('part:') ? body.label.slice(5) : body.label;
      let fill = ink;
      if (kind === 'basket') fill = brass;
      if (kind === 'plank') fill = wood;
      if (kind === 'trampoline') fill = '#2f7d5b';
      if (kind === 'domino') fill = '#b4453c';
      if (kind === 'weight') fill = '#4a4a52';

      ctx.beginPath();
      const v = body.vertices;
      ctx.moveTo(v[0]!.x, v[0]!.y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i]!.x, v[i]!.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = body === selBody ? 3 : 1.5;
      ctx.strokeStyle = body === selBody ? brass : 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(BASKET.x - BASKET.w / 2, BASKET.y - BASKET.h / 2, BASKET.w, BASKET.h);
    ctx.setLineDash([]);
    ctx.fillStyle = brass;
    ctx.font = '16px monospace';
    ctx.fillText('ЦЕЛЬ', BASKET.x - 24, BASKET.y - BASKET.h / 2 - 10);

    const b = ballRef.current;
    if (b) {
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, BALL_START.r, 0, Math.PI * 2);
      ctx.fillStyle = '#e0e4ea';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.position.x, b.position.y);
      ctx.lineTo(
        b.position.x + Math.cos(b.angle) * BALL_START.r,
        b.position.y + Math.sin(b.angle) * BALL_START.r,
      );
      ctx.stroke();
    }
  }, [selectedId]);

  const toWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD.w,
      y: ((e.clientY - rect.top) / rect.height) * WORLD.h,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== 'build') return;
    const p = toWorld(e);
    const hit = [...placedRef.current]
      .reverse()
      .find((pl) => Matter.Vertices.contains(pl.body.vertices, p));

    if (hit) {
      setSelectedId(hit.id);
      dragRef.current = { id: hit.id, dx: hit.body.position.x - p.x, dy: hit.body.position.y - p.y };
      canvasRef.current!.setPointerCapture(e.pointerId);
      return;
    }
    if (!selectedKind || remaining(selectedKind) <= 0) {
      setSelectedId(null);
      return;
    }
    const body = makePart(selectedKind, p.x, p.y, selectedKind === 'plank' ? 0.25 : 0);
    Matter.Composite.add(engineRef.current!.world, body);
    const id = idRef.current++;
    placedRef.current.push({ id, kind: selectedKind, body });
    setUsed((u) => ({ ...u, [selectedKind]: (u[selectedKind] ?? 0) + 1 }));
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || status !== 'build') return;
    const p = toWorld(e);
    const pl = placedRef.current.find((x) => x.id === d.id);
    if (pl) Matter.Body.setPosition(pl.body, { x: p.x + d.dx, y: p.y + d.dy });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const rotate = (delta: number) => {
    const pl = placedRef.current.find((x) => x.id === selectedId);
    if (!pl || !PART_INFO[pl.kind].rotatable) return;
    Matter.Body.setAngle(pl.body, pl.body.angle + delta);
    setTick((t) => t + 1);
  };

  const removeSelected = () => {
    const pl = placedRef.current.find((x) => x.id === selectedId);
    if (!pl) return;
    Matter.Composite.remove(engineRef.current!.world, pl.body);
    placedRef.current = placedRef.current.filter((x) => x.id !== pl.id);
    setUsed((u) => ({ ...u, [pl.kind]: Math.max(0, (u[pl.kind] ?? 1) - 1) }));
    setSelectedId(null);
  };

  const start = () => {
    const engine = engineRef.current!;
    snapshotRef.current = placedRef.current.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: p.body.position.x,
      y: p.body.position.y,
      a: p.body.angle,
    }));
    Matter.Body.setVelocity(ballRef.current!, { x: 0, y: 0 });
    void engine;
    setSelectedId(null);
    setStatus('running');
    runningRef.current = true;
  };

  const reset = () => {
    const engine = engineRef.current!;
    runningRef.current = false;
    for (const pl of placedRef.current) Matter.Composite.remove(engine.world, pl.body);
    placedRef.current = snapshotRef.current.map((s) => {
      const body = makePart(s.kind, s.x, s.y, s.a);
      Matter.Composite.add(engine.world, body);
      return { id: s.id, kind: s.kind, body };
    });
    const ball = ballRef.current!;
    Matter.Body.setAngle(ball, 0);
    Matter.Body.setAngularVelocity(ball, 0);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Body.setPosition(ball, { x: BALL_START.x, y: BALL_START.y });
    setStatus('build');
  };

  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw, tick]);

  const selected = placedRef.current.find((x) => x.id === selectedId);

  return (
    <div className="machine-game">
      <header className="game-header">
        <p className="eyebrow">Уровень 1</p>
        <h1>Невероятная машина</h1>
        <p className="intro">Соберите цепочку: шар должен сам докатиться до корзины «ЦЕЛЬ». Ставьте детали, крутите доски, затем запускайте механизм.</p>
      </header>

      <div className="game-layout">
        <div className="canvas-shell">
          <canvas
            ref={canvasRef}
            width={WORLD.w}
            height={WORLD.h}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="tim-canvas"
            style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }}
          />
        </div>

        <aside className="sidebar">
          <section className="card">
            <h2>Детали</h2>
            <ul className="inventory-list">
              {INVENTORY.map(({ kind }) => {
                const left = remaining(kind);
                const active = selectedKind === kind;
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      disabled={status !== 'build' || left <= 0}
                      onClick={() => setSelectedKind(kind)}
                      className={`inventory-button ${active ? 'active' : ''}`}
                    >
                      <span className="inventory-title">{PART_INFO[kind].label}<b>×{left}</b></span>
                      <span className="inventory-hint">{PART_INFO[kind].hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h2>Выбранная деталь</h2>
            {selected ? (
              <div className="selected-tools">
                <p>{PART_INFO[selected.kind].label} — тяните, чтобы переместить</p>
                <div className="tool-row">
                  <button type="button" onClick={() => rotate(-0.12)} disabled={!PART_INFO[selected.kind].rotatable}>↺</button>
                  <button type="button" onClick={() => rotate(0.12)} disabled={!PART_INFO[selected.kind].rotatable}>↻</button>
                  <button type="button" onClick={removeSelected} className="danger">Убрать</button>
                </div>
              </div>
            ) : (
              <p className="muted">Кликните по деталям на чертеже, чтобы настроить их.</p>
            )}
          </section>

          <div className="run-row">
            <button type="button" onClick={start} disabled={status !== 'build'} className="run-button">Запустить</button>
            <button type="button" onClick={reset} className="reset-button">Сброс</button>
          </div>

          {status === 'won' && (
            <div className="result success"><strong>Машина работает!</strong><span>Шар в корзине. Уровень пройден.</span></div>
          )}
          {status === 'failed' && (
            <div className="result fail"><strong>Шар не добрался до цели</strong><span>Нажмите «Сброс» и переставьте детали.</span></div>
          )}
          {status === 'running' && <p className="running-copy">механизм работает…</p>}
        </aside>
      </div>
    </div>
  );
}
