import type { PartDefinition } from './types';

export const PARTS: Record<string, PartDefinition> = {
  'energy-ball': {
    id: 'energy-ball',
    kind: 'energy-ball',
    displayName: 'Энергетический шар',
    assetKey: 'energy-ball',
    body: { type: 'circle', radius: 32 },
    mass: 1,
    friction: 0.002,
    frictionAir: 0.0008,
    restitution: 0.025
  },
  'beam-short-red': {
    id: 'beam-short-red',
    kind: 'beam',
    displayName: 'Короткая красная балка',
    assetKey: 'beam-short-red',
    body: { type: 'rectangle', width: 210, height: 30 },
    friction: 0.004,
    restitution: 0.015,
    rotatable: true,
    rotationStepDeg: 5,
    minRotationDeg: -35,
    maxRotationDeg: 35,
    snapRadius: 145,
    connectionPoints: [
      { x: -92, y: 0 },
      { x: 92, y: 0 }
    ]
  },
  'beam-medium-red': {
    id: 'beam-medium-red',
    kind: 'beam',
    displayName: 'Средняя красная балка',
    assetKey: 'beam-medium-red',
    body: { type: 'rectangle', width: 274, height: 34 },
    friction: 0.004,
    restitution: 0.015,
    rotatable: true,
    rotationStepDeg: 5,
    minRotationDeg: -35,
    maxRotationDeg: 35,
    snapRadius: 155,
    connectionPoints: [
      { x: -122, y: 0 },
      { x: 122, y: 0 }
    ]
  },
  'beam-long-blue': {
    id: 'beam-long-blue',
    kind: 'beam',
    displayName: 'Длинная синяя балка',
    assetKey: 'beam-long-blue',
    body: { type: 'rectangle', width: 402, height: 30 },
    friction: 0.004,
    restitution: 0.015,
    fixed: true,
    connectionPoints: [
      { x: -190, y: 0 },
      { x: 190, y: 0 }
    ]
  },
  'start-cradle-green': {
    id: 'start-cradle-green',
    kind: 'start-cradle',
    displayName: 'Стартовая опора',
    assetKey: 'start-cradle-green',
    body: { type: 'rectangle', width: 126, height: 46 },
    friction: 0.2,
    fixed: true
  },
  'support-column': {
    id: 'support-column',
    kind: 'support',
    displayName: 'Опорная стойка',
    assetKey: 'support-column',
    body: { type: 'rectangle', width: 82, height: 92 },
    fixed: true
  },
  'button-red': {
    id: 'button-red',
    kind: 'button',
    displayName: 'Красная кнопка',
    assetKey: 'button-red',
    body: { type: 'rectangle', width: 96, height: 32 },
    fixed: true
  },
  'spring-yellow': {
    id: 'spring-yellow',
    kind: 'spring',
    displayName: 'Пружина',
    assetKey: 'spring-yellow',
    body: { type: 'rectangle', width: 72, height: 76 },
    fixed: true
  },
  'energy-receiver': {
    id: 'energy-receiver',
    kind: 'receiver',
    displayName: 'Энергопорт',
    assetKey: 'energy-receiver',
    body: { type: 'circle', radius: 62 },
    fixed: true
  }
};

export const getPart = (partId: string): PartDefinition => {
  const part = PARTS[partId];
  if (!part) throw new Error(`Unknown part: ${partId}`);
  return part;
};
