import * as THREE from 'three';
import {
  capsuleLoopPoints,
  createClosedBeltGeometry,
  makeSelectionBox,
  type PremiumReviewAssetModel
} from './parts0913PremiumShared';

function createDemoPulley(radius: number, depth: number, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 64, 1, false), material);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Twin raised lips read as a real V-belt groove without turning the preview
  // pulley into a visually dominant asset of its own.
  for (const z of [-depth * 0.48, depth * 0.48]) {
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.92, 0.032, 10, 64),
      material
    );
    lip.position.z = z;
    group.add(lip);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.23, radius * 0.23, depth * 1.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x29343c, metalness: 0.78, roughness: 0.30 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  return group;
}

export function createFanBeltModelV2(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'fan-belt-3d';
  group.userData.assetVersion = 'fan-belt-v2';
  group.userData.sourceKey = 'sketchfab-v-belt-c-type-cc-by';
  group.userData.referenceStyle = 'v-profile-drive-belt';
  group.userData.previewIncludesDemoPulleys = true;
  group.userData.snapPoints = [
    { id: 'loop-left', position: [-0.95, 0, 0] },
    { id: 'loop-right', position: [0.95, 0, 0] }
  ];

  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x1c2023,
    roughness: 0.74,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.94,
    sheen: 0.04,
    sheenRoughness: 0.96,
    sheenColor: new THREE.Color(0x5e6569)
  });
  const pulleyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x6f808a,
    metalness: 0.82,
    roughness: 0.31,
    clearcoat: 0.03,
    clearcoatRoughness: 0.55
  });

  const path = capsuleLoopPoints(0.95, 0.56, 46);
  const belt = new THREE.Mesh(
    createClosedBeltGeometry(path, 0.085, 0.12, 0.078),
    rubber
  );
  belt.name = 'FanBeltV2ContinuousVProfile';
  group.add(belt);

  // Neutral review pulleys communicate the real function of the TIM fan belt:
  // the part is a connection between two rotating components, not a rigid ring.
  const leftPulley = createDemoPulley(0.48, 0.34, pulleyMaterial);
  leftPulley.position.x = -0.95;
  leftPulley.name = 'FanBeltV2PreviewPulleyLeft';
  const rightPulley = createDemoPulley(0.48, 0.34, pulleyMaterial);
  rightPulley.position.x = 0.95;
  rightPulley.name = 'FanBeltV2PreviewPulleyRight';
  group.add(leftPulley, rightPulley);

  // Thin sidewall bands add the layered rubber/fabric construction of a real
  // industrial V-belt while staying readable at game scale.
  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x343a3e, roughness: 0.76, metalness: 0 });
  for (const z of [-0.112, 0.112]) {
    const band = new THREE.Mesh(
      createClosedBeltGeometry(path, 0.088, 0.0065, 0.0065),
      bandMaterial
    );
    band.scale.z = 1;
    band.position.z = z;
    band.name = 'FanBeltV2FabricEdgeBand';
    group.add(band);
  }

  const selection = makeSelectionBox(new THREE.Vector3(3.25, 1.55, 0.95));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
