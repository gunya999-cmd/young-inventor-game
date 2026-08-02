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
  chamferWidth: number;
  innerRadiusFactor: number;
}

const HOLES: FingerHoleSpec[] = [
  {
    normal: new THREE.Vector3(-0.23, 0.27, 1).normalize(),
    radius: 0.118,
    depth: 0.17,
    chamferWidth: 0.028,
    innerRadiusFactor: 0.72
  },
  {
    normal: new THREE.Vector3(0.22, 0.27, 1).normalize(),
    radius: 0.118,
    depth: 0.17,
    chamferWidth: 0.028,
    innerRadiusFactor: 0.72
  },
  {
    normal: new THREE.Vector3(0, -0.12, 1).normalize(),
    radius: 0.138,
    depth: 0.198,
    chamferWidth: 0.032,
    innerRadiusFactor: 0.76
  }
];

function clamp01(value: number): number {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smooth01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Two-stage drilled-hole profile: a narrow rounded entrance chamfer followed
 * by a steeper inner cavity. The tighter transition keeps the opening crisp
 * without adding any raised ring or overlay above the bowling-ball surface.
 */
function holeProfile(distance: number, hole: FingerHoleSpec): { depth: number; darkness: number } {
  const outerRadius = hole.radius;
  const innerRadius = hole.radius * hole.innerRadiusFactor;
  const chamferInner = Math.max(innerRadius, outerRadius - hole.chamferWidth);

  if (distance >= outerRadius) return { depth: 0, darkness: 0 };

  if (distance >= chamferInner) {
    const t = 1 - (distance - chamferInner) / Math.max(0.0001, outerRadius - chamferInner);
    const chamfer = smooth01(t);
    return {
      depth: hole.depth * 0.22 * chamfer,
      darkness: 0.24 * chamfer
    };
  }

  const innerT = 1 - distance / Math.max(0.0001, innerRadius);
  const cavity = Math.pow(clamp01(innerT), 0.72);
  return {
    depth: hole.depth * (0.22 + 0.78 * cavity),
    darkness: 0.24 + 0.76 * cavity
  };
}

/**
 * One continuous bowling-ball shell. All three finger holes are sculpted into
 * the sphere vertices themselves. No torus, ring, disc or surface overlay is
 * used, so the openings stay recessed from every camera angle.
 */
function createRecessedShellGeometry(): THREE.SphereGeometry {
  // 112x84 gives a cleaner hole lip than v3 while remaining lightweight enough
  // for the mobile WebGL layer used during gameplay.
  const geometry = new THREE.SphereGeometry(1, 112, 84);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);

  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const surfaceColor = new THREE.Color(0x242a31);
  const cavityColor = new THREE.Color(0x050607);
  const vertexColor = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();

    let deepest = 0;
    let darkness = 0;

    for (const hole of HOLES) {
      const dot = THREE.MathUtils.clamp(direction.dot(hole.normal), -1, 1);
      const angularDistance = Math.acos(dot);
      const profile = holeProfile(angularDistance, hole);
      deepest = Math.max(deepest, profile.depth);
      darkness = Math.max(darkness, profile.darkness);
    }

    direction.multiplyScalar(1 - deepest);
    position.setXYZ(index, direction.x, direction.y, direction.z);

    vertexColor.copy(surfaceColor).lerp(cavityColor, clamp01(darkness));
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
  group.userData.assetVersion = 'bowling-ball-v4';
  group.userData.holeConstruction = 'deformed-shell-sharp';

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.01,
    roughness: 0.48,
    clearcoat: 0.18,
    clearcoatRoughness: 0.42,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  const shell = new THREE.Mesh(createRecessedShellGeometry(), shellMaterial);
  shell.name = 'BowlingBallRecessedShell';
  group.add(shell);

  const selectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.14,
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
