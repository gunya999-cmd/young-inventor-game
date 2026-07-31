export const PHYSICS_CONFIG = {
  gravity: 9.81,
  velocityIterations: 12,
  positionIterations: 6,
  maxSubstepSeconds: 1 / 120,
  maxFrameSeconds: 1 / 20,
  maxLinearSpeed: 42,
  maxAngularSpeed: 32,
  rollingLinearDamping: 0.025,
  rollingAngularDamping: 0.025,
  defaultLinearDamping: 0.08,
  defaultAngularDamping: 0.12,
  leverLinearDamping: 0.045,
  leverAngularDamping: 0.065,
  heavyLinearDamping: 0.075,
  heavyAngularDamping: 0.12,
  spring: {
    travelPx: 48,
    stiffness: 125,
    damping: 7.5,
    maxForce: 190,
    plungerHalfWidthPx: 12,
    plungerHalfHeightPx: 19
  }
} as const;
