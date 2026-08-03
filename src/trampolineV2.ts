import * as THREE from 'three';
import {
  createHelixBetween,
  extrude,
  makeSelectionBox,
  roundedRectPath,
  roundedRectShape,
  type PremiumReviewAssetModel
} from './parts0913PremiumShared';

function roundedLoopCurve(width: number, depth: number, radius: number, y: number): THREE.CatmullRomCurve3 {
  const w = width * 0.5;
  const d = depth * 0.5;
  const r = Math.min(radius, w, d);
  const points: THREE.Vector3[] = [];
  const corners = [
    { cx: w - r, cz: d - r, start: 0, end: Math.PI * 0.5 },
    { cx: -w + r, cz: d - r, start: Math.PI * 0.5, end: Math.PI },
    { cx: -w + r, cz: -d + r, start: Math.PI, end: Math.PI * 1.5 },
    { cx: w - r, cz: -d + r, start: Math.PI * 1.5, end: Math.PI * 2 }
  ];
  for (const corner of corners) {
    for (let index = 0; index < 12; index += 1) {
      const t = index / 12;
      const angle = THREE.MathUtils.lerp(corner.start, corner.end, t);
      points.push(new THREE.Vector3(corner.cx + Math.cos(angle) * r, y, corner.cz + Math.sin(angle) * r));
    }
  }
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.25);
}

function createULeg(x: number, steel: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, 0.02, -0.74),
    new THREE.Vector3(x, -0.42, -0.74),
    new THREE.Vector3(x, -0.62, -0.54),
    new THREE.Vector3(x, -0.62, 0.54),
    new THREE.Vector3(x, -0.42, 0.74),
    new THREE.Vector3(x, 0.02, 0.74)
  ]);
  const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.055, 10, false), steel);
  leg.name = x < 0 ? 'TrampolineV2LeftULeg' : 'TrampolineV2RightULeg';
  return leg;
}

export function createTrampolineModelV2(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'trampoline-3d';
  group.userData.assetVersion = 'trampoline-v2';
  group.userData.sourceKey = 'sketchfab-simon-laisne-trampoline-cc-by';
  group.userData.referenceStyle = 'game-ready-tubular-frame';
  group.userData.snapPoints = [{ id: 'bounce-surface', position: [0, 0.17, 0] }];

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0x38586c,
    metalness: 0.78,
    roughness: 0.34,
    clearcoat: 0.07,
    clearcoatRoughness: 0.48
  });
  const padMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc84e36,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.78
  });
  const matMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x18242c,
    roughness: 0.90,
    metalness: 0,
    sheen: 0.08,
    sheenRoughness: 0.93,
    sheenColor: new THREE.Color(0x53636d)
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1f262a, roughness: 0.86, metalness: 0 });

  const frameCurve = roundedLoopCurve(3.35, 2.02, 0.35, 0.02);
  const frame = new THREE.Mesh(new THREE.TubeGeometry(frameCurve, 220, 0.072, 12, true), steel);
  frame.name = 'TrampolineV2ContinuousTubularFrame';
  group.add(frame);

  const padShape = roundedRectShape(3.28, 1.95, 0.34);
  padShape.holes.push(roundedRectPath(2.72, 1.39, 0.27));
  const pad = new THREE.Mesh(extrude(padShape, 0.075, 0.025), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.105;
  pad.name = 'TrampolineV2ProtectivePad';
  group.add(pad);

  const mat = new THREE.Mesh(
    extrude(roundedRectShape(2.64, 1.31, 0.25), 0.045, 0.016),
    matMaterial
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.16;
  mat.name = 'TrampolineV2TautFabric';
  group.add(mat);

  // Twenty-two visible steel springs, distributed on all four sides with
  // consistent spacing and real coil geometry.
  const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const x of [-1.08, -0.72, -0.36, 0, 0.36, 0.72, 1.08]) {
    pairs.push([new THREE.Vector3(x, 0.155, 0.67), new THREE.Vector3(x, 0.075, 0.89)]);
    pairs.push([new THREE.Vector3(x, 0.155, -0.67), new THREE.Vector3(x, 0.075, -0.89)]);
  }
  for (const z of [-0.42, -0.14, 0.14, 0.42]) {
    pairs.push([new THREE.Vector3(1.34, 0.155, z), new THREE.Vector3(1.57, 0.075, z)]);
    pairs.push([new THREE.Vector3(-1.34, 0.155, z), new THREE.Vector3(-1.57, 0.075, z)]);
  }
  pairs.forEach(([start, end], index) => {
    const spring = createHelixBetween(start, end, 4.4, 0.026, 0.0085);
    spring.name = `TrampolineV2Spring${index + 1}`;
    group.add(spring);
  });

  group.add(createULeg(-1.08, steel), createULeg(1.08, steel));

  for (const x of [-1.08, 1.08]) {
    for (const z of [-0.55, 0.55]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.075, 28), rubber);
      foot.position.set(x, -0.65, z);
      foot.name = 'TrampolineV2RubberFoot';
      group.add(foot);
    }
  }

  // Small metal spring tabs make the coil endpoints look mechanically attached
  // instead of floating between the mat and frame. V3 moves these with the mat.
  const tabMaterial = new THREE.MeshStandardMaterial({ color: 0x9ba8af, metalness: 0.82, roughness: 0.34 });
  for (const x of [-1.08, -0.72, -0.36, 0, 0.36, 0.72, 1.08]) {
    for (const z of [-0.665, 0.665]) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.055), tabMaterial);
      tab.position.set(x, 0.158, z);
      tab.name = 'TrampolineV2MatSpringTab';
      group.add(tab);
    }
  }

  const selection = makeSelectionBox(new THREE.Vector3(3.75, 1.62, 2.35));
  selection.position.y = -0.12;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
