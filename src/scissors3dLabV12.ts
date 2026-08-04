import { World } from 'planck';
import { installScissors3DLabV9 } from './scissors3dLabV9';

/**
 * v12 fixes the last physical failure in the scissors review rig.
 *
 * v11 used a proportional motor controller. Close to zero angle the requested
 * motor speed became so small that angular damping could balance the motor
 * before the blades reached the actual cutting gap. Visually the scissors
 * looked closed, but the rope-cut condition was never reached.
 *
 * This wrapper keeps the approved v11 geometry and rope model intact, but
 * enforces a finite minimum motor speed for revolute joints while they still
 * have a non-zero command. The joint limits remain authoritative, so the
 * blades stop exactly at the physical closed limit rather than crossing it.
 */
export function installScissors3DLabV12(): void {
  const worldProto = World.prototype as unknown as {
    createJoint: (...args: any[]) => any;
  };
  const originalCreateJoint = worldProto.createJoint;

  worldProto.createJoint = function (...args: any[]): any {
    const joint = originalCreateJoint.apply(this, args);
    if (joint && typeof joint.setMotorSpeed === 'function' && !joint.__scissorsV12MotorPatched) {
      const originalSetMotorSpeed = joint.setMotorSpeed.bind(joint);
      joint.setMotorSpeed = (requestedSpeed: number): void => {
        let speed = requestedSpeed;
        const magnitude = Math.abs(speed);
        if (Number.isFinite(speed) && magnitude > 1e-6 && magnitude < 0.9) {
          speed = Math.sign(speed) * 0.9;
        }
        originalSetMotorSpeed(speed);
      };
      joint.__scissorsV12MotorPatched = true;
    }
    return joint;
  };

  installScissors3DLabV9();

  const canvas = document.querySelector<HTMLCanvasElement>('.scissors3d-lab canvas');
  if (canvas) {
    canvas.dataset.assetVersion = 'scissors-v12-guaranteed-final-closure-cut';
    canvas.dataset.motorFix = 'minimum-closing-speed-until-joint-limit';
  }

  const meta = document.querySelector<HTMLElement>('.scissors3d-lab .bowling-ball-lab__meta');
  if (meta) {
    meta.innerHTML = '<span>v3 proportions</span><span>PBR</span><span>true blade closure</span><span>physical rope split</span><span>v12</span>';
  }
}
