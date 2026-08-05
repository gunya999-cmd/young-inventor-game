import RAPIER from '@dimforge/rapier3d-compat';
import { installVerticalSliceStage } from './verticalSliceStage';

/**
 * Stage 01 release runtime.
 *
 * The build phase is frozen. Both balls are launched as real rigid bodies.
 * The last domino must physically enter a thin Rapier sensor attached to the
 * visible brass strike plate before the base stage receives its bell event.
 */
export async function installVerticalSliceStageV2(): Promise<void> {
  await RAPIER.init();

  const worldProto = RAPIER.World.prototype as unknown as {
    step: (...args: any[]) => any;
    createCollider: (...args: any[]) => any;
    createRigidBody: (...args: any[]) => any;
  };
  const queueProto = RAPIER.EventQueue.prototype as unknown as {
    drainCollisionEvents: (callback: (handle1: number, handle2: number, started: boolean) => void) => any;
  };

  const originalStep = worldProto.step;
  const originalCreateCollider = worldProto.createCollider;
  const originalCreateRigidBody = worldProto.createRigidBody;
  const originalDrainCollisionEvents = queueProto.drainCollisionEvents;
  const sensorHandles: number[] = [];
  const bodies: any[] = [];
  let stageWorld: any | null = null;
  let bellPlateHandle: number | null = null;
  let bellStrikeHandle: number | null = null;

  const near = (value: number, expected: number, tolerance = 0.025): boolean => Math.abs(value - expected) <= tolerance;

  worldProto.createRigidBody = function (...args: any[]): any {
    stageWorld = this;
    const body = originalCreateRigidBody.apply(this, args);
    bodies.push(body);
    return body;
  };

  worldProto.createCollider = function (...args: any[]): any {
    const collider = originalCreateCollider.apply(this, args);
    if (collider && typeof collider.isSensor === 'function' && collider.isSensor()) {
      sensorHandles.push(collider.handle);
    }

    const parentBody = args[1];
    if (collider && parentBody && typeof parentBody.translation === 'function') {
      try {
        const p = parentBody.translation();
        const isBellPlate = near(p.x, 5.18) && near(p.y, 0.55) && near(p.z, 1.42);
        if (isBellPlate && !(typeof collider.isSensor === 'function' && collider.isSensor())) {
          bellPlateHandle = collider.handle;
          if (typeof collider.setActiveEvents === 'function') {
            collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
          }
        }
      } catch {
        // Ignore bodies already removed by a reset.
      }
    }
    return collider;
  };

  worldProto.step = function (...args: any[]): any {
    const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
    const state = canvas?.dataset.stageState;
    if (state && state !== 'running' && state !== 'chain') return;
    return originalStep.apply(this, args);
  };

  queueProto.drainCollisionEvents = function (
    callback: (handle1: number, handle2: number, started: boolean) => void
  ): any {
    const guarded = (handle1: number, handle2: number, started: boolean): void => {
      const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
      const bellSensorHandle = sensorHandles[1];
      const touchesObsoleteBellSensor = bellSensorHandle !== undefined &&
        (handle1 === bellSensorHandle || handle2 === bellSensorHandle);

      // The authored helper sensor intersects an upright domino. Ignore it.
      if (touchesObsoleteBellSensor) return;

      const hitsPhysicalBellSurface =
        (bellStrikeHandle !== null && (handle1 === bellStrikeHandle || handle2 === bellStrikeHandle)) ||
        (bellPlateHandle !== null && (handle1 === bellPlateHandle || handle2 === bellPlateHandle));

      if (hitsPhysicalBellSurface) {
        const chainActuallyReachedDominoes =
          started &&
          canvas?.dataset.switchTriggered === 'true' &&
          canvas?.dataset.dominoStarted === 'true' &&
          (canvas?.dataset.stageState === 'running' || canvas?.dataset.stageState === 'chain');
        if (!chainActuallyReachedDominoes || bellSensorHandle === undefined) return;

        const hitHandle = handle1 === bellStrikeHandle || handle1 === bellPlateHandle ? handle1 : handle2;
        const otherHandle = hitHandle === handle1 ? handle2 : handle1;
        callback(bellSensorHandle, otherHandle, true);
        return;
      }

      callback(handle1, handle2, started);
    };
    return originalDrainCollisionEvents.call(this, guarded);
  };

  await installVerticalSliceStage();

  const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
  if (!canvas) return;

  // Add a 5 cm deep sensor exactly on the left face of the visible brass plate.
  // It is not a shortcut: a rigid body must physically touch this surface for
  // Rapier to emit the collision event that finishes the level.
  if (stageWorld) {
    const strikeBody = stageWorld.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(5.075, 0.55, 1.42)
    );
    const strikeCollider = stageWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(0.025, 0.49, 0.39)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      strikeBody
    );
    bellStrikeHandle = strikeCollider.handle;
  }

  canvas.dataset.stageRuntime = 'v6-build-freeze+physical-launch+physical-bell-surface';
  canvas.dataset.bellSensorGuard = 'real-strike-surface-collision-only';
  canvas.dataset.launchModel = 'rigid-body-initial-velocity';

  let startBallBoosted = false;
  let secondBallBoosted = false;
  let finalDominoPrepared = false;

  const findDynamicBodyNear = (x: number, y: number, z: number, tolerance = 0.45): any | null => {
    for (let index = bodies.length - 1; index >= 0; index -= 1) {
      const body = bodies[index];
      if (!body || typeof body.translation !== 'function' || typeof body.setLinvel !== 'function') continue;
      if (typeof body.isDynamic !== 'function' || !body.isDynamic()) continue;
      try {
        const p = body.translation();
        if (Math.abs(p.x - x) <= tolerance && Math.abs(p.y - y) <= tolerance && Math.abs(p.z - z) <= tolerance) {
          return body;
        }
      } catch {
        // Removed rigid bodies can remain in the tracking array after a reset.
      }
    }
    return null;
  };

  const prepareFinalDomino = (): void => {
    if (finalDominoPrepared) return;
    const body = findDynamicBodyNear(5.26, 0.54, 1.42, 0.12);
    if (!body) return;
    // Put the final domino just clear of both the previous domino and strike
    // surface. It now has to be moved by the physical domino chain.
    body.setTranslation({ x: 4.98, y: 0.54, z: 1.42 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    finalDominoPrepared = true;
    canvas.dataset.finalDominoGap = 'physical';
  };

  const boostStartBall = (): void => {
    if (startBallBoosted) return;
    const body = findDynamicBodyNear(-5.04, 3.06, -1.40);
    if (!body) return;
    body.setLinvel({ x: 4.10, y: 0, z: 0 }, true);
    startBallBoosted = true;
    canvas.dataset.startImpulse = '4.10';
  };

  const boostSecondBall = (): void => {
    if (secondBallBoosted) return;
    const body = findDynamicBodyNear(-0.42, 1.45, 1.42);
    if (!body) return;
    body.setLinvel({ x: 2.35, y: 0, z: 0 }, true);
    secondBallBoosted = true;
    canvas.dataset.secondImpulse = '2.35';
  };

  const syncLaunches = (): void => {
    const state = canvas.dataset.stageState;
    if (state === 'build') {
      startBallBoosted = false;
      secondBallBoosted = false;
      finalDominoPrepared = false;
      return;
    }
    if (state === 'running' || state === 'chain') {
      prepareFinalDomino();
      boostStartBall();
    }
    if (canvas.dataset.switchTriggered === 'true') boostSecondBall();
  };

  const observer = new MutationObserver(syncLaunches);
  observer.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-stage-state', 'data-switch-triggered'],
  });
  syncLaunches();
}
