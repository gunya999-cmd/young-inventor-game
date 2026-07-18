import { describe, expect, it } from 'vitest';
import { createGateLevelSnapshot, GATE_LEVEL_HINGES, GATE_LEVEL_INVENTORY } from './levelGate';

describe('raise gate level', () => {
  it('starts with one locked ball and a physically hinged gate', () => {
    const snapshot = createGateLevelSnapshot();
    expect(snapshot.parts.find((part) => part.id === 'level-ball')?.metadata.locked).toBe(true);
    expect(snapshot.parts.find((part) => part.id === 'level-gate')?.fixed).toBe(false);
    expect(snapshot.connections).toContainEqual(expect.objectContaining({
      id: 'level-gate-hinge',
      kind: 'hinge',
      minAngle: expect.any(Number),
      maxAngle: expect.any(Number)
    }));
  });

  it('gives the player levers and two movable fulcrums but no replacement goal objects', () => {
    expect(GATE_LEVEL_INVENTORY.lever).toBe(2);
    expect(GATE_LEVEL_HINGES).toBe(2);
    expect(GATE_LEVEL_INVENTORY.ball).toBe(0);
    expect(GATE_LEVEL_INVENTORY.gate).toBe(0);
  });
});
