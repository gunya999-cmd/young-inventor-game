import * as THREE from 'three';
import { createBoxingGloveModelV3 } from './boxingGloveV3';
import { makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const FRONT_X = -2.02;
const REST_GLOVE_X = 0;
const PUNCH_DISTANCE = 1.42;
const REST_SPRING_LENGTH = 0.88;
const EXTENDED_SPRING_LENGTH = REST_SPRING_LENGTH + PUNCH_DISTANCE;

function createSpringGeometry(turns = 11): THREE.TubeGeometry {
  class SpringCurve extends THREE.Curve<THREE.Vector3> {
    override getPoint(t: number): THREE.Vector3 {
      const angle = t * turns * Math.PI * 2;
      return new THREE.Vector3(t, Math.cos(angle) * 0.215, Math.sin(angle) * 0.215);
    }
  }
  return new THREE.TubeGeometry(new SpringCurve(), 220, 0.027, 8, false);
}

function createHousing(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x546b78,
    metalness: 0.68,
    roughness: 0.34,
    clearcoat: 0.06,
    clearcoatRoughness: 0.58
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x27333a, metalness: 0.58, roughness: 0.43 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb8c2c8, metalness: 0.82, roughness: 0.28 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.05, 64, 3, false), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.x = -2.55;
  body.name = 'BoxingGloveV4SpringHousing';
  group.add(body);

  const rearCap = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.10, 64), darkMat);
  rearCap.rotation.z = Math.PI / 2;
  rearCap.position.x = -3.08;
  rearCap.name = 'BoxingGloveV4RearCap';
  group.add(rearCap);

  const frontCollar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.075, 16, 64), trimMat);
  frontCollar.rotation.y = Math.PI / 2;
  frontCollar.position.x = FRONT_X;
  frontCollar.name = 'BoxingGloveV4FrontGuideCollar';
  group.add(frontCollar);

  const frontSocket = new THREE.Mesh(
    new THREE.CircleGeometry(0.40, 64),
    new THREE.MeshStandardMaterial({ color: 0x182126, roughness: 0.88, metalness: 0.15, side: THREE.DoubleSide })
  );
  frontSocket.rotation.y = Math.PI / 2;
  frontSocket.position.x = FRONT_X - 0.012;
  frontSocket.name = 'BoxingGloveV4GuideSocket';
  group.add(frontSocket);

  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.86), darkMat);
  mount.position.set(-2.55, -0.67, 0);
  mount.name = 'BoxingGloveV4MountFoot';
  group.add(mount);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.10, 1.08), trimMat);
  foot.position.set(-2.55, -0.80, 0);
  foot.name = 'BoxingGloveV4MountPlate';
  group.add(foot);

  return group;
}

