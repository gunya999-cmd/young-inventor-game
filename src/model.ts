export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
export const PHYSICS_SCALE = 100;

export type PartKind = 'ball' | 'plank' | 'wall' | 'lever' | 'pulley' | 'weight';
export type GameMode = 'build' | 'running' | 'paused';

export interface Point {
  x: number;
  y: number;
}

export interface PartSpec {
  kind: PartKind;
  label: string;
  width: number;
  height: number;
  radius?: number;
  density: number;
  friction: number;
  restitution: number;
  defaultFixed: boolean;
  canHinge: boolean;
  color: string;
}

export interface PartState {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  angle: number;
  fixed: boolean;
  locked?: boolean;
}

export interface Endpoint {
  partId: string;
  localX: number;
  localY: number;
}

export interface RopeState {
  id: string;
  a: Endpoint;
  b: Endpoint;
  maxLength: number;
}

export interface HingeState {
  id: string;
  partId: string;
  localX: number;
  localY: number;
  referenceAngle: number;
  lowerAngle?: number;
  upperAngle?: number;
}

export interface MachineSnapshot {
  parts: PartState[];
  ropes: RopeState[];
  hinges: HingeState[];
}

export const PARTS: Readonly<Record<PartKind, PartSpec>> = {
  ball: {
    kind: 'ball', label: 'Шар', width: 56, height: 56, radius: 28,
    density: 1.2, friction: 0.18, restitution: 0.28,
    defaultFixed: false, canHinge: false, color: '#596773'
  },
  plank: {
    kind: 'plank', label: 'Доска', width: 220, height: 30,
    density: 0.8, friction: 0.72, restitution: 0.04,
    defaultFixed: true, canHinge: true, color: '#a96531'
  },
  wall: {
    kind: 'wall', label: 'Стенка', width: 170, height: 30,
    density: 2.4, friction: 0.82, restitution: 0.02,
    defaultFixed: true, canHinge: false, color: '#53616c'
  },
  lever: {
    kind: 'lever', label: 'Рычаг', width: 275, height: 34,
    density: 0.9, friction: 0.68, restitution: 0.04,
    defaultFixed: false, canHinge: true, color: '#bd7436'
  },
  pulley: {
    kind: 'pulley', label: 'Блок', width: 76, height: 76, radius: 38,
    density: 1.3, friction: 0.28, restitution: 0.03,
    defaultFixed: true, canHinge: false, color: '#4b5964'
  },
  weight: {
    kind: 'weight', label: 'Груз', width: 68, height: 84,
    density: 5.5, friction: 0.46, restitution: 0.01,
    defaultFixed: false, canHinge: false, color: '#343b40'
  }
};

export const INVENTORY: Readonly<Record<PartKind, number>> = {
  ball: 0,
  plank: 4,
  wall: 2,
  lever: 2,
  pulley: 2,
  weight: 2
};

export const MAX_ROPES = 3;
export const MAX_HINGES = 3;

export function createInitialSnapshot(): MachineSnapshot {
  return {
    parts: [
      { id: 'target-ball', kind: 'ball', x: 170, y: 220, angle: 0, fixed: false, locked: true }
    ],
    ropes: [],
    hinges: []
  };
}

export function cloneSnapshot(snapshot: MachineSnapshot): MachineSnapshot {
  return {
    parts: snapshot.parts.map((part) => ({ ...part })),
    ropes: snapshot.ropes.map((rope) => ({
      ...rope,
      a: { ...rope.a },
      b: { ...rope.b }
    })),
    hinges: snapshot.hinges.map((hinge) => ({ ...hinge }))
  };
}

export function rotatePoint(point: Point, angle: number): Point {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine
  };
}

export function localToWorld(part: PartState, local: Point): Point {
  const rotated = rotatePoint(local, part.angle);
  return { x: part.x + rotated.x, y: part.y + rotated.y };
}

export function worldToLocal(part: PartState, world: Point): Point {
  return rotatePoint({ x: world.x - part.x, y: world.y - part.y }, -part.angle);
}

export function clampLocalPoint(part: PartState, point: Point): Point {
  const spec = PARTS[part.kind];
  if (spec.radius) {
    const length = Math.hypot(point.x, point.y);
    if (length <= spec.radius || length === 0) return { ...point };
    const ratio = spec.radius / length;
    return { x: point.x * ratio, y: point.y * ratio };
  }
  return {
    x: Math.max(-spec.width / 2, Math.min(spec.width / 2, point.x)),
    y: Math.max(-spec.height / 2, Math.min(spec.height / 2, point.y))
  };
}

export function containsPoint(part: PartState, world: Point, padding = 10): boolean {
  const spec = PARTS[part.kind];
  const local = worldToLocal(part, world);
  if (spec.radius) return Math.hypot(local.x, local.y) <= spec.radius + padding;
  return Math.abs(local.x) <= spec.width / 2 + padding && Math.abs(local.y) <= spec.height / 2 + padding;
}

export function topPartAt(snapshot: MachineSnapshot, point: Point): PartState | undefined {
  return [...snapshot.parts].reverse().find((part) => containsPoint(part, point));
}

export function countUsed(snapshot: MachineSnapshot, kind: PartKind): number {
  return snapshot.parts.filter((part) => !part.locked && part.kind === kind).length;
}

export function remaining(snapshot: MachineSnapshot, kind: PartKind): number {
  return Math.max(0, INVENTORY[kind] - countUsed(snapshot, kind));
}

export class SnapshotHistory {
  private states: MachineSnapshot[];
  private cursor = 0;

  constructor(initial: MachineSnapshot) {
    this.states = [cloneSnapshot(initial)];
  }

  commit(snapshot: MachineSnapshot): void {
    const candidate = JSON.stringify(snapshot);
    if (candidate === JSON.stringify(this.states[this.cursor])) return;
    this.states = this.states.slice(0, this.cursor + 1);
    this.states.push(cloneSnapshot(snapshot));
    this.cursor = this.states.length - 1;
  }

  undo(): MachineSnapshot | null {
    if (this.cursor === 0) return null;
    this.cursor -= 1;
    return cloneSnapshot(this.states[this.cursor]);
  }

  redo(): MachineSnapshot | null {
    if (this.cursor >= this.states.length - 1) return null;
    this.cursor += 1;
    return cloneSnapshot(this.states[this.cursor]);
  }

  reset(snapshot: MachineSnapshot): void {
    this.states = [cloneSnapshot(snapshot)];
    this.cursor = 0;
  }

  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor < this.states.length - 1; }
}
