import * as THREE from 'three';

export interface BowlingBallModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  selectionShell: THREE.Mesh;
}

interface FingerHoleSpec {
  normal: THREE.Vector3;
  radius: number;
  depth: number;
}

const HOLES: FingerHoleSpec[] = [
  { normal: new THREE.Vector3(-0.23, 0.27, 1).normalize(), radius: 0.122, depth: 0.155 },
  { normal: new THREE.Vector3(0.22, 0.27, 1).normalize(), radius: 0.122, depth: 0.155 },
  { normal: new THREE.Vector3(0, -0.12, 1).normalize(), radius: 0.142, depth: 0.185 }
];

function smoothstep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Creates one continuous shell mesh with the three finger holes recessed into
 * the sphere itself. There are deliberately no rings, tori, discs or overlays
 * sitting above the surface: the visible lip and depth come from the actual
 * vertex positions and normals of the shell.
 */
function createRecessedShellGeometry(): THREE.SphereGeometry {
  // 96×72 keeps the sculpted holes smooth at Asset-Lab scale while avoiding
  // the unnecessary software-WebGL cost of the earlier review mesh.
  const geometry = new THREE.SphereGeometry(1, 96, 72);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const surfaceColor = new THREE.Color(0x20242a);
  const cavityColor = new THREE.Color(0x050607);
  const vertexColor = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();

    let deepestNormalized = 0;
    let radialDepth = 0;

    for (const hole of HOLES) {
      const dot = THREE.MathUtils.clamp(direction.dot(hole.normal), -1, 1);
      const angle = Math.acos(dot);
      const outerAngle = hole.radius * 1.34;
      if (angle >= outerAngle) continue;

      const normalized = 1 - angle / outerAngle;
      const bowl = smoothstep01(normalized);
      const inner = smoothstep01((normalized - 0.46) / 0.54);
      const depth = hole.depth * (bowl * 0.48 + inner * 0.52);
      radialDepth = Math.max(radialDepth, depth);
      deepestNormalized = Math.max(deepestNormalized, depth / hole.depth);
    }

    direction.multiplyScalar(1 - radialDepth);
    position.setXYZ(index, direction.x, direction.y, direction.z);

    const darkening = smoothstep01((deepestNormalized - 0.22) / 0.78);
    vertexColor.copy(surfaceColor).lerp(cavityColor, darkening * 0.94);
    colors[index * 3] = vertexColor.r;
    colors[index * 3 + 1] = vertexColor.g;
    colors[index * 3 + 2] = vertexColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Production Bowling Ball visual shared by the game and Asset Lab. */
export function createBowlingBallModel(): BowlingBallModel {
  const group = new THREE.Group();
  group.userData.kind = 'bowling-ball-3d';
  group.userData.snapPoints = [];
  group.userData.assetVersion = 'bowling-ball-v3';
  group.userData.holeConstruction = 'deformed-shell';

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.015,
    roughness: 0.4,
    clearcoat: 0.36,
    clearcoatRoughness: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  const shell = new THREE.Mesh(createRecessedShellGeometry(), shellMaterial);
  shell.name = 'BowlingBallRecessedShell';
  group.add(shell);

  const selectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 48, 34),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  selectionShell.name = 'BowlingBallSelectionShell';
  selectionShell.visible = false;
  group.add(selectionShell);

  return { group, shellMaterial, selectionShell };
}

export function setBowlingBallSelected(model: BowlingBallModel, selected: boolean): void {
  model.selectionShell.visible = selected;
  model.shellMaterial.emissive.setHex(selected ? 0x182358 : 0x000000);
  model.shellMaterial.emissiveIntensity = selected ? 0.14 : 0;
}
