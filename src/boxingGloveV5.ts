import * as THREE from 'three';
import { createBoxingGloveModelV3 } from './boxingGloveV3';
import { makeSelectionBox, type PremiumReviewAssetModel } from './parts0913PremiumShared';

const REST_X = 0;
const PUNCH_DISTANCE = 1.36;
const BASE_FRONT_X = -1.46;
const GLOVE_SPRING_ANCHOR_X = -1.13;
const REST_SPRING_LENGTH = GLOVE_SPRING_ANCHOR_X - BASE_FRONT_X;
const EXTENDED_SPRING_LENGTH = REST_SPRING_LENGTH + PUNCH_DISTANCE;

class UnitSpringCurve extends THREE.Curve<THREE.Vector3> {
  private readonly turns: number;

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  override getPoint(t: number): THREE.Vector3 {
    const angle = t * this.turns * Math.PI * 2;
    return new THREE.Vector3(t, Math.cos(angle) * 0.205, Math.sin(angle) * 0.205);
  }
}

function createSpringGeometry(turns = 9.5): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new UnitSpringCurve(turns), 180, 0.024, 8, false);
}

function createCompactTimBase(): { group: THREE.Group; button: THREE.Mesh; buttonStem: THREE.Mesh } {
  const group = new THREE.Group();
  const purple = new THREE.MeshPhysicalMaterial({
    color: 0x4a4d9d,
    roughness: 0.40,
    metalness: 0.42,
    clearcoat: 0.08,
    clearcoatRoughness: 0.54
  });
  const blue = new THREE.MeshStandardMaterial({ color: 0x293f76, roughness: 0.42, metalness: 0.58 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbec8ce, roughness: 0.27, metalness: 0.86 });
  const red = new THREE.MeshPhysicalMaterial({
    color: 0xd72735,
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.11,
    clearcoatRoughness: 0.52
  });

  // TIM reads as a glove with a small mechanism attached to the cuff, not as a
  // separate launcher. Keep the base compact and partially tucked into the cuff.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.54, 56, 2, false), purple);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = -1.62;
  barrel.name = 'BoxingGloveV5CompactBase';
  group.add(barrel);

  const frontCollar = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.052, 14, 56), steel);
  frontCollar.rotation.y = Math.PI / 2;
  frontCollar.position.x = BASE_FRONT_X;
  frontCollar.name = 'BoxingGloveV5SpringCollar';
  group.add(frontCollar);

  const rearPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.075, 56), blue);
  rearPlate.rotation.z = Math.PI / 2;
  rearPlate.position.x = -1.91;
  rearPlate.name = 'BoxingGloveV5RearPlate';
  group.add(rearPlate);

  // The defining TIM interaction: a RED button on the rear/base side.
  const buttonStem = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.14, 32), steel);
  buttonStem.rotation.z = Math.PI / 2;
  buttonStem.position.x = -1.995;
  buttonStem.name = 'BoxingGloveV5ButtonStem';
  group.add(buttonStem);

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.085, 40), red);
  button.rotation.z = Math.PI / 2;
  button.position.x = -2.105;
  button.name = 'BoxingGloveV5TriggerButton';
  button.userData.isBoxingGloveTrigger = true;
  group.add(button);

  // Small mounting skid: enough to make the part feel fixed in space without
  // turning it into a large industrial machine.
  const skid = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.10, 0.60), blue);
  skid.position.set(-1.66, -0.42, 0);
  skid.name = 'BoxingGloveV5MountSkid';
  group.add(skid);

  return { group, button, buttonStem };
}

