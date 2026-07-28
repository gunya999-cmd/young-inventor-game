import { describe, expect, it } from 'vitest';
import { ACTIVE_LEVEL } from './level';
import { PARTS, createInitialSnapshot } from './model';
import { PhysicsEngine } from './physics';

const STEP = 1 / 120;

function run(engine: PhysicsEngine, frames: number): void {
  for (let index = 0; index < frames; index += 1) engine.step(STEP);
}

describe('level 07 · impulse and moment', () => {
  it('uses one authored screen-space angle convention for the start rail', () => {
    const rail = ACTIVE_LEVEL.platforms.find((platform) => platform.id === 'start-rail');
    expect(rail).toBeDefined();
    expect(rail!.angle).toBeGreaterThan(0);

    const engine = new PhysicsEngine(createInitialSnapshot());
    const startX = engine.partTransform('target-ball')!.position.x;
    run(engine, 150);
    const endX = engine.partTransform('target-ball')!.position.x;
    expect(endX).toBeGreaterThan(startX + 30);
  });

  it('makes the central barrier impossible to bypass underneath with the target ball', () => {
    const barrier = ACTIVE_LEVEL.platforms.find((platform) => platform.id === 'barrier')!;
    const floor = ACTIVE_LEVEL.platforms.find((platform) => platform.id === 'floor')!;
    const barrierBottom = barrier.y + barrier.height / 2;
    const floorTop = floor.y - floor.height / 2;
    const physicalGap = floorTop - barrierBottom;
    expect(physicalGap).toBeLessThan((PARTS.ball.radius ?? 28) * 2);
  });

  it('requires a meaningful but playable lift above the left bench', () => {
    const barrier = ACTIVE_LEVEL.platforms.find((platform) => platform.id === 'barrier')!;
    const bench = ACTIVE_LEVEL.platforms.find((platform) => platform.id === 'left-bench')!;
    const barrierTop = barrier.y - barrier.height / 2;
    const ballRadius = PARTS.ball.radius ?? 28;
    const requiredCenterHeight = barrierTop - ballRadius;
    const requiredLift = bench.y - requiredCenterHeight;
    expect(requiredLift).toBeGreaterThan(55);
    expect(requiredLift).toBeLessThan(75);
  });

  it('keeps the supplied weight on its latch before the control button is activated', () => {
    const engine = new PhysicsEngine(createInitialSnapshot());
    const startY = engine.partTransform('level-weight')!.position.y;
    run(engine, 100);
    const endY = engine.partTransform('level-weight')!.position.y;
    expect(engine.deviceActive('level-button')).toBe(false);
    expect(engine.deviceActive('level-latch')).toBe(false);
    expect(endY).toBeLessThan(startY + 35);
  });

  it('does not solve itself when the player presses Run without building anything', () => {
    const engine = new PhysicsEngine(createInitialSnapshot());
    run(engine, 1200);
    expect(engine.hasWon()).toBe(false);
  });
});
