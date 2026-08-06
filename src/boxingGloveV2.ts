import * as THREE from 'three';
import {
  createFineBumpTexture,
  extrude,
  makeSelectionBox,
  roundedRectPath,
  roundedRectShape,
  smooth01,
  type PremiumReviewAssetModel
} from './parts0913PremiumShared';

function createSculptedShell(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 144, 112);
  const position = geometry.getAttribute('position');
  const p = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    p.fromBufferAttribute(position, index).normalize();
    const x = p.x;
    const y = p.y;
    const z = p.z;

    // The back of the glove narrows into the cuff while the impact side swells
    // into the padded knuckle block. The asymmetry is intentional: a boxing
    // glove should never read as a mirrored mitten.
    const wristBlend = smooth01((x + 0.92) / 0.72);
    const frontBlend = smooth01((x + 0.18) / 1.05);
    const knuckleBulge = Math.exp(-Math.pow((x - 0.52) / 0.48, 2)) * Math.max(0, y);
    const palmRound = 1 - 0.08 * Math.max(0, -y) * Math.max(0, 1 - Math.abs(z));

    const px = x * (1.02 + frontBlend * 0.17) + 0.10 * frontBlend;
    const py = y * (0.62 + wristBlend * 0.26 + frontBlend * 0.06) + knuckleBulge * 0.10;
    const pz = z * (0.48 + wristBlend * 0.16 + frontBlend * 0.05) * palmRound;

    // Flatten only the striking cap very slightly so the impact area reads as a
    // padded face rather than a perfect egg.
    const cap = smooth01((x - 0.45) / 0.42);
    position.setXYZ(index, px - cap * Math.max(0, px - 1.05) * 0.42, py, pz);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createThumbGeometry(): THREE.CapsuleGeometry {
  return new THREE.CapsuleGeometry(0.285, 0.52, 16, 36);
}

function createCuffRing(): THREE.Mesh {
  const outer = roundedRectShape(0.86, 1.00, 0.22);
  outer.holes.push(roundedRectPath(0.48, 0.62, 0.16));
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x8f202c,
    roughness: 0.60,
    metalness: 0,
    clearcoat: 0.055,
    clearcoatRoughness: 0.84,
    bumpMap: createFineBumpTexture(0x63756666, 5000),
    bumpScale: 0.006
  });
  const mesh = new THREE.Mesh(extrude(outer, 0.36, 0.055), material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.x = -1.00;
  mesh.name = 'BoxingGloveV2OpenCuff';
  return mesh;
}

export function createBoxingGloveModelV2(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v2';
  group.userData.sourceKey = 'sketchfab-ule71-boxing-gloves-cc-by';
  group.userData.referenceStyle = 'sculpted-anatomical';
  group.userData.snapPoints = [
    { id: 'button', position: [-1.23, 0.04, 0] },
    { id: 'impact', position: [1.16, 0.18, 0] }
  ];

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc12f3b,
    metalness: 0,
    roughness: 0.52,
    clearcoat: 0.11,
    clearcoatRoughness: 0.72,
    sheen: 0.15,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xff9c98),
    bumpMap: createFineBumpTexture(0x676c6f76, 7200),
    bumpScale: 0.0065
  });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x6f1720, roughness: 0.67, metalness: 0 });
  const buttonMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdadfe2,
    roughness: 0.30,
    metalness: 0.72,
    clearcoat: 0.10,
    clearcoatRoughness: 0.45
  });

  const shell = new THREE.Mesh(createSculptedShell(), leather);
  shell.position.set(0.04, 0.06, 0);
  shell.rotation.z = -0.06;
  shell.name = 'BoxingGloveV2SculptedShell';
  group.add(shell);

  // Thumb follows the palm instead of hanging below the silhouette like the v1
  // primitive. Overlap is buried inside the same leather surface so it reads as
  // one padded construction.
  const thumb = new THREE.Mesh(createThumbGeometry(), leather);
  thumb.scale.set(1.0, 1.08, 0.93);
  thumb.rotation.set(0.16, 0.12, -0.92);
  thumb.position.set(0.16, -0.63, 0.28);
  thumb.name = 'BoxingGloveV2Thumb';
  group.add(thumb);

  const cuff = createCuffRing();
  group.add(cuff);

  // Deep sleeve shadow makes the cuff opening legible from oblique review
  // angles without relying on a black decal.
  const sleeve = new THREE.Mesh(
    extrude(roundedRectShape(0.43, 0.57, 0.14), 0.025, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x28171a, roughness: 0.96, metalness: 0 })
  );
  sleeve.rotation.y = Math.PI / 2;
  sleeve.position.x = -1.205;
  sleeve.name = 'BoxingGloveV2SleeveShadow';
  group.add(sleeve);

  // Palm stitching is thin and deliberately intersects the glove slightly. It
  // reads as stitched leather rather than a floating decorative cable.
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.58, -0.47, 0.555),
    new THREE.Vector3(-0.08, -0.59, 0.592),
    new THREE.Vector3(0.44, -0.45, 0.575),
    new THREE.Vector3(0.78, -0.15, 0.51)
  ]);
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 72, 0.0105, 6, false), seamMaterial);
  seam.name = 'BoxingGloveV2InsetPalmSeam';
  group.add(seam);

  // The TIM glove is a mechanism: preserve the characteristic rear trigger
  // button, but make it a machined part rather than the v1 square cuff block.
  const buttonStem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.19, 32), buttonMaterial);
  buttonStem.rotation.z = Math.PI / 2;
  buttonStem.position.set(-1.25, 0.04, 0);
  buttonStem.name = 'BoxingGloveTriggerStem';
  group.add(buttonStem);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 40), buttonMaterial);
  button.rotation.z = Math.PI / 2;
  button.position.set(-1.39, 0.04, 0);
  button.name = 'BoxingGloveTriggerButton';
  group.add(button);

  const selection = makeSelectionBox(new THREE.Vector3(3.05, 2.12, 1.55));
  selection.position.set(-0.05, 0.02, 0);
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
