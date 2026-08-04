import * as THREE from 'three';
import { Circle, RevoluteJoint, Vec2, World } from 'planck';

const FIXED_STEP = 1 / 180;
const MAX_CATCHUP = 0.42;
const ROTOR_RADIUS = 0.48;
const MAX_AERO_TORQUE = 4.2;
const AIR_TORQUE_GAIN = 2.45;
const TIP_SPEED_FEEDBACK = 0.19;
const BEARING_DAMPING = 0.085;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type WindmillTelemetry = {
  state: 'calm' | 'driven' | 'reversing';
  wind: number;
  rotorOmega: number;
  rotorAngle: number;
  aeroTorque: number;
  maxOmega: number;
  minOmega: number;
  maxTorque: number;
  rotationDirection: 'clockwise' | 'counterclockwise' | 'stopped';
};

export type WindmillPhysicsController = {
  setWind: (strength: number) => void;
  update: (dt: number) => void;
  telemetry: () => WindmillTelemetry;
};

export function createWindmillPhysicsV1(
  rotorVisual: THREE.Object3D,
  shaftVisual: THREE.Object3D,
  outputPulleyVisual: THREE.Object3D,
): WindmillPhysicsController {
  const world = new World({ gravity: Vec2(0, 0), allowSleep: false });
  const frame = world.createBody({ type: 'static', position: Vec2(0, 0) });
  const rotorBody = world.createBody({
    type: 'dynamic',
    position: Vec2(0, 0),
    angularDamping: BEARING_DAMPING,
    gravityScale: 0,
    allowSleep: false,
    userData: { kind: 'windmill-rotor' },
  });
  rotorBody.createFixture({
    shape: Circle(ROTOR_RADIUS),
    density: 3.15,
    friction: 0.28,
    restitution: 0.01,
  });
  world.createJoint(new RevoluteJoint({ collideConnected: false }, frame, rotorBody, Vec2(0, 0)));

  const rotorBase = rotorVisual.quaternion.clone();
  const shaftBase = shaftVisual.quaternion.clone();
  const pulleyBase = outputPulleyVisual.quaternion.clone();
  const spinAxis = new THREE.Vector3(0, 0, 1);
  const spinQ = new THREE.Quaternion();

  let accumulator = 0;
  let wind = 0;
  let aeroTorque = 0;
  let maxOmega = 0;
  let minOmega = 0;
  let maxTorque = 0;
  let everDrivenPositive = false;
  let everDrivenNegative = false;

  const setWind = (strength: number): void => {
    wind = clamp(strength, -1.5, 1.5);
    if (wind > 0.02) everDrivenPositive = true;
    if (wind < -0.02) everDrivenNegative = true;
    rotorBody.setAwake(true);
  };

  const applyAirflow = (): void => {
    const omega = rotorBody.getAngularVelocity();
    if (Math.abs(wind) < 0.001) {
      aeroTorque = 0;
      return;
    }

    // A compact drag-turbine model: air creates torque proportional to airflow,
    // while blade tip speed reduces the effective relative airflow. The torque is
    // finite, so the rotor accelerates gradually and reaches a physical equilibrium.
    const relativeAir = wind - omega * TIP_SPEED_FEEDBACK;
    const signedPressure = relativeAir * Math.abs(wind);
    aeroTorque = clamp(signedPressure * AIR_TORQUE_GAIN, -MAX_AERO_TORQUE, MAX_AERO_TORQUE);
    rotorBody.applyTorque(aeroTorque, true);
    maxTorque = Math.max(maxTorque, Math.abs(aeroTorque));
  };

  const syncVisual = (): void => {
    const angle = rotorBody.getAngle();
    spinQ.setFromAxisAngle(spinAxis, angle);
    rotorVisual.quaternion.copy(rotorBase).multiply(spinQ);
    shaftVisual.quaternion.copy(shaftBase).multiply(spinQ);
    outputPulleyVisual.quaternion.copy(pulleyBase).multiply(spinQ);
  };

  const update = (dt: number): void => {
    accumulator = Math.min(accumulator + Math.max(0, dt), MAX_CATCHUP);
    while (accumulator >= FIXED_STEP) {
      applyAirflow();
      world.step(FIXED_STEP, 10, 6);
      const omega = rotorBody.getAngularVelocity();
      maxOmega = Math.max(maxOmega, omega);
      minOmega = Math.min(minOmega, omega);
      accumulator -= FIXED_STEP;
    }
    syncVisual();
  };

  const telemetry = (): WindmillTelemetry => {
    const omega = rotorBody.getAngularVelocity();
    const direction = Math.abs(omega) < 0.06 ? 'stopped' : omega > 0 ? 'counterclockwise' : 'clockwise';
    const state: WindmillTelemetry['state'] = Math.abs(wind) < 0.02
      ? 'calm'
      : everDrivenPositive && everDrivenNegative
        ? 'reversing'
        : 'driven';
    return {
      state,
      wind,
      rotorOmega: omega,
      rotorAngle: rotorBody.getAngle(),
      aeroTorque,
      maxOmega,
      minOmega,
      maxTorque,
      rotationDirection: direction,
    };
  };

  syncVisual();
  return { setWind, update, telemetry };
}
