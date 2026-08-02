import * as THREE from 'three';
import { createBoxingGloveModelV11 } from './boxingGloveV11';
import { createFineBumpTexture, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const TAU = Math.PI * 2;

function spow(value: number, exponent: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

function createPaddedFistGeometry(): THREE.BufferGeometry {
  const latSegments = 72;
  const lonSegments = 96;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const a = 0.72; // punch axis half-length
  const b = 0.58; // vertical padding
  const c = 0.48; // depth
  const eLat = 0.58;
  const eLon = 0.62;

  for (let iy = 0; iy <= latSegments; iy += 1) {
    const v = iy / latSegments;
    const lat = -Math.PI * 0.5 + v * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);

    for (let ix = 0; ix <= lonSegments; ix += 1) {
      const u = ix / lonSegments;
      const lon = u * TAU;
      const co = Math.cos(lon);
      const so = Math.sin(lon);

      let x = a * spow(cl, eLat) * spow(co, eLon);
      let y = b * spow(sl, eLat);
      let z = c * spow(cl, eLat) * spow(so, eLon);

      const xn = THREE.MathUtils.clamp((x / a + 1) * 0.5, 0, 1);
      const front = THREE.MathUtils.smootherstep(xn, 0.12, 0.78);
      const wrist = 1 - THREE.MathUtils.smootherstep(xn, 0.02, 0.38);

      // Real gloves grow rapidly from the wrist into a broad padded fist.
      const yzScale = 0.70 + front * 0.30 - wrist * 0.08;
      y *= yzScale;
      z *= yzScale;

      // Raised knuckle dome and slightly flatter palm underside.
      const top = THREE.MathUtils.clamp(y / b, 0, 1);
      const knuckle = Math.exp(-Math.pow((xn - 0.70) / 0.28, 2));
      y += top * knuckle * 0.095;
      y += front * 0.035;

      // Flatten the striking face just a little while retaining a soft edge.
      if (x > a * 0.73) x = a * 0.73 + (x - a * 0.73) * 0.46;

      // Shallow thumb seat on the near/lower quadrant.
      const near = THREE.MathUtils.clamp(z / c, 0, 1);
      const lower = THREE.MathUtils.clamp(-y / b, 0, 1);
      const seat = Math.exp(-Math.pow((xn - 0.48) / 0.25, 2)) * near * lower;
      y += seat * 0.040;
      z -= seat * 0.060;

      positions.push(x + 0.13, y + 0.025, z);
      uvs.push(u, v);
    }
  }

  const stride = lonSegments + 1;
  for (let iy = 0; iy < latSegments; iy += 1) {
    for (let ix = 0; ix < lonSegments; ix += 1) {
      const a0 = iy * stride + ix;
      const b0 = a0 + 1;
      const c0 = (iy + 1) * stride + ix + 1;
      const d0 = (iy + 1) * stride + ix;
      indices.push(a0, b0, d0, b0, c0, d0);
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

function createTuckedThumbGeometry(): THREE.BufferGeometry {
  const rings = 52;
  const segments = 52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, -0.18, 0.31),
    new THREE.Vector3(0.02, -0.34, 0.40),
    new THREE.Vector3(0.20, -0.42, 0.43),
    new THREE.Vector3(0.39, -0.34, 0.40),
    new THREE.Vector3(0.52, -0.18, 0.32)
  ], false, 'centripetal');

  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(0, 0, 1);
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const taper = THREE.MathUtils.lerp(1.0, 0.66, THREE.MathUtils.smootherstep(t, 0.55, 1));
    const rootBlend = THREE.MathUtils.lerp(1.15, 1.0, THREE.MathUtils.smootherstep(t, 0, 0.28));
    const radiusY = 0.185 * taper * rootBlend;
    const radiusZ = 0.165 * taper * rootBlend;

    for (let s = 0; s < segments; s += 1) {
      const v = s / segments;
      const angle = v * TAU;
      const p = center.clone()
        .addScaledVector(up, Math.cos(angle) * radiusY)
        .addScaledVector(side, Math.sin(angle) * radiusZ);
      positions.push(p.x + 0.13, p.y + 0.025, p.z);
      uvs.push(t, v);
    }
  }

  for (let r = 0; r < rings - 1; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const next = (s + 1) % segments;
      const a = r * segments + s;
      const b = r * segments + next;
      const c = (r + 1) * segments + next;
      const d = (r + 1) * segments + s;
      indices.push(a, b, d, b, c, d);
    }
  }

  const rootCenter = positions.length / 3;
  const root = curve.getPoint(0);
  positions.push(root.x + 0.13, root.y + 0.025, root.z);
  uvs.push(0, 0.5);
  const tipCenter = positions.length / 3;
  const tip = curve.getPoint(1);
  positions.push(tip.x + 0.13, tip.y + 0.025, tip.z);
  uvs.push(1, 0.5);
  for (let s = 0; s < segments; s += 1) {
    const next = (s + 1) % segments;
    indices.push(rootCenter, next, s);
    const last = (rings - 1) * segments;
    indices.push(tipCenter, last + s, last + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createBoxingGloveModelV12(): PremiumReviewAssetModel {
  const model = createBoxingGloveModelV11();
  const group = model.group;
  const glove = group.getObjectByName('BoxingGloveV11DynamicHead') as THREE.Group | undefined;
  if (!glove) throw new Error('Boxing Glove v11 head was not found.');

  const oldBody = glove.getObjectByName('BoxingGloveV11Body');
  const oldThumb = glove.getObjectByName('BoxingGloveV11Thumb');
  if (oldBody) glove.remove(oldBody);
  if (oldThumb) glove.remove(oldThumb);

  // Remove the old decorative tube seam; v12 uses a subtle inset seam aligned
  // with the new tucked-thumb geometry.
  const oldTubes = glove.children.filter((child) => child instanceof THREE.Mesh && child.geometry.type === 'TubeGeometry');
  oldTubes.forEach((child) => glove.remove(child));

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc92737,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.045,
    clearcoatRoughness: 0.82,
    sheen: 0.17,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xef6a73),
    bumpMap: createFineBumpTexture(0x62677842, 14000),
    bumpScale: 0.0038
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x85141f, roughness: 0.76, metalness: 0 });

  const body = new THREE.Mesh(createPaddedFistGeometry(), leather);
  body.name = 'BoxingGloveV12PaddedFist';
  glove.add(body);

  const thumb = new THREE.Mesh(createTuckedThumbGeometry(), leather);
  thumb.name = 'BoxingGloveV12TuckedThumb';
  glove.add(thumb);

  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.01, -0.19, 0.445),
    new THREE.Vector3(0.12, -0.31, 0.49),
    new THREE.Vector3(0.30, -0.34, 0.48),
    new THREE.Vector3(0.47, -0.22, 0.415)
  ], false, 'centripetal');
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 60, 0.0055, 8, false), seamMat);
  seam.name = 'BoxingGloveV12InsetThumbSeam';
  glove.add(seam);

  glove.name = 'BoxingGloveV12DynamicHead';
  group.userData.assetVersion = 'boxing-glove-v12';
  group.userData.referenceStyle = 'padded-superellipsoid-boxing-glove-tim-physics';
  return model;
}
