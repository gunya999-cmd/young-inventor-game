import { createInitialSnapshot, type MachineSnapshot } from './model';

const LEVER_START_ANGLE = 0.20;
const PLAYER_HINGE_LIMIT = Math.PI * 0.82;

/**
 * Canonical solution used only for regression testing and level authoring.
 * Every part, position, connection and hinge limit is constructible through the current player UI.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    { id: 'solution-lever', kind: 'lever', x: 655, y: 630, angle: LEVER_START_ANGLE, fixed: false },
    // Fixed sheave routes the falling counterweight into an upward pull on the lever's right arm.
    { id: 'solution-sheave', kind: 'sheave', x: 600, y: 300, angle: 0, fixed: true },
    { id: 'solution-catch', kind: 'plank', x: 985, y: 420, angle: 0.10, fixed: true },
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
  snapshot.ropes.push({
    id: 'solution-drive-rope',
    a: { partId: 'level-weight', localX: 0, localY: 0 },
    b: { partId: 'solution-lever', localX: 130, localY: 0 },
    maxLength: 900,
    pulleyPartId: 'solution-sheave',
    ratio: 1
  });
  return snapshot;
}
