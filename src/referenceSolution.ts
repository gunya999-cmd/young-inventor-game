import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Canonical solution used only for regression testing and level authoring.
 * It is deliberately built from the same pieces the player receives.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Centered pivot keeps the empty lever neutral. The ball falls through the level's drop shaft onto the right arm.
    { id: 'solution-lever', kind: 'lever', x: 655, y: 690, angle: 0, fixed: false },
    // Catch the launched ball after it clears the barrier.
    { id: 'solution-catch', kind: 'plank', x: 995, y: 430, angle: 0.10, fixed: true },
    // Continue from the right bench down into the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1285, y: 575, angle: 0.38, fixed: true }
  );
  snapshot.hinges.push({
    id: 'solution-hinge',
    partId: 'solution-lever',
    localX: 0,
    localY: 0,
    referenceAngle: 0,
    lowerAngle: -1.05,
    upperAngle: 0.65
  });
  return snapshot;
}
