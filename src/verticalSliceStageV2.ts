import RAPIER from '@dimforge/rapier3d-compat';
import { installVerticalSliceStage } from './verticalSliceStage';

/**
 * Stage 01 runtime guard.
 *
 * The base vertical slice deliberately keeps the complete scene in one module.
 * This wrapper fixes two release-blocking issues without faking the Rube Goldberg
 * chain:
 * 1) Dynamic dominoes must not simulate while the player is still building.
 * 2) The bell sensor is armed only after the pressure pad has fired and the
 *    second ball has actually reached the domino chain.
 *
 * The real Rapier bodies/colliders and collision events remain the source of
 * truth once the simulation is running.
 */
export async function installVerticalSliceStageV2(): Promise<void> {
  await RAPIER.init();

  const worldProto = RAPIER.World.prototype as unknown as {
    step: (...args: any[]) => any;
    createCollider: (...args: any[]) => any;
  };
  const queueProto = RAPIER.EventQueue.prototype as unknown as {
    drainCollisionEvents: (callback: (handle1: number, handle2: number, started: boolean) => void) => any;
  };

  const originalStep = worldProto.step;
  const originalCreateCollider = worldProto.createCollider;
  const originalDrainCollisionEvents = queueProto.drainCollisionEvents;
  const sensorHandles: number[] = [];

  worldProto.createCollider = function (...args: any[]): any {
    const collider = originalCreateCollider.apply(this, args);
    if (collider && typeof collider.isSensor === 'function' && collider.isSensor()) {
      sensorHandles.push(collider.handle);
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
  if (canvas) {
    canvas.dataset.stageRuntime = 'v2-build-freeze+armed-bell-sensor';
    canvas.dataset.bellSensorGuard = 'requires-switch-and-domino-chain';
  }
}
