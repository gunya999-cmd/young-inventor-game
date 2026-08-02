import * as THREE from 'three';
import { createFineBumpTexture, makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;

function smoothSample(values: number[], t: number): number {
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(scaled));
  const f = THREE.MathUtils.smootherstep(scaled - index, 0, 1);
  return THREE.MathUtils.lerp(values[index], values[index + 1], f);
}

function createGloveLoftGeometry(): THREE.BufferGeometry {
  const rings = 72;
  const segments = 80;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const xs = [-0.94, -0.80, -0.57, -0.30, 0.00, 0.28, 0.54, 0.77, 0.98, 1.10];
  const radiusY = [0.07, 0.43, 0.56, 0.68, 0.78, 0.86, 0.91, 0.84, 0.60, 0.08];
  const radiusZ = [0.06, 0.38, 0.48, 0.58, 0.66, 0.71, 0.74, 0.69, 0.52, 0.07];
  const centerY = [0.00, -0.01, 0.00, 0.035, 0.085, 0.145, 0.205, 0.195, 0.115, 0.055];

  for (let ring = 0; ring < rings; ring += 1) {
    const t = ring / (rings - 1);
    const x = smoothSample(xs, t);
    const ry = smoothSample(radiusY, t);
    const rz = smoothSample(radiusZ, t);
    const cy = smoothSample(centerY, t);
    const knuckle = Math.exp(-Math.pow((t - 0.62) / 0.19, 2));
    const palm = Math.exp(-Math.pow((t - 0.43) / 0.28, 2));

    for (let segment = 0; segment < segments; segment += 1) {
      const v = segment / segments;
      const angle = v * TAU;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      // Fuller than an ellipse, but still soft: this produces the padded boxing
      // glove cross-section without the balloon-like look of the old sphere.
      const sy = Math.sign(sin) * Math.pow(Math.abs(sin), 0.84);
      const sz = Math.sign(cos) * Math.pow(Math.abs(cos), 0.88);

      let y = cy + sy * ry;
      let z = sz * rz;

      // Lift the upper/front knuckle mass and flatten the lower palm slightly.
      if (sy > 0) y += sy * knuckle * 0.07;
      if (sy < 0) y += (-sy) * palm * 0.045;

      // Natural palm hollow on the visible front side where the thumb folds in.
      const palmSide = Math.max(0, sz);
      const thumbSeat = Math.exp(-Math.pow((t - 0.43) / 0.18, 2)) * Math.max(0, -sy) * palmSide;
      z -= thumbSeat * 0.055;
      y += thumbSeat * 0.028;

      positions.push(x, y, z);
      uvs.push(t, v);
    }
  }

  for (let ring = 0; ring < rings - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + next;
      const d = (ring + 1) * segments + segment;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createThumbLoftGeometry(): THREE.BufferGeometry {
  const rings = 42;
  const segments = 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, -0.34, 0.22),
    new THREE.Vector3(-0.02, -0.50, 0.31),
    new THREE.Vector3(0.23, -0.63, 0.35),
    new THREE.Vector3(0.47, -0.62, 0.34),
    new THREE.Vector3(0.62, -0.49, 0.30)
  ], false, 'centripetal');

  for (let ring = 0; ring < rings; ring += 1) {
    const t = ring / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();

    const rootBlend = THREE.MathUtils.smoothstep(t, 0, 0.17);
    const tipBlend = 1 - THREE.MathUtils.smoothstep(t, 0.78, 1);
    const ry = (0.20 + 0.16 * rootBlend) * (0.22 + 0.78 * tipBlend);
    const rz = (0.18 + 0.14 * rootBlend) * (0.22 + 0.78 * tipBlend);

    for (let segment = 0; segment < segments; segment += 1) {
      const v = segment / segments;
      const angle = v * TAU;
      const point = center.clone()
        .addScaledVector(up, Math.cos(angle) * ry)
        .addScaledVector(side, Math.sin(angle) * rz);
      positions.push(point.x, point.y, point.z);
      uvs.push(t, v);
    }
  }

  for (let ring = 0; ring < rings - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + next;
      const d = (ring + 1) * segments + segment;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function installLeatherDetails(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vGloveLocal;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvGloveLocal = position;'
    );

    shader.fragmentShader = `
      varying vec3 vGloveLocal;
      float gloveBand(float value, float center, float width) {
        return 1.0 - smoothstep(width * 0.45, width, abs(value - center));
      }
    ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float palmSide = smoothstep(0.18, 0.40, vGloveLocal.z);
       float palmWindow = smoothstep(-0.48, -0.18, vGloveLocal.y) * (1.0 - smoothstep(0.15, 0.72, vGloveLocal.x));
       float palmCrease = gloveBand(vGloveLocal.y + 0.17 * vGloveLocal.x, -0.43, 0.026) * palmSide * palmWindow;
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.028, 0.040), palmCrease * 0.52);`
    );
  };
  material.customProgramCacheKey = () => 'boxing-glove-v3-integrated-leather-details';
}

