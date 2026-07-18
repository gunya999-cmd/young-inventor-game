import type { Connection, MachineSnapshot, PartInstance } from '../tim-core/types';
import { createPartInstance, type EditorPartKind } from './catalog';

export const GATE_LEVEL_ID = 'raise-gate-02';
export const GATE_LEVEL_TITLE = 'ПОДНИМИ ВОРОТА';
export const GATE_LEVEL_INVENTORY: Readonly<Record<EditorPartKind, number>> = {
  ball: 0,
  plank: 2,
  wall: 1,
  pulley: 2,
  weight: 1,
  lever: 2,
  hinge: 0,
  gate: 0
};
export const GATE_LEVEL_ROPES = 2;
export const GATE_LEVEL_HINGES = 2;

function locked(part: PartInstance): PartInstance {
  return { ...part, metadata: { ...part.metadata, locked: true, levelObject: true } };
}

export function createGateLevelSnapshot(): MachineSnapshot {
  const ball = locked(createPartInstance('ball', 'level-ball', { x: 170, y: 245 }));
  const gate = locked(createPartInstance('gate', 'level-gate', { x: 820, y: 520 }));
  const pin = locked(createPartInstance('hinge', 'level-gate-pin', { x: 820, y: 418 }));

  const gateHinge: Connection = {
    id: 'level-gate-hinge',
    kind: 'hinge',
    a: { partId: gate.id, anchorId: 'pivot' },
    b: { partId: pin.id, anchorId: 'pin' },
    localPointA: { x: 0, y: -102 },
    localPointB: { x: 0, y: 0 },
    referenceAngle: 0,
    minAngle: -Math.PI * 0.48,
    maxAngle: Math.PI * 0.48
  };

  return { parts: [ball, gate, pin], connections: [gateHinge] };
}
