import RAPIER from '@dimforge/rapier3d-compat';

export type Stage01PartType = 'ramp' | 'lever' | 'platform';

export type Stage01Placement = {
  id: string;
  type: Stage01PartType;
  x: number;
  y: number;
  rotationZ: number;
};

export type Stage01PhysicsState = {
  won: boolean;
  goalContact: boolean;
  ballOut: boolean;
  leverMoved: boolean;
};

export type Stage01Physics = {
  world: any;
  ballBody: any;
  leverBodies: ReadonlyMap<string, any>;
  state: Stage01PhysicsState;
  step: () => void;
  advance: (seconds: number) => void;
  free: () => void;
};

const DT = 1 / 120;

function quatZ(angle: number): { x: number; y: number; z: number; w: number } {
  const half = angle * 0.5;
  return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
}

export function createCampaignStage01Physics(placements: readonly Stage01Placement[]): Stage01Physics {
  const world: any = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const events = new RAPIER.EventQueue(true);
  const state: Stage01PhysicsState = { won: false, goalContact: false, ballOut: false, leverMoved: false };

  // MAIN-layer physics corridor. Visuals remain full 3D, but accidental depth
  // drift cannot make a valid-looking construction miss its collider.
  world.createCollider(RAPIER.ColliderDesc.cuboid(6.3, 0.08, 1.0).setTranslation(0, -0.08, 0).setFriction(0.72));
  world.createCollider(RAPIER.ColliderDesc.cuboid(6.3, 3.5, 0.04).setTranslation(0, 2.3, -0.52));
  world.createCollider(RAPIER.ColliderDesc.cuboid(6.3, 3.5, 0.04).setTranslation(0, 2.3, 0.52));

  // Slightly tilted start shelf releases the ball through gravity alone.
  const shelfAngle = -0.10;
  const startShelf = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(-4.75, 2.72, 0)
      .setRotation(quatZ(shelfAngle))
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.92, 0.08, 0.44).setFriction(0.48), startShelf);

  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-5.18, 3.14, 0)
      .setCcdEnabled(true)
      .setLinearDamping(0.006)
      .setAngularDamping(0.006)
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(0.34).setDensity(7.8).setFriction(0.56).setRestitution(0.06),
    ballBody
  );

  // Open-sided catch tray: the player can roll the ball into it horizontally
  // or drop it from above. A real collision sensor inside is the only win path.
  const goalBase = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(4.55, 0.62, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.72, 0.10, 0.48).setTranslation(0, -0.42, 0).setFriction(0.64), goalBase);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.09, 0.55, 0.48).setTranslation(0.70, 0, 0), goalBase);
  const goalSensor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.54, 0.30, 0.42)
      .setTranslation(-0.06, -0.08, 0)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    goalBase
  );

  const leverBodies = new Map<string, any>();

  for (const part of placements) {
    if (part.type === 'ramp') {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(part.x, part.y, 0)
          .setRotation(quatZ(part.rotationZ))
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(1.47, 0.11, 0.48).setFriction(0.58).setRestitution(0.02),
        body
      );
    } else if (part.type === 'platform') {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(part.x, part.y, 0)
          .setRotation(quatZ(part.rotationZ))
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.52, 0.09, 0.39).setFriction(0.62), body);
    } else {
      const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(part.x, part.y, 0));
      const lever = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(part.x, part.y, 0)
          .setRotation(quatZ(part.rotationZ))
          .setAngularDamping(0.30)
          .setLinearDamping(0.02)
          .setCanSleep(false)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(1.58, 0.11, 0.22).setTranslation(0, 0.30, 0).setDensity(1.05).setFriction(0.50),
        lever
      );
      const joint = world.createImpulseJoint(
        RAPIER.JointData.revolute(
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 }
        ),
        anchor,
        lever,
        true
      ) as any;
      joint.setLimits(-0.72, 0.72);
      leverBodies.set(part.id, lever);
    }
  }

  const step = (): void => {
    world.timestep = DT;
    world.step(events);
    events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      if (a === goalSensor.handle || b === goalSensor.handle) {
        state.goalContact = true;
        state.won = true;
      }
    });

    const p = ballBody.translation();
    if (p.y < -1.4 || p.x < -7 || p.x > 7) state.ballOut = true;
    if (!state.leverMoved) {
      for (const body of leverBodies.values()) {
        if (Math.abs(body.angvel().z) > 0.18) {
          state.leverMoved = true;
          break;
        }
      }
    }
  };

  const advance = (seconds: number): void => {
    const steps = Math.max(0, Math.ceil(seconds / DT));
    for (let i = 0; i < steps && !state.won; i += 1) step();
  };

  const free = (): void => {
    try { world.free(); } catch { /* already freed */ }
  };

  return { world, ballBody, leverBodies, state, step, advance, free };
}
