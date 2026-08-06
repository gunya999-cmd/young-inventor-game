import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createCampaignStage01Physics, type Stage01Placement } from './campaignStage01Physics';

beforeAll(async () => {
  await RAPIER.init();
});

const DIRECT_RAMP_SOLUTION: Stage01Placement[] = [
  { id: 'r1', type: 'ramp', x: -3.08, y: 2.29, rotationZ: -0.25 },
  { id: 'r2', type: 'ramp', x: -0.28, y: 1.56, rotationZ: -0.25 },
  { id: 'p1', type: 'platform', x: 2.25, y: 0.52, rotationZ: 0 },
];

describe('Campaign Stage 01 free-build physics', () => {
  it('solves through a real ball trajectory for the reference ramp solution', () => {
    const sim = createCampaignStage01Physics(DIRECT_RAMP_SOLUTION);
    sim.advance(12);
    const p = sim.ballBody.translation();
    console.log('CAMPAIGN_STAGE01_DIRECT', { state: sim.state, ball: { x: p.x, y: p.y } });
    expect(sim.state.goalContact).toBe(true);
    expect(sim.state.won).toBe(true);
    sim.free();
  });

  it('does not award victory just because the simulation started', () => {
    const sim = createCampaignStage01Physics([]);
    sim.advance(0.25);
    expect(sim.state.goalContact).toBe(false);
    expect(sim.state.won).toBe(false);
    sim.free();
  });

  it('keeps the lever optional rather than requiring a scripted part sequence', () => {
    const sim = createCampaignStage01Physics(DIRECT_RAMP_SOLUTION);
    sim.advance(12);
    expect(sim.state.won).toBe(true);
    expect(sim.state.leverMoved).toBe(false);
    sim.free();
  });
});
