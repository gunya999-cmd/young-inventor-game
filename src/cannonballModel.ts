import * as THREE from 'three';

export interface CannonballModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  selectionShell: THREE.Mesh;
}

function createCastIronBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannonball texture canvas unavailable.');

  context.fillStyle = '#7f7f7f';
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 0x8a3f9d1;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let i = 0; i < 1700; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 0.45 + random() * 1.5;
    const value = 103 + Math.round(random() * 42);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.2, 3.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createCannonballGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 96, 72);
  const position = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // Tiny deterministic casting irregularity: enough to catch the light without
  // changing the clean silhouette expected from a TIM-style cannonball.
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();
    const noise = Math.sin(direction.x * 31.0 + direction.y * 17.0) *
      Math.sin(direction.z * 23.0 - direction.x * 11.0);
    const scale = 1 + noise * 0.0019;
    position.setXYZ(index, direction.x * scale, direction.y * scale, direction.z * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCannonballModel(): CannonballModel {
  const group = new THREE.Group();
  group.userData.kind = 'cannonball-3d';
  group.userData.assetVersion = 'cannonball-v1';
  group.userData.surface = 'stylized-cast-iron';
  group.userData.snapPoints = [];

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2f343a,
    metalness: 0.78,
    roughness: 0.43,
    clearcoat: 0.035,
    clearcoatRoughness: 0.82,
    bumpMap: createCastIronBumpTexture(),
    bumpScale: 0.018,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const shell = new THREE.Mesh(createCannonballGeometry(), shellMaterial);
  shell.name = 'CannonballCastIronShell';
  group.add(shell);

  // A very restrained casting seam. It sits almost flush with the sphere and
  // reads only when light skims across it; no decorative sci-fi detailing.
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x24292e,
    metalness: 0.72,
    roughness: 0.55
  });
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1.001, 0.008, 8, 112), seamMaterial);
  seam.name = 'CannonballCastingSeam';
  seam.rotation.x = Math.PI / 2;
  group.add(seam);

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
  model.shellMaterial.emissive.setHex(selected ? 0x182358 : 0x000000);
  model.shellMaterial.emissiveIntensity = selected ? 0.11 : 0;
}
