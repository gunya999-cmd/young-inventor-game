import * as THREE from 'three';
import type { ReviewAssetModel } from './parts0408Models';

function createPaddleShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-1.82, -0.22);
  shape.lineTo(-1.08, -0.22);
  shape.quadraticCurveTo(-0.97, -0.53, -0.58, -0.60);
  shape.lineTo(0.76, -0.46);
  shape.quadraticCurveTo(1.04, -0.39, 1.13, -0.16);
  shape.quadraticCurveTo(1.18, 0.00, 1.13, 0.16);
  shape.quadraticCurveTo(1.04, 0.39, 0.76, 0.46);
  shape.lineTo(-0.58, 0.60);
  shape.quadraticCurveTo(-0.97, 0.53, -1.08, 0.22);
  shape.lineTo(-1.82, 0.22);
  shape.quadraticCurveTo(-1.96, 0.18, -1.96, 0.00);
  shape.quadraticCurveTo(-1.96, -0.18, -1.82, -0.22);
  shape.closePath();
  return shape;
}

function createPaddleBoard(material: THREE.Material): THREE.Mesh {
  const thickness = 0.13;
  const geometry = new THREE.ExtrudeGeometry(createPaddleShape(), {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 16,
    steps: 1
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function createPleatedBellowsGeometry(): THREE.BufferGeometry {
  const levels = 13;
  const segments = 40;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let level = 0; level < levels; level += 1) {
    const t = level / (levels - 1);
    const y = THREE.MathUtils.lerp(-0.34, 0.34, t);
    const foldScale = level % 2 === 0 ? 0.84 : 1.0;
    const endEase = 0.91 + 0.09 * Math.sin(Math.PI * t);
    const scale = foldScale * endEase;

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const x = -0.02 + 0.99 * c * scale;
      const frontTaper = 1 - 0.14 * Math.max(0, c);
      const z = 0.47 * s * scale * frontTaper;
      vertices.push(x, y, z);
    }
  }

  for (let level = 0; level < levels - 1; level += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = level * segments + segment;
      const b = level * segments + next;
      const c = (level + 1) * segments + next;
      const d = (level + 1) * segments + segment;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createSelectionVolume(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 1.4, 1.45),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.065,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.visible = false;
  mesh.position.x = 0.08;
  mesh.name = 'BellowsSelectionVolume';
  return mesh;
}

export function createBellowsModelV2(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'bellows-3d';
  group.userData.assetVersion = 'bellows-v2';
  group.userData.sourceKey = 'sketchfab-nudluria-bellows-cc-by';
  group.userData.construction = 'continuous-pleated-shell';
  group.userData.snapPoints = [
    { id: 'hinge', position: [-1.05, 0, 0] },
    { id: 'nozzle', position: [2.18, 0, 0] }
  ];

  const woodTop = new THREE.MeshPhysicalMaterial({
    color: 0xa86a3b,
    metalness: 0,
    roughness: 0.58,
    clearcoat: 0.04,
    clearcoatRoughness: 0.82
  });
  const woodBottom = new THREE.MeshPhysicalMaterial({
    color: 0x8d552f,
    metalness: 0,
    roughness: 0.61,
    clearcoat: 0.035,
    clearcoatRoughness: 0.84
  });
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0x4b2826,
    metalness: 0,
    roughness: 0.84,
    clearcoat: 0.015,
    clearcoatRoughness: 0.95,
    sheen: 0.10,
    sheenRoughness: 0.86,
    sheenColor: new THREE.Color(0x8b5148)
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb7c1c7, metalness: 0.88, roughness: 0.29 });
  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2b25, metalness: 0, roughness: 0.9 });

  const bottomBoard = createPaddleBoard(woodBottom);
  bottomBoard.position.y = -0.43;
  bottomBoard.name = 'BellowsLowerPaddle';
  group.add(bottomBoard);

  const upperBoard = createPaddleBoard(woodTop);
  upperBoard.position.y = 0.43;
  upperBoard.name = 'BellowsUpperPaddle';
  group.add(upperBoard);

  const pleats = new THREE.Mesh(createPleatedBellowsGeometry(), leather);
  pleats.name = 'ContinuousLeatherPleats';
  group.add(pleats);

  // Comfortable dark grip inserts keep the rear handles readable without
  // introducing decorative ornament.
  for (const y of [-0.515, 0.515]) {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.28), gripMaterial);
    grip.position.set(-1.53, y, 0);
    grip.name = y < 0 ? 'LowerHandleGrip' : 'UpperHandleGrip';
    group.add(grip);
  }

  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.02, 40), steel);
  hinge.rotation.x = Math.PI / 2;
  hinge.position.set(-1.03, 0, 0);
  hinge.name = 'BellowsHingePin';
  group.add(hinge);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.24, 40), steel);
  collar.rotation.z = -Math.PI / 2;
  collar.position.x = 1.15;
  collar.name = 'NozzleCollar';
  group.add(collar);

  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.105, 0.58, 40), steel);
  cone.rotation.z = -Math.PI / 2;
  cone.position.x = 1.54;
  cone.name = 'NozzleTaper';
  group.add(cone);

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.078, 0.72, 40), steel);
  tube.rotation.z = -Math.PI / 2;
  tube.position.x = 2.13;
  tube.name = 'NozzleTube';
  group.add(tube);

  const selection = createSelectionVolume();
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
