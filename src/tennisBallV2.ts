import * as THREE from 'three';
import type { ReviewAssetModel } from './parts0408Models';

const PI = Math.PI;

function tennisSeamLatitude(longitude: number): number {
  // One continuous closed curve. On the visible hemisphere it produces the
  // familiar soft S-shaped tennis-ball seam without adding an external tube.
  return 0.46 * Math.sin(longitude * 2 + 0.36);
}

function createFeltBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tennis felt texture canvas unavailable.');

  context.fillStyle = '#808080';
  context.fillRect(0, 0, 512, 512);

  let seed = 0x74656e6e;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Dense short fibres. Low contrast keeps the effect soft at game scale and
  // avoids the golf-ball / sandpaper look of the first attempt.
  context.lineCap = 'round';
  for (let index = 0; index < 10500; index += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const angle = random() * PI;
    const length = 0.7 + random() * 2.0;
    const value = 119 + Math.round(random() * 19);
    context.strokeStyle = `rgb(${value},${value},${value})`;
    context.lineWidth = 0.35 + random() * 0.55;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.6, 4.4);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTennisShellGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 160, 112);
  const position = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();

    const longitude = Math.atan2(direction.z, direction.x);
    const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    const distance = Math.abs(latitude - tennisSeamLatitude(longitude));

    // A real but very shallow panel joint. The cream seam itself is rendered
    // in the same material, so nothing floats above the felt.
    const groove = Math.exp(-(distance * distance) / (2 * 0.026 * 0.026));
    const scale = 1 - groove * 0.0048;
    direction.multiplyScalar(scale);
    position.setXYZ(index, direction.x, direction.y, direction.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function installIntegratedSeamShader(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vTennisLocalDirection;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvTennisLocalDirection = normalize(position);'
    );

    shader.fragmentShader = `
      varying vec3 vTennisLocalDirection;

      float tennisSeamLatitude(float longitude) {
        return 0.46 * sin(longitude * 2.0 + 0.36);
      }

      float tennisSeamDistance(vec3 direction) {
        float longitude = atan(direction.z, direction.x);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        return abs(latitude - tennisSeamLatitude(longitude));
      }

      float tennisSeamMask(vec3 direction) {
        float d = tennisSeamDistance(direction);
        return 1.0 - smoothstep(0.034, 0.057, d);
      }

      float tennisSeamBorder(vec3 direction) {
        float d = tennisSeamDistance(direction);
        return 1.0 - smoothstep(0.060, 0.082, d);
      }
    ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 tennisDirection = normalize(vTennisLocalDirection);
       float tennisBorder = tennisSeamBorder(tennisDirection);
       float tennisSeam = tennisSeamMask(tennisDirection);
       vec3 feltEdge = diffuseColor.rgb * 0.90;
       vec3 seamColor = vec3(0.88, 0.875, 0.80);
       diffuseColor.rgb = mix(diffuseColor.rgb, feltEdge, tennisBorder * 0.11);
       diffuseColor.rgb = mix(diffuseColor.rgb, seamColor, tennisSeam * 0.98);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float tennisSeamRoughness = tennisSeamMask(normalize(vTennisLocalDirection));
       roughnessFactor = mix(roughnessFactor, 0.88, tennisSeamRoughness * 0.92);`
    );
  };

  material.customProgramCacheKey = () => 'tennis-ball-v2-integrated-felt-seam';
}

function createSelectionShell(): THREE.Mesh {
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  shell.name = 'TennisBallSelectionShell';
  shell.visible = false;
  return shell;
}

/** Production Tennis Ball v2: a single felt shell with an integrated seam. */
export function createTennisBallModelV2(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'tennis-ball-3d';
  group.userData.assetVersion = 'tennis-ball-v2';
  group.userData.sourceKey = 'opengameart-hq-pbr-tennis-ball-cc0';
  group.userData.seamConstruction = 'surface-integrated';
  group.userData.externalSeamMeshes = 0;
  group.userData.surface = 'fine-felt';
  group.userData.snapPoints = [];

  const felt = new THREE.MeshPhysicalMaterial({
    color: 0xb8cf32,
    metalness: 0,
    roughness: 0.94,
    clearcoat: 0,
    bumpMap: createFeltBumpTexture(),
    bumpScale: 0.0065
  });
  installIntegratedSeamShader(felt);

  const shell = new THREE.Mesh(createTennisShellGeometry(), felt);
  shell.name = 'TennisBallV2IntegratedFeltShell';
  group.add(shell);

  const selection = createSelectionShell();
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
