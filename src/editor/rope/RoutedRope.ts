export interface RopePoint {
  readonly x: number;
  readonly y: number;
}

export interface RopeSolverNode {
  readonly key: string;
  readonly position: RopePoint;
  readonly inverseMass: number;
}

export interface RopeCorrectionResult {
  readonly length: number;
  readonly stretch: number;
  readonly corrections: ReadonlyMap<string, RopePoint>;
}

export interface RopeRenderNode extends RopePoint {
  readonly radius?: number;
}

export interface RopeArc {
  readonly center: RopePoint;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly anticlockwise: boolean;
}

export interface WrappedRopePath {
  readonly lines: readonly (readonly [RopePoint, RopePoint])[];
  readonly arcs: readonly RopeArc[];
}

const EPSILON = 1e-6;

function add(a: RopePoint, b: RopePoint): RopePoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: RopePoint, b: RopePoint): RopePoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(value: RopePoint, factor: number): RopePoint {
  return { x: value.x * factor, y: value.y * factor };
}

function magnitude(value: RopePoint): number {
  return Math.hypot(value.x, value.y);
}

function normalize(value: RopePoint): RopePoint {
  const length = magnitude(value);
  return length > EPSILON ? scale(value, 1 / length) : { x: 0, y: 0 };
}

export function routedRopeLength(nodes: readonly RopePoint[]): number {
  let total = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    total += magnitude(subtract(nodes[index], nodes[index - 1]));
  }
  return total;
}

/**
 * Solves one position-based constant-length rope iteration.
 *
 * Intermediate nodes naturally behave as redirected tension points. A movable
 * pulley therefore receives the vector sum of both neighbouring rope segments,
 * while a fixed pulley simply has inverseMass = 0.
 */
export function solveRoutedRope(
  nodes: readonly RopeSolverNode[],
  restLength: number,
  stiffness = 0.92,
  tolerance = 0.05
): RopeCorrectionResult {
  const length = routedRopeLength(nodes.map((node) => node.position));
  const stretch = length - restLength;
  if (nodes.length < 2 || stretch <= tolerance) {
    return { length, stretch: Math.max(0, stretch), corrections: new Map() };
  }

  const gradients = new Map<string, RopePoint>();
  const inverseMasses = new Map<string, number>();

  const accumulate = (key: string, gradient: RopePoint, inverseMass: number): void => {
    gradients.set(key, add(gradients.get(key) ?? { x: 0, y: 0 }, gradient));
    inverseMasses.set(key, Math.max(inverseMasses.get(key) ?? 0, Math.max(0, inverseMass)));
  };

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const current = nodes[index];
    const next = nodes[index + 1];
    const delta = subtract(next.position, current.position);
    const distance = magnitude(delta);
    if (distance <= EPSILON) continue;
    const direction = scale(delta, 1 / distance);
    accumulate(current.key, scale(direction, -1), current.inverseMass);
    accumulate(next.key, direction, next.inverseMass);
  }

  let denominator = 0;
  for (const [key, gradient] of gradients) {
    const inverseMass = inverseMasses.get(key) ?? 0;
    denominator += inverseMass * (gradient.x * gradient.x + gradient.y * gradient.y);
  }

  if (denominator <= EPSILON) {
    return { length, stretch, corrections: new Map() };
  }

  const lambda = -(stretch * Math.min(1, Math.max(0, stiffness))) / denominator;
  const corrections = new Map<string, RopePoint>();
  for (const [key, gradient] of gradients) {
    const inverseMass = inverseMasses.get(key) ?? 0;
    if (inverseMass <= 0) continue;
    corrections.set(key, scale(gradient, inverseMass * lambda));
  }

  return { length, stretch, corrections };
}

/**
 * Produces a render path that wraps around intermediate pulley circles instead
 * of visually cutting through their centres. Physics still uses the anchor
 * centres, which keeps the solver deterministic and stable.
 */
export function buildWrappedRopePath(nodes: readonly RopeRenderNode[]): WrappedRopePath {
  if (nodes.length < 2) return { lines: [], arcs: [] };

  const lines: Array<readonly [RopePoint, RopePoint]> = [];
  const arcs: RopeArc[] = [];
  let cursor: RopePoint = nodes[0];

  for (let index = 1; index < nodes.length - 1; index += 1) {
    const previous = nodes[index - 1];
    const pulley = nodes[index];
    const next = nodes[index + 1];
    const radius = Math.max(0, pulley.radius ?? 0);

    if (radius <= EPSILON) {
      lines.push([cursor, pulley]);
      cursor = pulley;
      continue;
    }

    const incoming = normalize(subtract(previous, pulley));
    const outgoing = normalize(subtract(next, pulley));
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    const side = cross >= 0 ? 1 : -1;
    const entryNormal = { x: -incoming.y * side, y: incoming.x * side };
    const exitNormal = { x: -outgoing.y * side, y: outgoing.x * side };
    const entry = add(pulley, scale(entryNormal, radius));
    const exit = add(pulley, scale(exitNormal, radius));

    lines.push([cursor, entry]);
    arcs.push({
      center: { x: pulley.x, y: pulley.y },
      radius,
      startAngle: Math.atan2(entry.y - pulley.y, entry.x - pulley.x),
      endAngle: Math.atan2(exit.y - pulley.y, exit.x - pulley.x),
      anticlockwise: side < 0
    });
    cursor = exit;
  }

  lines.push([cursor, nodes[nodes.length - 1]]);
  return { lines, arcs };
}
