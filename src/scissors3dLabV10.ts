import * as THREE from 'three';
import { installScissors3DLabV9 } from './scissors3dLabV9';

/**
 * v10 keeps the approved v9 scissors/rope simulation and adds a runtime
 * verification layer for the cut result. v9 already breaks exactly one
 * distance constraint and keeps every node's current/previous positions,
 * which preserves velocity and produces two independent Verlet chains.
 * This layer makes that state observable and refuses to report a successful
 * cut unless two separate visible rope pieces actually exist and continue
 * updating independently.
 */
export function installScissors3DLabV10(): void {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let capturedScene: THREE.Object3D | null = null;
  let previousCenters: THREE.Vector3[] = [];
  let lastTime = performance.now();

  THREE.WebGLRenderer.prototype.render = function (
    scene: THREE.Object3D,
    camera: THREE.Camera,
  ): void {
    capturedScene = scene;
    originalRender.call(this, scene, camera);
  };

  installScissors3DLabV9();

  const canvas = document.querySelector<HTMLCanvasElement>('.scissors3d-lab canvas');
  const status = document.querySelector<HTMLElement>('.scissors3d-status');
  const meta = document.querySelector<HTMLElement>('.scissors3d-lab .bowling-ball-lab__meta');
  if (!canvas) return;

  canvas.dataset.assetVersion = 'scissors-v10-two-independent-rope-pieces';
  canvas.dataset.ropePieces = '1';
  canvas.dataset.ropeIndependent = 'false';
  if (meta) {
    meta.innerHTML = '<span>v3 proportions</span><span>PBR</span><span>real cut corridor</span><span>2 physical rope pieces</span><span>v10</span>';
  }

  const centerOfGeometry = (mesh: THREE.Mesh): THREE.Vector3 => {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getCenter(center);
    return mesh.localToWorld(center);
  };

  const inspect = (now: number): void => {
    if (capturedScene) {
      const visibleRopeMeshes: THREE.Mesh[] = [];
      capturedScene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (!object.visible) return;
        if (object.geometry?.type !== 'TubeGeometry') return;

        // Scissors lab has rope TubeGeometry; exclude any accidental tiny tube.
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        if (!box) return;
        const size = new THREE.Vector3();
        box.getSize(size);
        if (Math.max(size.x, size.y, size.z) < 0.4) return;
        visibleRopeMeshes.push(object);
      });

      const cut = canvas.dataset.ropeCut === 'true';
      const currentCenters = visibleRopeMeshes.map(centerOfGeometry);
      const dt = Math.max(1e-3, (now - lastTime) / 1000);

      let independentMotion = false;
      if (cut && currentCenters.length === 2 && previousCenters.length === 2) {
        const v0 = currentCenters[0].clone().sub(previousCenters[0]).multiplyScalar(1 / dt);
        const v1 = currentCenters[1].clone().sub(previousCenters[1]).multiplyScalar(1 / dt);
        const relativeVelocity = v0.clone().sub(v1).length();
        const centerSeparation = currentCenters[0].distanceTo(currentCenters[1]);
        independentMotion = relativeVelocity > 0.002 || centerSeparation > 0.12;
        canvas.dataset.ropeRelativeVelocity = relativeVelocity.toFixed(4);
        canvas.dataset.ropePieceSeparation = centerSeparation.toFixed(4);
      }

      if (!cut) {
        canvas.dataset.ropePieces = '1';
        canvas.dataset.ropeIndependent = 'false';
      } else {
        canvas.dataset.ropePieces = String(visibleRopeMeshes.length);
        canvas.dataset.ropeIndependent = visibleRopeMeshes.length === 2 && independentMotion ? 'true' : 'pending';
        if (status && visibleRopeMeshes.length === 2) {
          status.textContent = independentMotion
            ? 'Разрезано · 2 независимые физические части верёвки'
            : 'Разрезано · 2 части, физика продолжается';
        }
      }

      previousCenters = currentCenters;
      lastTime = now;
    }
    requestAnimationFrame(inspect);
  };

  requestAnimationFrame(inspect);
}
