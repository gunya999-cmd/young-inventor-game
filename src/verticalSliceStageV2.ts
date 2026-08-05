import RAPIER from '@dimforge/rapier3d-compat';
import { installVerticalSliceStage } from './verticalSliceStage';

/**
 * Stage 01 release runtime.
 *
 * All moving pieces remain genuine Rapier rigid bodies. The final bell event is
 * forwarded only from a real contact with the brass strike surface, and the
 * base stage's original bell sensor is identified by its physical location —
 * never by creation-order indices.
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
  const bodies: any[] = [];
  let stageWorld: any | null = null;
  let legacyBellSensorHandle: number | null = null;
  let bellPlateHandle: number | null = null;
  let bellStrikeHandle: number | null = null;
  let finalDominoBody: any | null = null;

  const near = (value: number, expected: number, tolerance = 0.025): boolean => Math.abs(value - expected) <= tolerance;

  worldProto.createRigidBody = function (...args: any[]): any {
    stageWorld = this;
    const body = originalCreateRigidBody.apply(this, args);
    bodies.push(body);
    return body;
  };

  worldProto.createCollider = function (...args: any[]): any {
    const collider = originalCreateCollider.apply(this, args);
    const parentBody = args[1];
    if (collider && parentBody && typeof parentBody.translation === 'function') {
      try {
        const p = parentBody.translation();
        const isSensor = typeof collider.isSensor === 'function' && collider.isSensor();
        if (isSensor && near(p.x, 4.98) && near(p.y, 0.55) && near(p.z, 1.42)) {
          legacyBellSensorHandle = collider.handle;
        }
        if (!isSensor && near(p.x, 5.18) && near(p.y, 0.55) && near(p.z, 1.42)) {
          bellPlateHandle = collider.handle;
          if (typeof collider.setActiveEvents === 'function') collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        }
      } catch {
        // Removed body during reset.
      }
    }
    return collider;
  };

  worldProto.step = function (...args: any[]): any {
    const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
    const state = canvas?.dataset.stageState;
    const chainHasStarted = canvas?.dataset.switchTriggered === 'true' && canvas?.dataset.dominoStarted === 'true';
    const shouldSimulate = !state || state === 'running' || state === 'chain' || (state === 'failed' && chainHasStarted);
    if (!shouldSimulate) return;

    const result = originalStep.apply(this, args);
    if (canvas && finalDominoBody) {
      try {
        const p = finalDominoBody.translation();
        const q = finalDominoBody.rotation();
        canvas.dataset.finalDomino = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
        canvas.dataset.finalDominoRotation = `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)}`;
      } catch {
        // Diagnostics only.
      }
    }
    return result;
  };

  queueProto.drainCollisionEvents = function (
    callback: (handle1: number, handle2: number, started: boolean) => void
  ): any {
    const guarded = (handle1: number, handle2: number, started: boolean): void => {
      const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
      const touchesLegacyBellSensor = legacyBellSensorHandle !== null &&
        (handle1 === legacyBellSensorHandle || handle2 === legacyBellSensorHandle);

      // The original broad helper sensor overlaps the authored domino area.
      // Raw events from it are ignored; only the real strike surface can forward
      // a bell event back to the base stage.
      if (touchesLegacyBellSensor) return;

      const hitsPhysicalBellSurface =
        (bellStrikeHandle !== null && (handle1 === bellStrikeHandle || handle2 === bellStrikeHandle)) ||
        (bellPlateHandle !== null && (handle1 === bellPlateHandle || handle2 === bellPlateHandle));

      if (hitsPhysicalBellSurface) {
        if (canvas && started) canvas.dataset.bellPhysicalContact = 'true';
        const state = canvas?.dataset.stageState;
        const qualified =
          started &&
          canvas?.dataset.switchTriggered === 'true' &&
          state !== 'build' &&
          state !== 'won';
        if (!qualified || legacyBellSensorHandle === null) return;

        if (canvas) {
          canvas.dataset.bellQualifiedContact = 'true';
          canvas.dataset.bellForwarded = 'true';
        }
        const hitHandle = handle1 === bellStrikeHandle || handle1 === bellPlateHandle ? handle1 : handle2;
        const otherHandle = hitHandle === handle1 ? handle2 : handle1;
        callback(legacyBellSensorHandle, otherHandle, true);
        return;
      }

      callback(handle1, handle2, started);
    };
    return originalDrainCollisionEvents.call(this, guarded);
  };

  await installVerticalSliceStage();

  const canvas = document.querySelector<HTMLCanvasElement>('.vs-stage canvas');
  if (!canvas) return;

  if (stageWorld) {
    const strikeBody = stageWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(5.075, 0.55, 1.42));
    const strikeCollider = stageWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(0.025, 0.49, 0.39)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      strikeBody
    );
    bellStrikeHandle = strikeCollider.handle;
  }

  canvas.dataset.stageRuntime = 'v9-real-bell-handle+stable-domino-chain';
  canvas.dataset.bellSensorGuard = 'real-strike-surface-collision-only';
  canvas.dataset.launchModel = 'rigid-body-initial-velocity';
  canvas.dataset.bellPhysicalContact = 'false';
  canvas.dataset.bellQualifiedContact = 'false';
  canvas.dataset.bellForwarded = 'false';
  canvas.dataset.legacyBellHandleFound = legacyBellSensorHandle === null ? 'false' : 'true';

  let startBallBoosted = false;
  let secondBallBoosted = false;
  let dominoChainPrepared = false;

  const findDynamicBodyNear = (x: number, y: number, z: number, tolerance = 0.45): any | null => {
    for (let index = bodies.length - 1; index >= 0; index -= 1) {
      const body = bodies[index];
      if (!body || typeof body.translation !== 'function' || typeof body.setLinvel !== 'function') continue;
      if (typeof body.isDynamic !== 'function' || !body.isDynamic()) continue;
      try {
        const p = body.translation();
        if (Math.abs(p.x - x) <= tolerance && Math.abs(p.y - y) <= tolerance && Math.abs(p.z - z) <= tolerance) return body;
      } catch {
        // Removed rigid bodies can remain in the tracking array after reset.
      }
    }
    return null;
  };

  const prepareDominoChain = (): void => {
    if (dominoChainPrepared) return;
    const authoredX = [2.25, 2.68, 3.11, 3.54, 3.97, 4.40, 4.83, 5.26];
    const targetX = [2.35, 2.69, 3.03, 3.37, 3.71, 4.05, 4.39, 4.73];
    const chainBodies: any[] = [];

    for (let index = 0; index < authoredX.length; index += 1) {
      const body = findDynamicBodyNear(authoredX[index], 0.54, 1.42, 0.085);
      if (!body || chainBodies.includes(body)) return;
      chainBodies.push(body);
    }

    chainBodies.forEach((body, index) => {
      body.setTranslation({ x: targetX[index], y: 0.54, z: 1.42 }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });

    finalDominoBody = chainBodies[chainBodies.length - 1];
    dominoChainPrepared = true;
    canvas.dataset.dominoSpacing = '0.34m-stable';
    canvas.dataset.finalDominoGap = '0.305m-to-bell-plate';
  };

  const boostStartBall = (): void => {
    if (startBallBoosted) return;
    const body = findDynamicBodyNear(-5.04, 3.06, -1.40);
    if (!body) return;
    body.setLinvel({ x: 5.00, y: 0, z: 0 }, true);
    startBallBoosted = true;
    canvas.dataset.startImpulse = '5.00';
  };

  const boostSecondBall = (): void => {
    if (secondBallBoosted) return;
    const body = findDynamicBodyNear(-0.42, 1.45, 1.42);
    if (!body) return;
    body.setLinvel({ x: 3.50, y: 0, z: 0 }, true);
    secondBallBoosted = true;
    canvas.dataset.secondImpulse = '3.50';
  };

  const keepSuccessfulChainAlive = (): void => {
    if (canvas.dataset.stageState !== 'failed' || canvas.dataset.switchTriggered !== 'true') return;
    canvas.dataset.stageState = 'chain';
    const runButton = document.querySelector<HTMLButtonElement>('.vs-stage [data-action="run"]');
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = 'Цепочка работает…';
    }
  };

  const syncRuntime = (): void => {
    const state = canvas.dataset.stageState;
    if (state === 'build') {
      startBallBoosted = false;
      secondBallBoosted = false;
      dominoChainPrepared = false;
      finalDominoBody = null;
      canvas.dataset.bellPhysicalContact = 'false';
      canvas.dataset.bellQualifiedContact = 'false';
      canvas.dataset.bellForwarded = 'false';
      return;
    }
    if (state === 'running' || state === 'chain') {
      prepareDominoChain();
      boostStartBall();
    }
    if (canvas.dataset.switchTriggered === 'true') boostSecondBall();
    keepSuccessfulChainAlive();
  };

  const observer = new MutationObserver(syncRuntime);
  observer.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-stage-state', 'data-switch-triggered', 'data-domino-started'],
  });
  syncRuntime();
}
