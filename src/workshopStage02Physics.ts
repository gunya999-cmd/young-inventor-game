import RAPIER from '@dimforge/rapier3d-compat';

export type Stage02PhysicsState = {
  leverActivated: boolean;
  ropePulled: boolean;
  weightPressed: boolean;
  goalPowered: boolean;
};

export type Stage02Physics = {
  world: any;
  heavyBody: any;
  lightBody: any;
  leverBody: any;
  weightBody: any;
  state: Stage02PhysicsState;
  step: () => void;
  advance: (seconds: number) => void;
  free: () => void;
};

const DT = 1 / 120;

export function createStage02Physics(): Stage02Physics {
  const world: any = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const events = new RAPIER.EventQueue(true);
  const state: Stage02PhysicsState = {
    leverActivated: false,
    ropePulled: false,
    weightPressed: false,
    goalPowered: false,
  };

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(7, 0.08, 4.5)
      .setTranslation(0, -0.08, 0)
      .setFriction(0.72)
  );

  // Ramp slopes down toward the lever. The right lip is almost level with the
  // top of the lever so the heavy ball transfers its momentum through contact.
  const rampAngle = -0.19;
  const half = rampAngle * 0.5;
  const rampBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(-3.55, 1.05, 0)
      .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.48, 0.09, 0.50)
      .setFriction(0.60)
      .setRestitution(0.02),
    rampBody
  );

  // Real revolute lever. The beam is deliberately light compared with the
  // incoming steel ball; the light ball is small enough not to pre-tip it.
  const leverAnchor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(-0.75, 0.74, 0)
  );
  const leverBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-0.75, 0.74, 0)
      .setAngularDamping(0.34)
      .setLinearDamping(0.02)
      .setCanSleep(false)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.60, 0.10, 0.22)
      .setTranslation(0, 0.30, 0)
      .setDensity(0.95)
      .setFriction(0.50)
      .setRestitution(0.04),
    leverBody
  );
  const leverJoint = world.createImpulseJoint(
    RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 }
    ),
    leverAnchor,
    leverBody,
    true
  ) as any;
  leverJoint.setLimits(-0.42, 0.42);

  const heavyBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-4.72, 1.78, 0)
      .setCcdEnabled(true)
      .setLinearDamping(0.008)
      .setAngularDamping(0.008)
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(0.34)
      .setDensity(10.0)
      .setFriction(0.62)
      .setRestitution(0.03),
    heavyBody
  );

  // The light ball initially rests directly above the right arm of the lever.
  // The player platform is deliberately below it: it no longer blocks rotation.
  const lightBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0.56, 1.40, 0)
      .setCcdEnabled(true)
      .setLinearDamping(0.008)
      .setAngularDamping(0.008)
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(0.24)
      .setDensity(0.68)
      .setFriction(0.40)
      .setRestitution(0.42),
    lightBody
  );

  // A low safety platform catches a missed light ball but never intersects the
  // lever beam. This fixes the V2 geometry that physically locked the lever.
  const platformBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0.76, 0.56, 0)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.55, 0.05, 0.38).setFriction(0.42),
    platformBody
  );

  // Pull ring is a genuine collision sensor. The ball has to physically enter
  // it; there is no coordinate/proximity success condition.
  const pullBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(1.22, 1.46, 0)
  );
  const pullSensor = world.createCollider(
    RAPIER.ColliderDesc.ball(0.38)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    pullBody
  );

  // Weight is held by the rope until the pull ring gets a real collision.
  const weightBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(3.18, 1.92, 0)
      .setGravityScale(0)
      .setCcdEnabled(true)
      .setLinearDamping(0.04)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.34, 0.32)
      .setDensity(6.5)
      .setFriction(0.60)
      .setRestitution(0.01),
    weightBody
  );

  const buttonBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(3.18, 0.28, 0)
  );
  const buttonSensor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.35, 0.14, 0.31)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    buttonBody
  );

  const step = (): void => {
    world.timestep = DT;
    world.step(events);

    events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      const hitsPull = a === pullSensor.handle || b === pullSensor.handle;
      if (hitsPull && !state.ropePulled) {
        state.ropePulled = true;
        weightBody.setGravityScale(1, true);
      }

      const hitsButton = a === buttonSensor.handle || b === buttonSensor.handle;
      if (hitsButton && state.ropePulled && !state.weightPressed) {
        state.weightPressed = true;
        state.goalPowered = true;
      }
    });

    if (!state.leverActivated) {
      const av = leverBody.angvel();
      if (Math.abs(av.z) > 0.45) state.leverActivated = true;
    }
  };

  const advance = (seconds: number): void => {
    const steps = Math.max(0, Math.ceil(seconds / DT));
    for (let i = 0; i < steps && !state.goalPowered; i += 1) step();
  };

  const free = (): void => {
    try { world.free(); } catch { /* already freed */ }
  };

  return { world, heavyBody, lightBody, leverBody, weightBody, state, step, advance, free };
}
