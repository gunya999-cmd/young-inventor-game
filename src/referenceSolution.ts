import { createInitialSnapshot, type MachineSnapshot } from './model';

const LEVER_START_ANGLE = 0.15;

/**
 * Canonical solution used only for regression testing and level authoring.
 * It is deliberately built from the same pieces the player receives.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // The pivot is shifted toward the ball. The level's second latch supports the long arm until the button releases it.
    { id: 'solution-lever', kind: 'lever', x: 655, y: 700, angle: LEVER_START_ANGLE, fixed: false },
    { id: 'solution-catch', kind: 'plank', x: 995, y: 430, angle: 0.10, fixed: true },
    { id: 'solution-exit', kind: 'plank', x: 1285, y: 575, angle: 0.38, fixed: true }
  );
  snapshot.hinges.push({
    id: 'solution-hinge',
    partId: 'solution-lever',
    localX: 50,
    localY: 0,
    referenceAngle: LEVER_START_ANGLE,
    lowerAngle: -1.05,
    upperAngle: 0.65
  });
  return snapshot;
}
