import * as THREE from 'three';
import { Circle, Vec2, World } from 'planck';
import { createBoxingGloveVisualV16 } from './boxingGloveVisualV16';
import type { PremiumReviewAssetModel } from './parts0913PremiumShared';

const ANCHOR = new THREE.Vector2(-1.34, 0.06);
const ARMED_CENTER = new THREE.Vector2(-0.16, 0.05);
const SPRING_ATTACH_X = -0.68;
const REST_LENGTH = 1.08;
const SPRING_K = 31.5;
const SPRING_DAMPING = 2.15;
const GRAVITY = 4.65;
const LAUNCH_VELOCITY = new THREE.Vector2(5.9, 1.12);
const MAX_SPRING_FORCE = 82;
const MAX_FREE_TIME = 7.5;
const FIXED_STEP = 1 / 180;

function setSpringPose(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const delta = end.clone().sub(start);
  const length = Math.max(0.08, delta.length());
  mesh.position.copy(start);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
}

function receiverWorld(center: THREE.Vector2, angle: number): THREE.Vector3 {
  return new THREE.Vector3(
    center.x + Math.cos(angle) * SPRING_ATTACH_X,
    center.y + Math.sin(angle) * SPRING_ATTACH_X,
    0
  );
}

export function createBoxingGloveModelV16(): PremiumReviewAssetModel {
  const model = createBoxingGloveVisualV16();
  const group = model.group;
  const glove = group.getObjectByName('BoxingGloveV16DynamicHead') as THREE.Group | undefined;
  const spring = group.getObjectByName('BoxingGloveV11PhysicalSpring') as THREE.Mesh | undefined;
  const button = group.getObjectByName('BoxingGloveV11TriggerButton') as THREE.Mesh | undefined;
  const buttonStem = group.children
    .flatMap((child) => child.children)
    .find((child) => child.type === 'Mesh' && child !== button && Math.abs(child.position.x + 1.88) < 0.01) as THREE.Mesh | undefined;
  if (!glove || !spring || !button) throw new Error('Boxing Glove v16 mechanism parts were not found.');

  const world = new World({ gravity: Vec2(0, -GRAVITY), allowSleep: true });
  const gloveBody = world.createBody({
    type: 'dynamic',
    position: Vec2(ARMED_CENTER.x, ARMED_CENTER.y),
    fixedRotation: true,
    linearDamping: 0.42,
    angularDamping: 1,
    allowSleep: true,
    awake: false,
    userData: { kind: 'boxing-glove-head' }
  });
  // The fixture makes the preview use the same kind of real dynamic body that
  // will later collide with TIM gameplay objects. Density is chosen so the
  // 2D mass is close to a padded glove rather than an effectively weightless icon.
  gloveBody.createFixture({
    shape: Circle(0.32),
    density: 2.86,
    friction: 0.62,
    restitution: 0.12
  });

  type MotionState = 'armed' | 'free' | 'settled';
  let state: MotionState = 'armed';
  let triggerPressed = false;
  let triggerLatched = false;
  let elapsedFree = 0;
  let lowEnergyTime = 0;
  let accumulator = 0;
  let oscillationTurns = 0;
  let lastVerticalDirection = 0;

  const readCenter = (): THREE.Vector2 => {
    const position = gloveBody.getPosition();
    return new THREE.Vector2(position.x, position.y);
  };

  const applyPose = (): void => {
    const center = readCenter();
    const radial = center.clone().sub(ANCHOR);
    const angle = Math.atan2(radial.y, radial.x);
    const velocity = gloveBody.getLinearVelocity();

    glove.position.set(center.x, center.y, 0);
    glove.rotation.z = angle;
    setSpringPose(spring, new THREE.Vector3(ANCHOR.x, ANCHOR.y, 0), receiverWorld(center, angle));

    const buttonTravel = triggerPressed ? 0.055 : 0;
    button.position.x = -1.98 + buttonTravel;
    if (buttonStem) buttonStem.position.x = -1.88 + buttonTravel * 0.55;

    const distance = radial.length();
    const mass = Math.max(0.001, gloveBody.getMass());
    group.userData.state = state;
    group.userData.centerX = center.x;
    group.userData.centerY = center.y;
    group.userData.speed = Math.hypot(velocity.x, velocity.y);
    group.userData.verticalVelocity = velocity.y;
    group.userData.springLength = distance;
    group.userData.equilibriumLength = REST_LENGTH + (mass * GRAVITY) / SPRING_K;
    group.userData.extension = Math.max(0, distance - ARMED_CENTER.distanceTo(ANCHOR));
    group.userData.triggerPressed = triggerPressed;
    group.userData.oscillationTurns = oscillationTurns;
    group.userData.physicsEngine = 'planck';
  };

  const applySpringAndDamping = (): void => {
    const position = gloveBody.getPosition();
    const velocity = gloveBody.getLinearVelocity();
    const dx = position.x - ANCHOR.x;
    const dy = position.y - ANCHOR.y;
    const distance = Math.max(0.0001, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const radialSpeed = velocity.x * nx + velocity.y * ny;
    const springTerm = -SPRING_K * (distance - REST_LENGTH);
    const dampingTerm = -SPRING_DAMPING * radialSpeed;
    const magnitude = THREE.MathUtils.clamp(springTerm + dampingTerm, -MAX_SPRING_FORCE, MAX_SPRING_FORCE);
    gloveBody.applyForceToCenter(Vec2(nx * magnitude, ny * magnitude), true);
  };

  const stepPhysics = (dt: number): void => {
    accumulator = Math.min(accumulator + dt, 0.12);
    while (accumulator >= FIXED_STEP) {
      applySpringAndDamping();
      world.step(FIXED_STEP, 10, 6);
      accumulator -= FIXED_STEP;

      const vy = gloveBody.getLinearVelocity().y;
      const direction = Math.abs(vy) > 0.08 ? Math.sign(vy) : 0;
      if (elapsedFree > 0.22 && direction !== 0 && lastVerticalDirection !== 0 && direction !== lastVerticalDirection) {
        oscillationTurns += 1;
      }
      if (direction !== 0) lastVerticalDirection = direction;
    }
  };

  const settleIfReady = (dt: number): void => {
    const velocity = gloveBody.getLinearVelocity();
    const speed = Math.hypot(velocity.x, velocity.y);
    if (elapsedFree > 3.0 && speed < 0.055) lowEnergyTime += dt;
    else lowEnergyTime = 0;

    if (lowEnergyTime > 0.50 || elapsedFree >= MAX_FREE_TIME) {
      // Do not snap or teleport to a scripted final pose. The body is frozen
      // exactly where the physical simulation has converged.
      gloveBody.setLinearVelocity(Vec2(0, 0));
      gloveBody.setAwake(false);
      state = 'settled';
    }
  };

  const releaseWithImpulse = (): void => {
    if (triggerLatched || state === 'free') return;
    triggerLatched = true;
    state = 'free';
    elapsedFree = 0;
    lowEnergyTime = 0;
    accumulator = 0;
    oscillationTurns = 0;
    lastVerticalDirection = 0;
    gloveBody.setAwake(true);
    const mass = Math.max(0.001, gloveBody.getMass());
    gloveBody.applyLinearImpulse(
      Vec2(LAUNCH_VELOCITY.x * mass, LAUNCH_VELOCITY.y * mass),
      gloveBody.getWorldCenter(),
      true
    );
  };

  const setTriggerPressed = (pressed: boolean): void => {
    const next = Boolean(pressed);
    if (next && !triggerPressed) releaseWithImpulse();
    triggerPressed = next;
    if (!next) triggerLatched = false;
    applyPose();
  };

  const update = (dt = 0): void => {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    if (state === 'free') {
      elapsedFree += safeDt;
      stepPhysics(safeDt);
      settleIfReady(safeDt);
    }
    applyPose();
  };

  const reset = (): void => {
    state = 'armed';
    triggerPressed = false;
    triggerLatched = false;
    elapsedFree = 0;
    lowEnergyTime = 0;
    accumulator = 0;
    oscillationTurns = 0;
    lastVerticalDirection = 0;
    gloveBody.setTransform(Vec2(ARMED_CENTER.x, ARMED_CENTER.y), 0);
    gloveBody.setLinearVelocity(Vec2(0, 0));
    gloveBody.setAngularVelocity(0);
    gloveBody.setAwake(false);
    applyPose();
  };

  group.userData.assetVersion = 'boxing-glove-v16';
  group.userData.referenceStyle = 'authentic-side-silhouette-boxing-glove-planck-physics';
  group.userData.motion = 'planck-impulse-spring-gravity-damping';
  group.userData.physicsEngine = 'planck';
  group.userData.setTriggerPressed = setTriggerPressed;
  group.userData.trigger = (): void => {
    setTriggerPressed(true);
    window.setTimeout(() => setTriggerPressed(false), 80);
  };
  group.userData.update = update;
  group.userData.reset = reset;

  reset();
  return model;
}
