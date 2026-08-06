import { describe, expect, it } from 'vitest';
import { MECHANICS_CATALOG, MECHANICS_BY_ID, STAGE_02_MECHANICS, requireMechanic } from './mechanicsCatalog';

describe('clean-room mechanics catalog', () => {
  it('has unique stable ids', () => {
    const ids = MECHANICS_CATALOG.map((mechanic) => mechanic.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MECHANICS_BY_ID.size).toBe(ids.length);
  });

  it('gives every mechanic a complete functional contract', () => {
    for (const mechanic of MECHANICS_CATALOG) {
      expect(mechanic.label.length).toBeGreaterThan(2);
      expect(mechanic.inputs.length).toBeGreaterThan(0);
      expect(mechanic.outputs.length).toBeGreaterThan(0);
      expect(mechanic.connections.length).toBeGreaterThan(0);
      expect(mechanic.physicsSummary.length).toBeGreaterThan(15);
      expect(mechanic.states.length).toBeGreaterThan(0);
    }
  });

  it('maps Stage 02 only to registered generic mechanics', () => {
    for (const id of STAGE_02_MECHANICS) {
      expect(() => requireMechanic(id)).not.toThrow();
    }
    expect(STAGE_02_MECHANICS).toContain('lever');
    expect(STAGE_02_MECHANICS).toContain('pressure-trigger');
    expect(STAGE_02_MECHANICS).toContain('goal-receiver');
  });

  it('keeps the P0 foundation broad enough for a systemic sandbox', () => {
    const p0 = MECHANICS_CATALOG.filter((mechanic) => mechanic.priority === 'P0');
    const categories = new Set(p0.map((mechanic) => mechanic.category));
    expect(p0.length).toBeGreaterThanOrEqual(14);
    expect(categories.has('body')).toBe(true);
    expect(categories.has('machine')).toBe(true);
    expect(categories.has('transmission')).toBe(true);
    expect(categories.has('trigger')).toBe(true);
    expect(categories.has('energy')).toBe(true);
    expect(categories.has('goal')).toBe(true);
  });
});
