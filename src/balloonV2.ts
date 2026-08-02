import * as THREE from 'three';
import type { ReviewAssetModel } from './parts0408Models';

function createSmoothBalloonGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 144, 104);
  const position = geometry.getAttribute('position');
  const point = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    const y = THREE.MathUtils.clamp(point.y, -1, 1);

    // Smooth pear-shaped latex envelope: a little fuller in the lower half,
    // slightly narrower near the crown, and gently pinched toward the neck.
    let radialScale = 0.955 + 0.075 * (1 - y) - 0.035 * y * y;
    if (y < -0.68) {
      const pinch = THREE.MathUtils.smoothstep(y, -1.0, -0.68);
      radialScale *= THREE.MathUtils.lerp(0.72, 1, pinch);
    }

    position.setXYZ(index, point.x * radialScale, point.y * 1.16, point.z * radialScale * 0.985);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createSelectionShell(): THREE.Mesh {
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 48, 36),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  shell.scale.set(1.0, 1.18, 0.99);
  shell.visible = false;
  shell.name = 'BalloonSelectionShell';
  return shell;
}

export function createBalloonModelV2(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'balloon-3d';
  group.userData.assetVersion = 'balloon-v2';
  group.userData.sourceKey = 'opengameart-balloons-cc0';
  group.userData.geometry = 'smooth-deformed-sphere';
  group.userData.snapPoints = [{ id: 'knot', position: [0, -1.36, 0] }];

  const latex = new THREE.MeshPhysicalMaterial({
    color: 0xde536c,
    metalness: 0,
    roughness: 0.43,
    clearcoat: 0.12,
    clearcoatRoughness: 0.64,
    transmission: 0.018,
    thickness: 0.18,
    ior: 1.45,
    sheen: 0.08,
    sheenRoughness: 0.74,
    sheenColor: new THREE.Color(0xffd2d9)
  });

  const body = new THREE.Mesh(createSmoothBalloonGeometry(), latex);
  body.name = 'BalloonV2SmoothLatexBody';
  group.add(body);

  const neckMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9455d,
    roughness: 0.5,
    clearcoat: 0.08,
    clearcoatRoughness: 0.72
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.11, 0.17, 36), neckMaterial);
  neck.position.y = -1.22;
  neck.name = 'BalloonNeck';
  group.add(neck);

  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 10, 36), neckMaterial);
  tie.rotation.x = Math.PI / 2;
  tie.position.y = -1.31;
  tie.name = 'BalloonTieRing';
  group.add(tie);

  // Four-sided folded knot reads as tied latex rather than a generic cone.
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 4), neckMaterial);
  knot.position.y = -1.40;
  knot.rotation.set(0, Math.PI / 4, Math.PI);
  knot.name = 'BalloonFoldedKnot';
  group.add(knot);

  const stringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.00, -1.50, 0.00),
    new THREE.Vector3(0.055, -1.66, 0.015),
    new THREE.Vector3(-0.035, -1.82, -0.010),
    new THREE.Vector3(0.045, -1.99, 0.008),
    new THREE.Vector3(-0.015, -2.16, 0.000)
  ], false, 'catmullrom', 0.35);
  const string = new THREE.Mesh(
    new THREE.TubeGeometry(stringCurve, 52, 0.006, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x6b7076, roughness: 0.92, metalness: 0 })
  );
  string.name = 'BalloonString';
  group.add(string);

  const selection = createSelectionShell();
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
