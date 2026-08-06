import * as THREE from 'three';
import {
  extrude,
  makeSelectionBox,
  type PremiumReviewAssetModel
} from './parts0913PremiumShared';

function gearPoint(angle: number, radius: number): THREE.Vector2 {
  return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function createMachinedGearShape(teeth = 24): THREE.Shape {
  const rootRadius = 0.86;
  const flankRadius = 1.01;
  const tipRadius = 1.105;
  const step = (Math.PI * 2) / teeth;
  const shape = new THREE.Shape();

  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const base = tooth * step;
    const fractions = [0.00, 0.12, 0.26, 0.38, 0.62, 0.74, 0.88];
    const radii = [rootRadius, rootRadius, flankRadius, tipRadius, tipRadius, flankRadius, rootRadius];
    for (let index = 0; index < fractions.length; index += 1) {
      const point = gearPoint(base + fractions[index] * step, radii[index]);
      if (tooth === 0 && index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    }
  }
  shape.closePath();

  // True axle bore.
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 0.255, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  // Six large lightening holes, matching the functional industrial reference
  // without the cookie-cutter look of the old equal white circles.
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const radius = 0.56;
    const hole = new THREE.Path();
    hole.absellipse(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.145,
      0.118,
      0,
      Math.PI * 2,
      true,
      angle
    );
    shape.holes.push(hole);
  }
  return shape;
}

export function createGearModelV2(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'gear-3d';
  group.userData.assetVersion = 'gear-v2';
  group.userData.sourceKey = 'sketchfab-plaggy-cc0-gear';
  group.userData.referenceStyle = 'machined-pbr-gear';
  group.userData.snapPoints = [{ id: 'axle', position: [0, 0, 0] }];

  const metal = new THREE.MeshPhysicalMaterial({
    color: 0x56646d,
    metalness: 0.88,
    roughness: 0.31,
    clearcoat: 0.035,
    clearcoatRoughness: 0.52
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x29343b,
    metalness: 0.86,
    roughness: 0.35
  });
  const edgeMetal = new THREE.MeshStandardMaterial({
    color: 0x89979f,
    metalness: 0.92,
    roughness: 0.25
  });

  const gear = new THREE.Mesh(extrude(createMachinedGearShape(24), 0.30, 0.034), metal);
  gear.name = 'GearV2MachinedBody';
  group.add(gear);

  // Raised hub rings on both faces keep the center mechanically believable while
  // preserving the real through-bore.
  for (const z of [-0.165, 0.165]) {
    const hub = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.065, 16, 72), darkMetal);
    hub.position.z = z;
    hub.name = 'GearV2HubRing';
    group.add(hub);

    const faceStep = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.018, 8, 96), edgeMetal);
    faceStep.position.z = z;
    faceStep.name = 'GearV2MachinedFaceStep';
    group.add(faceStep);
  }

  // Short inner sleeve gives the axle hole actual wall depth instead of a flat
  // punched opening.
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.34, 64, 1, true),
    darkMetal
  );
  sleeve.rotation.x = Math.PI / 2;
  sleeve.name = 'GearV2AxleBoreSleeve';
  group.add(sleeve);

  // Six small recessed fastener seats around the hub add scale and machining
  // detail without turning the object into photoreal clutter.
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
    const fastener = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 24), darkMetal);
    fastener.rotation.x = Math.PI / 2;
    fastener.position.set(Math.cos(angle) * 0.39, Math.sin(angle) * 0.39, 0.168);
    fastener.name = 'GearV2FastenerSeat';
    group.add(fastener);
  }

  const selection = makeSelectionBox(new THREE.Vector3(2.55, 2.55, 0.82));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
