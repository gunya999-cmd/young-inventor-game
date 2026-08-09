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

const HOOP = {
  x: BASKET.x - 18,
  rimY: BASKET.y - 86,
  rimWidth: 132,
  rimRadius: 7,
  backboardX: BASKET.x + 64,
  backboardY: BASKET.y - 158,
  backboardW: 16,
  backboardH: 194,
  visualBoardW: 112,
  visualBoardH: 194,
  netRows: 7,
  netCols: 8,
  netRowGap: 16,
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
    isStatic: true,
    label: "hoop-rim",
    friction: 0.18,
    restitution: 0.48,
  });
  const rightRim = Matter.Bodies.circle(HOOP.x + HOOP.rimWidth / 2, HOOP.rimY, HOOP.rimRadius, {
    isStatic: true,
    label: "hoop-rim",
    friction: 0.18,
    restitution: 0.48,
  });
  const backboard = Matter.Bodies.rectangle(HOOP.backboardX, HOOP.backboardY, HOOP.backboardW, HOOP.backboardH, {
    isStatic: true,
    label: "hoop-backboard",
    friction: 0.12,
    restitution: 0.35,
  });
  const bracket = Matter.Bodies.rectangle(HOOP.x + HOOP.rimWidth / 2 + 23, HOOP.rimY + 3, 48, 10, {
    isStatic: true,
    label: "hoop-bracket",
    friction: 0.18,
    restitution: 0.32,
  });
  const sensor = Matter.Bodies.rectangle(HOOP.x, HOOP.rimY + 35, HOOP.rimWidth - 30, 18, {
    isStatic: true,
    isSensor: true,
    label: "hoop-score-sensor",
  });

  const nodes: Matter.Body[] = [];
  const constraints: Matter.Constraint[] = [];
  const startPositions: { x: number; y: number }[] = [];
  const group = Matter.Body.nextGroup(true);
  const nodeAt = (row: number, col: number) => nodes[row * HOOP.netCols + col]!;

  for (let row = 0; row < HOOP.netRows; row++) {
    const t = row / (HOOP.netRows - 1);
    const width = HOOP.rimWidth * (0.91 - t * 0.46);
    const y = HOOP.rimY + 13 + row * HOOP.netRowGap;
    for (let col = 0; col < HOOP.netCols; col++) {
      const u = col / (HOOP.netCols - 1);
      const x = HOOP.x - width / 2 + width * u;
      const node = Matter.Bodies.circle(x, y, 2.35, {
        label: "net-node",
        density: 0.00034,
        friction: 0.07,
        frictionAir: 0.072,
        restitution: 0.04,
        collisionFilter: { group },
      });
      nodes.push(node);
      startPositions.push({ x, y });
    }
  }

  const link = (a: Matter.Body, b: Matter.Body, stiffness: number) => {
    constraints.push(
      Matter.Constraint.create({ bodyA: a, bodyB: b, stiffness, damping: 0.12, label: "net-link" }),
    );
  };

  for (let col = 0; col < HOOP.netCols; col++) {
    const u = col / (HOOP.netCols - 1);
    const anchorX = HOOP.x - (HOOP.rimWidth * 0.91) / 2 + HOOP.rimWidth * 0.91 * u;
    constraints.push(
      Matter.Constraint.create({
        pointA: { x: anchorX, y: HOOP.rimY + 3 },
        bodyB: nodeAt(0, col),
        length: 10,
        stiffness: 0.76,
        damping: 0.15,
        label: "net-anchor",
      }),
    );
  }

  for (let row = 0; row < HOOP.netRows; row++) {
    for (let col = 0; col < HOOP.netCols; col++) {
      if (col < HOOP.netCols - 1) link(nodeAt(row, col), nodeAt(row, col + 1), 0.45);
      if (row < HOOP.netRows - 1) link(nodeAt(row, col), nodeAt(row + 1, col), 0.56);
      if (row < HOOP.netRows - 1 && col < HOOP.netCols - 1) {
        link(nodeAt(row, col), nodeAt(row + 1, col + 1), 0.31);
        link(nodeAt(row, col + 1), nodeAt(row + 1, col), 0.31);
      }
    }
  }

  return { rigid: [leftRim, rightRim, backboard, bracket], sensor, net: { nodes, constraints, startPositions } };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBasketballGoal(ctx: CanvasRenderingContext2D, net: NetRig | null) {
  const bx = HOOP.backboardX - HOOP.visualBoardW / 2;
  const by = HOOP.backboardY - HOOP.visualBoardH / 2;

  // Rear support: dark powder-coated steel frame, largely off the right edge.
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(24,28,30,.95)";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(HOOP.backboardX + 46, HOOP.backboardY + 10);
  ctx.lineTo(HOOP.backboardX + 76, HOOP.backboardY + 58);
  ctx.lineTo(HOOP.backboardX + 76, HOOP.backboardY + 170);
  ctx.stroke();
  ctx.strokeStyle = "rgba(103,109,112,.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HOOP.backboardX + 45, HOOP.backboardY + 9);
  ctx.lineTo(HOOP.backboardX + 75, HOOP.backboardY + 57);
  ctx.stroke();
  ctx.restore();

  // Backboard drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(19,22,23,.28)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 9;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "rgba(20,24,26,.14)";
  drawRoundedRect(ctx, bx - 3, by - 3, HOOP.visualBoardW + 6, HOOP.visualBoardH + 6, 4);
  ctx.fill();
  ctx.restore();

  // Aluminum outer frame with proper thickness.
  ctx.save();
  const frame = ctx.createLinearGradient(bx, by, bx + HOOP.visualBoardW, by + HOOP.visualBoardH);
  frame.addColorStop(0, "#fbfcfc");
  frame.addColorStop(0.17, "#aeb5b8");
  frame.addColorStop(0.42, "#e9eded");
  frame.addColorStop(0.75, "#8d9497");
  frame.addColorStop(1, "#4f5659");
  ctx.fillStyle = frame;
  drawRoundedRect(ctx, bx, by, HOOP.visualBoardW, HOOP.visualBoardH, 4);
  ctx.fill();

  // Glass/clear polycarbonate panel.
  const glass = ctx.createLinearGradient(bx + 9, by + 8, bx + HOOP.visualBoardW - 9, by + HOOP.visualBoardH - 8);
  glass.addColorStop(0, "rgba(250,253,253,.78)");
  glass.addColorStop(0.52, "rgba(221,230,231,.47)");
  glass.addColorStop(1, "rgba(243,247,247,.64)");
  ctx.fillStyle = glass;
  drawRoundedRect(ctx, bx + 8, by + 8, HOOP.visualBoardW - 16, HOOP.visualBoardH - 16, 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(113,121,124,.86)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle glass reflection.
  ctx.fillStyle = "rgba(255,255,255,.26)";
  ctx.beginPath();
  ctx.moveTo(bx + 15, by + 14);
  ctx.lineTo(bx + 44, by + 14);
  ctx.lineTo(bx + 18, by + HOOP.visualBoardH - 18);
  ctx.lineTo(bx + 10, by + HOOP.visualBoardH - 18);
  ctx.closePath();
  ctx.fill();

  // Red target square, aligned behind the rim.
  ctx.strokeStyle = "#e34d2c";
  ctx.lineWidth = 4;
  ctx.strokeRect(HOOP.backboardX - 31, HOOP.rimY - 52, 58, 42);

  // Corner bolts.
  const bolt = (x: number, y: number) => {
    const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0, x, y, 4.5);
    g.addColorStop(0, "#f5f6f6");
    g.addColorStop(0.45, "#a5abad");
    g.addColorStop(1, "#414749");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  };
  bolt(bx + 10, by + 10);
  bolt(bx + HOOP.visualBoardW - 10, by + 10);
  bolt(bx + 10, by + HOOP.visualBoardH - 10);
  bolt(bx + HOOP.visualBoardW - 10, by + HOOP.visualBoardH - 10);
  ctx.restore();

  // Orange steel mounting plate between ring and board.
  ctx.save();
  ctx.shadowColor = "rgba(28,24,20,.28)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  const mount = ctx.createLinearGradient(HOOP.x + 43, HOOP.rimY - 12, HOOP.backboardX, HOOP.rimY + 13);
  mount.addColorStop(0, "#78200e");
  mount.addColorStop(0.44, "#d44818");
  mount.addColorStop(0.72, "#ef6527");
  mount.addColorStop(1, "#8a260f");
  ctx.fillStyle = mount;
  ctx.beginPath();
  ctx.moveTo(HOOP.x + 46, HOOP.rimY - 8);
  ctx.lineTo(HOOP.backboardX - 6, HOOP.rimY - 19);
  ctx.lineTo(HOOP.backboardX - 6, HOOP.rimY + 19);
  ctx.lineTo(HOOP.x + 46, HOOP.rimY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Dynamic net. We intentionally draw the live rope mesh rather than a static sprite.
  if (net) {
    const nodeAt = (row: number, col: number) => net.nodes[row * HOOP.netCols + col]!;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(35,35,35,.24)";
    ctx.shadowBlur = 2.2;
    ctx.strokeStyle = "rgba(247,247,241,.97)";
    ctx.lineWidth = 1.7;

    // Horizontal bands.
    for (let row = 0; row < HOOP.netRows; row++) {
      ctx.beginPath();
      for (let col = 0; col < HOOP.netCols; col++) {
        const p = nodeAt(row, col).position;
        if (col === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Diagonal strands produce the basketball-net diamond pattern.
    for (let row = 0; row < HOOP.netRows - 1; row++) {
      for (let col = 0; col < HOOP.netCols - 1; col++) {
        const a = nodeAt(row, col).position;
        const b = nodeAt(row + 1, col + 1).position;
        const c = nodeAt(row, col + 1).position;
        const d = nodeAt(row + 1, col).position;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
    }

    // Short top ties to the rim.
    ctx.lineWidth = 2.1;
    for (let col = 0; col < HOOP.netCols; col++) {
      const p = nodeAt(0, col).position;
      const u = col / (HOOP.netCols - 1);
      const ax = HOOP.x - (HOOP.rimWidth * 0.91) / 2 + HOOP.rimWidth * 0.91 * u;
      ctx.beginPath();
      ctx.moveTo(ax, HOOP.rimY + 3);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Thick three-dimensional orange ring: dark underside, body, top highlight.
  ctx.save();
  ctx.shadowColor = "rgba(25,25,25,.34)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = "#6d1808";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.rimY + 2, HOOP.rimWidth / 2, 12.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  const rim = ctx.createLinearGradient(HOOP.x - HOOP.rimWidth / 2, HOOP.rimY - 9, HOOP.x + HOOP.rimWidth / 2, HOOP.rimY + 9);
  rim.addColorStop(0, "#8c210c");
  rim.addColorStop(0.24, "#d94816");
  rim.addColorStop(0.48, "#ff7626");
  rim.addColorStop(0.72, "#d94413");
  rim.addColorStop(1, "#7a1c09");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 8.5;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.rimY, HOOP.rimWidth / 2, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,202,144,.9)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.ellipse(HOOP.x, HOOP.rimY - 1.6, HOOP.rimWidth / 2 - 2, 8.2, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
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

  const remaining = (kind: PartKind) =>
    (INVENTORY.find((i) => i.kind === kind)?.count ?? 0) - (used[kind] ?? 0);

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
    const scenery = SCENERY.map((s) =>
      Matter.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        isStatic: true,
        angle: s.a,
        label: "scenery",
        friction: 0.02,
        restitution: 0.1,
      }),
    );
    const hoop = buildBasketballGoal();
    netRigRef.current = hoop.net;
    const ball = Matter.Bodies.circle(BALL_START.x, BALL_START.y, BALL_START.r, {
      label: "ball",
      restitution: 0.42,
      friction: 0.02,
      density: 0.008,
      frictionAir: 0.004,
      frictionStatic: 0.05,
    });
    ballRef.current = ball;
    Matter.Composite.add(engine.world, [
      ...walls,
      ...scenery,
      ...hoop.rigid,
      hoop.sensor,
      ...hoop.net.nodes,
      ...hoop.net.constraints,
      ball,
    ]);

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
        const openingHalf = HOOP.rimWidth / 2 - HOOP.rimRadius - BALL_START.r * 0.15;
        const crossedHoop =
          previousBallYRef.current < HOOP.rimY - BALL_START.r * 0.15 &&
          b.position.y >= HOOP.rimY + BALL_START.r * 0.15 &&
          Math.abs(b.position.x - HOOP.x) < openingHalf &&
          b.velocity.y > 0;
        previousBallYRef.current = b.position.y;
        const slow = Matter.Vector.magnitude(b.velocity) < 0.35;
        if (crossedHoop) {
          runningRef.current = false;
          setStatus("won");
        } else if (slow) {
          settled += STEP;
          if (settled > 2500) {
            runningRef.current = false;
            setStatus("failed");
          }
        } else settled = 0;
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
      const x = b.position.x;
      const y = b.position.y;
      const r = BALL_START.r;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.12, y + r * 0.78, r * 0.78, r * 0.22, 0, 0, Math.PI * 2);
      const shadow = ctx.createRadialGradient(x, y + r * 0.78, 0, x, y + r * 0.78, r * 0.95);
      shadow.addColorStop(0, "rgba(20,20,20,.22)");
      shadow.addColorStop(1, "rgba(20,20,20,0)");
      ctx.fillStyle = shadow;
      ctx.fill();
      const sprite = ballSpriteRef.current;
      if (sprite?.complete && sprite.naturalWidth > 0) {
        ctx.translate(x, y);
        ctx.rotate(b.angle);
        const size = r * 2.12;
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#596068";
        ctx.fill();
      }
      ctx.restore();
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
    if (status !== "build") return;
    const p = toWorld(e);
    const hit = [...placedRef.current].reverse().find((pl) => Matter.Vertices.contains(pl.body.vertices, p));
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
    snapshotRef.current = placedRef.current.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: p.body.position.x,
      y: p.body.position.y,
      a: p.body.angle,
    }));
    Matter.Body.setVelocity(ballRef.current!, { x: 0, y: 0 });
    previousBallYRef.current = ballRef.current!.position.y;
    setSelectedId(null);
    setStatus("running");
    runningRef.current = true;
  };

  const resetNet = () => {
    const net = netRigRef.current;
    if (!net) return;
    net.nodes.forEach((node, i) => {
      Matter.Body.setPosition(node, net.startPositions[i]!);
      Matter.Body.setVelocity(node, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(node, 0);
      Matter.Body.setAngle(node, 0);
    });
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
    previousBallYRef.current = BALL_START.y;
    resetNet();
    setStatus("build");
  };

  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw, tick]);

  const selected = placedRef.current.find((x) => x.id === selectedId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="pt-8 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-brass">Уровень 1</p>
        <h1 className="mt-1 font-display text-4xl leading-none text-foreground sm:text-5xl">Невероятная машина</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Соберите цепочку: шар должен сам попасть в баскетбольную корзину «ЦЕЛЬ». Ставьте детали, крутите доски, затем запускайте механизм.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border-2 border-ink/20 bg-paper p-2 shadow-plate">
          <canvas
            ref={canvasRef}
            width={WORLD.w}
            height={WORLD.h}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            data-goal="basketball-hoop-render-v2"
            className="tim-canvas w-full touch-none rounded-lg"
            style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }}
          />
        </div>
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border-2 border-ink/20 bg-card p-4 shadow-plate">
            <h2 className="font-display text-lg text-foreground">Детали</h2>
            <ul className="mt-3 space-y-2">
              {INVENTORY.map(({ kind }) => {
                const left = remaining(kind);
                const active = selectedKind === kind;
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      disabled={status !== "build" || left <= 0}
                      onClick={() => setSelectedKind(kind)}
                      className={`w-full rounded-lg border-2 px-3 py-2 text-left transition-colors disabled:opacity-40 ${active ? "border-brass bg-brass/15" : "border-ink/15 hover:border-brass/60"}`}
                    >
                      <span className="flex items-center justify-between font-display text-base text-foreground">
                        {PART_INFO[kind].label}
                        <span className="font-mono text-xs text-brass">×{left}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{PART_INFO[kind].hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-ink/20 bg-card p-4 shadow-plate">
            <h2 className="font-display text-lg text-foreground">Выбранная деталь</h2>
            {selected ? (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-xs text-muted-foreground">{PART_INFO[selected.kind].label} — тяните мышью, чтобы переместить</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => rotate(-0.12)} disabled={!PART_INFO[selected.kind].rotatable} className="flex-1 rounded-md border-2 border-ink/15 py-1.5 font-mono text-sm disabled:opacity-40">↺</button>
                  <button type="button" onClick={() => rotate(0.12)} disabled={!PART_INFO[selected.kind].rotatable} className="flex-1 rounded-md border-2 border-ink/15 py-1.5 font-mono text-sm disabled:opacity-40">↻</button>
                  <button type="button" onClick={removeSelected} className="flex-1 rounded-md border-2 border-danger/50 py-1.5 font-mono text-sm text-danger">Убрать</button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Кликните по деталям на чертеже, чтобы настроить их.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={start} disabled={status !== "build"} className="flex-1 rounded-lg border-2 border-ink bg-brass px-4 py-3 font-display text-lg text-ink shadow-plate transition-transform active:translate-y-0.5 disabled:opacity-40">Запустить</button>
            <button type="button" onClick={reset} className="rounded-lg border-2 border-ink/25 px-4 py-3 font-display text-lg text-foreground">Сброс</button>
          </div>
          {status === "won" && (
            <div className="rounded-xl border-2 border-brass bg-brass/15 p-4 text-center">
              <p className="font-display text-xl text-foreground">Машина работает!</p>
              <p className="mt-1 text-xs text-muted-foreground">Шар прошёл через кольцо. Уровень пройден.</p>
            </div>
          )}
          {status === "failed" && (
            <div className="rounded-xl border-2 border-danger/50 bg-danger/10 p-4 text-center">
              <p className="font-display text-lg text-foreground">Шар не попал в корзину</p>
              <p className="mt-1 text-xs text-muted-foreground">Нажмите «Сброс» и переставьте детали.</p>
            </div>
          )}
          {status === "running" && <p className="text-center font-mono text-xs uppercase tracking-widest text-brass">механизм работает…</p>}
        </aside>
      </div>
    </div>
  );
}
