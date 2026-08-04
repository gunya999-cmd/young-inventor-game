import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, Circle, RevoluteJoint, Vec2, World } from 'planck';

const FIXED_DT = 1 / 180;
const SWITCH_OFF_ANGLE = -0.30;
const SWITCH_ON_ANGLE = 0.30;
const SWITCH_TRIP_ANGLE = 0.035;
const DETENT_STIFFNESS = 24;
const DETENT_DAMPING = 1.75;
const DETENT_MAX_TORQUE = 5.8;

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.035): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 36,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

function makeScrew(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.055, 32), material);
  head.rotation.x = Math.PI / 2;
  g.add(head);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.018, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x24292c, metalness: 0.7, roughness: 0.35 }),
  );
  slot.position.z = 0.034;
  slot.rotation.z = -0.15;
  g.add(slot);
  return g;
}

function makeSocket(y: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.58, y, 0.16);

  const dark = new THREE.MeshPhysicalMaterial({ color: 0x171a1b, metalness: 0.08, roughness: 0.62, clearcoat: 0.18 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xb9893f, metalness: 0.92, roughness: 0.25 });
  const rim = new THREE.MeshPhysicalMaterial({ color: 0xd4d2ca, metalness: 0.1, roughness: 0.36, clearcoat: 0.36 });

  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 48), rim);
  outer.rotation.x = Math.PI / 2;
  g.add(outer);

  const recess = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.065, 48), dark);
  recess.rotation.x = Math.PI / 2;
  recess.position.z = 0.055;
  g.add(recess);

  for (const x of [-0.105, 0.105]) {
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.055), dark);
    hole.position.set(x, 0.02, 0.105);
    g.add(hole);
    const contact = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.02), brass);
    contact.position.set(x, 0.02, 0.135);
    g.add(contact);
  }

  const earth = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 18), dark);
  earth.rotation.x = Math.PI / 2;
  earth.position.set(0, -0.20, 0.11);
  g.add(earth);
  return g;
}

function makePlugCable(): THREE.Group {
  const g = new THREE.Group();
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x1a1d1f, metalness: 0.02, roughness: 0.72 });
  const plug = new THREE.Mesh(extrude(roundedRectShape(0.42, 0.28, 0.09), 0.18, 0.025), rubber);
  plug.position.set(0.58, -0.93, 0.50);
  g.add(plug);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.78, -0.95, 0.49),
    new THREE.Vector3(1.45, -1.15, 0.38),
    new THREE.Vector3(2.05, -0.55, 0.30),
    new THREE.Vector3(2.55, -0.72, 0.22),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.055, 10, false), rubber));
  return g;
}

function makeTestLamp(): { group: THREE.Group; bulb: THREE.Mesh; glow: THREE.PointLight } {
  const group = new THREE.Group();
  group.position.set(2.85, -0.65, 0.0);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x454e54, metalness: 0.9, roughness: 0.28 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.42, 32), metal);
  base.position.y = -0.28;
  group.add(base);

  const bulbMat = new THREE.MeshPhysicalMaterial({
    color: 0xdad2ad,
    roughness: 0.18,
    transmission: 0.38,
    transparent: true,
    opacity: 0.88,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 40, 28), bulbMat);
  bulb.scale.y = 1.18;
  bulb.position.y = 0.20;
  group.add(bulb);

  const glow = new THREE.PointLight(0xffd787, 0, 4.5, 2);
  glow.position.set(0, 0.30, 0.55);
  group.add(glow);
  return { group, bulb, glow };
}

