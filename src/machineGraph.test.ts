import { describe, expect, it } from 'vitest';
import { MachineGraph, type MachinePartNode } from './machineGraph';

function part(
  id: string,
  mechanicId: string,
  ports: MachinePartNode['ports'],
  x = 0,
): MachinePartNode {
  return {
    id,
    mechanicId,
    layer: 'main',
    ports,
    transform: { x, y: 1, z: 0, rotationZ: 0 },
  };
}

describe('MachineGraph', () => {
  it('connects compatible generic ports and cascades connections when a part is removed', () => {
    const graph = new MachineGraph();
    graph.addPart(part('switch-1', 'toggle-switch', [
      { id: 'power-out', kind: 'electrical', role: 'output' },
    ]));
    graph.addPart(part('motor-1', 'motor', [
      { id: 'power-in', kind: 'electrical', role: 'input' },
      { id: 'shaft', kind: 'belt-shaft', role: 'output' },
    ], 2));

    graph.connect({
      id: 'wire-1',
      kind: 'electrical',
      from: { partId: 'switch-1', portId: 'power-out' },
      to: { partId: 'motor-1', portId: 'power-in' },
    });

    expect(graph.listConnections()).toHaveLength(1);
    graph.removePart('switch-1');
    expect(graph.listConnections()).toHaveLength(0);
    expect(graph.listParts().map((item) => item.id)).toEqual(['motor-1']);
  });

  it('rejects incompatible port kinds and roles', () => {
    const graph = new MachineGraph();
    graph.addPart(part('generator-1', 'generator', [
      { id: 'power-out', kind: 'electrical', role: 'output' },
    ]));
    graph.addPart(part('switch-1', 'toggle-switch', [
      { id: 'power-out', kind: 'electrical', role: 'output' },
    ]));

    const result = graph.validateConnection({
      id: 'bad-wire',
      kind: 'electrical',
      from: { partId: 'generator-1', portId: 'power-out' },
      to: { partId: 'switch-1', portId: 'power-out' },
    });
    expect(result.ok).toBe(false);
  });

  it('restores an immutable build snapshot', () => {
    const graph = new MachineGraph();
    graph.addPart(part('anchor-1', 'anchor', [
      { id: 'rope', kind: 'rope-anchor', role: 'bidirectional' },
    ]));
    graph.addPart(part('lever-1', 'lever', [
      { id: 'rope-left', kind: 'rope-anchor', role: 'bidirectional' },
    ], 2));
    graph.connect({
      id: 'rope-link-1',
      kind: 'rope-anchor',
      from: { partId: 'anchor-1', portId: 'rope' },
      to: { partId: 'lever-1', portId: 'rope-left' },
    });

    const snapshot = graph.snapshot();
    graph.updatePartTransform('lever-1', { x: 9, y: 4 });
    graph.removePart('anchor-1');
    expect(graph.listConnections()).toHaveLength(0);

    graph.restore(snapshot);
    expect(graph.getPart('lever-1')?.transform.x).toBe(2);
    expect(graph.listConnections()).toHaveLength(1);
  });

  it('prevents connected same-layer mechanics from being silently moved into another depth channel', () => {
    const graph = new MachineGraph();
    graph.addPart(part('generator-1', 'generator', [
      { id: 'power-out', kind: 'electrical', role: 'output' },
    ]));
    graph.addPart(part('motor-1', 'motor', [
      { id: 'power-in', kind: 'electrical', role: 'input' },
    ]));
    graph.connect({
      id: 'wire-1',
      kind: 'electrical',
      from: { partId: 'generator-1', portId: 'power-out' },
      to: { partId: 'motor-1', portId: 'power-in' },
    });

    expect(() => graph.movePartToLayer('motor-1', 'front')).toThrow(/connected same-layer part/);
  });
});
