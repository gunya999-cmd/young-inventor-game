import { World } from 'planck';
import { installScissors3DLabV10 } from './scissors3dLabV10';

/**
 * v12 fixes the last physical failure in the scissors review rig.
 *
 * v10 ultimately uses the v9 proportional motor controller. Close to zero
 * angle the requested motor speed becomes so small that angular damping can
 * balance the motor before the blades reach the real cutting position. The
 * scissors can therefore look closed while ropeCut never becomes true.
 *
 * This wrapper preserves the v10 verification layer for two independent rope
 * pieces, while forcing a finite minimum revolute-joint motor speed until the
 * physical joint limit is actually reached. Joint limits remain authoritative,
 * so the blades stop at the closed position and cannot cross through it.
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

  installScissors3DLabV10();

  const canvas = document.querySelector<HTMLCanvasElement>('.scissors3d-lab canvas');
  if (canvas) {
    canvas.dataset.assetVersion = 'scissors-v12-guaranteed-final-closure-cut';
    canvas.dataset.motorFix = 'minimum-closing-speed-until-joint-limit';
  }

  const meta = document.querySelector<HTMLElement>('.scissors3d-lab .bowling-ball-lab__meta');
  if (meta) {
    meta.innerHTML = '<span>v3 proportions</span><span>PBR</span><span>true blade closure</span><span>2 physical rope pieces</span><span>v12</span>';
  }
}
