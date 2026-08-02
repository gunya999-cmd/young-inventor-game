import * as THREE from 'three';

export interface CannonballModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  selectionShell: THREE.Mesh;
}

/**
 * Source reference: Kenney Tower Defense Kit / weapon-ammo-cannonball (CC0).
 * The production mesh is re-authored locally at a smoother game-ready density
 * so the asset stays self-contained and does not hot-link third-party files.
 */
const SOURCE_REFERENCE = {
  creator: 'Kenney',
  pack: 'Tower Defense Kit',
  asset: 'weapon-ammo-cannonball',
  license: 'CC0-1.0',
  url: 'https://kenney.nl/assets/tower-defense-kit'
} as const;

function createCastIronRoughnessTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannonball roughness texture canvas unavailable.');

  const image = context.createImageData(size, size);
  let seed = 0x71d3a519;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let pixel = 0; pixel < size * size; pixel += 1) {
    // High values keep the iron broadly matte. The tiny deterministic variation
    // breaks up the reflection without creating visible pits or dirty highlights.
    const value = Math.round(218 + random() * 24);
    const offset = pixel * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 2.4);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createCannonballGeometry(): THREE.SphereGeometry {
  // Kenney's CC0 source uses a deliberately simple spherical silhouette.
  // We retain that clean proportion while increasing tessellation so the
  // close-up Asset Lab reads as a modern production object rather than faceted.
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCannonballModel(): CannonballModel {
  const group = new THREE.Group();
  group.userData.kind = 'cannonball-3d';
  group.userData.assetVersion = 'cannonball-v2';
  group.userData.surface = 'seamless-gunmetal-cast-iron';
  group.userData.sourceReference = SOURCE_REFERENCE;
  group.userData.snapPoints = [];

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4a4f54,
    metalness: 0.58,
    roughness: 0.76,
    roughnessMap: createCastIronRoughnessTexture(),
    clearcoat: 0,
    clearcoatRoughness: 1,
    envMapIntensity: 0.92,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const shell = new THREE.Mesh(createCannonballGeometry(), shellMaterial);
  shell.name = 'CannonballSeamlessCastIronShell';
  group.add(shell);

  // No decorative or casting-ring overlay. A real cannonball reads as one
  // continuous mass; the v1 torus was intentionally removed after review.

  const selectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  selectionShell.name = 'CannonballSelectionShell';
  selectionShell.visible = false;
  group.add(selectionShell);

  return { group, shellMaterial, selectionShell };
}

export function setCannonballSelected(model: CannonballModel, selected: boolean): void {
  model.selectionShell.visible = selected;
  model.shellMaterial.emissive.setHex(selected ? 0x19202b : 0x000000);
  model.shellMaterial.emissiveIntensity = selected ? 0.1 : 0;
}
