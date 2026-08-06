import RAPIER from '@dimforge/rapier3d-compat';

export type DriveDirection = -1 | 1;
export type RebootPart =
  | { id: string; type: 'drive-wheel'; x: number; y: number; direction: DriveDirection }
  | { id: string; type: 'ramp'; x: number; y: number; rotationZ: number };

export type BeltConnection = { id: string; wheelId: string; conveyorId: string };

export type ConveyorDefinition = {
  id: string;
  x: number;
  y: number;
  width: number;
  direction: DriveDirection;
};

export const BALL_START = { x: -5.10, y: 4.08 } as const;
export const GOAL_POSITION = { x: 5.55, y: 1.62 } as const;
export const RAMP_LENGTH = 2.40;

export const CONVEYORS: readonly ConveyorDefinition[] = [
  { id: 'conveyor-a', x: -4.60, y: 3.70, width: 1.60, direction: 1 },
  { id: 'conveyor-b', x: -0.80, y: 2.75, width: 1.60, direction: 1 },
  { id: 'conveyor-c', x: 3.00, y: 1.80, width: 1.60, direction: 1 },
] as const;

export type RebootPhysicsState = {
  won: boolean;
  goalContact: boolean;
  ballOut: boolean;
  poweredConveyors: ReadonlySet<string>;
  elapsed: number;
};

export type RebootPhysics = {
  world: any;
  ballBody: any;
  wheelBodies: ReadonlyMap<string, any>;
  state: RebootPhysicsState;
  step: () => void;
  advance: (seconds: number) => void;
  free: () => void;
};

