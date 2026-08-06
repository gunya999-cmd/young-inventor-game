import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Circle, Vec2, World, type Body } from 'planck';

type ReviewCanvas = HTMLCanvasElement & {
  __pullTrigger?: () => void;
  __resetTarget?: () => void;
};

const FIXED_DT = 1 / 180;
const MAX_CATCHUP = 0.30;
const MUZZLE_X = 1.76;
const MUZZLE_Y = 0.36;
const BULLET_SPEED = 13.5;
const TARGET_X = 4.15;
const TARGET_Y = 0.36;

function roundedGripShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, 0.45);
  shape.quadraticCurveTo(-0.34, 0.22, -0.40, -0.15);
  shape.quadraticCurveTo(-0.44, -0.58, -0.24, -1.00);
  shape.quadraticCurveTo(0.02, -1.18, 0.34, -1.02);
  shape.quadraticCurveTo(0.46, -0.62, 0.34, -0.25);
  shape.quadraticCurveTo(0.22, 0.14, 0.14, 0.45);
  shape.closePath();
  return shape;
}

function makeBolt(material: THREE.Material, radius: number, depth: number): THREE.Mesh {
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 18), material);
  bolt.rotation.x = Math.PI / 2;
  return bolt;
}

function buildRevolver(): {
  group: THREE.Group;
  triggerPivot: THREE.Group;
  hammerPivot: THREE.Group;
  cylinder: THREE.Group;
  muzzleFlash: THREE.Mesh;
  triggerHit: THREE.Object3D;
} {
  const group = new THREE.Group();
  group.name = 'ClassicPart19_RevolverV1';

  const bluedSteel = new THREE.MeshPhysicalMaterial({
    color: 0x26313a,
    metalness: 0.94,
    roughness: 0.27,
    clearcoat: 0.12,
    clearcoatRoughness: 0.23,
  });
  const machinedSteel = new THREE.MeshPhysicalMaterial({
    color: 0x7d8990,
    metalness: 0.98,
    roughness: 0.22,
    clearcoat: 0.10,
  });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x151c22, metalness: 0.92, roughness: 0.34 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xa87935, metalness: 0.83, roughness: 0.31, clearcoat: 0.07 });
  const wood = new THREE.MeshPhysicalMaterial({
    color: 0x713f25,
    metalness: 0.02,
    roughness: 0.52,
    clearcoat: 0.34,
    clearcoatRoughness: 0.26,
  });
  const blackRubber = new THREE.MeshStandardMaterial({ color: 0x171a1c, metalness: 0.03, roughness: 0.88 });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.72, 0.42, 5, 3, 2), bluedSteel);
  frame.name = 'Revolver_Frame';
  frame.position.set(0.12, 0.25, 0);
  group.add(frame);

  const topStrap = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.15, 0.36), machinedSteel);
  topStrap.position.set(0.18, 0.67, 0);
  topStrap.name = 'Revolver_TopStrap';
  group.add(topStrap);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 1.86, 48, 1, false), bluedSteel);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(1.16, 0.43, 0);
  barrel.name = 'Revolver_Barrel';
  group.add(barrel);

  const barrelSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.16, 48), machinedSteel);
  barrelSleeve.rotation.z = -Math.PI / 2;
  barrelSleeve.position.set(2.06, 0.43, 0);
  group.add(barrelSleeve);

  const muzzleBore = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.035, 40), darkSteel);
  muzzleBore.rotation.z = -Math.PI / 2;
  muzzleBore.position.set(2.155, 0.43, 0);
  muzzleBore.name = 'Revolver_MuzzleBore';
  group.add(muzzleBore);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.10), darkSteel);
  frontSight.position.set(1.78, 0.66, 0);
  group.add(frontSight);

  const cylinder = new THREE.Group();
  cylinder.name = 'Revolver_Cylinder';
  cylinder.position.set(0.22, 0.35, 0);
  group.add(cylinder);

  const cylinderBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.48, 48), bluedSteel);
  cylinderBody.rotation.x = Math.PI / 2;
  cylinder.add(cylinderBody);

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.50, 24), darkSteel);
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0);
    cylinder.add(chamber);
  }

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.60, 28), machinedSteel);
  axle.rotation.x = Math.PI / 2;
  cylinder.add(axle);

  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.055, 12, 48, Math.PI * 1.72), bluedSteel);
  triggerGuard.rotation.z = -0.42;
  triggerGuard.scale.set(1.16, 0.72, 1);
  triggerGuard.position.set(-0.18, -0.15, 0);
  triggerGuard.name = 'Revolver_TriggerGuard';
  group.add(triggerGuard);

  const triggerPivot = new THREE.Group();
  triggerPivot.position.set(-0.18, 0.02, 0);
  triggerPivot.name = 'Revolver_TriggerPivot';
  group.add(triggerPivot);

  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.047, 10, 32, Math.PI * 0.92), machinedSteel);
  trigger.position.set(0.02, -0.19, 0);
  trigger.rotation.z = -0.55;
  trigger.userData.isRevolverTrigger = true;
  trigger.name = 'Revolver_Trigger';
  triggerPivot.add(trigger);

  const triggerEye = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 10, 28), brass);
  triggerEye.position.set(-0.24, -0.34, 0);
  triggerEye.rotation.x = Math.PI / 2;
  triggerEye.userData.isRevolverTrigger = true;
  triggerEye.name = 'Revolver_RopeTriggerEye';
  triggerPivot.add(triggerEye);

  const hammerPivot = new THREE.Group();
  hammerPivot.position.set(-0.62, 0.62, 0);
  hammerPivot.name = 'Revolver_HammerPivot';
  group.add(hammerPivot);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.32), darkSteel);
  hammer.position.set(-0.04, 0.10, 0);
  hammer.rotation.z = -0.18;
  hammerPivot.add(hammer);

  const gripGeometry = new THREE.ExtrudeGeometry(roundedGripShape(), {
    depth: 0.30,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.04,
    bevelSegments: 4,
    curveSegments: 18,
  });
  gripGeometry.translate(0, 0, -0.15);
  const grip = new THREE.Mesh(gripGeometry, wood);
  grip.scale.set(0.82, 0.82, 1);
  grip.rotation.z = -0.24;
  grip.position.set(-0.55, -0.47, 0);
  grip.name = 'Revolver_WoodGrip';
  group.add(grip);

  const backstrap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.30, 0.34), bluedSteel);
  backstrap.rotation.z = -0.25;
  backstrap.position.set(-0.80, -0.40, 0);
  group.add(backstrap);

  for (const y of [-0.46, -0.78]) {
    const screw = makeBolt(machinedSteel, 0.055, 0.34);
    screw.position.set(-0.48, y, 0);
    group.add(screw);
  }

  const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.34), blackRubber);
  buttPad.rotation.z = -0.24;
  buttPad.position.set(-0.76, -1.25, 0);
  group.add(buttPad);

  const muzzleFlashMat = new THREE.MeshBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.72, 18), muzzleFlashMat);
  muzzleFlash.rotation.z = -Math.PI / 2;
  muzzleFlash.position.set(2.48, 0.43, 0);
  muzzleFlash.name = 'Revolver_MuzzleFlash';
  group.add(muzzleFlash);

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return { group, triggerPivot, hammerPivot, cylinder, muzzleFlash, triggerHit: trigger };
}

