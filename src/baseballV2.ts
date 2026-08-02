import * as THREE from 'three';
import type { ReviewAssetModel } from './parts0408Models';

const TWO_PI = Math.PI * 2;

function seamLatitude(longitude: number): number {
  return 0.405 * Math.sin(longitude * 2 + 0.32);
}

function createLeatherBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Baseball leather texture canvas unavailable.');

  context.fillStyle = '#808080';
  context.fillRect(0, 0, 256, 256);

  let seed = 0x4b617365;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Fine leather grain only. The contrast is intentionally restrained so the
  // ball reads as leather rather than rough stone at game scale.
  for (let i = 0; i < 5200; i += 1) {
    const value = 119 + Math.round(random() * 18);
    const radius = 0.22 + random() * 0.55;
    context.beginPath();
    context.arc(random() * 256, random() * 256, radius, 0, TWO_PI);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7.2, 5.4);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createBaseballShellGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 160, 112);
  const position = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    direction.copy(point).normalize();

    const longitude = Math.atan2(direction.z, direction.x);
    const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    const seam = seamLatitude(longitude);
    const distance = Math.abs(latitude - seam);

    // Shallow real indentation: the seam catches grazing light, but there is no
    // separate tube or stitch mesh floating above the leather.
    const groove = Math.exp(-(distance * distance) / (2 * 0.0125 * 0.0125));
    const scale = 1 - groove * 0.0065;
    direction.multiplyScalar(scale);
    position.setXYZ(index, direction.x, direction.y, direction.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function installSurfaceStitchShader(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vBaseballLocalDirection;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvBaseballLocalDirection = normalize(position);'
    );

    shader.fragmentShader = `
      varying vec3 vBaseballLocalDirection;
      const float BASEBALL_PI = 3.141592653589793;
      const float BASEBALL_TAU = 6.283185307179586;

      float baseballSeamLatitude(float longitude) {
        return 0.405 * sin(longitude * 2.0 + 0.32);
      }

      float baseballStitchMask(vec3 direction) {
        float longitude = atan(direction.z, direction.x);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float q = latitude - baseballSeamLatitude(longitude);

        // Two rows of V-shaped red thread, laid into the leather on either side
        // of the groove. Skewing the periodic phase by q produces the familiar
        // herringbone stitch direction without detached geometry.
        float stitchIndex = (longitude + BASEBALL_PI) / BASEBALL_TAU * 44.0;
        float side = q < 0.0 ? -1.0 : 1.0;
        float phase = abs(fract(stitchIndex + side * q * 5.8) - 0.5);
        float dash = 1.0 - smoothstep(0.20, 0.34, phase);
        float row = smoothstep(0.016, 0.025, abs(q)) * (1.0 - smoothstep(0.064, 0.078, abs(q)));
        return dash * row;
      }

      float baseballGrooveMask(vec3 direction) {
        float longitude = atan(direction.z, direction.x);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float d = abs(latitude - baseballSeamLatitude(longitude));
        return 1.0 - smoothstep(0.006, 0.020, d);
      }
    ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 baseballDirection = normalize(vBaseballLocalDirection);
       float baseballGroove = baseballGrooveMask(baseballDirection);
       float baseballStitch = baseballStitchMask(baseballDirection);
       vec3 grooveColor = vec3(0.48, 0.37, 0.30);
       vec3 threadColor = vec3(0.57, 0.045, 0.055);
       diffuseColor.rgb = mix(diffuseColor.rgb, grooveColor, baseballGroove * 0.28);
       diffuseColor.rgb = mix(diffuseColor.rgb, threadColor, baseballStitch * 0.96);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       vec3 baseballRoughnessDirection = normalize(vBaseballLocalDirection);
       float baseballThreadRoughness = baseballStitchMask(baseballRoughnessDirection);
       roughnessFactor = mix(roughnessFactor, 0.58, baseballThreadRoughness * 0.72);`
    );
  };

  material.customProgramCacheKey = () => 'baseball-v2-surface-integrated-stitches';
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
  shell.name = 'BaseballSelectionShell';
  shell.visible = false;
  return shell;
}

/**
 * Baseball v2: one continuous 3D leather shell.
 * No TubeGeometry seams and no external stitch meshes are used.
 */
export function createBaseballModelV2(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'baseball-3d';
  group.userData.assetVersion = 'baseball-v2';
  group.userData.sourceKey = 'opengameart-old-baseball-cc0';
  group.userData.seamConstruction = 'surface-integrated';
  group.userData.externalStitchMeshes = 0;
  group.userData.snapPoints = [];

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xeee9de,
    metalness: 0,
    roughness: 0.73,
    clearcoat: 0.025,
    clearcoatRoughness: 0.9,
    bumpMap: createLeatherBumpTexture(),
    bumpScale: 0.0055
  });
  installSurfaceStitchShader(leather);

  const shell = new THREE.Mesh(createBaseballShellGeometry(), leather);
  shell.name = 'BaseballV2IntegratedLeatherShell';
  group.add(shell);

  const selection = createSelectionShell();
  group.add(selection);

  return { group, selectionMeshes: [selection] };
}
