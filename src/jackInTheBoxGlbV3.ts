import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const GLB_URL = '/assets/jack-in-the-box-real-cc0.glb';
const SOURCE_URL = 'https://www.meshy.ai/3d-models/An-old-rusted-jackinthebox-its-tin-body-dented-and-covered-in-peeling-circus-designs-The-handle-grinds-loudly-when-turned-playing-a-distorted-lullaby-When-it-pops-open-a-grotesque-puppet-with-oversized-eyes-and-an-impossibly-wide-grin-springs-out-its-fabriccovered-hands-reaching-forward-unnaturally-Its-head-slowly-tilts-watching-whoever-opened-it-v2-0195a25f-cbd6-78c8-9255-1c8e88a70b80';
const DETAIL_GATE = 400_000;
const TARGET_HEIGHT = 1.86;
const TARGET_FLOOR_Y = -0.58;

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

function prepareRealSource(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 0.72;
        material.roughness = Math.max(0.62, material.roughness);
        material.metalness = Math.min(0.12, material.metalness);
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 8;
          material.map.needsUpdate = true;
        }
      }
      material.needsUpdate = true;
    }
  });
}

function fitImportedSource(source: THREE.Object3D): THREE.Group {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = TARGET_HEIGHT / Math.max(0.001, size.y);

  const visualRoot = new THREE.Group();
  visualRoot.name = 'JackBoxRealCc0RenderRoot';
  visualRoot.scale.setScalar(scale);
  visualRoot.position.set(
    -center.x * scale,
    TARGET_FLOOR_Y - bounds.min.y * scale,
    -center.z * scale
  );
  visualRoot.add(source);
  return visualRoot;
}

export function attachJackInTheBoxGlbV3(object: THREE.Group): Promise<void> {
  object.userData.renderSource = 'real-cc0-glb';
  object.userData.renderLoaded = false;
  object.userData.renderTriangles = 0;
  object.userData.renderError = '';
  object.userData.sourceKey = 'meshy-cc0-rusted-jack-in-the-box';
  object.userData.sourceUrl = SOURCE_URL;
  object.userData.sourceLicense = 'CC0-1.0';

  const housingHost = object.getObjectByName('JackBoxV2RealisticHousing');
  const lidHost = object.getObjectByName('JackBoxV2DynamicLid');
  const driveHost = object.getObjectByName('JackBoxV2DrivePulley');
  const jackHost = object.getObjectByName('JackBoxV2DynamicJack');
  const fallbackSpring = object.getObjectByName('JackBoxV2DynamicSpring');

  if (!housingHost || !lidHost || !driveHost || !jackHost || !fallbackSpring) {
    object.userData.renderError = 'missing-physics-visual-hosts';
    return Promise.reject(new Error('Jack physics hosts are missing.'));
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise<void>((resolve, reject) => {
    loader.load(
      GLB_URL,
      (gltf) => {
        const source = gltf.scene;
        const triangles = countTriangles(source);
        if (triangles < DETAIL_GATE) {
          const error = new Error(`Real Jack GLB detail gate failed: ${triangles} triangles.`);
          object.userData.renderError = 'real-glb-detail-gate';
          reject(error);
          return;
        }

        // The source is the actual CC0 Meshy mesh, not a reconstruction from Three.js primitives.
        // It is currently a single artist/source mesh; simple Planck bodies remain separate and invisible.
        hideChildren(housingHost);
        hideChildren(lidHost);
        hideChildren(driveHost);
        hideChildren(jackHost);
        fallbackSpring.visible = false;

        prepareRealSource(source);
        const visualRoot = fitImportedSource(source);
        object.add(visualRoot);

        object.userData.assetVersion = 'jack-in-the-box-v4-real-cc0';
        object.userData.renderLoaded = true;
        object.userData.renderTriangles = triangles;
        object.userData.renderBytes = 2_850_696;
        object.userData.renderMeshCount = 1;
        object.userData.renderMaterialCount = 1;
        object.userData.renderTextureCount = 1;
        object.userData.renderModelType = 'real-source-monolithic';
        object.userData.renderNodeNames = ['JackBoxRealCc0RenderRoot'];
        object.userData.update?.(0);
        resolve();
      },
      undefined,
      (error) => {
        object.userData.renderError = error instanceof Error ? error.message : 'real-glb-load-failed';
        reject(error);
      }
    );
  });
}
