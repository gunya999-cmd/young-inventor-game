import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createBoxingGloveModelV11 } from './boxingGloveV11';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

function createFistSilhouetteGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.48, 0.27);
  shape.bezierCurveTo(-0.35, 0.43, -0.08, 0.57, 0.23, 0.60);
  shape.bezierCurveTo(0.51, 0.63, 0.73, 0.54, 0.82, 0.34);
  shape.bezierCurveTo(0.90, 0.16, 0.88, -0.10, 0.77, -0.31);
  shape.bezierCurveTo(0.66, -0.50, 0.46, -0.58, 0.25, -0.57);
  shape.bezierCurveTo(0.05, -0.56, -0.13, -0.47, -0.24, -0.35);
  shape.bezierCurveTo(-0.34, -0.25, -0.42, -0.23, -0.48, -0.25);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.66,
    steps: 2,
    curveSegments: 36,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.14,
    bevelSegments: 12
  });
  geometry.center();
  geometry.scale(1.0, 1.0, 1.03);
  geometry.translate(0.18, 0.04, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createThumbSilhouetteGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.14, 0.03);
  shape.bezierCurveTo(-0.03, -0.08, 0.04, -0.28, 0.20, -0.37);
  shape.bezierCurveTo(0.35, -0.45, 0.49, -0.38, 0.53, -0.24);
  shape.bezierCurveTo(0.57, -0.10, 0.48, 0.02, 0.34, 0.07);
  shape.bezierCurveTo(0.16, 0.13, -0.02, 0.10, -0.14, 0.03);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    steps: 2,
    curveSegments: 30,
    bevelEnabled: true,
    bevelThickness: 0.085,
    bevelSize: 0.070,
    bevelSegments: 10
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function populateHead(head: THREE.Group): void {
  head.clear();

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc72737,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.03,
    clearcoatRoughness: 0.88,
    sheen: 0.15,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xef6d75),
    bumpMap: createFineBumpTexture(0x62677846, 18000),
    bumpScale: 0.0035
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xa91d2a,
    roughness: 0.64,
    metalness: 0,
    clearcoat: 0.018,
    clearcoatRoughness: 0.92
  });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x7d141e, roughness: 0.80, metalness: 0 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x201518, roughness: 0.98, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d2d7, roughness: 0.28, metalness: 0.88 });

  const fist = new THREE.Mesh(createFistSilhouetteGeometry(), leather);
  fist.name = 'BoxingGloveV16Fist';
  head.add(fist);

  const thumb = new THREE.Mesh(createThumbSilhouetteGeometry(), leather);
  thumb.position.set(0.18, -0.25, 0.34);
  thumb.rotation.y = -0.04;
  thumb.name = 'BoxingGloveV16Thumb';
  head.add(thumb);

  const cuff = new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.62, 0.68, 10, 0.15), cuffLeather);
  cuff.position.set(-0.57, -0.01, 0);
  cuff.name = 'BoxingGloveV16Cuff';
  head.add(cuff);

  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, -0.16, 0.52),
    new THREE.Vector3(0.12, -0.27, 0.55),
    new THREE.Vector3(0.27, -0.31, 0.53),
    new THREE.Vector3(0.41, -0.22, 0.47)
  ], false, 'centripetal');
  const thumbSeam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 64, 0.0045, 8, false), seamMaterial);
  thumbSeam.name = 'BoxingGloveV16ThumbSeam';
  head.add(thumbSeam);

  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.232, 64), inner);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.79, -0.01, 0);
  head.add(opening);

  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(-0.68, -0.01, 0);
  receiver.name = 'BoxingGloveV16SpringReceiver';
  head.add(receiver);

  const receiverRing = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 10, 40), steel);
  receiverRing.rotation.y = Math.PI / 2;
  receiverRing.position.set(-0.77, -0.01, 0);
  head.add(receiverRing);
}

export function createBoxingGloveVisualV16(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV11();
  const root = model.group;
  const head = root.getObjectByName('BoxingGloveV11DynamicHead') as THREE.Group | undefined;
  if (!head) throw new Error('Boxing Glove v11 dynamic head was not found.');

  populateHead(head);
  head.name = 'BoxingGloveV16DynamicHead';
  root.userData.assetVersion = 'boxing-glove-v16';
  root.userData.referenceStyle = 'authentic-side-silhouette-boxing-glove-tim-physics';
  return model;
}
