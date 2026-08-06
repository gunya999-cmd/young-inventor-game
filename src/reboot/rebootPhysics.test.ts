import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { canonicalRebootSolution, createRebootPhysics } from './rebootPhysics';

beforeAll(async () => { await RAPIER.init(); });

describe('clean reboot Level 1', () => {
  it('does not self-solve without player parts', () => {
    const sim = createRebootPhysics([], []);
    sim.advance(5);
    expect(sim.state.won).toBe(false);
    sim.free();
  });

  it('canonical benchmark solution reaches the goal through Rapier physics', () => {
    const solution = canonicalRebootSolution();
    const sim = createRebootPhysics(solution.parts, solution.belts);
    const trace: Array<{ second: number; x: number; y: number; vx: number; vy: number; won: boolean; out: boolean }> = [];
    for (let second = 1; second <= 12 && !sim.state.won && !sim.state.ballOut; second += 1) {
      sim.advance(1);
      const p = sim.ballBody.translation();
      const v = sim.ballBody.linvel();
      trace.push({ second, x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)), vx: Number(v.x.toFixed(3)), vy: Number(v.y.toFixed(3)), won: sim.state.won, out: sim.state.ballOut });
    }
    console.log('REBOOT_LEVEL_1_TRACE', JSON.stringify(trace));
    expect(sim.state.poweredConveyors.size).toBe(3);
    expect(sim.state.won).toBe(true);
    expect(sim.state.goalContact).toBe(true);
    sim.free();
  });
});
