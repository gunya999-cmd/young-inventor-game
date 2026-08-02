import * as THREE from 'three';
import type { ReviewAssetModel } from './parts0408Models';

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function roundedExtrusion(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 10,
    steps: 1
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function createAFramePlate(material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-0.58, -0.69);
  shape.lineTo(0, 0.36);
  shape.lineTo(0.58, -0.69);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-0.31, -0.52);
  hole.lineTo(0, 0.10);
  hole.lineTo(0.31, -0.52);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.10,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 8
  });
  geometry.translate(0, 0, -0.05);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function createSelectionVolume(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(4.15, 1.75, 1.25),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.075,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.visible = false;
  mesh.position.y = -0.08;
  mesh.name = 'TeeterTotterSelectionVolume';
  return mesh;
}

/** A TIM-style workshop lever, not playground furniture. */
export function createTeeterTotterModelV2(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'teeter-totter-3d';
  group.userData.assetVersion = 'teeter-totter-v2';
  group.userData.sourceKey = 'opengameart-playground-cc0';
  group.userData.construction = 'workshop-lever-a-frame';
  group.userData.snapPoints = [
    { id: 'pivot', position: [0, 0.34, 0] },
    { id: 'left-end', position: [-1.72, 0.58, 0] },
    { id: 'right-end', position: [1.72, 0.37, 0] }
  ];

  const beamMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd86543,
    metalness: 0.03,
    roughness: 0.48,
    clearcoat: 0.055,
    clearcoatRoughness: 0.76
  });
  const rubberMaterial = new THREE.MeshStandardMaterial({ color: 0x343b42, roughness: 0.84, metalness: 0.02 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x465865, roughness: 0.48, metalness: 0.58 });
  const steelMaterial = new THREE.MeshStandardMaterial({ color: 0xc4ccd2, roughness: 0.27, metalness: 0.88 });

  const lever = new THREE.Group();
  lever.rotation.z = -0.062;
  lever.position.y = 0.50;

  const beam = roundedExtrusion(3.75, 0.25, 0.46, 0.12, beamMaterial);
  beam.name = 'WorkshopLeverBeam';
  lever.add(beam);

  for (const x of [-1.38, 1.38]) {
    const pad = roundedExtrusion(0.58, 0.055, 0.34, 0.027, rubberMaterial);
    pad.position.set(x, 0.155, 0);
    pad.name = x < 0 ? 'LeftContactPad' : 'RightContactPad';
    lever.add(pad);
  }

  // Central metal saddle visually locks the beam to the axle.
  const saddle = roundedExtrusion(0.43, 0.29, 0.54, 0.06, frameMaterial);
  saddle.position.y = -0.01;
  saddle.name = 'PivotSaddle';
  lever.add(saddle);
  group.add(lever);

  const base = roundedExtrusion(1.55, 0.14, 1.05, 0.06, frameMaterial);
  base.position.y = -0.76;
  base.name = 'LeverBase';
  group.add(base);

  for (const z of [-0.31, 0.31]) {
    const plate = createAFramePlate(frameMaterial);
    plate.position.z = z;
    plate.name = z < 0 ? 'RearAFramePlate' : 'FrontAFramePlate';
    group.add(plate);
  }

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.86, 48), steelMaterial);
  axle.rotation.x = Math.PI / 2;
  axle.position.y = 0.34;
  axle.name = 'LeverAxle';
  group.add(axle);

  for (const z of [-0.455, 0.455]) {
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.055, 48), steelMaterial);
    washer.rotation.x = Math.PI / 2;
    washer.position.set(0, 0.34, z);
    washer.name = z < 0 ? 'RearAxleCap' : 'FrontAxleCap';
    group.add(washer);
  }

  const selection = createSelectionVolume();
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