function easeOutBack(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  const c1 = 0.72;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeInOutCubic(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function createBoxingGloveModelV5(): PremiumReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v5';
  group.userData.sourceKey = 'sketchfab-incg5764-boxing-glove-cc-by';
  group.userData.referenceStyle = 'tim-compact-rear-button-spring-punch';
  group.userData.dynamic = true;
  group.userData.gravity = false;
  group.userData.motion = 'rear-button-contact-punch';
  group.userData.punchAxis = [1, 0, 0];
  group.userData.punchDistance = PUNCH_DISTANCE;
  group.userData.triggerZone = { center: [-2.11, 0, 0], size: [0.16, 0.38, 0.38] };
  group.userData.snapPoints = [
    { id: 'trigger', position: [-2.15, 0, 0] },
    { id: 'mount', position: [-1.66, -0.45, 0] },
    { id: 'impact-rest', position: [1.06, 0.12, 0] },
    { id: 'impact-extended', position: [1.06 + PUNCH_DISTANCE, 0.12, 0] }
  ];

  const base = createCompactTimBase();
  group.add(base.group);

  const glove = createBoxingGloveModelV3().group;
  for (const name of ['BoxingGloveV3TriggerStem', 'BoxingGloveV3TriggerButton']) {
    const child = glove.getObjectByName(name);
    if (child?.parent) child.parent.remove(child);
  }
  // The glove head stays dominant, as in TIM. The compact mechanism only peeks
  // out of the cuff until the punch exposes the spring.
  glove.position.x = REST_X;
  glove.scale.setScalar(0.96);
  glove.name = 'BoxingGloveV5MovingHead';
  group.add(glove);

  const steel = new THREE.MeshStandardMaterial({ color: 0xc4cdd2, metalness: 0.88, roughness: 0.25 });
  const springMaterial = new THREE.MeshStandardMaterial({ color: 0xd5dce0, metalness: 0.92, roughness: 0.23 });

  const spring = new THREE.Mesh(createSpringGeometry(), springMaterial);
  spring.position.set(BASE_FRONT_X, 0, 0);
  spring.name = 'BoxingGloveV5VisibleCoilSpring';
  group.add(spring);

  const guideRod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 28), steel);
  guideRod.rotation.z = Math.PI / 2;
  guideRod.name = 'BoxingGloveV5GuideRod';
  group.add(guideRod);

  const cuffConnector = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.10, 40), steel);
  cuffConnector.rotation.z = Math.PI / 2;
  cuffConnector.position.x = GLOVE_SPRING_ANCHOR_X;
  cuffConnector.name = 'BoxingGloveV5CuffConnector';
  group.add(cuffConnector);

  const selection = makeSelectionBox(new THREE.Vector3(4.85, 2.25, 1.72));
  selection.position.set(0.15, 0.02, 0);
  group.add(selection);

  let state: 'armed' | 'punching' | 'hold' | 'returning' = 'armed';
  let phase = 0;
  let extension = 0;
  let triggerPressed = false;
  let triggerLatched = false;

  const applyPose = (): void => {
    const gloveX = REST_X + extension * PUNCH_DISTANCE;
    glove.position.x = gloveX;
    cuffConnector.position.x = GLOVE_SPRING_ANCHOR_X + extension * PUNCH_DISTANCE;

    const springLength = THREE.MathUtils.lerp(REST_SPRING_LENGTH, EXTENDED_SPRING_LENGTH, extension);
    spring.position.x = BASE_FRONT_X;
    spring.scale.set(springLength, 1, 1);

    const rodStart = BASE_FRONT_X + 0.04;
    const rodEnd = GLOVE_SPRING_ANCHOR_X + extension * PUNCH_DISTANCE;
    const rodLength = Math.max(0.10, rodEnd - rodStart);
    guideRod.scale.set(1, rodLength, 1);
    guideRod.position.x = rodStart + rodLength * 0.5;

    const buttonTravel = triggerPressed ? 0.070 : 0;
    base.button.position.x = -2.105 + buttonTravel;
    base.buttonStem.position.x = -1.995 + buttonTravel * 0.58;

    // Very small kick gives the hit character without turning into cartoon wobble.
    glove.rotation.z = -0.025 * extension;
    group.userData.state = state;
    group.userData.extension = extension;
    group.userData.triggerPressed = triggerPressed;
  };

  const fire = (): void => {
    if (state !== 'armed' || triggerLatched) return;
    triggerLatched = true;
    state = 'punching';
    phase = 0;
  };

  const setTriggerPressed = (pressed: boolean): void => {
    const next = Boolean(pressed);
    if (next && !triggerPressed) fire();
    triggerPressed = next;
    if (!triggerPressed && state === 'armed') triggerLatched = false;
    applyPose();
  };

  const update = (dt: number): void => {
    if (state === 'punching') {
      phase += dt / 0.145;
      extension = THREE.MathUtils.clamp(easeOutBack(phase), 0, 1);
      if (phase >= 1) {
        extension = 1;
        state = 'hold';
        phase = 0;
      }
    } else if (state === 'hold') {
      phase += dt;
      if (phase >= 0.075) {
        state = 'returning';
        phase = 0;
      }
    } else if (state === 'returning') {
      phase += dt / 0.26;
      extension = 1 - easeInOutCubic(phase);
      if (phase >= 1) {
        extension = 0;
        state = 'armed';
        phase = 0;
        if (!triggerPressed) triggerLatched = false;
      }
    }
    applyPose();
  };

  // Game-side contract: Planck contact on triggerZone calls setTriggerPressed(true),
  // contact end calls false. A rising edge launches exactly one punch.
  group.userData.setTriggerPressed = setTriggerPressed;
  group.userData.trigger = (): void => {
    setTriggerPressed(true);
    window.setTimeout(() => setTriggerPressed(false), 90);
  };
  group.userData.update = update;
  group.userData.setExtensionForReview = (value: number): void => {
    extension = THREE.MathUtils.clamp(value, 0, 1);
    state = extension > 0.98 ? 'hold' : 'armed';
    phase = 0;
    applyPose();
  };

  applyPose();
  return { group, selectionMeshes: [selection] };
}
