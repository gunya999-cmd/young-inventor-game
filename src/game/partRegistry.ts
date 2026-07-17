import type { PartDefinition } from './types';

export const PARTS: Record<string, PartDefinition> = {
  ball: {
    id: 'ball', kind: 'energy-ball', displayName: 'Энергетический шар', assetKey: 'energy-ball',
    body: { type: 'circle', radius: 32 }, mass: 1, friction: 0.002, frictionAir: 0.0008, restitution: 0.025
  },
  'beam-short': {
    id: 'beam-short', kind: 'beam', displayName: 'Короткая пластина', assetKey: 'beam-red-short',
    body: { type: 'rectangle', width: 180, height: 34 }, friction: 0.004, restitution: 0.015,
    rotatable: true, rotationStepDeg: 5, minRotationDeg: -35, maxRotationDeg: 35, snapRadius: 135,
    connectionPoints: [{ x: -90, y: 0 }, { x: 90, y: 0 }]
  },
  'beam-medium': {
    id: 'beam-medium', kind: 'beam', displayName: 'Средняя пластина', assetKey: 'beam-red',
    body: { type: 'rectangle', width: 254, height: 34 }, friction: 0.004, restitution: 0.015,
    rotatable: true, rotationStepDeg: 5, minRotationDeg: -35, maxRotationDeg: 35, snapRadius: 150,
    connectionPoints: [{ x: -127, y: 0 }, { x: 127, y: 0 }]
  },
  'beam-long': {
    id: 'beam-long', kind: 'beam', displayName: 'Длинная пластина', assetKey: 'beam-red-long',
    body: { type: 'rectangle', width: 360, height: 34 }, friction: 0.004, restitution: 0.015,
    rotatable: true, rotationStepDeg: 5, minRotationDeg: -35, maxRotationDeg: 35, snapRadius: 165,
    connectionPoints: [{ x: -180, y: 0 }, { x: 180, y: 0 }]
  },
  support: {
    id: 'support', kind: 'support', displayName: 'Опора', assetKey: 'support',
    body: { type: 'rectangle', width: 76, height: 90 }, fixed: true
  },
  button: {
    id: 'button', kind: 'button', displayName: 'Кнопка', assetKey: 'button',
    body: { type: 'rectangle', width: 92, height: 28 }, fixed: true
  },
  spring: {
    id: 'spring', kind: 'spring', displayName: 'Пружина', assetKey: 'spring',
    body: { type: 'rectangle', width: 86, height: 48 }, fixed: true
  },
  receiver: {
    id: 'receiver', kind: 'receiver', displayName: 'Энергопорт', assetKey: 'receiver',
    body: { type: 'circle', radius: 62 }, fixed: true
  }
};

export function getPart(id: string): PartDefinition {
  const part = PARTS[id];
  if (!part) throw new Error(`Unknown part: ${id}`);
  return part;
}
