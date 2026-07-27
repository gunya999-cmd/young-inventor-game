import { createInitialSnapshot, type MachineSnapshot } from './model';

const LEVER_START_ANGLE = 0.20;
const PLAYER_HINGE_LIMIT = Math.PI * 0.82;

/**
 * Canonical solution used only for regression testing and level authoring.
 * Every position, angle and hinge limit is constructible through the current player UI.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Raised speed lever: a slightly left-shifted pivot gives the ball a longer, faster right arm.
    { id: 'solution-lever', kind: 'lever', x: 655, y: 630, angle: LEVER_START_ANGLE, fixed: false },
    // Catch the launched ball immediately after it clears the barrier.
    { id: 'solution-catch', kind: 'plank', x: 985, y: 420, angle: 0.10, fixed: true },
    // Guide it from the right side toward the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1285, y: 575, angle: 0.38, fixed: true }
  );
  snapshot.hinges.push({
    id: 'solution-hinge',
    partId: 'solution-lever',
    localX: -20,
    localY: 0,
    referenceAngle: LEVER_START_ANGLE,
    lowerAngle: -PLAYER_HINGE_LIMIT,
    upperAngle: PLAYER_HINGE_LIMIT
  });
  return snapshot;
}
