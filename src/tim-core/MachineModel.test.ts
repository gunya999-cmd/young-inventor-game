import { describe, expect, it } from 'vitest';
import { MachineModel } from './MachineModel';
import type { AnchorKind, PartInstance, PartKind } from './types';

function part(
  id: string,
  kind: PartKind = 'plank',
  anchorKind: AnchorKind = 'rope'
): PartInstance {
  return {
    id,
    definition: {
      kind,
      canRotate: true,
      canFlip: true,
      anchors: [
        { id: 'left', kind: anchorKind, localPosition: { x: -10, y: 0 } },
        { id: 'right', kind: anchorKind, localPosition: { x: 10, y: 0 } }
      ]
    },
    transform: { position: { x: 0, y: 0 }, angle: 0 },
    fixed: false,
    flipped: false,
    metadata: {}
  };
}

describe('MachineModel', () => {
  it('places and rotates parts freely without snapping them to a scripted slot', () => {
    const machine = new MachineModel();
    machine.addPart(part('plank'));

    machine.movePart('plank', { x: 347.25, y: 192.75 });
    machine.rotatePart('plank', 0.731);

    expect(machine.getPart('plank').transform).toEqual({
      position: { x: 347.25, y: 192.75 },
      angle: 0.731
    });
  });

  it('accepts a routed rope through compatible pulley anchors', () => {
    const machine = new MachineModel();
    machine.addPart(part('bucket', 'bucket'));
    machine.addPart(part('pulley', 'pulley'));
    machine.addPart(part('gate', 'wall'));

    machine.connect({
      id: 'rope-1',
      kind: 'rope',
      a: { partId: 'bucket', anchorId: 'right' },
      b: { partId: 'gate', anchorId: 'left' },
      route: [{ partId: 'pulley', anchorId: 'left' }],
      restLength: 420
    });

    expect(machine.getConnections()).toHaveLength(1);
    expect(machine.getConnections()[0]?.route).toEqual([
      { partId: 'pulley', anchorId: 'left' }
    ]);
  });

  it('rejects connections between incompatible anchor types', () => {
    const machine = new MachineModel();
    machine.addPart(part('rope-part', 'plank', 'rope'));
    machine.addPart(part('gear-part', 'gear', 'belt'));

    expect(() => machine.connect({
      id: 'invalid',
      kind: 'rope',
      a: { partId: 'rope-part', anchorId: 'right' },
      b: { partId: 'gear-part', anchorId: 'left' },
      restLength: 100
    })).toThrow('incompatible anchor types');
  });

  it('removes every connection that depends on a deleted part', () => {
    const machine = new MachineModel();
    machine.addPart(part('a'));
    machine.addPart(part('pulley', 'pulley'));
    machine.addPart(part('b'));
    machine.connect({
      id: 'rope',
      kind: 'rope',
      a: { partId: 'a', anchorId: 'right' },
      b: { partId: 'b', anchorId: 'left' },
      route: [{ partId: 'pulley', anchorId: 'left' }],
      restLength: 300
    });

    machine.removePart('pulley');

    expect(machine.getConnections()).toEqual([]);
  });

  it('locks construction edits while the simulation is running', () => {
    const machine = new MachineModel();
    machine.addPart(part('ball', 'ball'));
    machine.startSimulation();

    expect(() => machine.movePart('ball', { x: 10, y: 20 })).toThrow(
      'Machine can only be edited in build mode'
    );
  });

  it('restores the exact construction after a simulation is stopped', () => {
    const machine = new MachineModel();
    machine.addPart(part('ball', 'ball'));
    machine.movePart('ball', { x: 120, y: 80 });
    machine.rotatePart('ball', 0.25);
    const before = machine.captureSnapshot();

    machine.startSimulation();
    machine.applySimulationTransform('ball', {
      position: { x: 731, y: 642 },
      angle: 2.6
    });
    machine.pauseSimulation();
    machine.stopSimulation();

    expect(machine.mode).toBe('build');
    expect(machine.captureSnapshot()).toEqual(before);
  });

  it('returns deep snapshots that cannot mutate the live machine', () => {
    const machine = new MachineModel();
    machine.addPart(part('weight', 'weight'));
    const snapshot = machine.captureSnapshot();
    const mutable = snapshot.parts[0] as PartInstance;

    (mutable.transform.position as { x: number; y: number }).x = 999;

    expect(machine.getPart('weight').transform.position.x).toBe(0);
  });
});
