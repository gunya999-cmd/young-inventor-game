import { ACTIVE_LEVEL } from './level';

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
export const PHYSICS_SCALE = 100;

export type PartKind =
  | 'ball'
  | 'plank'
  | 'wall'
  | 'lever'
  | 'pulley'
  | 'weight'
  | 'domino'
  | 'rubberball'
  | 'spring'
  | 'magnet'
  | 'sheave'
  | 'motor'
  | 'gear'
  | 'button'
  | 'latch';
export type GameMode = 'build' | 'running' | 'paused';

export interface Point { x: number; y: number; }

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

export interface Endpoint { partId: string; localX: number; localY: number; }

export interface RopeState {
  id: string;
  a: Endpoint;
  b: Endpoint;
  maxLength: number;
  pulleyPartId?: string;
  ratio?: number;
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

export type SignalAction = 'release';
export interface SignalLink { id: string; sourcePartId: string; targetPartId: string; action: SignalAction; }

export interface MachineSnapshot {
  parts: PartState[];
  ropes: RopeState[];
  hinges: HingeState[];
  signals?: SignalLink[];
}

export const PARTS: Readonly<Record<PartKind, PartSpec>> = {
  ball: { kind:'ball',label:'Стальной шар',width:56,height:56,radius:28,density:1.2,friction:.18,restitution:.28,defaultFixed:false,canHinge:false,color:'#596773' },
  plank: { kind:'plank',label:'Направляющая',width:235,height:28,density:.62,friction:.78,restitution:.03,defaultFixed:true,canHinge:true,color:'#a96531' },
  wall: { kind:'wall',label:'Резиновый отбойник',width:155,height:34,density:3.2,friction:.5,restitution:.72,defaultFixed:true,canHinge:false,color:'#ca3f4d' },
  lever: { kind:'lever',label:'Балансир',width:300,height:32,density:.35,friction:.64,restitution:.04,defaultFixed:false,canHinge:true,color:'#bd7436' },
  pulley: { kind:'pulley',label:'Вентилятор',width:92,height:92,radius:46,density:1.6,friction:.3,restitution:.02,defaultFixed:true,canHinge:false,color:'#4b5964' },
  weight: { kind:'weight',label:'Тяжёлый противовес',width:82,height:72,density:4.0,friction:.7,restitution:.02,defaultFixed:false,canHinge:false,color:'#6f5135' },
  domino: { kind:'domino',label:'Домино',width:34,height:102,density:.56,friction:.86,restitution:.035,defaultFixed:false,canHinge:false,color:'#e7d8b8' },
  rubberball: { kind:'rubberball',label:'Резиновый мяч',width:62,height:62,radius:31,density:.74,friction:.24,restitution:.92,defaultFixed:false,canHinge:false,color:'#39aee8' },
  spring: { kind:'spring',label:'Пружинный толкатель',width:126,height:54,density:3.4,friction:.62,restitution:.18,defaultFixed:true,canHinge:false,color:'#efb43f' },
  magnet: { kind:'magnet',label:'Магнит',width:104,height:88,density:3.1,friction:.55,restitution:.04,defaultFixed:true,canHinge:false,color:'#d9535d' },
  sheave: { kind:'sheave',label:'Шкив',width:84,height:84,radius:42,density:2.2,friction:.32,restitution:.02,defaultFixed:true,canHinge:false,color:'#687985' },
  motor: { kind:'motor',label:'Электромотор',width:96,height:96,radius:48,density:2.8,friction:.42,restitution:.01,defaultFixed:true,canHinge:false,color:'#d65f45' },
  gear: { kind:'gear',label:'Шестерня',width:88,height:88,radius:44,density:2.1,friction:.72,restitution:.01,defaultFixed:true,canHinge:false,color:'#d1a643' },
  button: { kind:'button',label:'Нажимная кнопка',width:92,height:30,density:3,friction:.72,restitution:.01,defaultFixed:true,canHinge:false,color:'#d9a53b' },
  latch: { kind:'latch',label:'Механическая защёлка',width:116,height:26,density:3.5,friction:.82,restitution:.01,defaultFixed:true,canHinge:false,color:'#62727c' }
};

export const INVENTORY: Readonly<Record<PartKind, number>> = ACTIVE_LEVEL.inventory;
export const MAX_ROPES = ACTIVE_LEVEL.maxRopes;
export const MAX_HINGES = ACTIVE_LEVEL.maxHinges;

export function createInitialSnapshot(): MachineSnapshot {
  return {
    parts: ACTIVE_LEVEL.initialParts.map((part) => ({ ...part })),
    ropes: [],
    hinges: [],
    signals: ACTIVE_LEVEL.initialSignals.map((signal) => ({ ...signal }))
  };
}

export function cloneSnapshot(snapshot: MachineSnapshot): MachineSnapshot {
  return {
    parts: snapshot.parts.map((part) => ({ ...part })),
    ropes: snapshot.ropes.map((rope) => ({ ...rope, a: { ...rope.a }, b: { ...rope.b } })),
    hinges: snapshot.hinges.map((hinge) => ({ ...hinge })),
    signals: (snapshot.signals ?? []).map((signal) => ({ ...signal }))
  };
}

export function rotatePoint(point: Point, angle: number): Point {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
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
  constructor(initial: MachineSnapshot) { this.states = [cloneSnapshot(initial)]; }
  commit(snapshot: MachineSnapshot): void {
    const candidate = JSON.stringify(snapshot);
    if (candidate === JSON.stringify(this.states[this.cursor])) return;
    this.states = this.states.slice(0, this.cursor + 1);
    this.states.push(cloneSnapshot(snapshot));
    this.cursor = this.states.length - 1;
  }
  undo(): MachineSnapshot | null { if (this.cursor === 0) return null; this.cursor -= 1; return cloneSnapshot(this.states[this.cursor]); }
  redo(): MachineSnapshot | null { if (this.cursor >= this.states.length - 1) return null; this.cursor += 1; return cloneSnapshot(this.states[this.cursor]); }
  reset(snapshot: MachineSnapshot): void { this.states = [cloneSnapshot(snapshot)]; this.cursor = 0; }
  get canUndo(): boolean { return this.cursor > 0; }
  get canRedo(): boolean { return this.cursor < this.states.length - 1; }
}
