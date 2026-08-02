import * as THREE from 'three';

export interface BowlingBallModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  selectionShell: THREE.Mesh;
}

interface FingerHoleSpec {
  normal: THREE.Vector3;
  outerRadius: number;
  innerRadius: number;
  chamferDepth: number;
  boreDepth: number;
}

const HOLES: FingerHoleSpec[] = [
  {
    normal: new THREE.Vector3(-0.23, 0.27, 1).normalize(),
    outerRadius: 0.116,
    innerRadius: 0.086,
    chamferDepth: 0.052,
    boreDepth: 0.21
  },
  {
    normal: new THREE.Vector3(0.22, 0.27, 1).normalize(),
    outerRadius: 0.116,
    innerRadius: 0.086,
    chamferDepth: 0.052,
    boreDepth: 0.21
  },
  {
    normal: new THREE.Vector3(0, -0.12, 1).normalize(),
    outerRadius: 0.14,
    innerRadius: 0.106,
    chamferDepth: 0.06,
    boreDepth: 0.245
  }
];

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function orientAlongNormal(object: THREE.Object3D, normal: THREE.Vector3, sourceAxis: THREE.Vector3): void {
  object.quaternion.setFromUnitVectors(sourceAxis, normal);
}

function configureShellCuts(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    HOLES.forEach((hole, index) => {
      shader.uniforms[`uBowlingHoleNormal${index}`] = { value: hole.normal.clone() };
      shader.uniforms[`uBowlingHoleLimit${index}`] = {
        value: Math.sqrt(Math.max(0, 1 - hole.outerRadius * hole.outerRadius))
      };
    });

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'varying vec3 vBowlingBallLocalPosition;\nvoid main() {'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vBowlingBallLocalPosition = position;'
    );

    const fragmentHeader = `
      varying vec3 vBowlingBallLocalPosition;
      uniform vec3 uBowlingHoleNormal0;
      uniform vec3 uBowlingHoleNormal1;
      uniform vec3 uBowlingHoleNormal2;
      uniform float uBowlingHoleLimit0;
      uniform float uBowlingHoleLimit1;
      uniform float uBowlingHoleLimit2;
    `;
    const fragmentCut = `
      vec3 bowlingBallDirection = normalize(vBowlingBallLocalPosition);
      if (
        dot(bowlingBallDirection, uBowlingHoleNormal0) > uBowlingHoleLimit0 ||
        dot(bowlingBallDirection, uBowlingHoleNormal1) > uBowlingHoleLimit1 ||
        dot(bowlingBallDirection, uBowlingHoleNormal2) > uBowlingHoleLimit2
      ) discard;
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${fragmentHeader}\nvoid main() {\n${fragmentCut}`
    );
  };
  material.customProgramCacheKey = () => 'bowling-ball-v5-cut-shell';
}

function createFingerHole(
  hole: FingerHoleSpec,
  index: number,
  chamferMaterial: THREE.MeshStandardMaterial,
  boreMaterial: THREE.MeshStandardMaterial,
  bottomMaterial: THREE.MeshStandardMaterial
): THREE.Group {
  const cavity = new THREE.Group();
  cavity.name = `FingerHole${index + 1}`;

  // A cylinder aligned with the hole normal intersects a unit sphere in a
  // circle at this exact distance. Using the same value for the shader cut and
  // cavity mouth keeps the opening crisp and prevents any raised external rim.
  const mouthDistance = Math.sqrt(Math.max(0, 1 - hole.outerRadius * hole.outerRadius));

  const chamfer = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hole.outerRadius * 0.995,
      hole.innerRadius,
      hole.chamferDepth,
      48,
      1,
      true
    ),
    chamferMaterial
  );
  chamfer.name = `FingerHoleChamfer${index + 1}`;
  orientAlongNormal(chamfer, hole.normal, Y_AXIS);
  chamfer.position.copy(hole.normal).multiplyScalar(mouthDistance - hole.chamferDepth * 0.5 - 0.0015);
  cavity.add(chamfer);

  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hole.innerRadius,
      hole.innerRadius,
      hole.boreDepth,
      48,
      1,
      true
    ),
    boreMaterial
  );
  bore.name = `FingerHoleBore${index + 1}`;
  orientAlongNormal(bore, hole.normal, Y_AXIS);
  bore.position.copy(hole.normal).multiplyScalar(
    mouthDistance - hole.chamferDepth - hole.boreDepth * 0.5 - 0.0015
  );
  cavity.add(bore);

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(hole.innerRadius * 0.985, 48),
    bottomMaterial
  );
  bottom.name = `FingerHoleBottom${index + 1}`;
  orientAlongNormal(bottom, hole.normal, Z_AXIS);
  bottom.position.copy(hole.normal).multiplyScalar(
    mouthDistance - hole.chamferDepth - hole.boreDepth - 0.001
  );
  cavity.add(bottom);

  return cavity;
}

/** Production Bowling Ball visual shared by the game and Asset Lab. */
export function createBowlingBallModel(): BowlingBallModel {
  const group = new THREE.Group();
  group.userData.kind = 'bowling-ball-3d';
  group.userData.snapPoints = [];
  group.userData.assetVersion = 'bowling-ball-v5';
  group.userData.holeConstruction = 'cut-shell-cavity-mesh';
  group.userData.holeCount = HOLES.length;

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x202a36,
    metalness: 0.015,
    roughness: 0.34,
    clearcoat: 0.24,
    clearcoatRoughness: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  configureShellCuts(shellMaterial);

  // The shell no longer needs a dense sculpted mesh: the openings are precise
  // fragment cuts, while the visible depth is real 3D cavity geometry.
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 52), shellMaterial);
  shell.name = 'BowlingBallCutShell';
  group.add(shell);

  const chamferMaterial = new THREE.MeshStandardMaterial({
    color: 0x111821,
    metalness: 0.015,
    roughness: 0.44,
    side: THREE.DoubleSide
  });
  const boreMaterial = new THREE.MeshStandardMaterial({
    color: 0x070a0e,
    metalness: 0,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: 0x030405,
    metalness: 0,
    roughness: 0.84,
    side: THREE.DoubleSide
  });

  HOLES.forEach((hole, index) => {
    group.add(createFingerHole(hole, index, chamferMaterial, boreMaterial, bottomMaterial));
  });

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
  model.shellMaterial.emissiveIntensity = selected ? 0.12 : 0;
}
