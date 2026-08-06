import { describe, expect, it } from 'vitest';
import { CAMPAIGN_STAGE_01_DEFINITION, CAMPAIGN_STAGE_01_MECHANICS } from './campaignStage01Definition';

describe('Campaign Stage 01 definition', () => {
  it('uses only registered generic clean-room mechanics', () => {
    expect(CAMPAIGN_STAGE_01_DEFINITION.mechanics).toHaveLength(CAMPAIGN_STAGE_01_MECHANICS.length);
    expect(CAMPAIGN_STAGE_01_DEFINITION.mechanics.map((mechanic) => mechanic.id)).toEqual([...CAMPAIGN_STAGE_01_MECHANICS]);
  });

  it('is explicitly a multiple-solution free-build level', () => {
    expect(CAMPAIGN_STAGE_01_DEFINITION.solutionPolicy).toBe('multiple-valid-solutions');
    expect(CAMPAIGN_STAGE_01_DEFINITION.editor).toContain('free-xy-275d');
    expect(CAMPAIGN_STAGE_01_DEFINITION.inventory.ramp).toBeGreaterThanOrEqual(2);
  });
});
