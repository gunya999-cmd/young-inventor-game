import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLB_URL = '/assets/jack-in-the-box-v3-realistic.glb';
const SPRING_BOTTOM_Y = -0.49;
const SPRING_BASE_TOP_Y = -0.11;

function hideChildren(host: THREE.Object3D): void {
  for (const child of host.children) child.visible = false;
}

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry;
    if (geometry.index) triangles += geometry.index.count / 3;
    else if (geometry.attributes.position) triangles += geometry.attributes.position.count / 3;
  });
  return Math.round(triangles);
}

function prepareRenderMesh(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if ('envMapIntensity' in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 1.0;
      material.needsUpdate = true;
    }
  });
}

export function attachJackInTheBoxGlbV3(object: THREE.Group): Promise<void> {
  object.userData.renderSource = 'glb';
  object.userData.renderLoaded = false;
  object.userData.renderTriangles = 0;
  object.userData.renderError = '';

  const housingHost = object.getObjectByName('JackBoxV2RealisticHousing');
  const lidHost = object.getObjectByName('JackBoxV2DynamicLid');
  const driveHost = object.getObjectByName('JackBoxV2DrivePulley');
  const jackHost = object.getObjectByName('JackBoxV2DynamicJack');
  const fallbackSpring = object.getObjectByName('JackBoxV2DynamicSpring');

  if (!housingHost || !lidHost || !driveHost || !jackHost || !fallbackSpring) {
    object.userData.renderError = 'missing-physics-visual-hosts';
    return Promise.reject(new Error('Jack GLB hosts are missing.'));
  }

  return new Promise<void>((resolve, reject) => {
    new GLTFLoader().load(
      GLB_URL,
      (gltf) => {
        const source = gltf.scene;
        const housing = source.getObjectByName('JITB_Housing');
        const lid = source.getObjectByName('JITB_Lid');
        const drive = source.getObjectByName('JITB_Drive');
        const jack = source.getObjectByName('JITB_Jack');
        const spring = source.getObjectByName('JITB_Spring');

        if (!housing || !lid || !drive || !jack || !spring) {
          const error = new Error('Jack GLB is missing required named nodes.');
          object.userData.renderError = 'missing-glb-nodes';
          reject(error);
          return;
        }

        const triangles = countTriangles(source);
        if (triangles < 30_000) {
          const error = new Error(`Jack GLB detail gate failed: ${triangles} triangles.`);
          object.userData.renderError = 'glb-detail-gate';
          reject(error);
          return;
        }

        hideChildren(housingHost);
        hideChildren(lidHost);
        hideChildren(driveHost);
        hideChildren(jackHost);
        fallbackSpring.visible = false;

        prepareRenderMesh(source);
        housingHost.add(housing);
        lidHost.add(lid);
        driveHost.add(drive);
        jackHost.add(jack);
        object.add(spring);

        drive.userData.isJackDrive = true;
        drive.traverse((child) => { child.userData.isJackDrive = true; });
        spring.name = 'JackBoxV3ImportedDynamicSpring';

        const baseUpdate = object.userData.update as ((dt?: number) => void) | undefined;
        object.userData.update = (dt = 0): void => {
          baseUpdate?.(dt);
          const jackY = typeof object.userData.jackY === 'number' ? object.userData.jackY : -0.02;
          const targetTop = jackY - 0.18;
          const baseLength = SPRING_BASE_TOP_Y - SPRING_BOTTOM_Y;
          const targetLength = Math.max(0.08, targetTop - SPRING_BOTTOM_Y);
          const scaleY = targetLength / baseLength;
          spring.scale.y = scaleY;
          spring.position.y = SPRING_BOTTOM_Y * (1 - scaleY);
        };

        object.userData.assetVersion = 'jack-in-the-box-v3-glb-realistic';
        object.userData.renderLoaded = true;
        object.userData.renderTriangles = triangles;
        object.userData.renderNodeNames = ['JITB_Housing', 'JITB_Lid', 'JITB_Drive', 'JITB_Jack', 'JITB_Spring'];
        object.userData.update(0);
        resolve();
      },
      undefined,
      (error) => {
        object.userData.renderError = error instanceof Error ? error.message : 'glb-load-failed';
        reject(error);
      }
    );
  });
}
