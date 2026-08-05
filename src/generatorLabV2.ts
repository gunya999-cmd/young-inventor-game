import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Circle, RevoluteJoint, Vec2, World } from 'planck';

const FIXED_DT = 1 / 180;
const DRIVER_X = -2.25;
const GENERATOR_X = 0;
const PULLEY_Y = 0.05;
const PULLEY_RADIUS = 0.42;
const TARGET_DRIVE_SPEED = 11.5;
const MAX_DRIVE_TORQUE = 10.0;
const BELT_RESPONSE = 18.0;
const MAX_BELT_FORCE = 24.0;
const GENERATOR_DRAG = 0.035;
const LOAD_DRAG = 0.10;
const POWER_THRESHOLD = 1.6;
const FULL_OUTPUT_OMEGA = 7.0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cable(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, radius, 10, false), material);
}

function pulley(radius: number, face: THREE.Material, metal: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.18, 64), face);
  wheel.rotation.x = Math.PI / 2;
  g.add(wheel);
  for (const z of [-0.095, 0.095]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.96, 0.035, 12, 64), metal);
    rim.position.z = z;
    g.add(rim);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.27, 40), metal);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, radius * 1.34, 0.055), metal);
    spoke.rotation.z = angle;
    g.add(spoke);
  }
  return g;
}

function belt(material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const midpoint = (DRIVER_X + GENERATOR_X) / 2;
  const width = GENERATOR_X - DRIVER_X;
  const z = 0.87;
  for (const y of [PULLEY_Y - PULLEY_RADIUS, PULLEY_Y + PULLEY_RADIUS]) {
    const run = new THREE.Mesh(new THREE.BoxGeometry(width, 0.075, 0.11), material);
    run.position.set(midpoint, y, z);
    g.add(run);
  }
  for (const x of [DRIVER_X, GENERATOR_X]) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(PULLEY_RADIUS, 0.054, 12, 72), material);
    wrap.position.set(x, PULLEY_Y, z);
    g.add(wrap);
  }
  return g;
}

function lamp(): { group: THREE.Group; bulb: THREE.Mesh; glow: THREE.PointLight } {
  const g = new THREE.Group();
  g.position.set(2.55, 0.20, 0.05);
  const baseMaterial = new THREE.MeshPhysicalMaterial({ color: 0x31383d, metalness: 0.78, roughness: 0.30 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.42, 40), baseMaterial);
  base.position.y = -0.22;
  g.add(base);
  const bulbMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf2e5bf, roughness: 0.14, transmission: 0.42, transparent: true, opacity: 0.92, emissive: 0x000000, emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.31, 44, 28), bulbMaterial);
  bulb.scale.y = 1.16;
  bulb.position.y = 0.22;
  g.add(bulb);
  const glow = new THREE.PointLight(0xffc66f, 0, 4.8, 2);
  glow.position.set(0, 0.26, 0.52);
  g.add(glow);
  return { group: g, bulb, glow };
}

