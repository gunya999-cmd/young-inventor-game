import * as THREE from 'three';
import type { ReviewAssetModel0913 } from './parts0913Models';

export type PremiumReviewAssetModel = ReviewAssetModel0913;

export function smooth01(value: number): number {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

export function makeSelectionBox(size: THREE.Vector3, opacity = 0.055): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.visible = false;
  return mesh;
}

export function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width * 0.5;
  const h = height * 0.5;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  shape.closePath();
  return shape;
}

export function roundedRectPath(width: number, height: number, radius: number): THREE.Path {
  const w = width * 0.5;
  const h = height * 0.5;
  const r = Math.min(radius, w, h);
  const path = new THREE.Path();
  path.moveTo(-w + r, -h);
  path.lineTo(w - r, -h);
  path.quadraticCurveTo(w, -h, w, -h + r);
  path.lineTo(w, h - r);
  path.quadraticCurveTo(w, h, w - r, h);
  path.lineTo(-w + r, h);
  path.quadraticCurveTo(-w, h, -w, h - r);
  path.lineTo(-w, -h + r);
  path.quadraticCurveTo(-w, -h, -w + r, -h);
  path.closePath();
  return path;
}

export function extrude(shape: THREE.Shape, depth: number, bevel = 0.035): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 24,
    bevelEnabled: bevel > 0,
    bevelSegments: 4,
    bevelSize: bevel,
    bevelThickness: bevel * 0.82
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFineBumpTexture(seedValue: number, dots = 6800): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Premium asset texture canvas unavailable.');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, 256, 256);

  let seed = seedValue >>> 0;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let index = 0; index < dots; index += 1) {
    const value = 116 + Math.round(random() * 24);
    const radius = 0.18 + random() * 0.62;
    context.beginPath();
    context.arc(random() * 256, random() * 256, radius, 0, Math.PI * 2);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 5.5);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function capsuleLoopPoints(halfStraight: number, radius: number, arcSegments = 40): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  points.push(new THREE.Vector3(-halfStraight, radius, 0));
  points.push(new THREE.Vector3(halfStraight, radius, 0));
  for (let index = 1; index <= arcSegments; index += 1) {
    const angle = Math.PI * 0.5 - (index / arcSegments) * Math.PI;
    points.push(new THREE.Vector3(halfStraight + Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  points.push(new THREE.Vector3(-halfStraight, -radius, 0));
  for (let index = 1; index <= arcSegments; index += 1) {
    const angle = -Math.PI * 0.5 - (index / arcSegments) * Math.PI;
    points.push(new THREE.Vector3(-halfStraight + Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  return points;
}

/**
 * Sweeps a rectangular/trapezoidal belt cross-section around a closed 2D path.
 * The path is expected to run clockwise in XY; the generated outward normal
 * therefore points away from the loop. The Z axis is the belt width.
 */
export function createClosedBeltGeometry(
  points: THREE.Vector3[],
  halfThickness: number,
  outerHalfWidth: number,
  innerHalfWidth = outerHalfWidth
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const tangent = next.clone().sub(previous);
    tangent.z = 0;
    tangent.normalize();
    const outward = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();

    const outer = current.clone().addScaledVector(outward, halfThickness);
    const inner = current.clone().addScaledVector(outward, -halfThickness);
    vertices.push(
      outer.x, outer.y, -outerHalfWidth,
      outer.x, outer.y, outerHalfWidth,
      inner.x, inner.y, innerHalfWidth,
      inner.x, inner.y, -innerHalfWidth
    );
  }

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const a = index * 4;
    const b = next * 4;
    // Outside, front edge, inside and rear edge.
    indices.push(
      a, b, a + 1, b, b + 1, a + 1,
      a + 1, b + 1, a + 2, b + 1, b + 2, a + 2,
      a + 2, b + 2, a + 3, b + 2, b + 3, a + 3,
      a + 3, b + 3, a, b + 3, b, a
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createHelixBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  turns = 4.5,
  coilRadius = 0.028,
  wireRadius = 0.008
): THREE.Mesh {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const axis = direction.clone().normalize();
  const helper = Math.abs(axis.y) < 0.84 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= 64; index += 1) {
    const t = index / 64;
    const angle = t * Math.PI * 2 * turns;
    const point = start.clone().addScaledVector(axis, length * t);
    point.addScaledVector(side, Math.cos(angle) * coilRadius);
    point.addScaledVector(up, Math.sin(angle) * coilRadius);
    points.push(point);
  }

  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, wireRadius, 6, false),
    new THREE.MeshStandardMaterial({ color: 0xb6c1c8, metalness: 0.88, roughness: 0.27 })
  );
}

export function createTubeBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 1, radius, 10, false),
    material
  );
}
