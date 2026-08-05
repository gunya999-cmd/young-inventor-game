import RAPIER from '@dimforge/rapier3d-compat';
import { installVerticalSliceStage } from './verticalSliceStage';

/**
 * Stage 01 release runtime.
 *
 * Keeps the build phase static, arms the bell only after the real chain reaches
 * the dominoes, and gives both steel balls a small physical launch impulse.
 * After those impulses every result still comes from Rapier rigid-body motion,
 * friction and collision events.
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
    return collider;
  };

  // During construction the machine must remain exactly where the player put it.
  // Rapier starts stepping only after Run is pressed and continues through the chain.
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
      const touchesBellSensor = bellSensorHandle !== undefined &&
        (handle1 === bellSensorHandle || handle2 === bellSensorHandle);

      if (touchesBellSensor) {
        const chainActuallyReachedDominoes =
          canvas?.dataset.switchTriggered === 'true' &&
          canvas?.dataset.dominoStarted === 'true' &&
          (canvas?.dataset.stageState === 'running' || canvas?.dataset.stageState === 'chain');
        if (!chainActuallyReachedDominoes) return;
      }

      callback(handle1, handle2, started);
    };
    return originalDrainCollisionEvents.call(this, guarded);
  };

  await installVerticalSliceStage();

  const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
  if (!canvas) return;

  canvas.dataset.stageRuntime = 'v3-build-freeze+armed-bell+physical-launch';
  canvas.dataset.bellSensorGuard = 'requires-switch-and-domino-chain';
  canvas.dataset.launchModel = 'rigid-body-initial-impulse';

  let startBallBoosted = false;
  let secondBallBoosted = false;

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
        // Removed rigid bodies may remain in the tracking array after reset.
      }
    }
    return null;
  };

  const boostStartBall = (): void => {
    if (startBallBoosted) return;
    const body = findBodyNear(-5.04, 3.06, -1.40);
    if (!body) return;
    body.setLinvel({ x: 1.45, y: 0, z: 0 }, true);
    startBallBoosted = true;
    canvas.dataset.startImpulse = '1.45';
  };

  const boostSecondBall = (): void => {
    if (secondBallBoosted) return;
    const body = findBodyNear(-0.42, 1.45, 1.42);
    if (!body) return;
    body.setLinvel({ x: 1.20, y: 0, z: 0 }, true);
    secondBallBoosted = true;
    canvas.dataset.secondImpulse = '1.20';
  };

  const syncLaunches = (): void => {
    const state = canvas.dataset.stageState;
    if (state === 'build') {
      startBallBoosted = false;
      secondBallBoosted = false;
      return;
    }
    if (state === 'running' || state === 'chain') boostStartBall();
    if (canvas.dataset.switchTriggered === 'true') boostSecondBall();
  };

  const observer = new MutationObserver(syncLaunches);
  observer.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-stage-state', 'data-switch-triggered'],
  });
  syncLaunches();
}
