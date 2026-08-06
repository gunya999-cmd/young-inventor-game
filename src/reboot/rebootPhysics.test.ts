import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { canonicalRebootSolution, createRebootPhysics } from './rebootPhysics';

beforeAll(async () => { await RAPIER.init(); });

describe('clean reboot Level 1', () => {
  it('does not self-solve without the player transmission and ramps', () => {
    const sim = createRebootPhysics([], []);
    sim.advance(5);
    expect(sim.state.won).toBe(false);
    sim.free();
  });

  it('canonical benchmark solution reaches the goal through Rapier physics', () => {
    const solution = canonicalRebootSolution();
    const sim = createRebootPhysics(solution.parts, solution.belts);
    sim.advance(12);
    expect(sim.state.poweredConveyors.size).toBe(3);
    expect(sim.state.won).toBe(true);
    expect(sim.state.goalContact).toBe(true);
    sim.free();
  });
});
