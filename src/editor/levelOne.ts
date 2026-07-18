import type { MachineSnapshot, PartInstance } from '../tim-core/types';
import { createPartInstance, type EditorPartKind } from './catalog';

export const LEVEL_ID = 'ball-to-basket-01';
export const LEVEL_TITLE = 'ДОСТАВЬ ШАР В КОРЗИНУ';
export const LEVEL_INVENTORY: Readonly<Record<EditorPartKind, number>> = {
  ball: 1,
  plank: 4,
  wall: 2,
  pulley: 2,
  weight: 1
};
export const LEVEL_ROPES = 2;

function locked(part: PartInstance): PartInstance {
  return {
    ...part,
    metadata: { ...part.metadata, locked: true, levelObject: true }
  };
}

export function createLevelSnapshot(): MachineSnapshot {
  return {
    parts: [locked(createPartInstance('ball', 'level-ball', { x: 132, y: 196 }))],
    connections: []
  };
}
