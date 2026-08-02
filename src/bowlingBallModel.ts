import * as THREE from 'three';

export interface BowlingBallModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  holeLipMaterials: THREE.MeshStandardMaterial[];
  selectionShell: THREE.Mesh;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function placeOnSphere(object: THREE.Object3D, normal: THREE.Vector3, radius: number): void {
  object.position.copy(normal).multiplyScalar(radius);
  object.quaternion.setFromUnitVectors(Z_AXIS, normal);
}

/**
 * Production Bowling Ball visual.
 * The finger-hole elements are oriented to the local sphere tangent instead of
 * being placed on one flat Z plane. This keeps them visually attached to the
 * curved shell while the whole asset rotates freely in 3D.
 */
export function createBowlingBallModel(): BowlingBallModel {
  const group = new THREE.Group();
  group.userData.kind = 'bowling-ball-3d';
  group.userData.snapPoints = [];
  group.userData.assetVersion = 'bowling-ball-v2';

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x171a1f,
    metalness: 0.02,
    roughness: 0.34,
    clearcoat: 0.52,
    clearcoatRoughness: 0.24,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 52), shellMaterial);
  shell.name = 'BowlingBallShell';
  group.add(shell);

  const cavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x020304,
    metalness: 0,
    roughness: 0.92,
    side: THREE.DoubleSide
  });
  const holeLipMaterials: THREE.MeshStandardMaterial[] = [];

  const holes = [
    { normal: new THREE.Vector3(-0.23, 0.27, 1).normalize(), radius: 0.122 },
    { normal: new THREE.Vector3(0.22, 0.27, 1).normalize(), radius: 0.122 },
    { normal: new THREE.Vector3(0, -0.12, 1).normalize(), radius: 0.142 }
  ];

  holes.forEach((hole, index) => {
    // A dark flush opening. Its tangent follows the real curvature of the ball.
    const cavity = new THREE.Mesh(new THREE.CircleGeometry(hole.radius * 0.78, 64), cavityMaterial);
    cavity.name = `FingerHoleCavity${index + 1}`;
    placeOnSphere(cavity, hole.normal, 1.003);
    group.add(cavity);

    // Thin, matte chamfer instead of a raised metallic torus.
    const lipMaterial = new THREE.MeshStandardMaterial({
      color: 0x31363d,
      metalness: 0.12,
      roughness: 0.46,
      emissive: 0x000000,
      emissiveIntensity: 0,
      side: THREE.DoubleSide
    });
    holeLipMaterials.push(lipMaterial);
    const lip = new THREE.Mesh(
      new THREE.RingGeometry(hole.radius * 0.79, hole.radius, 64),
      lipMaterial
    );
    lip.name = `FingerHoleChamfer${index + 1}`;
    placeOnSphere(lip, hole.normal, 1.004);
    group.add(lip);

    // Subtle inner shadow toward the bottom of the bore gives depth at game scale.
    const innerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(hole.radius * 0.58, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    );
    innerShadow.name = `FingerHoleDepth${index + 1}`;
    placeOnSphere(innerShadow, hole.normal, 1.005);
    innerShadow.position.add(new THREE.Vector3(0, -0.012, 0));
    group.add(innerShadow);
  });

  // A full 3D selection shell reads correctly from every rotation angle.
  const selectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 48, 34),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  selectionShell.name = 'BowlingBallSelectionShell';
  selectionShell.visible = false;
  group.add(selectionShell);

  return { group, shellMaterial, holeLipMaterials, selectionShell };
}

export function setBowlingBallSelected(model: BowlingBallModel, selected: boolean): void {
  model.selectionShell.visible = selected;
  model.shellMaterial.emissive.setHex(selected ? 0x182358 : 0x000000);
  model.shellMaterial.emissiveIntensity = selected ? 0.16 : 0;
  for (const material of model.holeLipMaterials) {
    material.emissive.setHex(selected ? 0x4156bf : 0x000000);
    material.emissiveIntensity = selected ? 0.52 : 0;
  }
}
