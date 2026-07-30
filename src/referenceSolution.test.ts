import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { createLevel07ReferenceSolution } from './referenceSolution';

const STEP = 1 / 120;

describe('level 07 geometry-control solution', () => {
  it('provides a legal player-buildable physical path from start to receiver', () => {
    const snapshot = createLevel07ReferenceSolution();
    const playerParts = snapshot.parts.filter((part) => !part.locked);
    expect(playerParts).toHaveLength(3);
    expect(playerParts.every((part) => part.kind === 'plank' && part.fixed)).toBe(true);
    expect(snapshot.ropes).toHaveLength(0);
    expect(snapshot.hinges).toHaveLength(0);

    const engine = new PhysicsEngine(snapshot);
    let minimumBallY = Number.POSITIVE_INFINITY;
    let maximumBallX = Number.NEGATIVE_INFINITY;
    let stateAtMaximumX: { frame: number; x: number; y: number; vx: number; vy: number } | null = null;
    let firstOutOfBounds: { frame: number; x: number; y: number } | null = null;
    let wonFrame = -1;

    for (let frame = 0; frame < 2400; frame += 1) {
      engine.step(STEP);
      const ball = engine.partTransform('target-ball')!;
      const motion = engine.partKinematics('target-ball')!;
      minimumBallY = Math.min(minimumBallY, ball.position.y);
      if (ball.position.x > maximumBallX) {
        maximumBallX = ball.position.x;
        stateAtMaximumX = {
          frame,
          x: ball.position.x,
          y: ball.position.y,
          vx: motion.velocity.x,
          vy: motion.velocity.y
        };
      }
      if (!firstOutOfBounds && (ball.position.x < -50 || ball.position.x > 1650 || ball.position.y > 950)) {
        firstOutOfBounds = { frame, x: ball.position.x, y: ball.position.y };
      }
      if (engine.hasWon()) {
        wonFrame = frame;
        break;
      }
    }

    const finalBall = engine.partTransform('target-ball')!;
    console.log('LEVEL07_GEOMETRY_DIAGNOSTICS', {
      wonFrame,
      minimumBallY: Math.round(minimumBallY),
      maximumBallX: Math.round(maximumBallX),
      stateAtMaximumX: stateAtMaximumX && {
        frame: stateAtMaximumX.frame,
        x: Math.round(stateAtMaximumX.x),
        y: Math.round(stateAtMaximumX.y),
        vx: Number(stateAtMaximumX.vx.toFixed(2)),
        vy: Number(stateAtMaximumX.vy.toFixed(2))
      },
      firstOutOfBounds: firstOutOfBounds && {
        frame: firstOutOfBounds.frame,
        x: Math.round(firstOutOfBounds.x),
        y: Math.round(firstOutOfBounds.y)
      },
      finalBall: { x: Math.round(finalBall.position.x), y: Math.round(finalBall.position.y) }
    });

    expect(minimumBallY).toBeLessThan(357);
    expect(maximumBallX).toBeGreaterThan(825);
    expect(wonFrame).toBeGreaterThan(0);
  });
});
