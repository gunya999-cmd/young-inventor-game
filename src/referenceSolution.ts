import { createInitialSnapshot, type MachineSnapshot } from './model';

const LEVER_START_ANGLE = 0.12;
const PLAYER_HINGE_LIMIT = Math.PI * 0.82;

/**
 * Canonical solution used only for regression testing and level authoring.
 * Every position, angle and hinge limit is constructible through the current player UI.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Speed lever: the pivot sits left of center, so the target ball rides the long, fast right arm.
    { id: 'solution-lever', kind: 'lever', x: 655, y: 700, angle: LEVER_START_ANGLE, fixed: false },
    // Catch the launched ball after it clears the barrier.
    { id: 'solution-catch', kind: 'plank', x: 995, y: 430, angle: 0.10, fixed: true },
    // Guide it from the right side toward the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1285, y: 575, angle: 0.38, fixed: true }
  );
  snapshot.hinges.push({
    id: 'solution-hinge',
    partId: 'solution-lever',
    localX: -50,
    localY: 0,
    referenceAngle: LEVER_START_ANGLE,
    lowerAngle: -PLAYER_HINGE_LIMIT,
    upperAngle: PLAYER_HINGE_LIMIT
  });
  return snapshot;
}
