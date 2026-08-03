import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLB_URL = '/assets/jack-in-the-box-option-a.glb';
const DETAIL_GATE = 45_000;
const SPRING_BOTTOM_Y = -0.49;
const SPRING_BASE_TOP_Y = -0.10;

function hideProceduralMeshes(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.visible = false;
  });
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

function collectRenderStats(root: THREE.Object3D): { meshes: number; materials: number; textures: number } {
  let meshes = 0;
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshes += 1;
    const entries = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of entries) {
      materials.add(material);
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]) {
        if (texture) textures.add(texture);
      }
    }
  });
  return { meshes, materials: materials.size, textures: textures.size };
}

function prepareOriginalMesh(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.visible = true;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 0.78;
        for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]) {
          if (!texture) continue;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
        }
        if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      }
      material.needsUpdate = true;
    }
  });
}

function takeNode(source: THREE.Object3D, name: string): THREE.Object3D | null {
  const node = source.getObjectByName(name);
  if (!node) return null;
  node.removeFromParent();
  node.position.set(0, 0, 0);
  node.rotation.set(0, 0, 0);
  node.scale.set(1, 1, 1);
  node.updateMatrix();
  return node;
}

export function attachJackInTheBoxGlbV3(object: THREE.Group): Promise<void> {
  object.userData.renderSource = 'original-blender-glb';
  object.userData.renderLoaded = false;
  object.userData.renderTriangles = 0;
  object.userData.renderError = '';
  object.userData.sourceKey = 'original-blender-jitb-option-a';
  object.userData.sourceLicense = 'PROJECT-ORIGINAL';
  object.userData.sourceUrl = 'repo://tools/build-jitb-option-a-v4.py';

  const housingHost = object.getObjectByName('JackBoxV2RealisticHousing');
  const lidHost = object.getObjectByName('JackBoxV2DynamicLid');
  const driveHost = object.getObjectByName('JackBoxV2DrivePulley');
  const jackHost = object.getObjectByName('JackBoxV2DynamicJack');

  if (!housingHost || !lidHost || !driveHost || !jackHost) {
    object.userData.renderError = 'missing-physics-visual-hosts';
    return Promise.reject(new Error('Jack physics hosts are missing.'));
  }

  return new Promise<void>((resolve, reject) => {
    new GLTFLoader().load(
      GLB_URL,
      (gltf) => {
        const source = gltf.scene;
        const triangles = countTriangles(source);
        const stats = collectRenderStats(source);
        if (triangles < DETAIL_GATE) {
          const error = new Error(`Original Jack GLB detail gate failed: ${triangles} triangles.`);
          object.userData.renderError = 'original-glb-detail-gate';
          reject(error);
          return;
        }

        prepareOriginalMesh(source);
        const housing = takeNode(source, 'JITB_Housing');
        const lid = takeNode(source, 'JITB_Lid');
        const drive = takeNode(source, 'JITB_Drive');
        const jack = takeNode(source, 'JITB_Jack');
        const spring = takeNode(source, 'JITB_Spring');
        if (!housing || !lid || !drive || !jack || !spring) {
          object.userData.renderError = 'missing-original-glb-nodes';
          reject(new Error('Original Jack GLB is missing required physical assemblies.'));
          return;
        }

        // The procedural model exists only to host the proven Planck bodies and their pivots.
        // Hide EVERY old mesh before attaching the reviewed Blender render layer. This also removes
        // old bearing plates / decorative geometry that sit outside the four moving host groups.
        hideProceduralMeshes(object);

        housingHost.add(housing);
        lidHost.add(lid);
        driveHost.add(drive);
        jackHost.add(jack);
        object.add(spring);

        drive.userData.isJackDrive = true;
        drive.traverse((child) => { child.userData.isJackDrive = true; });
        spring.name = 'JackBoxOriginalDynamicSpring';

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

        object.userData.assetVersion = 'jack-in-the-box-v5-original-blender';
        object.userData.renderLoaded = true;
        object.userData.renderTriangles = triangles;
        object.userData.renderBytes = 6_095_652;
        object.userData.renderMeshCount = stats.meshes;
        object.userData.renderMaterialCount = stats.materials;
        object.userData.renderTextureCount = stats.textures;
        object.userData.renderModelType = 'original-articulated-blender-glb';
        object.userData.renderNodeNames = ['JITB_Housing', 'JITB_Lid', 'JITB_Drive', 'JITB_Jack', 'JITB_Spring'];
        object.userData.update(0);
        resolve();
      },
      undefined,
      (error) => {
        object.userData.renderError = error instanceof Error ? error.message : 'original-glb-load-failed';
        reject(error);
      }
    );
  });
}
