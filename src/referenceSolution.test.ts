import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { createLevel07ReferenceSolution } from './referenceSolution';

const STEP = 1 / 120;

describe('level 07 canonical solution', () => {
  it('completes the entire level using only physical interactions', () => {
    const engine = new PhysicsEngine(createLevel07ReferenceSolution());
    let minimumBallYAfterButton = Number.POSITIVE_INFINITY;
    let maximumBallX = Number.NEGATIVE_INFINITY;
    let minimumLeverAngle = Number.POSITIVE_INFINITY;
    let maximumLeverAngle = Number.NEGATIVE_INFINITY;
    let maximumUpwardBallSpeed = 0;
    let maximumRightwardBallSpeed = 0;
    let maximumLeverAngularSpeed = 0;
    let buttonFrame = -1;
    let wonFrame = -1;
    let ballAtButton: { x: number; y: number } | null = null;

    for (let frame = 0; frame < 2400; frame += 1) {
      engine.step(STEP);
      const ball = engine.partTransform('target-ball')!;
      const ballMotion = engine.partKinematics('target-ball')!;
      const lever = engine.partTransform('solution-lever')!;
      const leverMotion = engine.partKinematics('solution-lever')!;
      maximumBallX = Math.max(maximumBallX, ball.position.x);
      minimumLeverAngle = Math.min(minimumLeverAngle, lever.angle);
      maximumLeverAngle = Math.max(maximumLeverAngle, lever.angle);
      maximumLeverAngularSpeed = Math.max(maximumLeverAngularSpeed, Math.abs(leverMotion.angularVelocity));
      if (buttonFrame < 0 && engine.deviceActive('level-button')) {
        buttonFrame = frame;
        ballAtButton = { x: ball.position.x, y: ball.position.y };
      }
      if (buttonFrame >= 0) {
        minimumBallYAfterButton = Math.min(minimumBallYAfterButton, ball.position.y);
        maximumUpwardBallSpeed = Math.max(maximumUpwardBallSpeed, -ballMotion.velocity.y);
        maximumRightwardBallSpeed = Math.max(maximumRightwardBallSpeed, ballMotion.velocity.x);
      }
      if (engine.hasWon()) {
        wonFrame = frame;
        break;
      }
    }

    const finalBall = engine.partTransform('target-ball')!;
    console.log('LEVEL07_REFERENCE_DIAGNOSTICS', {
      wonFrame,
      buttonFrame,
      ballAtButton: ballAtButton && { x: Math.round(ballAtButton.x), y: Math.round(ballAtButton.y) },
      minimumBallYAfterButton: Number.isFinite(minimumBallYAfterButton) ? Math.round(minimumBallYAfterButton) : null,
      maximumBallX: Math.round(maximumBallX),
      maximumUpwardBallSpeed: Math.round(maximumUpwardBallSpeed),
      maximumRightwardBallSpeed: Math.round(maximumRightwardBallSpeed),
      maximumLeverAngularSpeed: Number(maximumLeverAngularSpeed.toFixed(2)),
      finalBall: { x: Math.round(finalBall.position.x), y: Math.round(finalBall.position.y) },
      leverAnglesDeg: {
        min: Math.round(minimumLeverAngle * 180 / Math.PI),
        max: Math.round(maximumLeverAngle * 180 / Math.PI)
      },
      latchReleased: engine.deviceActive('level-latch')
    });

    expect(buttonFrame).toBeGreaterThan(0);
    expect(ballAtButton).not.toBeNull();
    expect(ballAtButton!.x).toBeGreaterThan(700);
    expect(engine.deviceActive('level-latch')).toBe(true);
    expect(minimumBallYAfterButton).toBeLessThan(357);
    expect(maximumBallX).toBeGreaterThan(825);
    expect(wonFrame).toBeGreaterThan(0);
  });
});