function makeBalloon(): THREE.Group {
  const balloon = new THREE.Group();
  balloon.name = 'Revolver_DemoBalloon';
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd83a3a,
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.52,
    clearcoatRoughness: 0.22,
    transmission: 0.03,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.43, 40, 28), mat);
  body.scale.y = 1.18;
  body.userData.isDemoBalloon = true;
  balloon.add(body);

  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 14), mat);
  knot.position.y = -0.54;
  knot.rotation.z = Math.PI;
  knot.userData.isDemoBalloon = true;
  balloon.add(knot);

  const stringMat = new THREE.MeshStandardMaterial({ color: 0x8d8d88, roughness: 0.94 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.59, 0),
    new THREE.Vector3(0.04, -0.90, 0),
    new THREE.Vector3(-0.04, -1.16, 0),
  ]);
  const string = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 6, false), stringMat);
  balloon.add(string);
  return balloon;
}

export function installRevolverLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab revolver-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 19 · TRIGGERED PROJECTILE</small><h1>Revolver / Gun</h1></div>
      <div class="bowling-ball-lab__meta"><span>Three.js</span><span>PBR</span><span>Planck</span><span>Rope trigger</span><span>v1</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Revolver realistic 3D preview"
        data-asset-version="revolver-v1-physical-projectile"
        data-source-license="PROJECT-ORIGINAL"
        data-source-key="original-game-revolver-v1"
        data-render-source="procedural-real-geometry"
        data-physics-engine="planck"
        data-motion="translational-trigger-physical-projectile"
        data-rope-anchor="trigger-eye"
        data-fake-floor="false"></canvas>
      <p>Нажми на спусковую скобу/кольцо: спуск физически проходит ход, курок срабатывает, а отдельное тело-пуля летит к шарику. Попадание лопает шарик; затем он автоматически восстанавливается для следующего теста.</p>
    </div>
  `;
  document.body.appendChild(root);

  const canvas = root.querySelector<ReviewCanvas>('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0xe8edf0, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;
  scene.add(new THREE.HemisphereLight(0xfafcff, 0x68727a, 0.83));

  const key = new THREE.DirectionalLight(0xfff8ee, 1.52);
  key.position.set(-4.7, 5.9, 7.4);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7e9f4, 0.47);
  fill.position.set(4.6, 1.0, 5.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffead8, 0.34);
  rim.position.set(3.4, 4.8, -4.7);
  scene.add(rim);

  const reviewRoot = new THREE.Group();
  reviewRoot.rotation.set(-0.06, -0.20, 0.015);
  reviewRoot.position.set(-1.05, 0.08, 0);
  scene.add(reviewRoot);

  const revolver = buildRevolver();
  revolver.group.scale.setScalar(0.78);
  reviewRoot.add(revolver.group);

  const balloon = makeBalloon();
  balloon.position.set(TARGET_X, TARGET_Y, 0);
  reviewRoot.add(balloon);

  const bulletMat = new THREE.MeshPhysicalMaterial({
    color: 0xb88b44,
    metalness: 0.86,
    roughness: 0.28,
    clearcoat: 0.08,
  });
  const bulletMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 6, 12), bulletMat);
  bulletMesh.rotation.z = -Math.PI / 2;
  bulletMesh.visible = false;
  bulletMesh.name = 'Revolver_PhysicalBullet';
  reviewRoot.add(bulletMesh);

  const world = new World({ gravity: Vec2(0, 0), allowSleep: false });
  let bulletBody: Body | null = null;
  const targetBody = world.createBody({ type: 'static', position: Vec2(TARGET_X, TARGET_Y) });
  targetBody.setUserData({ kind: 'balloon-target' });
  targetBody.createFixture({ shape: Circle(0.40), isSensor: true });

  let accumulator = 0;
  let triggerProgress = 0;
  let triggerVelocity = 0;
  let hammerProgress = 0;
  let recoil = 0;
  let fireRequested = false;
  let firedThisPull = false;
  let targetPopped = false;
  let shotCount = 0;
  let hitCount = 0;
  let popResetTimer = 0;
  let muzzleTimer = 0;

  const destroyBullet = (): void => {
    if (bulletBody) {
      world.destroyBody(bulletBody);
      bulletBody = null;
    }
    bulletMesh.visible = false;
  };

  const resetTarget = (): void => {
    targetPopped = false;
    balloon.visible = true;
    balloon.scale.set(1, 1, 1);
    popResetTimer = 0;
  };
  canvas.__resetTarget = resetTarget;

  const spawnBullet = (): void => {
    destroyBullet();
    bulletBody = world.createBody({
      type: 'dynamic',
      position: Vec2(MUZZLE_X, MUZZLE_Y),
      linearVelocity: Vec2(BULLET_SPEED, 0),
      gravityScale: 0,
      linearDamping: 0,
      bullet: true,
      allowSleep: false,
    });
    bulletBody.setUserData({ kind: 'revolver-bullet' });
    bulletBody.createFixture({ shape: Circle(0.055), density: 1.2, friction: 0.05, restitution: 0.03 });
    bulletMesh.visible = true;
    muzzleTimer = 0.055;
    recoil = 1;
    shotCount += 1;
  };

  world.on('begin-contact', (contact) => {
    const a = contact.getFixtureA().getBody().getUserData() as { kind?: string } | undefined;
    const b = contact.getFixtureB().getBody().getUserData() as { kind?: string } | undefined;
    const kinds = [a?.kind, b?.kind];
    if (kinds.includes('revolver-bullet') && kinds.includes('balloon-target') && !targetPopped) {
      targetPopped = true;
      hitCount += 1;
      popResetTimer = 1.15;
      balloon.visible = false;
      destroyBullet();
    }
  });

  const pullTrigger = (): void => {
    if (triggerProgress > 0.10 || fireRequested) return;
    fireRequested = true;
    triggerVelocity = 5.2;
    firedThisPull = false;
  };
  canvas.__pullTrigger = pullTrigger;

  const updateMechanism = (dt: number): void => {
    if (fireRequested) {
      triggerProgress += triggerVelocity * dt;
      triggerVelocity *= Math.pow(0.22, dt);
      if (triggerProgress >= 0.74 && !firedThisPull) {
        firedThisPull = true;
        hammerProgress = 1;
        revolver.cylinder.rotation.z -= Math.PI / 3;
        spawnBullet();
      }
      if (triggerProgress >= 1) {
        triggerProgress = 1;
        fireRequested = false;
        triggerVelocity = -3.2;
      }
    } else if (triggerProgress > 0) {
      triggerProgress = Math.max(0, triggerProgress + triggerVelocity * dt);
      triggerVelocity -= 4.8 * dt;
      if (triggerProgress <= 0) {
        triggerProgress = 0;
        triggerVelocity = 0;
        firedThisPull = false;
      }
    }

    hammerProgress = Math.max(0, hammerProgress - dt * 7.0);
    recoil = Math.max(0, recoil - dt * 9.5);
    muzzleTimer = Math.max(0, muzzleTimer - dt);

    revolver.triggerPivot.rotation.z = -triggerProgress * 0.48;
    revolver.hammerPivot.rotation.z = -0.12 + hammerProgress * 0.62;
    revolver.group.position.x = -recoil * 0.08;
    (revolver.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = muzzleTimer > 0 ? muzzleTimer / 0.055 : 0;
  };

  const updatePhysics = (dt: number): void => {
    accumulator = Math.min(MAX_CATCHUP, accumulator + Math.max(0, dt));
    while (accumulator >= FIXED_DT) {
      world.step(FIXED_DT, 8, 3);
      accumulator -= FIXED_DT;
    }

    if (bulletBody) {
      const p = bulletBody.getPosition();
      bulletMesh.position.set(p.x, p.y, 0);
      if (p.x > 5.5 || p.x < -2 || Math.abs(p.y) > 3.0) destroyBullet();
    }
  };

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 120);
  camera.position.set(1.15, 0.15, 9.0);
  camera.lookAt(1.15, 0.05, 0);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragDistance = 0;
  let velocityX = 0;
  let velocityY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDistance = 0;
    velocityX = 0;
    velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    dragDistance += Math.hypot(dx, dy);
    lastX = event.clientX;
    lastY = event.clientY;
    velocityX = dx * 0.005;
    velocityY = dy * 0.005;
    reviewRoot.rotation.y += velocityX;
    reviewRoot.rotation.x += velocityY;
  });

  const release = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragDistance >= 8) return;

    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(revolver.group, true);
    const triggerHit = hits.find((hit) => hit.object.userData.isRevolverTrigger === true);
    if (triggerHit) pullTrigger();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(1.7, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let previous = performance.now();
  const animate = (now: number): void => {
    const wallDt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;

    updateMechanism(wallDt);
    updatePhysics(wallDt);

    if (targetPopped) {
      popResetTimer -= wallDt;
      if (popResetTimer <= 0) resetTarget();
    }

    if (pointerId === null) {
      const damping = Math.pow(0.03, wallDt);
      velocityX *= damping;
      velocityY *= damping;
      reviewRoot.rotation.y += velocityX;
      reviewRoot.rotation.x += velocityY;
    }

    canvas.dataset.triggerTravel = triggerProgress.toFixed(3);
    canvas.dataset.hammer = hammerProgress.toFixed(3);
    canvas.dataset.shotCount = String(shotCount);
    canvas.dataset.hitCount = String(hitCount);
    canvas.dataset.targetPopped = targetPopped ? 'true' : 'false';
    canvas.dataset.bulletActive = bulletBody ? 'true' : 'false';
    canvas.dataset.bulletSpeed = bulletBody ? bulletBody.getLinearVelocity().length().toFixed(3) : '0';
    canvas.dataset.reviewRotationX = reviewRoot.rotation.x.toFixed(4);
    canvas.dataset.reviewRotationY = reviewRoot.rotation.y.toFixed(4);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
