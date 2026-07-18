export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface HingeLimits {
  readonly minAngle?: number;
  readonly maxAngle?: number;
}

const TAU = Math.PI * 2;

export function normalizeAngle(angle: number): number {
  let result = angle % TAU;
  if (result > Math.PI) result -= TAU;
  if (result < -Math.PI) result += TAU;
  return result;
}

export function worldPointToLocal(point: Point, bodyPosition: Point, bodyAngle: number): Point {
  const dx = point.x - bodyPosition.x;
  const dy = point.y - bodyPosition.y;
  const cos = Math.cos(-bodyAngle);
  const sin = Math.sin(-bodyAngle);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  };
}

export function localPointToWorld(point: Point, bodyPosition: Point, bodyAngle: number): Point {
  const cos = Math.cos(bodyAngle);
  const sin = Math.sin(bodyAngle);
  return {
    x: bodyPosition.x + point.x * cos - point.y * sin,
    y: bodyPosition.y + point.x * sin + point.y * cos
  };
}

export function clampPivotToLever(localPoint: Point, width: number, margin = 22): Point {
  const half = Math.max(0, width / 2 - margin);
  return {
    x: Math.max(-half, Math.min(half, localPoint.x)),
    y: 0
  };
}

export function clampHingeAngle(bodyAngle: number, referenceAngle: number, limits: HingeLimits): number {
  if (limits.minAngle === undefined || limits.maxAngle === undefined) return bodyAngle;
  const relative = normalizeAngle(bodyAngle - referenceAngle);
  const clamped = Math.max(limits.minAngle, Math.min(limits.maxAngle, relative));
  return referenceAngle + clamped;
}

export function hingeLimitPreset(mode: 'wide' | 'narrow' | 'free'): HingeLimits {
  if (mode === 'wide') return { minAngle: -Math.PI * 0.46, maxAngle: Math.PI * 0.46 };
  if (mode === 'narrow') return { minAngle: -Math.PI * 0.2, maxAngle: Math.PI * 0.2 };
  return {};
}
