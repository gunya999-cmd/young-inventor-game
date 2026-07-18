import { describe, expect, it } from 'vitest';
import { createLevelSnapshot, LEVEL_INVENTORY, LEVEL_ROPES } from './levelOne';

describe('level one contract', () => {
  it('starts with one locked dynamic target ball', () => {
    const snapshot = createLevelSnapshot();
    expect(snapshot.parts).toHaveLength(1);
    expect(snapshot.parts[0].definition.kind).toBe('ball');
    expect(snapshot.parts[0].fixed).toBe(false);
    expect(snapshot.parts[0].metadata.locked).toBe(true);
  });

  it('offers several construction paths rather than scripted slots', () => {
    expect(LEVEL_INVENTORY.plank).toBeGreaterThanOrEqual(3);
    expect(LEVEL_INVENTORY.wall).toBeGreaterThanOrEqual(1);
    expect(LEVEL_ROPES).toBeGreaterThanOrEqual(1);
  });
});