const DT = 1 / 120;
const CONVEYOR_TARGET_SPEED = 1.65;
const CONVEYOR_MAX_ACCEL = 2.2;
const CONVEYOR_RESPONSE = 2.0;
const RAMP_HALF = RAMP_LENGTH / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quatZ(angle: number): { x: number; y: number; z: number; w: number } {
  const half = angle * 0.5;
  return { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
}

function poweredConveyors(parts: readonly RebootPart[], belts: readonly BeltConnection[]): Map<string, DriveDirection> {
  const wheels = new Map(parts.filter((part): part is Extract<RebootPart, { type: 'drive-wheel' }> => part.type === 'drive-wheel').map((part) => [part.id, part]));
  const powered = new Map<string, DriveDirection>();
  for (const belt of belts) {
    const wheel = wheels.get(belt.wheelId);
    if (!wheel || !CONVEYORS.some((c) => c.id === belt.conveyorId)) continue;
    powered.set(belt.conveyorId, wheel.direction);
  }
  return powered;
}

export function canonicalRebootSolution(): { parts: RebootPart[]; belts: BeltConnection[] } {
  const bridgeAngle = -0.407;
  return {
    parts: [
      { id: 'wheel-a', type: 'drive-wheel', x: -4.60, y: 2.95, direction: 1 },
      { id: 'wheel-b', type: 'drive-wheel', x: -0.80, y: 2.00, direction: 1 },
      { id: 'wheel-c', type: 'drive-wheel', x: 3.00, y: 1.00, direction: 1 },
      { id: 'ramp-a', type: 'ramp', x: -2.70, y: 3.238, rotationZ: bridgeAngle },
      { id: 'ramp-b', type: 'ramp', x: 1.10, y: 2.288, rotationZ: bridgeAngle },
      { id: 'ramp-c', type: 'ramp', x: 4.95, y: 1.459, rotationZ: -0.296 },
    ],
    belts: [
      { id: 'belt-a', wheelId: 'wheel-a', conveyorId: 'conveyor-a' },
      { id: 'belt-b', wheelId: 'wheel-b', conveyorId: 'conveyor-b' },
      { id: 'belt-c', wheelId: 'wheel-c', conveyorId: 'conveyor-c' },
    ],
  };
}

export function createRebootPhysics(parts: readonly RebootPart[], belts: readonly BeltConnection[]): RebootPhysics {
  const world: any = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const events = new RAPIER.EventQueue(true);
  const powerMap = poweredConveyors(parts, belts);
  const state: RebootPhysicsState = {
    won: false,
    goalContact: false,
    ballOut: false,
    poweredConveyors: new Set(powerMap.keys()),
    elapsed: 0,
  };

  world.createCollider(RAPIER.ColliderDesc.cuboid(6.6, 0.08, 0.72).setTranslation(0, -0.16, 0).setFriction(0.78));
  world.createCollider(RAPIER.ColliderDesc.cuboid(6.6, 3.4, 0.035).setTranslation(0, 2.35, -0.52));
  world.createCollider(RAPIER.ColliderDesc.cuboid(6.6, 3.4, 0.035).setTranslation(0, 2.35, 0.52));

  const conveyorColliders = new Map<string, any>();
  for (const c of CONVEYORS) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(c.x, c.y, 0));
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(c.width / 2, 0.08, 0.46).setFriction(0.88).setRestitution(0),
      body
    );
    conveyorColliders.set(c.id, collider);
  }

  for (const part of parts) {
    if (part.type !== 'ramp') continue;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(part.x, part.y, 0).setRotation(quatZ(part.rotationZ))
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(RAMP_HALF, 0.065, 0.46).setFriction(0.34).setRestitution(0), body);
  }

  const wheelBodies = new Map<string, any>();
  for (const part of parts) {
    if (part.type !== 'drive-wheel') continue;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicVelocityBased()
        .setTranslation(part.x, part.y, 0)
        .setAngvel({ x: 0, y: 0, z: -part.direction * 2.8 })
    );
    // The drive wheel is a transmission source, not an obstacle in the ball track.
    // Its physical rotation is authoritative, while the belt transmits that state to a conveyor.
    wheelBodies.set(part.id, body);
  }

  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(BALL_START.x, BALL_START.y, 0)
      .setCcdEnabled(true)
      .setLinearDamping(0.045)
      .setAngularDamping(0.03)
  );
  const ballCollider = world.createCollider(
    RAPIER.ColliderDesc.ball(0.28).setDensity(4.0).setFriction(0.46).setRestitution(0),
    ballBody
  );

  const goalBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(GOAL_POSITION.x, GOAL_POSITION.y, 0));
  const goalSensor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.22, 0.38, 0.40)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    goalBody
  );

  const step = (): void => {
    for (const c of CONVEYORS) {
      const direction = powerMap.get(c.id);
      if (!direction) continue;
      const collider = conveyorColliders.get(c.id);
      let touching = false;
      if (collider) world.contactPair(ballCollider, collider, () => { touching = true; });
      if (touching) {
        const v = ballBody.linvel();
        const target = CONVEYOR_TARGET_SPEED * direction;
        const desiredAcceleration = clamp((target - v.x) * CONVEYOR_RESPONSE, -CONVEYOR_MAX_ACCEL, CONVEYOR_MAX_ACCEL);
        const mass = Math.max(0.001, Number(ballBody.mass?.() ?? 0.37));
        ballBody.addForce({ x: desiredAcceleration * mass, y: 0, z: 0 }, true);
      }
    }

    world.timestep = DT;
    world.step(events);
    state.elapsed += DT;

    events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      if (a === goalSensor.handle || b === goalSensor.handle) {
        state.goalContact = true;
        state.won = true;
      }
    });

    const p = ballBody.translation();
    if (p.y < -1.4 || p.x < -7 || p.x > 7 || p.y > 6.5) state.ballOut = true;
  };

  const advance = (seconds: number): void => {
    const steps = Math.max(0, Math.ceil(seconds / DT));
    for (let i = 0; i < steps && !state.won && !state.ballOut; i += 1) step();
  };

  const free = (): void => { try { world.free(); } catch { /* already free */ } };

  return { world, ballBody, wheelBodies, state, step, advance, free };
}
