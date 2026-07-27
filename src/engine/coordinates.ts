import { PHYSICS_SCALE, WORLD_HEIGHT, type Point } from '../model';

export const pxToMeters = (value: number): number => value / PHYSICS_SCALE;
export const metersToPx = (value: number): number => value * PHYSICS_SCALE;

export function pixelPointToPhysics(point: Point): Point {
  return { x: pxToMeters(point.x), y: pxToMeters(WORLD_HEIGHT - point.y) };
}

export function physicsPointToPixel(point: Point): Point {
  return { x: metersToPx(point.x), y: WORLD_HEIGHT - metersToPx(point.y) };
}

export function localPointToPhysics(point: Point): Point {
  return { x: pxToMeters(point.x), y: -pxToMeters(point.y) };
}

export function radialContact(center: Point, target: Point, radius: number): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { x: center.x, y: center.y - radius };
  return {
    x: center.x + dx / distance * radius,
    y: center.y + dy / distance * radius
  };
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