export function installGeneratorLabV2(): void {
  document.documentElement.classList.add('bowling-ball-lab-mode');
  document.body.classList.add('bowling-ball-lab-mode', 'parts-0913-lab-mode');

  const style = document.createElement('style');
  style.textContent = `
    .generator-lab .bowling-ball-lab__stage{position:relative}.generator-lab canvas{width:100%;height:min(74vh,780px);display:block;touch-action:none}
    .generator-controls{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:10px;z-index:5;flex-wrap:wrap;justify-content:center}.generator-controls button{border:1px solid rgba(255,255,255,.18);border-radius:13px;padding:12px 17px;background:#11161b;color:#fff;font:700 14px/1 system-ui}.generator-controls button.primary{background:#d8a536;color:#15120a;border-color:#f4cb67}.generator-status{position:absolute;right:18px;bottom:20px;z-index:5;padding:10px 13px;border-radius:11px;color:#eef3f6;background:rgba(10,13,16,.84);font:600 12px/1.4 system-ui;backdrop-filter:blur(8px);min-width:210px}
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.className = 'bowling-ball-lab parts-0913-lab generator-lab';
  root.innerHTML = `
    <header class="bowling-ball-lab__header">
      <div><small>CLASSIC PART 22 · PHYSICAL 3D REVIEW</small><h1>Generator / Генератор</h1></div>
      <div class="bowling-ball-lab__meta"><span>PBR</span><span>Planck</span><span>fan-belt input</span><span>mechanical → electrical</span><span>v2</span></div>
    </header>
    <div class="bowling-ball-lab__stage">
      <canvas aria-label="Generator 3D preview" data-asset-version="generator-v2"></canvas>
      <div class="generator-controls"><button class="primary" data-action="start">Запустить внешний привод</button><button data-action="stop">Остановить привод</button><button data-action="load">Отключить лампу</button><button data-action="reset">Сбросить</button></div>
      <div class="generator-status">Привод остановлен · генератор не вырабатывает ток</div>
    </div>`;
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const startButton = root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
  const stopButton = root.querySelector<HTMLButtonElement>('[data-action="stop"]')!;
  const loadButton = root.querySelector<HTMLButtonElement>('[data-action="load"]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const status = root.querySelector<HTMLElement>('.generator-status')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(0x30363b, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xf6fafc, 0x4f5960, 1.0));
  const key = new THREE.DirectionalLight(0xfff3df, 2.15);
  key.position.set(-4.5, 5.7, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e8f1, 0.74);
  fill.position.set(4.6, 2.1, 5.0);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshStandardMaterial({ color: 0x3c4348, roughness: 0.94 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.55;
  floor.receiveShadow = true;
  scene.add(floor);

  const assembly = new THREE.Group();
  assembly.rotation.x = -0.055;
  assembly.rotation.y = 0.10;
  scene.add(assembly);

  const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: 0x496b73, metalness: 0.70, roughness: 0.31, clearcoat: 0.10, clearcoatRoughness: 0.48 });
  const darkMetal = new THREE.MeshPhysicalMaterial({ color: 0x232a2e, metalness: 0.86, roughness: 0.28 });
  const machined = new THREE.MeshPhysicalMaterial({ color: 0xaeb8bc, metalness: 0.95, roughness: 0.19 });
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xb66b3d, metalness: 0.76, roughness: 0.28 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.82, metalness: 0.02 });

  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.80, 1.30, 72), bodyMaterial);
  housing.rotation.x = Math.PI / 2;
  housing.position.set(GENERATOR_X, PULLEY_Y, 0.02);
  assembly.add(housing);

  for (const z of [-0.67, 0.67]) {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.76, 0.18, 72), darkMetal);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(GENERATOR_X, PULLEY_Y, z);
    assembly.add(bell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.045, 12, 72), machined);
    ring.position.set(GENERATOR_X, PULLEY_Y, z + (z > 0 ? 0.09 : -0.09));
    assembly.add(ring);
  }

  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.045), darkMetal);
    vent.position.set(Math.cos(angle) * 0.64, PULLEY_Y + Math.sin(angle) * 0.64, 0.42);
    vent.rotation.z = angle;
    assembly.add(vent);
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.16, 0.03), copper);
    coil.position.set(Math.cos(angle) * 0.60, PULLEY_Y + Math.sin(angle) * 0.60, 0.385);
    coil.rotation.z = angle;
    assembly.add(coil);
  }

  for (const x of [-0.48, 0.48]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.74), bodyMaterial);
    foot.position.set(x, -0.78, -0.08);
    assembly.add(foot);
    const isolator = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 28), rubber);
    isolator.position.set(x, -0.89, -0.08);
    assembly.add(isolator);
  }

  const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.44), darkMetal);
  terminalBox.position.set(0.70, 0.55, 0.10);
  assembly.add(terminalBox);
  for (const x of [0.61, 0.79]) {
    const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 24), copper);
    terminal.rotation.x = Math.PI / 2;
    terminal.position.set(x, 0.60, 0.37);
    assembly.add(terminal);
  }

  const generatorPulley = pulley(PULLEY_RADIUS, darkMetal, machined);
  generatorPulley.position.set(GENERATOR_X, PULLEY_Y, 0.88);
  assembly.add(generatorPulley);

  const driverStand = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.20, 0.74), darkMetal);
  driverStand.position.set(DRIVER_X, -0.70, -0.05);
  assembly.add(driverStand);
  const driverPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.30), darkMetal);
  driverPost.position.set(DRIVER_X, -0.28, 0.02);
  assembly.add(driverPost);
  const driverPulley = pulley(PULLEY_RADIUS, new THREE.MeshPhysicalMaterial({ color: 0x5a6267, metalness: 0.88, roughness: 0.24 }), machined);
  driverPulley.position.set(DRIVER_X, PULLEY_Y, 0.88);
  assembly.add(driverPulley);

  const beltVisual = belt(rubber);
  assembly.add(beltVisual);

  const loadLamp = lamp();
  assembly.add(loadLamp.group);
  assembly.add(cable([
    new THREE.Vector3(0.82, 0.55, 0.18),
    new THREE.Vector3(1.25, 0.78, 0.14),
    new THREE.Vector3(1.92, 0.58, 0.10),
    new THREE.Vector3(2.30, 0.05, 0.08),
  ], 0.045, rubber));

  assembly.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  const world = new World({ gravity: Vec2(0, 0), allowSleep: false });
  const frame = world.createBody({ type: 'static' });
  const driverBody = world.createBody({ type: 'dynamic', position: Vec2(DRIVER_X, PULLEY_Y), angularDamping: 0.035, gravityScale: 0, allowSleep: false });
  driverBody.createFixture({ shape: Circle(PULLEY_RADIUS), density: 2.6, friction: 0.70, restitution: 0.01 });
  const driverJoint = world.createJoint(new RevoluteJoint({ enableMotor: false, motorSpeed: TARGET_DRIVE_SPEED, maxMotorTorque: MAX_DRIVE_TORQUE, collideConnected: false }, frame, driverBody, Vec2(DRIVER_X, PULLEY_Y)))!;

  const rotorBody = world.createBody({ type: 'dynamic', position: Vec2(GENERATOR_X, PULLEY_Y), angularDamping: GENERATOR_DRAG, gravityScale: 0, allowSleep: false });
  rotorBody.createFixture({ shape: Circle(PULLEY_RADIUS), density: 1.8, friction: 0.70, restitution: 0.01 });
  world.createJoint(new RevoluteJoint({ collideConnected: false }, frame, rotorBody, Vec2(GENERATOR_X, PULLEY_Y)));

  let driveEnabled = false;
  let loadConnected = true;
  let accumulator = 0;
  let beltSlip = 0;
  let outputLevel = 0;
  let generatedPower = false;

  const updateElectricalOutput = (): void => {
    const rotorOmega = Math.abs(rotorBody.getAngularVelocity());
    outputLevel = rotorOmega > POWER_THRESHOLD ? clamp(rotorOmega / FULL_OUTPUT_OMEGA, 0, 1) : 0;
    generatedPower = loadConnected && outputLevel > 0;
    const bulbMaterial = loadLamp.bulb.material as THREE.MeshPhysicalMaterial;
    bulbMaterial.emissive.setHex(generatedPower ? 0xffad42 : 0x000000);
    bulbMaterial.emissiveIntensity = generatedPower ? 0.35 + outputLevel * 3.7 : 0;
    loadLamp.glow.intensity = generatedPower ? 0.45 + outputLevel * 3.5 : 0;

    if (!loadConnected) status.textContent = rotorOmega > POWER_THRESHOLD ? 'Генератор вращается · нагрузка отключена' : 'Нагрузка отключена';
    else if (generatedPower) status.textContent = `Генерация ${(outputLevel * 100).toFixed(0)}% · лампа питается от ременного привода`;
    else if (driveEnabled) status.textContent = 'Ремень раскручивает ротор генератора…';
    else status.textContent = 'Привод остановлен · генератор не вырабатывает ток';
  };

  const applyTransmission = (): void => {
    const driverOmega = driverBody.getAngularVelocity();
    const rotorOmega = rotorBody.getAngularVelocity();
    beltSlip = (driverOmega - rotorOmega) * PULLEY_RADIUS;
    const tangentialForce = clamp(beltSlip * BELT_RESPONSE, -MAX_BELT_FORCE, MAX_BELT_FORCE);
    driverBody.applyTorque(-tangentialForce * PULLEY_RADIUS, true);
    rotorBody.applyTorque(tangentialForce * PULLEY_RADIUS, true);

    if (loadConnected) {
      const omega = rotorBody.getAngularVelocity();
      const electricalResistance = clamp(-omega * LOAD_DRAG, -1.45, 1.45);
      rotorBody.applyTorque(electricalResistance, true);
    }
  };

  const setDrive = (enabled: boolean): void => {
    driveEnabled = enabled;
    driverJoint.enableMotor(enabled);
    if (enabled) {
      driverJoint.setMotorSpeed(TARGET_DRIVE_SPEED);
      driverJoint.setMaxMotorTorque(MAX_DRIVE_TORQUE);
      driverBody.setAwake(true);
      rotorBody.setAwake(true);
    }
  };

  startButton.addEventListener('click', () => setDrive(true));
  stopButton.addEventListener('click', () => setDrive(false));
  loadButton.addEventListener('click', () => {
    loadConnected = !loadConnected;
    loadButton.textContent = loadConnected ? 'Отключить лампу' : 'Подключить лампу';
  });
  resetButton.addEventListener('click', () => {
    setDrive(false);
    loadConnected = true;
    loadButton.textContent = 'Отключить лампу';
    driverBody.setTransform(Vec2(DRIVER_X, PULLEY_Y), 0);
    rotorBody.setTransform(Vec2(GENERATOR_X, PULLEY_Y), 0);
    driverBody.setAngularVelocity(0);
    rotorBody.setAngularVelocity(0);
    beltSlip = 0;
    updateElectricalOutput();
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0.35, 0.38, 9.4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 6.5;
  controls.maxDistance = 13;
  controls.target.set(0.05, -0.04, 0.20);
  controls.update();

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  updateElectricalOutput();
  let previous = performance.now();
  const animate = (now: number): void => {
    const wallDt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    accumulator = Math.min(0.25, accumulator + wallDt);
    while (accumulator >= FIXED_DT) {
      applyTransmission();
      world.step(FIXED_DT, 12, 6);
      accumulator -= FIXED_DT;
    }

    driverPulley.rotation.z = driverBody.getAngle();
    generatorPulley.rotation.z = rotorBody.getAngle();
    updateElectricalOutput();

    canvas.dataset.driveEnabled = driveEnabled ? 'true' : 'false';
    canvas.dataset.loadConnected = loadConnected ? 'true' : 'false';
    canvas.dataset.generatorPowered = generatedPower ? 'true' : 'false';
    canvas.dataset.driverOmega = driverBody.getAngularVelocity().toFixed(4);
    canvas.dataset.rotorOmega = rotorBody.getAngularVelocity().toFixed(4);
    canvas.dataset.outputLevel = outputLevel.toFixed(4);
    canvas.dataset.beltSlip = beltSlip.toFixed(4);
    canvas.dataset.physics = 'planck-finite-torque-driver+stiff-friction-belt+generator-load-v2';

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
