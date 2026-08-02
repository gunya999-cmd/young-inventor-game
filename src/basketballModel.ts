import * as THREE from 'three';

export interface BasketballModel {
  group: THREE.Group;
  shellMaterial: THREE.MeshPhysicalMaterial;
  selectionShell: THREE.Mesh;
}

const SEAM_PLANES = [
  new THREE.Vector3(1, 0, 0).normalize(),
  new THREE.Vector3(0, 1, 0).normalize(),
  new THREE.Vector3(0.72, 0, 0.69).normalize(),
  new THREE.Vector3(-0.72, 0, 0.69).normalize()
] as const;

function smoothstep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function seamDistance(direction: THREE.Vector3): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const plane of SEAM_PLANES) distance = Math.min(distance, Math.abs(direction.dot(plane)));
  return distance;
}

/**
 * Geometry carries a shallow physical groove so light catches the seams.
 * The exact dark seam is rendered in the PBR shader, therefore the edge stays
 * crisp independently of polygon density or screen size.
 */
function createBasketballGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 112, 84);
  const position = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();

  const grooveOuter = 0.034;
  const grooveDepth = 0.012;

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();
    const distance = seamDistance(direction);
    if (distance < grooveOuter) {
      const strength = 1 - smoothstep01(distance / grooveOuter);
      direction.multiplyScalar(1 - grooveDepth * strength);
      position.setXYZ(index, direction.x, direction.y, direction.z);
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPebbleBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Basketball texture canvas unavailable.');

  context.fillStyle = '#858585';
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 0x2f6e2b1;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let i = 0; i < 1450; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 0.7 + random() * 1.25;
    const value = 108 + Math.round(random() * 28);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6.8, 4.8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function installCrispSeamShader(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vBasketLocalDirection;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvBasketLocalDirection = normalize(position);'
    );

    shader.fragmentShader = `
      varying vec3 vBasketLocalDirection;
      float basketballSeamMask(vec3 p) {
        vec3 n0 = vec3(1.0, 0.0, 0.0);
        vec3 n1 = vec3(0.0, 1.0, 0.0);
        vec3 n2 = normalize(vec3(0.72, 0.0, 0.69));
        vec3 n3 = normalize(vec3(-0.72, 0.0, 0.69));
        float d = abs(dot(p, n0));
        d = min(d, abs(dot(p, n1)));
        d = min(d, abs(dot(p, n2)));
        d = min(d, abs(dot(p, n3)));
        return 1.0 - smoothstep(0.014, 0.025, d);
      }
    ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float basketballSeam = basketballSeamMask(normalize(vBasketLocalDirection));
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.028, 0.022), basketballSeam);`
    );
  };
  material.customProgramCacheKey = () => 'basketball-v1-crisp-seams';
}

/** Production Basketball visual. */
export function createBasketballModel(): BasketballModel {
  const group = new THREE.Group();
  group.userData.kind = 'basketball-3d';
  group.userData.assetVersion = 'basketball-v1';
  group.userData.seamConstruction = 'recessed-four-channel';
  group.userData.seamCount = SEAM_PLANES.length;
  group.userData.snapPoints = [];

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd96824,
    metalness: 0,
    roughness: 0.62,
    clearcoat: 0.07,
    clearcoatRoughness: 0.72,
    bumpMap: createPebbleBumpTexture(),
    bumpScale: 0.014,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  installCrispSeamShader(shellMaterial);

  const shell = new THREE.Mesh(createBasketballGeometry(), shellMaterial);
  shell.name = 'BasketballRecessedShell';
  group.add(shell);

  const selectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.13,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  selectionShell.name = 'BasketballSelectionShell';
  selectionShell.visible = false;
  group.add(selectionShell);

  return { group, shellMaterial, selectionShell };
}

export function setBasketballSelected(model: BasketballModel, selected: boolean): void {
  model.selectionShell.visible = selected;
  model.shellMaterial.emissive.setHex(selected ? 0x4a2108 : 0x000000);
  model.shellMaterial.emissiveIntensity = selected ? 0.16 : 0;
}
