import RAPIER from '@dimforge/rapier3d-compat';
import { installVerticalSliceStage } from './verticalSliceStage';

/**
 * Stage 01 release runtime.
 *
 * The build phase is frozen. Both balls are launched as real rigid bodies.
 * The final win event comes from an actual collision between the last domino
 * and the visible brass bell plate; the obsolete overlapping helper sensor is
 * ignored so it cannot create a false win.
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
  let bellPlateHandle: number | null = null;

  const near = (value: number, expected: number, tolerance = 0.025): boolean => Math.abs(value - expected) <= tolerance;

  worldProto.createRigidBody = function (...args: any[]): any {
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

      // The original helper sensor overlaps a domino in the authored scene.
      // Never use that overlap as a victory condition.
      if (touchesObsoleteBellSensor) return;

      const hitsVisibleBellPlate = bellPlateHandle !== null &&
        (handle1 === bellPlateHandle || handle2 === bellPlateHandle);
      if (hitsVisibleBellPlate) {
        const chainActuallyReachedDominoes =
          started &&
          canvas?.dataset.switchTriggered === 'true' &&
          canvas?.dataset.dominoStarted === 'true' &&
          (canvas?.dataset.stageState === 'running' || canvas?.dataset.stageState === 'chain');
        if (!chainActuallyReachedDominoes || bellSensorHandle === undefined) return;

        // Feed the real plate collision into the base stage's existing win path.
        const otherHandle = handle1 === bellPlateHandle ? handle2 : handle1;
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

  canvas.dataset.stageRuntime = 'v5-build-freeze+physical-launch+bell-plate-finish';
  canvas.dataset.bellSensorGuard = 'visible-bell-plate-collision-only';
  canvas.dataset.launchModel = 'rigid-body-initial-velocity';

  let startBallBoosted = false;
  let secondBallBoosted = false;
  let finalDominoPrepared = false;

  const findBodyNear = (x: number, y: number, z: number, tolerance = 0.45): any | null => {
    for (let index = bodies.length - 1; index >= 0; index -= 1) {
      const body = bodies[index];
      if (!body || typeof body.translation !== 'function' || typeof body.setLinvel !== 'function') continue;
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
    // The authored last domino starts intersecting the bell plate by ~6 cm.
    // Move it 26 cm left so it begins with a real air gap and must be knocked
    // into the plate by the preceding dominoes.
    const body = findBodyNear(5.26, 0.54, 1.42, 0.12);
    if (!body) return;
    body.setTranslation({ x: 5.00, y: 0.54, z: 1.42 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    finalDominoPrepared = true;
    canvas.dataset.finalDominoGap = 'physical';
  };

  const boostStartBall = (): void => {
    if (startBallBoosted) return;
    const body = findBodyNear(-5.04, 3.06, -1.40);
    if (!body) return;
    body.setLinvel({ x: 4.10, y: 0, z: 0 }, true);
    startBallBoosted = true;
    canvas.dataset.startImpulse = '4.10';
  };

  const boostSecondBall = (): void => {
    if (secondBallBoosted) return;
    const body = findBodyNear(-0.42, 1.45, 1.42);
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
