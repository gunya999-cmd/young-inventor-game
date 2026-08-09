import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import {
  BALL_START,
  BASKET,
  INVENTORY,
  PART_INFO,
  SCENERY,
  WORLD,
  type PartKind,
} from "@/lib/tim/level";

type Placed = { id: number; kind: PartKind; body: Matter.Body };
type NetRig = {
  nodes: Matter.Body[];
  constraints: Matter.Constraint[];
  startPositions: { x: number; y: number }[];
};
type Status = "build" | "running" | "won" | "failed";

const PART_SIZE: Record<PartKind, { w: number; h: number }> = {
  plank: { w: 150, h: 12 },
  trampoline: { w: 100, h: 14 },
  domino: { w: 16, h: 70 },
  weight: { w: 46, h: 46 },
};

// Proportions intentionally match the approved render: a large regulation-style
// backboard at the right edge, a deep orange rim, and a long white hanging net.
const HOOP = {
  x: BASKET.x - 8,
  rimY: BASKET.y - 82,
  rimWidth: 126,
  rimRadius: 7,
  backboardX: BASKET.x + 70,
  backboardY: BASKET.y - 150,
  backboardW: 14,
  backboardH: 182,
  visualBoardW: 78,
  visualBoardH: 178,
  netRows: 6,
  netCols: 7,
  netRowGap: 17,
};

function makePart(kind: PartKind, x: number, y: number, angle: number): Matter.Body {
  const { w, h } = PART_SIZE[kind];
  const common = { label: `part:${kind}`, angle };
  if (kind === "plank") return Matter.Bodies.rectangle(x, y, w, h, { ...common, isStatic: true, friction: 0.02 });
  if (kind === "trampoline") return Matter.Bodies.rectangle(x, y, w, h, { ...common, isStatic: true, restitution: 1.35 });
  if (kind === "domino") return Matter.Bodies.rectangle(x, y, w, h, { ...common, density: 0.004, friction: 0.4 });
  return Matter.Bodies.rectangle(x, y, w, h, { ...common, density: 0.02, friction: 0.5 });
}

