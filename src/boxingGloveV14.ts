import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createBoxingGloveModelV11 } from './boxingGloveV11';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

function createTaperedPaddedShell(): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(1.30, 1.06, 0.86, 14, 0.34);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    const xn = THREE.MathUtils.clamp((x + 0.65) / 1.30, 0, 1);
    const fill = THREE.MathUtils.smootherstep(xn, 0.02, 0.62);
    const taper = 0.70 + 0.30 * fill;

    y *= taper;
    z *= 0.92 * taper + 0.08;

    // The padded knuckles ride slightly higher toward the striking end.
    const upper = THREE.MathUtils.clamp(y / 0.53, 0, 1);
    const knuckle = Math.exp(-Math.pow((xn - 0.78) / 0.28, 2));
    y += upper * knuckle * 0.075;
    y += fill * 0.045;

    // Soft palm scoop around the thumb root on the near/lower quadrant.
    const near = THREE.MathUtils.clamp(z / 0.43, 0, 1);
    const lower = THREE.MathUtils.clamp(-y / 0.53, 0, 1);
    const thumbSeat = Math.exp(-Math.pow((xn - 0.43) / 0.22, 2)) * near * lower;
    y += thumbSeat * 0.035;
    z -= thumbSeat * 0.055;

    // A tiny asymmetry keeps it from reading as a generic rounded block.
    x += 0.12;
    position.setXYZ(i, x, y + 0.02, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCurledThumb(leather: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, -0.20, 0.29),
    new THREE.Vector3(0.00, -0.34, 0.39),
    new THREE.Vector3(0.18, -0.41, 0.43),
    new THREE.Vector3(0.36, -0.35, 0.40),
    new THREE.Vector3(0.48, -0.22, 0.32)
  ], false, 'centripetal');
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.17, 18, false), leather);
  tube.name = 'BoxingGloveV14ThumbBody';
  group.add(tube);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.175, 48, 36), leather);
  tip.scale.set(1.04, 0.92, 0.94);
  tip.position.copy(curve.getPoint(1));
  tip.name = 'BoxingGloveV14ThumbTip';
  group.add(tip);
  return group;
}

function populateGloveHead(head: THREE.Group): void {
  head.clear();

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc82737,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.84,
    sheen: 0.17,
    sheenRoughness: 0.79,
    sheenColor: new THREE.Color(0xef6b74),
    bumpMap: createFineBumpTexture(0x62677844, 16000),
    bumpScale: 0.0037
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xaa1d2a,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.90
  });
  const inner = new THREE.MeshStandardMaterial({ color: 0x201517, roughness: 0.98, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d2d7, roughness: 0.28, metalness: 0.88 });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x84151f, roughness: 0.77, metalness: 0 });

  const shell = new THREE.Mesh(createTaperedPaddedShell(), leather);
  shell.name = 'BoxingGloveV14PaddedShell';
  head.add(shell);

  const thumb = createCurledThumb(leather);
  thumb.name = 'BoxingGloveV14CurledThumb';
  head.add(thumb);

  // Short wide cuff, deeply overlapping the tapered rear of the padded shell.
  const cuff = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.62, 0.66, 10, 0.16), cuffLeather);
  cuff.position.set(-0.55, -0.03, 0);
  cuff.name = 'BoxingGloveV14Cuff';
  head.add(cuff);

  // Clean dark wrist break and metal receiver recessed into the cuff.
  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.235, 64), inner);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.77, -0.03, 0);
  head.add(opening);

  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(-0.72, -0.03, 0);
  receiver.name = 'BoxingGloveV14SpringReceiver';
  head.add(receiver);

  const receiverRing = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 10, 40), steel);
  receiverRing.rotation.y = Math.PI / 2;
  receiverRing.position.set(-0.81, -0.03, 0);
  head.add(receiverRing);

  const thumbSeam = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.08, -0.21, 0.445),
    new THREE.Vector3(0.06, -0.33, 0.49),
    new THREE.Vector3(0.23, -0.36, 0.48),
    new THREE.Vector3(0.40, -0.25, 0.415)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(thumbSeam, 64, 0.005, 8, false), seamMat);
  seam.name = 'BoxingGloveV14ThumbSeam';
  head.add(seam);
}

export function createBoxingGloveModelV14(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV11();
  const root = model.group;
  const head = root.getObjectByName('BoxingGloveV11DynamicHead') as THREE.Group | undefined;
  if (!head) throw new Error('Boxing Glove v11 head was not found.');

  populateGloveHead(head);
  head.name = 'BoxingGloveV14DynamicHead';
  root.userData.assetVersion = 'boxing-glove-v14';
  root.userData.referenceStyle = 'single-padded-shell-boxing-glove-tim-physics';
  return model;
}
