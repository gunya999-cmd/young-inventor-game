import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createBoxingGloveModelV11 } from './boxingGloveV11';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

function createPaddedGloveHead(): THREE.Group {
  const group = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc72535,
    roughness: 0.56,
    metalness: 0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.84,
    sheen: 0.18,
    sheenRoughness: 0.79,
    sheenColor: new THREE.Color(0xee6b74),
    bumpMap: createFineBumpTexture(0x62677843, 15000),
    bumpScale: 0.0037
  });
  const darkerLeather = new THREE.MeshPhysicalMaterial({
    color: 0xaa1d2a,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.90
  });
  const darkInner = new THREE.MeshStandardMaterial({ color: 0x201517, roughness: 0.98, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d2d7, roughness: 0.28, metalness: 0.88 });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x851520, roughness: 0.77, metalness: 0 });

  // Broad rounded striking pad: this is the dominant boxing-glove cue.
  const knuckle = new THREE.Mesh(new RoundedBoxGeometry(0.78, 1.02, 0.82, 10, 0.28), leather);
  knuckle.position.set(0.43, 0.11, 0);
  knuckle.name = 'BoxingGloveV13KnucklePad';
  group.add(knuckle);

  // Deep palm padding overlaps the knuckle block by more than half its volume,
  // so the two read as one inflated leather object instead of glued primitives.
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.50, 72, 56), leather);
  palm.scale.set(1.10, 1.00, 0.90);
  palm.position.set(0.03, 0.00, 0);
  palm.name = 'BoxingGloveV13Palm';
  group.add(palm);

  // Upper bridge rounds the shoulder from palm into knuckle padding.
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.38, 64, 48), leather);
  bridge.scale.set(1.05, 0.92, 0.92);
  bridge.position.set(0.24, 0.24, 0);
  bridge.name = 'BoxingGloveV13KnuckleBridge';
  group.add(bridge);

  // Narrow wrist transition disappears well inside both palm and cuff.
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.31, 56, 40), leather);
  wrist.scale.set(1.04, 0.92, 0.94);
  wrist.position.set(-0.36, -0.03, 0);
  wrist.name = 'BoxingGloveV13Wrist';
  group.add(wrist);

  // Short padded cuff / strap. Its overlap with wrist removes the disconnected
  // red skirt seen in earlier versions.
  const cuff = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.61, 0.65, 8, 0.14), darkerLeather);
  cuff.position.set(-0.56, -0.03, 0);
  cuff.name = 'BoxingGloveV13Cuff';
  group.add(cuff);

  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.235, 56), darkInner);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.755, -0.03, 0);
  group.add(opening);

  // Spring receiver is embedded into the cuff rather than floating outside.
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(-0.72, -0.03, 0);
  receiver.name = 'BoxingGloveV13SpringReceiver';
  group.add(receiver);

  const receiverRing = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.016, 10, 40), steel);
  receiverRing.rotation.y = Math.PI / 2;
  receiverRing.position.set(-0.81, -0.03, 0);
  group.add(receiverRing);

  // Curled thumb: root + padded middle + rounded tip. All three components are
  // strongly buried into one another and into the palm; only their outer skin
  // is visible, producing the familiar tucked boxing-glove thumb silhouette.
  const thumbRoot = new THREE.Mesh(new THREE.SphereGeometry(0.235, 56, 42), leather);
  thumbRoot.scale.set(1.10, 0.92, 0.92);
  thumbRoot.position.set(-0.02, -0.31, 0.31);
  group.add(thumbRoot);

  const thumbMiddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.185, 0.24, 12, 28), leather);
  thumbMiddle.rotation.z = -0.72;
  thumbMiddle.rotation.x = 0.08;
  thumbMiddle.position.set(0.18, -0.38, 0.36);
  group.add(thumbMiddle);

  const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.19, 52, 38), leather);
  thumbTip.scale.set(1.02, 0.90, 0.92);
  thumbTip.position.set(0.36, -0.34, 0.34);
  group.add(thumbTip);

  // Small inset construction line where the thumb is sewn into the palm.
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, -0.22, 0.455),
    new THREE.Vector3(0.08, -0.34, 0.505),
    new THREE.Vector3(0.25, -0.37, 0.49),
    new THREE.Vector3(0.40, -0.27, 0.43)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 64, 0.0055, 8, false), seamMaterial);
  seam.name = 'BoxingGloveV13ThumbSeam';
  group.add(seam);

  return group;
}

export function createBoxingGloveModelV13(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV11();
  const root = model.group;
  const oldHead = root.getObjectByName('BoxingGloveV11DynamicHead') as THREE.Group | undefined;
  if (!oldHead) throw new Error('Boxing Glove v11 head was not found.');

  root.remove(oldHead);
  const head = createPaddedGloveHead();
  head.name = 'BoxingGloveV13DynamicHead';
  root.add(head);

  // v11 physics closes over the original head group. Re-parent the new visuals
  // into that exact moving group, then put it back into the mechanism.
  oldHead.clear();
  while (head.children.length > 0) oldHead.add(head.children[0]);
  oldHead.name = 'BoxingGloveV13DynamicHead';
  root.remove(head);
  root.add(oldHead);

  root.userData.assetVersion = 'boxing-glove-v13';
  root.userData.referenceStyle = 'premium-padded-boxing-glove-tim-physics';
  return model;
}