function buildBasketballGoal(): { rigid: Matter.Body[]; sensor: Matter.Body; net: NetRig } {
  const leftRim = Matter.Bodies.circle(HOOP.x - HOOP.rimWidth / 2, HOOP.rimY, HOOP.rimRadius, {
    isStatic: true, label: "hoop-rim", friction: 0.18, restitution: 0.48,
  });
  const rightRim = Matter.Bodies.circle(HOOP.x + HOOP.rimWidth / 2, HOOP.rimY, HOOP.rimRadius, {
    isStatic: true, label: "hoop-rim", friction: 0.18, restitution: 0.48,
  });
  const backboard = Matter.Bodies.rectangle(HOOP.backboardX, HOOP.backboardY, HOOP.backboardW, HOOP.backboardH, {
    isStatic: true, label: "hoop-backboard", friction: 0.12, restitution: 0.35,
  });
  const bracket = Matter.Bodies.rectangle(HOOP.x + HOOP.rimWidth / 2 + 20, HOOP.rimY + 4, 42, 10, {
    isStatic: true, label: "hoop-bracket", friction: 0.18, restitution: 0.32,
  });
  const sensor = Matter.Bodies.rectangle(HOOP.x, HOOP.rimY + 34, HOOP.rimWidth - 28, 18, {
    isStatic: true, isSensor: true, label: "hoop-score-sensor",
  });

  const nodes: Matter.Body[] = [];
  const constraints: Matter.Constraint[] = [];
  const startPositions: { x: number; y: number }[] = [];
  const group = Matter.Body.nextGroup(true);
  const nodeAt = (row: number, col: number) => nodes[row * HOOP.netCols + col]!;

  for (let row = 0; row < HOOP.netRows; row++) {
    const t = row / (HOOP.netRows - 1);
    const width = HOOP.rimWidth * (0.90 - t * 0.46);
    const y = HOOP.rimY + 13 + row * HOOP.netRowGap;
    for (let col = 0; col < HOOP.netCols; col++) {
      const u = col / (HOOP.netCols - 1);
      const x = HOOP.x - width / 2 + width * u;
      const node = Matter.Bodies.circle(x, y, 2.5, {
        label: "net-node",
        density: 0.00038,
        friction: 0.08,
        frictionAir: 0.065,
        restitution: 0.05,
        collisionFilter: { group },
      });
      nodes.push(node);
      startPositions.push({ x, y });
    }
  }

  const link = (a: Matter.Body, b: Matter.Body, stiffness = 0.5) => {
    constraints.push(Matter.Constraint.create({ bodyA: a, bodyB: b, stiffness, damping: 0.11, label: "net-link" }));
  };

  for (let col = 0; col < HOOP.netCols; col++) {
    const u = col / (HOOP.netCols - 1);
    const anchorX = HOOP.x - (HOOP.rimWidth * 0.9) / 2 + HOOP.rimWidth * 0.9 * u;
    constraints.push(Matter.Constraint.create({
      pointA: { x: anchorX, y: HOOP.rimY + 3 },
      bodyB: nodeAt(0, col),
      length: 10,
      stiffness: 0.74,
      damping: 0.14,
      label: "net-anchor",
    }));
  }

  for (let row = 0; row < HOOP.netRows; row++) {
    for (let col = 0; col < HOOP.netCols; col++) {
      if (col < HOOP.netCols - 1) link(nodeAt(row, col), nodeAt(row, col + 1), 0.48);
      if (row < HOOP.netRows - 1) link(nodeAt(row, col), nodeAt(row + 1, col), 0.58);
      if (row < HOOP.netRows - 1 && col < HOOP.netCols - 1) {
        link(nodeAt(row, col), nodeAt(row + 1, col + 1), 0.34);
        link(nodeAt(row, col + 1), nodeAt(row + 1, col), 0.34);
      }
    }
  }

  return { rigid: [leftRim, rightRim, backboard, bracket], sensor, net: { nodes, constraints, startPositions } };
}

