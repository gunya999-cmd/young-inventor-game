import * as THREE from 'three';
import {
  capsuleLoopPoints,
  createClosedBeltGeometry,
  createTubeBetween,
  makeSelectionBox,
  type PremiumReviewAssetModel
} from './parts0913PremiumShared';

function createRoller(radius: number, width: number, material: THREE.Material): THREE.Mesh {
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 56), material);
  roller.rotation.x = Math.PI / 2;
  return roller;
}

export function createConveyorBeltModelV2(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'conveyor-belt-3d';
  group.userData.assetVersion = 'conveyor-belt-v2';
  group.userData.sourceKey = 'sketchfab-jason-kan-conveyor-cc-by';
  group.userData.referenceStyle = 'industrial-game-ready';
  group.userData.snapPoints = [
    { id: 'drive-left', position: [-1.55, 0.16, 0] },
    { id: 'drive-right', position: [1.55, 0.16, 0] }
  ];

  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x1c252b,
    roughness: 0.82,
    metalness: 0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.96,
    sheen: 0.05,
    sheenRoughness: 0.92,
    sheenColor: new THREE.Color(0x536068)
  });
  const frameMetal = new THREE.MeshPhysicalMaterial({
    color: 0x355d72,
    metalness: 0.74,
    roughness: 0.36,
    clearcoat: 0.05,
    clearcoatRoughness: 0.56
  });
  const rollerMetal = new THREE.MeshStandardMaterial({ color: 0xa6b2b9, metalness: 0.88, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x243139, metalness: 0.76, roughness: 0.36 });
  const accentMetal = new THREE.MeshPhysicalMaterial({ color: 0xc68d32, metalness: 0.64, roughness: 0.36, clearcoat: 0.04 });
  const footMaterial = new THREE.MeshStandardMaterial({ color: 0x20272b, roughness: 0.82, metalness: 0.08 });

  // The belt is one continuous loop wrapping the two end drums, not two detached
  // slabs. Geometry includes the underside so the part reads correctly when the
  // player rotates it in the Asset Lab.
  const loopPoints = capsuleLoopPoints(1.55, 0.31, 48);
  for (const point of loopPoints) point.y += 0.16;
  const belt = new THREE.Mesh(createClosedBeltGeometry(loopPoints, 0.055, 0.72), rubber);
  belt.name = 'ConveyorV2ContinuousRubberLoop';
  group.add(belt);

  for (const x of [-1.55, 1.55]) {
    const drum = createRoller(0.265, 1.52, rollerMetal);
    drum.position.set(x, 0.16, 0);
    drum.name = x < 0 ? 'ConveyorV2DriveDrumLeft' : 'ConveyorV2DriveDrumRight';
    group.add(drum);

    for (const z of [-0.82, 0.82]) {
      const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 36), darkMetal);
      bearing.rotation.x = Math.PI / 2;
      bearing.position.set(x, 0.16, z);
      bearing.name = 'ConveyorV2BearingHousing';
      group.add(bearing);
    }
  }

  // Five support rollers are visible below the top run. They give believable belt
  // support and keep the silhouette from reading like two silver end cylinders.
  for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) {
    const roller = createRoller(0.075, 1.40, rollerMetal);
    roller.position.set(x, 0.405, 0);
    roller.name = 'ConveyorV2SupportRoller';
    group.add(roller);
  }

  // Continuous rounded side rails.
  for (const z of [-0.84, 0.84]) {
    const rail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 2.90, 8, 20),
      frameMetal
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.27, z);
    rail.name = 'ConveyorV2SideRail';
    group.add(rail);
  }

  // Subtle transverse tread lines are functional surface detail, not decorative
  // blocks. They sit almost flush with the rubber top run.
  const treadMaterial = new THREE.MeshStandardMaterial({ color: 0x323e45, roughness: 0.84, metalness: 0 });
  for (let index = -6; index <= 6; index += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 1.30), treadMaterial);
    tread.position.set(index * 0.215, 0.526, 0);
    tread.name = 'ConveyorV2TreadLine';
    group.add(tread);
  }

  // Four legs plus X-bracing make the conveyor feel like a complete machine, not
  // a floating belt mockup.
  const legXs = [-1.13, 1.13];
  for (const x of legXs) {
    for (const z of [-0.68, 0.68]) {
      const top = new THREE.Vector3(x, -0.04, z);
      const bottom = new THREE.Vector3(x, -0.78, z);
      const leg = createTubeBetween(top, bottom, 0.055, frameMetal);
      leg.name = 'ConveyorV2TubularLeg';
      group.add(leg);

      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.065, 28), footMaterial);
      foot.position.set(x, -0.82, z);
      foot.name = 'ConveyorV2RubberFoot';
      group.add(foot);
    }
  }

  for (const z of [-0.69, 0.69]) {
    const braceA = createTubeBetween(new THREE.Vector3(-1.10, -0.14, z), new THREE.Vector3(1.10, -0.70, z), 0.025, frameMetal);
    const braceB = createTubeBetween(new THREE.Vector3(1.10, -0.14, z), new THREE.Vector3(-1.10, -0.70, z), 0.025, frameMetal);
    braceA.name = 'ConveyorV2CrossBrace';
    braceB.name = 'ConveyorV2CrossBrace';
    group.add(braceA, braceB);
  }

  // Compact side-mounted motor/gearbox makes the source of rotational motion
  // obvious and gives the belt a useful snap target in later physics integration.
  const gearbox = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.30, 44), frameMetal);
  gearbox.rotation.x = Math.PI / 2;
  gearbox.position.set(1.55, 0.16, 1.00);
  gearbox.name = 'ConveyorV2Gearbox';
  group.add(gearbox);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.50, 44), darkMetal);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(1.55, 0.16, 1.36);
  motor.name = 'ConveyorV2Motor';
  group.add(motor);

  const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.16, 32), accentMetal);
  coupler.rotation.x = Math.PI / 2;
  coupler.position.set(1.55, 0.16, 0.84);
  coupler.name = 'ConveyorV2DriveCoupler';
  group.add(coupler);

  const selection = makeSelectionBox(new THREE.Vector3(3.75, 1.82, 3.05));
  selection.position.set(0, -0.10, 0.18);
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