function smoothPunch(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  const c1 = 1.22;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function smoothRetract(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function createBoxingGloveModelV4(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v4';
  group.userData.sourceKey = 'sketchfab-incg5764-boxing-glove-cc-by';
  group.userData.referenceStyle = 'tim-spring-loaded-mechanism';
  group.userData.dynamic = true;
  group.userData.motion = 'button-spring-punch';
  group.userData.snapPoints = [
    { id: 'button', position: [-3.28, 0.02, 0] },
    { id: 'mount', position: [-2.55, -0.82, 0] },
    { id: 'impact-rest', position: [1.08, 0.14, 0] },
    { id: 'impact-extended', position: [2.50, 0.14, 0] }
  ];

  group.add(createHousing());

  const movingGlove = createBoxingGloveModelV3().group;
  const oldStem = movingGlove.getObjectByName('BoxingGloveV3TriggerStem');
  const oldButton = movingGlove.getObjectByName('BoxingGloveV3TriggerButton');
  if (oldStem) movingGlove.remove(oldStem);
  if (oldButton) movingGlove.remove(oldButton);
  movingGlove.position.x = REST_GLOVE_X;
  movingGlove.name = 'BoxingGloveV4MovingGloveHead';
  group.add(movingGlove);

  const steel = new THREE.MeshStandardMaterial({ color: 0xbcc7cd, metalness: 0.88, roughness: 0.27 });
  const springMat = new THREE.MeshStandardMaterial({ color: 0xd7dde1, metalness: 0.91, roughness: 0.25 });
  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: 0xe3b83d,
    metalness: 0.18,
    roughness: 0.45,
    clearcoat: 0.08,
    clearcoatRoughness: 0.48
  });

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 32), steel);
  rod.rotation.z = Math.PI / 2;
  rod.name = 'BoxingGloveV4GuideRod';
  group.add(rod);

  const spring = new THREE.Mesh(createSpringGeometry(), springMat);
  spring.position.set(FRONT_X, 0, 0);
  spring.name = 'BoxingGloveV4VisibleCoilSpring';
  group.add(spring);

  const rearButtonStem = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.20, 32), steel);
  rearButtonStem.rotation.z = Math.PI / 2;
  rearButtonStem.position.x = -3.16;
  rearButtonStem.name = 'BoxingGloveV4ButtonStem';
  group.add(rearButtonStem);

  const rearButton = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.10, 48), buttonMat);
  rearButton.rotation.z = Math.PI / 2;
  rearButton.position.x = -3.29;
  rearButton.name = 'BoxingGloveV4TriggerButton';
  group.add(rearButton);

  const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 12, 48), steel);
  lockRing.rotation.y = Math.PI / 2;
  lockRing.position.x = -3.11;
  lockRing.name = 'BoxingGloveV4ButtonBezel';
  group.add(lockRing);

  const selection = makeSelectionBox(new THREE.Vector3(6.05, 2.35, 1.82));
  selection.position.set(-0.38, 0, 0);
  group.add(selection);

  let state: 'armed' | 'firing' | 'hold' | 'retracting' = 'armed';
  let phase = 0;
  let autoTimer = 0;
  let extension = 0;
  let autoDemo = true;

  const applyPose = (): void => {
    const springLength = THREE.MathUtils.lerp(REST_SPRING_LENGTH, EXTENDED_SPRING_LENGTH, extension);
    const gloveX = REST_GLOVE_X + extension * PUNCH_DISTANCE;
    movingGlove.position.x = gloveX;

    spring.scale.set(springLength, 1, 1);
    spring.position.x = FRONT_X;

    const rodStart = FRONT_X + 0.08;
    const rodEnd = -1.12 + extension * PUNCH_DISTANCE;
    const rodLength = Math.max(0.18, rodEnd - rodStart);
    rod.scale.set(1, rodLength, 1);
    rod.position.x = rodStart + rodLength / 2;

    const press = state === 'firing' ? Math.min(1, phase * 5) : 0;
    rearButton.position.x = -3.29 + press * 0.085;
    rearButtonStem.position.x = -3.16 + press * 0.055;

    movingGlove.rotation.z = -0.035 * extension;
    group.userData.extension = extension;
    group.userData.state = state;
  };

  const trigger = (): void => {
    if (state !== 'armed') return;
    state = 'firing';
    phase = 0;
    autoTimer = 0;
  };

  const update = (dt: number): void => {
    if (state === 'armed') {
      autoTimer += dt;
      if (autoDemo && autoTimer > 1.35) trigger();
    } else if (state === 'firing') {
      phase += dt / 0.24;
      extension = THREE.MathUtils.clamp(smoothPunch(phase), 0, 1);
      if (phase >= 1) {
        extension = 1;
        state = 'hold';
        phase = 0;
      }
    } else if (state === 'hold') {
      phase += dt;
      if (phase >= 0.42) {
        state = 'retracting';
        phase = 0;
      }
    } else {
      phase += dt / 0.62;
      extension = 1 - smoothRetract(phase);
      if (phase >= 1) {
        extension = 0;
        state = 'armed';
        phase = 0;
        autoTimer = 0;
      }
    }
    applyPose();
  };

  group.userData.trigger = trigger;
  group.userData.update = update;
  group.userData.setAutoDemo = (enabled: boolean): void => { autoDemo = enabled; };
  group.userData.setExtension = (value: number): void => {
    autoDemo = false;
    extension = THREE.MathUtils.clamp(value, 0, 1);
    state = extension > 0.99 ? 'hold' : 'armed';
    phase = 0;
    applyPose();
  };

  applyPose();
  return { group, selectionMeshes: [selection] };
}
