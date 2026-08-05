import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { createStage02Physics } from './workshopStage02Physics';

beforeAll(async () => {
  await RAPIER.init();
});

describe('Stage 02 physical chain', () => {
  it('transfers a real collision chain from heavy ball to the final button', () => {
    const sim = createStage02Physics();
    sim.advance(12);

    const heavy = sim.heavyBody.translation();
    const light = sim.lightBody.translation();
    const weight = sim.weightBody.translation();
    console.log('STAGE02_PHYSICS', {
      state: sim.state,
      heavy: { x: heavy.x, y: heavy.y },
      light: { x: light.x, y: light.y },
      weight: { x: weight.x, y: weight.y },
      leverAngularVelocity: sim.leverBody.angvel().z,
    });

    expect(sim.state.leverActivated).toBe(true);
    expect(sim.state.ropePulled).toBe(true);
    expect(sim.state.weightPressed).toBe(true);
    expect(sim.state.goalPowered).toBe(true);
    sim.free();
  });

  it('does not solve itself before the heavy ball has time to reach the lever', () => {
    const sim = createStage02Physics();
    sim.advance(0.15);
    expect(sim.state.ropePulled).toBe(false);
    expect(sim.state.weightPressed).toBe(false);
    expect(sim.state.goalPowered).toBe(false);
    sim.free();
  });
});
