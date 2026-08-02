import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createBoxingGloveModelV11 } from './boxingGloveV11';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

function createMainPaddingGeometry(): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(1.16, 1.02, 0.84, 14, 0.31);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);

    // Keep almost the entire fist at full padded width. Only the rear quarter
    // narrows toward the wrist. Earlier versions tapered the whole object and
    // became bells/handbags when gravity rotated the glove vertically.
    const rearT = THREE.MathUtils.smoothstep(x, -0.58, -0.22);
    const rearScale = THREE.MathUtils.lerp(0.74, 1.0, rearT);
    y *= rearScale;
    z *= THREE.MathUtils.lerp(0.80, 1.0, rearT);

    // Raised upper knuckle padding toward the striking half.
    const frontT = THREE.MathUtils.smoothstep(x, 0.00, 0.52);
    const top = THREE.MathUtils.clamp(y / 0.51, 0, 1);
    y += top * frontT * 0.075;
    y += frontT * 0.025;

    // Slightly flatten the front striking face, keeping the bevelled perimeter.
    if (x > 0.43) x = 0.43 + (x - 0.43) * 0.58;

    // Small palm-side seat for the thumb on the near side.
    const near = THREE.MathUtils.clamp(z / 0.42, 0, 1);
    const lower = THREE.MathUtils.clamp(-y / 0.51, 0, 1);
    const seat = Math.exp(-Math.pow((x + 0.02) / 0.30, 2)) * near * lower;
    y += seat * 0.032;
    z -= seat * 0.050;

    position.setXYZ(i, x + 0.24, y + 0.055, z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function populateHead(head: THREE.Group): void {
  head.clear();

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc62838,
    roughness: 0.57,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.86,
    sheen: 0.17,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xef6c75),
    bumpMap: createFineBumpTexture(0x62677845, 16500),
    bumpScale: 0.0036
  });
  const cuffLeather = new THREE.MeshPhysicalMaterial({
    color: 0xa81d2a,
    roughness: 0.63,
    metalness: 0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.91
  });
  const seam = new THREE.MeshStandardMaterial({ color: 0x83141f, roughness: 0.79, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211619, roughness: 0.98, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d2d7, roughness: 0.28, metalness: 0.88 });

  // One dominant padded fist shell. It remains wide through the knuckles and
  // palm, with only the wrist end narrowing.
  const main = new THREE.Mesh(createMainPaddingGeometry(), leather);
  main.name = 'BoxingGloveV15MainPadding';
  head.add(main);

  // Palm/wrist bridge is buried deeply inside the main shell and cuff. Its job
  // is only to remove the visual pinch where those two volumes meet.
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.33, 64, 48), leather);
  bridge.scale.set(1.16, 0.94, 0.94);
  bridge.position.set(-0.31, 0.005, 0);
  bridge.name = 'BoxingGloveV15WristBridge';
  head.add(bridge);

  // One compact tucked thumb: short enough not to read as a handle/finger set.
  const thumbRoot = new THREE.Mesh(new THREE.SphereGeometry(0.205, 56, 40), leather);
  thumbRoot.scale.set(1.10, 0.92, 0.92);
  thumbRoot.position.set(0.00, -0.30, 0.30);
  thumbRoot.name = 'BoxingGloveV15ThumbRoot';
  head.add(thumbRoot);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 12, 28), leather);
  thumb.scale.set(1.0, 1.0, 0.90);
  thumb.rotation.z = -0.78;
  thumb.rotation.x = 0.10;
  thumb.position.set(0.19, -0.36, 0.34);
  thumb.name = 'BoxingGloveV15TuckedThumb';
  head.add(thumb);

  // Short square-ish padded cuff, typical of a boxing glove and visually very
  // different from the bell-shaped cuffs that failed previous reviews.
  const cuff = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.62, 0.66, 10, 0.15), cuffLeather);
  cuff.position.set(-0.57, -0.02, 0);
  cuff.name = 'BoxingGloveV15Cuff';
  head.add(cuff);

  // Subtle seam/band around the wrist construction.
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.292, 0.014, 8, 56), seam);
  band.rotation.y = Math.PI / 2;
  band.scale.set(1, 1.0, 0.94);
  band.position.set(-0.35, -0.02, 0);
  band.name = 'BoxingGloveV15WristSeam';
  head.add(band);

  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.232, 56), dark);
  opening.rotation.y = Math.PI / 2;
  opening.position.set(-0.79, -0.02, 0);
  head.add(opening);

  // The spring terminates inside a metal receiver embedded in the cuff.
  const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 40, 2), steel);
  receiver.rotation.z = Math.PI / 2;
  receiver.position.set(-0.68, -0.02, 0);
  receiver.name = 'BoxingGloveV15SpringReceiver';
  head.add(receiver);

  const receiverRing = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.016, 10, 40), steel);
  receiverRing.rotation.y = Math.PI / 2;
  receiverRing.position.set(-0.77, -0.02, 0);
  head.add(receiverRing);

  // Short inset thumb seam reinforces that this is one leather glove.
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.02, -0.19, 0.435),
    new THREE.Vector3(0.08, -0.29, 0.470),
    new THREE.Vector3(0.22, -0.31, 0.455),
    new THREE.Vector3(0.34, -0.23, 0.400)
  ], false, 'centripetal');
  const thumbSeam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 48, 0.0048, 8, false), seam);
  thumbSeam.name = 'BoxingGloveV15ThumbSeam';
  head.add(thumbSeam);
}

export function createBoxingGloveModelV15(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV11();
  const root = model.group;
  const head = root.getObjectByName('BoxingGloveV11DynamicHead') as THREE.Group | undefined;
  if (!head) throw new Error('Boxing Glove v11 dynamic head was not found.');

  populateHead(head);
  head.name = 'BoxingGloveV15DynamicHead';
  root.userData.assetVersion = 'boxing-glove-v15';
  root.userData.referenceStyle = 'broad-padded-boxing-glove-tim-physics';
  return model;
}