function drawBasketballGoal(ctx: CanvasRenderingContext2D, net: NetRig | null) {
  // Rear steel support, visible behind the board like in the approved render.
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2f3336";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(HOOP.backboardX + 18, HOOP.backboardY + 16);
  ctx.lineTo(HOOP.backboardX + 45, HOOP.backboardY + 55);
  ctx.lineTo(HOOP.backboardX + 45, HOOP.backboardY + 150);
  ctx.stroke();
  ctx.strokeStyle = "#555b5e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HOOP.backboardX + 18, HOOP.backboardY + 16);
  ctx.lineTo(HOOP.backboardX + 45, HOOP.backboardY + 55);
  ctx.stroke();
  ctx.restore();

  // Backboard: translucent centre, thick silver frame, small red target square.
  const bx = HOOP.backboardX - HOOP.visualBoardW / 2;
  const by = HOOP.backboardY - HOOP.visualBoardH / 2;
  ctx.save();
  ctx.shadowColor = "rgba(30,35,38,.28)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 7;
  ctx.shadowOffsetY = 8;
  const frame = ctx.createLinearGradient(bx, by, bx + HOOP.visualBoardW, by + HOOP.visualBoardH);
  frame.addColorStop(0, "#f7f8f8");
  frame.addColorStop(0.18, "#b7bdc0");
  frame.addColorStop(0.55, "#f0f2f2");
  frame.addColorStop(1, "#686e71");
  ctx.fillStyle = frame;
  ctx.fillRect(bx, by, HOOP.visualBoardW, HOOP.visualBoardH);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(236,239,239,.72)";
  ctx.fillRect(bx + 7, by + 7, HOOP.visualBoardW - 14, HOOP.visualBoardH - 14);
  ctx.strokeStyle = "rgba(122,128,130,.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 7, by + 7, HOOP.visualBoardW - 14, HOOP.visualBoardH - 14);
  ctx.strokeStyle = "#d64a28";
  ctx.lineWidth = 4;
  ctx.strokeRect(HOOP.backboardX - 26, HOOP.rimY - 50, 50, 38);
  ctx.restore();

  // Heavy orange mounting plate from backboard to rim.
  ctx.save();
  const mount = ctx.createLinearGradient(HOOP.x + 45, HOOP.rimY - 12, HOOP.backboardX, HOOP.rimY + 12);
  mount.addColorStop(0, "#7d210f");
  mount.addColorStop(0.5, "#d54b1d");
  mount.addColorStop(1, "#8f2b13");
  ctx.fillStyle = mount;
  ctx.beginPath();
  ctx.moveTo(HOOP.x + 42, HOOP.rimY - 7);
  ctx.lineTo(HOOP.backboardX - 5, HOOP.rimY - 17);
  ctx.lineTo(HOOP.backboardX - 5, HOOP.rimY + 17);
  ctx.lineTo(HOOP.x + 42, HOOP.rimY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Dynamic white rope net. Every strand follows Matter.js live endpoints.
  if (net) {
    ctx.save();
    ctx.strokeStyle = "rgba(239,239,233,.98)";
    ctx.lineWidth = 2.15;
    ctx.shadowColor = "rgba(35,35,35,.28)";
    ctx.shadowBlur = 2.5;
    for (const c of net.constraints) {
      const a = c.bodyA ? Matter.Vector.add(c.bodyA.position, c.pointA) : c.pointA;
      const b = c.bodyB ? Matter.Vector.add(c.bodyB.position, c.pointB) : c.pointB;
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Deep elliptical orange rim with a metallic highlight and underside.
  ctx.save();
  ctx.shadowColor = "rgba(25,25,25,.32)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  const rim = ctx.createLinearGradient(HOOP.x - HOOP.rimWidth / 2, HOOP.rimY - 8, HOOP.x + HOOP.rimWidth / 2, HOOP.rimY + 8);
  rim.addColorStop(0, "#7b1e0d");
  rim.addColorStop(0.22, "#d84b18");
  rim.addColorStop(0.5, "#f37428");
  rim.addColorStop(0.78, "#c13b12");
  rim.addColorStop(1, "#711a0a");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.rimY, HOOP.rimWidth / 2, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,191,129,.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.rimY - 1.5, HOOP.rimWidth / 2 - 2, 8, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#b53f20";
  ctx.font = "bold 14px monospace";
  ctx.fillText("ЦЕЛЬ", HOOP.x - 22, HOOP.rimY - 28);
}

export function MachineGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballRef = useRef<Matter.Body | null>(null);
  const ballSpriteRef = useRef<HTMLImageElement | null>(null);
  const netRigRef = useRef<NetRig | null>(null);
  const placedRef = useRef<Placed[]>([]);
  const runningRef = useRef(false);
  const previousBallYRef = useRef(BALL_START.y);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const idRef = useRef(1);
  const drawRef = useRef<() => void>(() => {});
  const snapshotRef = useRef<{ id: number; kind: PartKind; x: number; y: number; a: number }[]>([]);

  const [status, setStatus] = useState<Status>("build");
  const [selectedKind, setSelectedKind] = useState<PartKind | null>("plank");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  const remaining = (kind: PartKind) => (INVENTORY.find((i) => i.kind === kind)?.count ?? 0) - (used[kind] ?? 0);

  useEffect(() => {
    const sprite = new Image();
    sprite.src = "/assets/tim-ball-master.svg";
    sprite.onload = () => drawRef.current();
    ballSpriteRef.current = sprite;
  }, []);

  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0016 } });
    engineRef.current = engine;
    const walls = [
      Matter.Bodies.rectangle(WORLD.w / 2, WORLD.h + 20, WORLD.w, 40, { isStatic: true, label: "ground" }),
      Matter.Bodies.rectangle(-20, WORLD.h / 2, 40, WORLD.h, { isStatic: true, label: "ground" }),
      Matter.Bodies.rectangle(WORLD.w + 20, WORLD.h / 2, 40, WORLD.h, { isStatic: true, label: "ground" }),
    ];
    const scenery = SCENERY.map((s) => Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
      isStatic: true, angle: s.a, label: "scenery", friction: 0.02, restitution: 0.1,
    }));
    const hoop = buildBasketballGoal();
    netRigRef.current = hoop.net;
    const ball = Matter.Bodies.circle(BALL_START.x, BALL_START.y, BALL_START.r, {
      label: "ball", restitution: 0.42, friction: 0.02, density: 0.008, frictionAir: 0.004, frictionStatic: 0.05,
    });
    ballRef.current = ball;
    Matter.Composite.add(engine.world, [...walls, ...scenery, ...hoop.rigid, hoop.sensor, ...hoop.net.nodes, ...hoop.net.constraints, ball]);

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
        while (acc >= STEP && steps < 4) { Matter.Engine.update(engine, STEP); acc -= STEP; steps++; }
        const b = ballRef.current!;
        const openingHalf = HOOP.rimWidth / 2 - HOOP.rimRadius - BALL_START.r * 0.15;
        const crossedHoop = previousBallYRef.current < HOOP.rimY - BALL_START.r * 0.15 &&
          b.position.y >= HOOP.rimY + BALL_START.r * 0.15 &&
          Math.abs(b.position.x - HOOP.x) < openingHalf && b.velocity.y > 0;
        previousBallYRef.current = b.position.y;
        const slow = Matter.Vector.magnitude(b.velocity) < 0.35;
        if (crossedHoop) { runningRef.current = false; setStatus("won"); }
        else if (slow) { settled += STEP; if (settled > 2500) { runningRef.current = false; setStatus("failed"); } }
        else settled = 0;
      } else { acc = 0; settled = 0; }
      drawRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); Matter.Engine.clear(engine); };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext("2d")!;
    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue("--tim-ink").trim() || "#1c2b3a";
    const line = css.getPropertyValue("--tim-line").trim() || "#7fa8c9";
    const brass = css.getPropertyValue("--tim-brass").trim() || "#c98a2b";
    const wood = css.getPropertyValue("--tim-wood").trim() || "#9a6b3f";
    const paper = css.getPropertyValue("--tim-paper").trim() || "#f3ead6";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WORLD.w, WORLD.h);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
    for (let y = 0; y <= WORLD.h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }
    ctx.globalAlpha = 1;

    const selBody = placedRef.current.find((p) => p.id === selectedId)?.body;
    for (const body of Matter.Composite.allBodies(engine.world)) {
      if (body.label === "ball" || body.label.startsWith("hoop-") || body.label === "net-node") continue;
      const kind = body.label.startsWith("part:") ? body.label.slice(5) : body.label;
      let fill = ink;
      if (kind === "plank") fill = wood;
      if (kind === "trampoline") fill = "#2f7d5b";
      if (kind === "domino") fill = "#b4453c";
      if (kind === "weight") fill = "#4a4a52";
      ctx.beginPath();
      const v = body.vertices;
      ctx.moveTo(v[0]!.x, v[0]!.y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i]!.x, v[i]!.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = body === selBody ? 3 : 1.5;
      ctx.strokeStyle = body === selBody ? brass : "rgba(0,0,0,.35)";
      ctx.stroke();
    }

    drawBasketballGoal(ctx, netRigRef.current);

    const b = ballRef.current;
    if (b) {
      const x = b.position.x, y = b.position.y, r = BALL_START.r;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.12, y + r * 0.78, r * 0.78, r * 0.22, 0, 0, Math.PI * 2);
      const shadow = ctx.createRadialGradient(x, y + r * 0.78, 0, x, y + r * 0.78, r * 0.95);
      shadow.addColorStop(0, "rgba(20,20,20,.22)"); shadow.addColorStop(1, "rgba(20,20,20,0)");
      ctx.fillStyle = shadow; ctx.fill();
      const sprite = ballSpriteRef.current;
      if (sprite?.complete && sprite.naturalWidth > 0) {
        ctx.translate(x, y); ctx.rotate(b.angle); const size = r * 2.12; ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      } else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = "#596068"; ctx.fill(); }
      ctx.restore();
    }
  }, [selectedId]);

  const toWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WORLD.w, y: ((e.clientY - rect.top) / rect.height) * WORLD.h };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== "build") return;
    const p = toWorld(e);
    const hit = [...placedRef.current].reverse().find((pl) => Matter.Vertices.contains(pl.body.vertices, p));
    if (hit) {
      setSelectedId(hit.id);
      dragRef.current = { id: hit.id, dx: hit.body.position.x - p.x, dy: hit.body.position.y - p.y };
      canvasRef.current!.setPointerCapture(e.pointerId);
      return;
    }
    if (!selectedKind || remaining(selectedKind) <= 0) { setSelectedId(null); return; }
    const body = makePart(selectedKind, p.x, p.y, selectedKind === "plank" ? 0.25 : 0);
    Matter.Composite.add(engineRef.current!.world, body);
    const id = idRef.current++;
    placedRef.current.push({ id, kind: selectedKind, body });
    setUsed((u) => ({ ...u, [selectedKind]: (u[selectedKind] ?? 0) + 1 }));
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || status !== "build") return;
    const p = toWorld(e);
    const pl = placedRef.current.find((x) => x.id === d.id);
    if (pl) Matter.Body.setPosition(pl.body, { x: p.x + d.dx, y: p.y + d.dy });
  };
  const onPointerUp = () => { dragRef.current = null; };
  const rotate = (delta: number) => {
    const pl = placedRef.current.find((x) => x.id === selectedId);
    if (!pl || !PART_INFO[pl.kind].rotatable) return;
    Matter.Body.setAngle(pl.body, pl.body.angle + delta); setTick((t) => t + 1);
  };
  const removeSelected = () => {
    const pl = placedRef.current.find((x) => x.id === selectedId); if (!pl) return;
    Matter.Composite.remove(engineRef.current!.world, pl.body);
    placedRef.current = placedRef.current.filter((x) => x.id !== pl.id);
    setUsed((u) => ({ ...u, [pl.kind]: Math.max(0, (u[pl.kind] ?? 1) - 1) }));
    setSelectedId(null);
  };
  const start = () => {
    snapshotRef.current = placedRef.current.map((p) => ({ id: p.id, kind: p.kind, x: p.body.position.x, y: p.body.position.y, a: p.body.angle }));
    Matter.Body.setVelocity(ballRef.current!, { x: 0, y: 0 });
    previousBallYRef.current = ballRef.current!.position.y;
    setSelectedId(null); setStatus("running"); runningRef.current = true;
  };
  const resetNet = () => {
    const net = netRigRef.current; if (!net) return;
    net.nodes.forEach((node, i) => {
      Matter.Body.setPosition(node, net.startPositions[i]!); Matter.Body.setVelocity(node, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(node, 0); Matter.Body.setAngle(node, 0);
    });
  };
  const reset = () => {
    const engine = engineRef.current!; runningRef.current = false;
    for (const pl of placedRef.current) Matter.Composite.remove(engine.world, pl.body);
    placedRef.current = snapshotRef.current.map((s) => { const body = makePart(s.kind, s.x, s.y, s.a); Matter.Composite.add(engine.world, body); return { id: s.id, kind: s.kind, body }; });
    const ball = ballRef.current!;
    Matter.Body.setAngle(ball, 0); Matter.Body.setAngularVelocity(ball, 0); Matter.Body.setVelocity(ball, { x: 0, y: 0 }); Matter.Body.setPosition(ball, { x: BALL_START.x, y: BALL_START.y });
    previousBallYRef.current = BALL_START.y; resetNet(); setStatus("build");
  };

  useEffect(() => { drawRef.current = draw; draw(); }, [draw, tick]);
  const selected = placedRef.current.find((x) => x.id === selectedId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="pt-8 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-brass">Уровень 1</p>
        <h1 className="mt-1 font-display text-4xl leading-none text-foreground sm:text-5xl">Невероятная машина</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">Соберите цепочку: шар должен сам попасть в баскетбольную корзину «ЦЕЛЬ». Ставьте детали, крутите доски, затем запускайте механизм.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border-2 border-ink/20 bg-paper p-2 shadow-plate">
          <canvas ref={canvasRef} width={WORLD.w} height={WORLD.h} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} data-goal="basketball-hoop-render" className="tim-canvas w-full touch-none rounded-lg" style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }} />
        </div>
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border-2 border-ink/20 bg-card p-4 shadow-plate">
            <h2 className="font-display text-lg text-foreground">Детали</h2>
            <ul className="mt-3 space-y-2">{INVENTORY.map(({ kind }) => {
              const left = remaining(kind); const active = selectedKind === kind;
              return <li key={kind}><button type="button" disabled={status !== "build" || left <= 0} onClick={() => setSelectedKind(kind)} className={`w-full rounded-lg border-2 px-3 py-2 text-left transition-colors disabled:opacity-40 ${active ? "border-brass bg-brass/15" : "border-ink/15 hover:border-brass/60"}`}><span className="flex items-center justify-between font-display text-base text-foreground">{PART_INFO[kind].label}<span className="font-mono text-xs text-brass">×{left}</span></span><span className="block text-xs text-muted-foreground">{PART_INFO[kind].hint}</span></button></li>;
            })}</ul>
          </div>
          <div className="rounded-xl border-2 border-ink/20 bg-card p-4 shadow-plate">
            <h2 className="font-display text-lg text-foreground">Выбранная деталь</h2>
            {selected ? <div className="mt-2 space-y-2"><p className="font-mono text-xs text-muted-foreground">{PART_INFO[selected.kind].label} — тяните мышью, чтобы переместить</p><div className="flex gap-2"><button type="button" onClick={() => rotate(-0.12)} disabled={!PART_INFO[selected.kind].rotatable} className="flex-1 rounded-md border-2 border-ink/15 py-1.5 font-mono text-sm disabled:opacity-40">↺</button><button type="button" onClick={() => rotate(0.12)} disabled={!PART_INFO[selected.kind].rotatable} className="flex-1 rounded-md border-2 border-ink/15 py-1.5 font-mono text-sm disabled:opacity-40">↻</button><button type="button" onClick={removeSelected} className="flex-1 rounded-md border-2 border-danger/50 py-1.5 font-mono text-sm text-danger">Убрать</button></div></div> : <p className="mt-2 text-xs text-muted-foreground">Кликните по деталям на чертеже, чтобы настроить их.</p>}
          </div>
          <div className="flex gap-2"><button type="button" onClick={start} disabled={status !== "build"} className="flex-1 rounded-lg border-2 border-ink bg-brass px-4 py-3 font-display text-lg text-ink shadow-plate transition-transform active:translate-y-0.5 disabled:opacity-40">Запустить</button><button type="button" onClick={reset} className="rounded-lg border-2 border-ink/25 px-4 py-3 font-display text-lg text-foreground">Сброс</button></div>
          {status === "won" && <div className="rounded-xl border-2 border-brass bg-brass/15 p-4 text-center"><p className="font-display text-xl text-foreground">Машина работает!</p><p className="mt-1 text-xs text-muted-foreground">Шар прошёл через кольцо. Уровень пройден.</p></div>}
          {status === "failed" && <div className="rounded-xl border-2 border-danger/50 bg-danger/10 p-4 text-center"><p className="font-display text-lg text-foreground">Шар не попал в корзину</p><p className="mt-1 text-xs text-muted-foreground">Нажмите «Сброс» и переставьте детали.</p></div>}
          {status === "running" && <p className="text-center font-mono text-xs uppercase tracking-widest text-brass">механизм работает…</p>}
        </aside>
      </div>
    </div>
  );
}
