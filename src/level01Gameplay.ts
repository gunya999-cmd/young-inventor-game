import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { PARTS, localToWorld, type MachineSnapshot, type PartState } from './model';

export interface Level01BonusTarget {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Level01ResultScore {
  collected: number;
  total: number;
  smooth: boolean;
  fast: boolean;
  explorer: boolean;
  medals: number;
}

export const LEVEL01_BONUSES: ReadonlyArray<Level01BonusTarget> = [
  { id: 'spark-a', x: 612, y: 342, label: 'ТРАЕКТОРИЯ' },
  { id: 'spark-b', x: 816, y: 414, label: 'БАЛАНС' },
  { id: 'spark-c', x: 1022, y: 478, label: 'ТОЧНОСТЬ' }
];

const BONUS_RADIUS = 58;
const FAST_SECONDS = 7.5;
const STORAGE_KEY = 'young-inventor:level-01:best:v2';

const runtime = {
  collected: new Set<string>(),
  hintVisible: false,
  attempt: 0
};

export function isCanonicalLevel01(): boolean {
  if (ACTIVE_LEVEL.id !== 'first-ramp') return false;
  if (typeof localStorage === 'undefined') return true;
  return !localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY);
}

export function resetLevel01Attempt(): void {
  runtime.collected.clear();
  runtime.attempt += 1;
}

export function level01AttemptNumber(): number {
  return Math.max(1, runtime.attempt);
}

export function setLevel01HintVisible(value: boolean): void {
  runtime.hintVisible = value;
}

export function level01HintVisible(): boolean {
  return runtime.hintVisible;
}

export function isLevel01BonusCollected(id: string): boolean {
  return runtime.collected.has(id);
}

export function level01CollectedCount(): number {
  return runtime.collected.size;
}

export function updateLevel01Bonuses(snapshot: MachineSnapshot): string[] {
  const ball = snapshot.parts.find((part) => part.id === ACTIVE_LEVEL.targetPartId);
  if (!ball) return [];
  const collectedNow: string[] = [];
  for (const bonus of LEVEL01_BONUSES) {
    if (runtime.collected.has(bonus.id)) continue;
    if (Math.hypot(ball.x - bonus.x, ball.y - bonus.y) <= BONUS_RADIUS) {
      runtime.collected.add(bonus.id);
      collectedNow.push(bonus.id);
    }
  }
  return collectedNow;
}

function playerRails(snapshot: MachineSnapshot): PartState[] {
  return snapshot.parts
    .filter((part) => !part.locked && part.kind === 'plank')
    .slice()
    .sort((a, b) => a.x - b.x);
}

export function isSmoothLevel01Route(snapshot: MachineSnapshot): boolean {
  const rails = playerRails(snapshot);
  if (rails.length !== 3) return false;
  if (rails.some((rail) => rail.angle < 0.08 || rail.angle > 0.58)) return false;

  const width = PARTS.plank.width;
  for (let index = 0; index < rails.length - 1; index += 1) {
    const current = rails[index];
    const next = rails[index + 1];
    if (Math.abs(current.angle - next.angle) > 0.22) return false;
    const right = localToWorld(current, { x: width / 2, y: 0 });
    const left = localToWorld(next, { x: -width / 2, y: 0 });
    if (Math.hypot(right.x - left.x, right.y - left.y) > 92) return false;
  }
  return true;
}

export function scoreLevel01(snapshot: MachineSnapshot, elapsed: number): Level01ResultScore {
  const collected = level01CollectedCount();
  const smooth = isSmoothLevel01Route(snapshot);
  const fast = elapsed <= FAST_SECONDS;
  const explorer = collected === LEVEL01_BONUSES.length;
  return {
    collected,
    total: LEVEL01_BONUSES.length,
    smooth,
    fast,
    explorer,
    medals: Number(smooth) + Number(fast) + Number(explorer)
  };
}

export interface Level01BestResult {
  bestTime: number;
  bestBonuses: number;
  bestMedals: number;
}

export function loadLevel01Best(): Level01BestResult | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Level01BestResult>;
    if (!Number.isFinite(parsed.bestTime) || !Number.isInteger(parsed.bestBonuses) || !Number.isInteger(parsed.bestMedals)) return null;
    return {
      bestTime: Math.max(0, parsed.bestTime as number),
      bestBonuses: Math.max(0, Math.min(LEVEL01_BONUSES.length, parsed.bestBonuses as number)),
      bestMedals: Math.max(0, Math.min(3, parsed.bestMedals as number))
    };
  } catch {
    return null;
  }
}

export function saveLevel01Best(score: Level01ResultScore, elapsed: number): Level01BestResult {
  const previous = loadLevel01Best();
  const next: Level01BestResult = {
    bestTime: previous ? Math.min(previous.bestTime, elapsed) : elapsed,
    bestBonuses: Math.max(previous?.bestBonuses ?? 0, score.collected),
    bestMedals: Math.max(previous?.bestMedals ?? 0, score.medals)
  };
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