function createCuff(leather: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.47, 0.52, 64, 3, true), leather);
  sleeve.rotation.z = Math.PI / 2;
  sleeve.scale.set(1.08, 1, 0.90);
  sleeve.position.x = -0.91;
  sleeve.name = 'BoxingGloveV3PaddedCuff';
  group.add(sleeve);

  const opening = new THREE.Mesh(
    new THREE.CircleGeometry(0.415, 64),
    new THREE.MeshStandardMaterial({ color: 0x241619, roughness: 0.97, metalness: 0, side: THREE.DoubleSide })
  );
  opening.rotation.y = Math.PI / 2;
  opening.scale.set(1, 1.08, 0.88);
  opening.position.x = -1.185;
  opening.name = 'BoxingGloveV3CuffOpening';
  group.add(opening);

  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9f202d,
    roughness: 0.56,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.86
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.050, 14, 64), rimMaterial);
  rim.rotation.y = Math.PI / 2;
  rim.scale.set(1, 1.08, 0.88);
  rim.position.x = -1.19;
  rim.name = 'BoxingGloveV3CuffRim';
  group.add(rim);

  return group;
}

export function createBoxingGloveModelV3(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v3';
  group.userData.sourceKey = 'sketchfab-incg5764-boxing-glove-cc-by';
  group.userData.referenceStyle = 'lofted-anatomical';
  group.userData.snapPoints = [
    { id: 'button', position: [-1.38, 0.02, 0] },
    { id: 'impact', position: [1.08, 0.12, 0] }
  ];

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xb92735,
    metalness: 0,
    roughness: 0.59,
    clearcoat: 0.055,
    clearcoatRoughness: 0.83,
    sheen: 0.12,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xf36e72),
    bumpMap: createFineBumpTexture(0x626f7867, 9200),
    bumpScale: 0.0048
  });
  installLeatherDetails(leather);

  const shell = new THREE.Mesh(createGloveLoftGeometry(), leather);
  shell.name = 'BoxingGloveV3LoftedPaddedShell';
  group.add(shell);

  const thumb = new THREE.Mesh(createThumbLoftGeometry(), leather);
  thumb.name = 'BoxingGloveV3TuckedThumb';
  group.add(thumb);

  group.add(createCuff(leather));

  // Small mechanical rear plunger keeps the classic TIM function readable,
  // without allowing the trigger to dominate the silhouette like v2 did.
  const metal = new THREE.MeshStandardMaterial({ color: 0xbac3c8, metalness: 0.80, roughness: 0.31 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.20, 28), metal);
  stem.rotation.z = Math.PI / 2;
  stem.position.set(-1.27, 0.02, 0);
  stem.name = 'BoxingGloveV3TriggerStem';
  group.add(stem);

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.075, 36), metal);
  button.rotation.z = Math.PI / 2;
  button.position.set(-1.40, 0.02, 0);
  button.name = 'BoxingGloveV3TriggerButton';
  group.add(button);

  const selection = makeSelectionBox(new THREE.Vector3(3.05, 2.20, 1.62));
  selection.position.set(-0.04, 0.03, 0);
  group.add(selection);

  return { group, selectionMeshes: [selection] };
}
