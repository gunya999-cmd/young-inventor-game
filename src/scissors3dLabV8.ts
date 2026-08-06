import * as THREE from 'three';
import { installScissors3DLabV7 } from './scissors3dLabV7';

/**
 * v8 keeps the approved v7 scissors geometry/physics intact and corrects only
 * the 3D depth of the rope test rig. v7 simulated the rope in the correct XY
 * cut line, but rendered the tube and its anchors at z=-0.14, behind the
 * actual blade working plane. That made the rope look as if it missed the
 * scissors from oblique/top views even though the 2D cut test said otherwise.
 */
export function installScissors3DLabV8(): void {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  const correctedGeometries = new WeakSet<THREE.BufferGeometry>();

  THREE.WebGLRenderer.prototype.render = function (
    scene: THREE.Object3D,
    camera: THREE.Camera,
  ): void {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      // Rope is rebuilt as TubeGeometry during simulation. Move each newly
      // generated tube from its legacy preview plane to the blade mid-plane.
      if (object.geometry?.type === 'TubeGeometry' && !correctedGeometries.has(object.geometry)) {
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox;
        if (bounds) {
          const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
          // Only correct the test rope tubes created around z=-0.14.
          if (centerZ < -0.06 && centerZ > -0.24) {
            object.geometry.translate(0, 0, -centerZ);
            object.geometry.computeBoundingBox();
            object.geometry.computeBoundingSphere();
          }
        }
        correctedGeometries.add(object.geometry);
      }

      // The only TorusGeometry objects in the v7 scissors lab are the two
      // rope anchor rings. Keep them in the same Z plane as the corrected rope.
      if (object.geometry?.type === 'TorusGeometry' && object.parent instanceof THREE.Group) {
        if (Math.abs(object.parent.position.z + 0.14) < 0.04) {
          object.parent.position.z = 0;
        }
      }
    });

    originalRender.call(this, scene, camera);
  };

  installScissors3DLabV7();

  const canvas = document.querySelector<HTMLCanvasElement>('.scissors3d-lab canvas');
  if (canvas) {
    canvas.dataset.assetVersion = 'scissors-v8-rope-in-blade-midplane';
    canvas.dataset.ropeRenderPlaneZ = '0.000';
  }

  const meta = document.querySelector<HTMLElement>('.scissors3d-lab .bowling-ball-lab__meta');
  if (meta) {
    meta.innerHTML = '<span>v3 proportions</span><span>PBR</span><span>natural handle stop</span><span>rope Z=blade plane</span><span>v8</span>';
  }
}
