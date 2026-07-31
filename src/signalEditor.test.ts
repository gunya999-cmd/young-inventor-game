import { describe, expect, it } from 'vitest';
import { addSignalLink, removeSignalLink, signalActionForTarget } from './signalEditor';
import type { MachineSnapshot } from './model';

function snapshot(): MachineSnapshot {
  return {
    parts: [
      { id: 'switch-a', kind: 'switch', x: 100, y: 100, angle: 0, fixed: true },
      { id: 'button-a', kind: 'button', x: 150, y: 100, angle: 0, fixed: true },
      { id: 'fan-a', kind: 'pulley', x: 300, y: 100, angle: 0, fixed: true },
      { id: 'latch-a', kind: 'latch', x: 400, y: 100, angle: 0, fixed: true },
      { id: 'ball-a', kind: 'ball', x: 500, y: 100, angle: 0, fixed: false }
    ],
    ropes: [],
    hinges: [],
    signals: []
  };
}

describe('signal editor', () => {
  it('chooses the only valid action for a target', () => {
    expect(signalActionForTarget('pulley')).toBe('activate');
    expect(signalActionForTarget('magnet')).toBe('activate');
    expect(signalActionForTarget('latch')).toBe('release');
    expect(signalActionForTarget('ball')).toBeNull();
  });

  it('creates unique source-to-device links', () => {
    const machine = snapshot();
    expect(addSignalLink(machine, 'switch-a', 'fan-a')).toBe(true);
    expect(machine.signals?.[0]).toMatchObject({ sourcePartId: 'switch-a', targetPartId: 'fan-a', action: 'activate' });
    expect(addSignalLink(machine, 'switch-a', 'fan-a')).toBe(false);
    expect(addSignalLink(machine, 'ball-a', 'fan-a')).toBe(false);
    expect(addSignalLink(machine, 'button-a', 'latch-a')).toBe(true);
    expect(machine.signals?.[1]).toMatchObject({ action: 'release' });
  });

  it('rejects incompatible actions and removes links by id', () => {
    const machine = snapshot();
    expect(addSignalLink(machine, 'switch-a', 'latch-a', 'activate')).toBe(false);
    expect(addSignalLink(machine, 'switch-a', 'ball-a')).toBe(false);
    expect(addSignalLink(machine, 'switch-a', 'fan-a')).toBe(true);
    const id = machine.signals?.[0].id ?? '';
    expect(removeSignalLink(machine, id)).toBe(true);
    expect(machine.signals).toEqual([]);
    expect(removeSignalLink(machine, id)).toBe(false);
  });
});