export function installOutletSwitchLab(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const style = document.createElement('style');
  style.textContent = `
    .outlet-lab .bowling-ball-lab__stage{position:relative}.outlet-lab canvas{width:100%;height:min(72vh,760px);display:block;touch-action:none}
    .outlet-controls{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:12px;z-index:5;flex-wrap:wrap;justify-content:center}.outlet-controls button{border:1px solid rgba(255,255,255,.18);border-radius:13px;padding:12px 18px;background:#11161b;color:#fff;font:700 14px/1 system-ui}.outlet-controls button.primary{background:#d8a536;color:#15120a;border-color:#f4cb67}.outlet-status{position:absolute;right:20px;bottom:22px;z-index:5;padding:10px 13px;border-radius:11px;color:#eef3f6;background:rgba(10,13,16,.82);font:600 12px/1.35 system-ui;backdrop-filter:blur(8px)}
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab outlet-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 21 · PHYSICAL 3D REVIEW</small><h1>Outlet with Switch / Розетка с выключателем</h1></div>
      <div class="bowling-ball-lab__meta"><span>PBR</span><span>Planck contact</span><span>bistable detent</span><span>physical power state</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Outlet with switch 3D preview" data-asset-version="outlet-switch-v2-physical-detent"></canvas>
      <div class="outlet-controls"><button class="primary" data-action="drop">Уронить шар</button><button data-action="toggle">Толкнуть тумблер</button><button data-action="reset">Сбросить</button></div>
      <div class="outlet-status">Питание выключено</div>
    </div>`;
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const dropButton = root.querySelector<HTMLButtonElement>('[data-action="drop"]')!;
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const status = root.querySelector<HTMLElement>('.outlet-status')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x2d3338, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xf5f9fb, 0x4d565d, 1.0));
  const key = new THREE.DirectionalLight(0xfff2df, 2.2);
  key.position.set(-4.2, 5.5, 6.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e6ef, 0.72);
  fill.position.set(4.2, 1.5, 4.8);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.25;
  floor.receiveShadow = true;
  scene.add(floor);

  const assembly = new THREE.Group();
  assembly.position.set(-0.45, 0.0, 0);
  assembly.rotation.x = -0.04;
  assembly.rotation.y = 0.10;
  scene.add(assembly);

  const plateMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe4e1d7, metalness: 0.06, roughness: 0.32, clearcoat: 0.42, clearcoatRoughness: 0.24 });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xaeb4b7, metalness: 0.82, roughness: 0.27 });
  const blackMaterial = new THREE.MeshPhysicalMaterial({ color: 0x171a1c, metalness: 0.05, roughness: 0.58, clearcoat: 0.25 });

  const back = new THREE.Mesh(extrude(roundedRectShape(2.4, 3.35, 0.24), 0.24, 0.055), edgeMaterial);
  back.position.z = -0.10;
  assembly.add(back);
  const face = new THREE.Mesh(extrude(roundedRectShape(2.24, 3.18, 0.20), 0.16, 0.04), plateMaterial);
  face.position.z = 0.08;
  assembly.add(face);

  const screwA = makeScrew(edgeMaterial); screwA.position.set(0, 1.38, 0.22); assembly.add(screwA);
  const screwB = makeScrew(edgeMaterial); screwB.position.set(0, -1.38, 0.22); assembly.add(screwB);
  assembly.add(makeSocket(0.35), makeSocket(-0.78));
  assembly.add(makePlugCable());

  const switchPivot = new THREE.Group();
  switchPivot.position.set(-0.58, 0.52, 0.31);
  assembly.add(switchPivot);
  const switchFrame = new THREE.Mesh(extrude(roundedRectShape(0.66, 1.22, 0.15), 0.10, 0.025), blackMaterial);
  switchFrame.position.set(-0.58, 0.52, 0.20);
  assembly.add(switchFrame);

  const leverMat = new THREE.MeshPhysicalMaterial({ color: 0xcac6b9, metalness: 0.22, roughness: 0.28, clearcoat: 0.52 });
  const lever = new THREE.Mesh(extrude(roundedRectShape(0.38, 0.92, 0.12), 0.16, 0.028), leverMat);
  lever.position.y = 0.14;
  switchPivot.add(lever);
  const indicator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.025, 20),
    new THREE.MeshStandardMaterial({ color: 0x5a1010, emissive: 0x000000 }),
  );
  indicator.rotation.x = Math.PI / 2;
  indicator.position.set(-0.58, -0.08, 0.34);
  assembly.add(indicator);

  const lamp = makeTestLamp();
  assembly.add(lamp.group);
  assembly.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });

  const world = new World({ gravity: Vec2(0, -8.5), allowSleep: false });
  const ground = world.createBody();
  const switchBody = world.createBody({
    type: 'dynamic',
    position: Vec2(-0.58, 0.52),
    angle: SWITCH_OFF_ANGLE,
    angularDamping: 0.35,
  });
  switchBody.createFixture({ shape: Box(0.19, 0.46, Vec2(0, 0.14), 0), density: 1.35, friction: 0.46, restitution: 0.02 });
  world.createJoint(RevoluteJoint({ enableLimit: true, lowerAngle: -0.34, upperAngle: 0.34 }, ground, switchBody, Vec2(-0.58, 0.52)));

  let latchedOn = false;
  let powered = false;
  let ballBody: ReturnType<World['createBody']> | null = null;
  let ballMesh: THREE.Mesh | null = null;

  const renderPower = (on: boolean): void => {
    powered = on;
    const bulbMat = lamp.bulb.material as THREE.MeshPhysicalMaterial;
    bulbMat.emissive.setHex(on ? 0xffb23f : 0x000000);
    bulbMat.emissiveIntensity = on ? 3.4 : 0;
    lamp.glow.intensity = on ? 3.2 : 0;
    const im = indicator.material as THREE.MeshStandardMaterial;
    im.color.setHex(on ? 0x5d1a12 : 0x341111);
    im.emissive.setHex(on ? 0xff4b28 : 0x000000);
    im.emissiveIntensity = on ? 1.8 : 0;
    status.textContent = on
      ? 'Питание включено · тумблер физически защёлкнут · лампа работает'
      : 'Питание выключено · тумблер физически защёлкнут';
  };

  const updateDetent = (): void => {
    const angle = switchBody.getAngle();
    const omega = switchBody.getAngularVelocity();

    if (!latchedOn && (angle > SWITCH_TRIP_ANGLE || (angle > -0.015 && omega > 0.65))) {
      latchedOn = true;
      renderPower(true);
    } else if (latchedOn && (angle < -SWITCH_TRIP_ANGLE || (angle < 0.015 && omega < -0.65))) {
      latchedOn = false;
      renderPower(false);
    }

    const target = latchedOn ? SWITCH_ON_ANGLE : SWITCH_OFF_ANGLE;
    const torque = THREE.MathUtils.clamp(
      (target - angle) * DETENT_STIFFNESS - omega * DETENT_DAMPING,
      -DETENT_MAX_TORQUE,
      DETENT_MAX_TORQUE,
    );
    switchBody.applyTorque(torque, true);
  };

  const spawnBall = (): void => {
    if (ballBody) world.destroyBody(ballBody);
    if (ballMesh) assembly.remove(ballMesh);
    // Offset to the left of the hinge so the downward impact creates a real
    // positive angular impulse instead of a scripted toggle.
    ballBody = world.createBody({ type: 'dynamic', position: Vec2(-0.86, 2.30), linearDamping: 0.01, angularDamping: 0.02 });
    ballBody.createFixture({ shape: Circle(0.23), density: 5.2, restitution: 0.06, friction: 0.52 });
    ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 32, 22),
      new THREE.MeshPhysicalMaterial({ color: 0x59636a, metalness: 0.88, roughness: 0.24 }),
    );
    ballMesh.castShadow = true;
    assembly.add(ballMesh);
    canvas.dataset.ballSpawned = 'true';
  };

  dropButton.addEventListener('click', spawnBall);
  toggleButton.addEventListener('click', () => {
    // A hand interaction is also a physical impulse. The detent decides whether
    // the mechanism actually crosses into the other stable state.
    switchBody.applyAngularImpulse(latchedOn ? -0.62 : 0.62, true);
  });
  resetButton.addEventListener('click', () => {
    if (ballBody) { world.destroyBody(ballBody); ballBody = null; }
    if (ballMesh) { assembly.remove(ballMesh); ballMesh = null; }
    switchBody.setTransform(Vec2(-0.58, 0.52), SWITCH_OFF_ANGLE);
    switchBody.setAngularVelocity(0);
    latchedOn = false;
    renderPower(false);
    canvas.dataset.ballSpawned = 'false';
  });

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  const defaultCamera = new THREE.Vector3(0.25, 0.55, 8.6);
  camera.position.copy(defaultCamera);
  camera.lookAt(0.6, -0.10, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 5.0;
  controls.maxDistance = 12;
  controls.target.set(0.6, -0.10, 0);
  controls.update();

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  renderPower(false);
  canvas.dataset.ballSpawned = 'false';
  let previous = performance.now();
  let accumulator = 0;

  const animate = (now: number): void => {
    const wallDt = Math.min(0.045, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator += wallDt;

    while (accumulator >= FIXED_DT) {
      updateDetent();
      world.step(FIXED_DT, 14, 6);
      accumulator -= FIXED_DT;
    }

    switchPivot.rotation.z = switchBody.getAngle();
    if (ballBody && ballMesh) {
      const p = ballBody.getPosition();
      ballMesh.position.set(p.x, p.y, 0.42);
      ballMesh.rotation.z = ballBody.getAngle();
      canvas.dataset.ballY = p.y.toFixed(4);
      canvas.dataset.ballVelocityY = ballBody.getLinearVelocity().y.toFixed(4);
    }

    canvas.dataset.powered = powered ? 'true' : 'false';
    canvas.dataset.switchLatched = latchedOn ? 'on' : 'off';
    canvas.dataset.switchAngle = switchBody.getAngle().toFixed(4);
    canvas.dataset.switchAngularVelocity = switchBody.getAngularVelocity().toFixed(4);
    canvas.dataset.physics = 'planck-contact+revolute-joint+torsion-detent-v2';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}
