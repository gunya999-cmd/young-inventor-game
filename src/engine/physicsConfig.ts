export const PHYSICS_CONFIG = {
  gravity: 9.81,
  velocityIterations: 10,
  positionIterations: 4,
  rollingLinearDamping: 0.025,
  rollingAngularDamping: 0.025,
  defaultLinearDamping: 0.08,
  defaultAngularDamping: 0.12,
  heavyLinearDamping: 0.12,
  heavyAngularDamping: 0.18,
  spring: {
    travelPx: 48,
    stiffness: 125,
    damping: 7.5,
    maxForce: 190,
    plungerHalfWidthPx: 12,
    plungerHalfHeightPx: 19
  }
} as const;
