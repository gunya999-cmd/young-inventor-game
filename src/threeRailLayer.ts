import * as THREE from 'three';
import { ACTIVE_LEVEL } from './level';
import { LEVEL01_BONUSES, isCanonicalLevel01, isLevel01BonusCollected, level01HintVisible } from './level01Gameplay';
import { PARTS, WORLD_HEIGHT, WORLD_WIDTH, type PartState } from './model';
import { CanvasRenderer, type RenderFrame } from './renderer';

type RendererPrototype = CanvasRenderer & { __threeRailVisualsInstalled?: boolean };
type RailVisual = { group: THREE.Group; glow: THREE.MeshBasicMaterial; socketLights: THREE.MeshStandardMaterial[] };

const layers = new WeakMap<CanvasRenderer, ThreeRailLayer>();
const search = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const isE2E = search.get('e2e') === '1';
const enableThreeInThisRun = !isE2E || search.get('three') === '1';

function roundedShape(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function roundedSolid(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
  bevel = 1.6
): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
    depth,
    steps: 1,
    curveSegments: 7,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function addContactShadow(group: THREE.Group, length: number): void {
  const material = new THREE.MeshBasicMaterial({
    color: 0x15212c,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  });
  const shadow = roundedSolid(length - 2, 32, 0.5, 12, material, 0.6);
  shadow.position.set(7, -8, -14);
  group.add(shadow);
}

function makeRail(length: number, authored = false, ghost = false): RailVisual {
  const group = new THREE.Group();
  group.userData.kind = 'three-rail';

  const glow = new THREE.MeshBasicMaterial({
    color: 0x6d83ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glowBody = roundedSolid(length + 15, 47, 1, 17, glow, 0.8);
  glowBody.position.z = -4;
  group.add(glowBody);

  if (ghost) {
    const material = new THREE.MeshStandardMaterial({
      color: 0x91a2ff,
      metalness: 0.12,
      roughness: 0.42,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      emissive: 0x4f67d9,
      emissiveIntensity: 0.2
    });
    group.add(roundedSolid(length, 28, 7, 10, material, 1.4));
    return { group, glow, socketLights: [] };
  }

  addContactShadow(group, length);

  const underbody = roundedSolid(
    length - 4,
    34,
    11,
    11,
    new THREE.MeshStandardMaterial({ color: 0x20303e, metalness: 0.52, roughness: 0.45 }),
    1.5
  );
  underbody.position.z = -7;
  group.add(underbody);

  const chassis = roundedSolid(
    length,
    30,
    18,
    11,
    new THREE.MeshStandardMaterial({
      color: authored ? 0x98a8b8 : 0xb7c4cf,
      metalness: 0.8,
      roughness: 0.23
    }),
    2.1
  );
  chassis.position.z = 3;
  group.add(chassis);

  const brightMetal = new THREE.MeshStandardMaterial({ color: 0xe2e8ed, metalness: 0.92, roughness: 0.17 });
  for (const y of [-11, 11]) {
    const edge = roundedSolid(length - 28, 3.2, 3.5, 1.6, brightMetal, 0.5);
    edge.position.set(0, y, 14);
    group.add(edge);
  }

  const track = roundedSolid(
    length - 46,
    10,
    5,
    4.5,
    new THREE.MeshStandardMaterial({ color: 0x17232f, metalness: 0.13, roughness: 0.57 }),
    0.9
  );
  track.position.z = 15;
  group.add(track);

  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x293947, metalness: 0.47, roughness: 0.34 });
  const socketLights: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const x = side * (length / 2 - 14);
    const cap = roundedSolid(26, 26, 11, 8, capMaterial, 1.5);
    cap.position.set(x, 0, 9);
    group.add(cap);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xa9b7c2,
      metalness: 0.9,
      roughness: 0.17,
      emissive: 0x5b75ff,
      emissiveIntensity: 0
    });
    socketLights.push(ringMaterial);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 2, 10, 24), ringMaterial);
    ring.position.set(x, 0, 17);
    group.add(ring);

    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 4, 16),
      new THREE.MeshStandardMaterial({ color: 0x172431, metalness: 0.5, roughness: 0.32 })
    );
    socket.rotation.x = Math.PI / 2;
    socket.position.set(x, 0, 17.2);
    group.add(socket);
  }

  if (!authored) {
    const footMaterial = new THREE.MeshStandardMaterial({ color: 0x65798b, metalness: 0.7, roughness: 0.33 });
    const boltMaterial = new THREE.MeshStandardMaterial({ color: 0xd2d9df, metalness: 0.94, roughness: 0.16 });
    for (const x of [-length * 0.29, length * 0.29]) {
      const foot = roundedSolid(34, 13, 7, 5, footMaterial, 1);
      foot.position.set(x, -21, -4);
      group.add(foot);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3.2, 16), boltMaterial);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, -21, 3);
      group.add(bolt);
    }
  }

  const accent = roundedSolid(
    Math.min(64, length * 0.3),
    5,
    3,
    2,
    new THREE.MeshStandardMaterial({
      color: authored ? 0x65788c : 0x667cff,
      metalness: 0.32,
      roughness: 0.31,
      emissive: authored ? 0x000000 : 0x3046bd,
      emissiveIntensity: authored ? 0 : 0.09
    }),
    0.6
  );
  accent.position.set(-length * 0.18, 0, 18);
  group.add(accent);

  return { group, glow, socketLights };
}

function setRailState(visual: RailVisual, selected: boolean): void {
  visual.glow.opacity = selected ? 0.3 : 0;
  for (const material of visual.socketLights) material.emissiveIntensity = selected ? 1.8 : 0;
  visual.group.scale.setScalar(selected ? 1.012 : 1);
}

function setWorldTransform(group: THREE.Object3D, x: number, y: number, angle: number, z = 0): void {
  group.position.set(x, -y, z);
  group.rotation.set(0, 0, -angle);
}

class ThreeRailLayer {
  private readonly source: CanvasRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, WORLD_WIDTH, 0, -WORLD_HEIGHT, 0.1, 2500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly railVisuals = new Map<string, RailVisual>();
  private readonly bonusVisuals = new Map<string, THREE.Mesh>();
  private readonly ghostVisuals: RailVisual[] = [];
  private ball: THREE.Mesh | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastRenderAt = 0;

  constructor(source: CanvasRenderer) {
    this.source = source;
    const host = source.canvas.parentElement;
    if (!host) throw new Error('Контейнер игрового поля не найден.');

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isE2E,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(isE2E ? 1 : Math.min(1.3, Math.max(1, window.devicePixelRatio || 1)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0xeef3f7, 1);
    this.renderer.domElement.className = 'three-rail-layer';
    this.renderer.domElement.dataset.renderEngine = 'three-webgl';
    this.renderer.domElement.dataset.performanceMode = isE2E ? 'test' : 'mobile-first';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 1200);
    this.camera.lookAt(0, 0, 0);
    this.buildEnvironment();
    this.buildStaticRails();
    this.buildReceiver();
    this.buildBonuses();
  }

  private buildEnvironment(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT),
      new THREE.MeshStandardMaterial({ color: 0xf1f4f6, metalness: 0.03, roughness: 0.88 })
    );
    floor.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, -45);
    this.scene.add(floor);

    const minor: number[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 50) minor.push(x, 0, -38, x, -WORLD_HEIGHT, -38);
    for (let y = 0; y <= WORLD_HEIGHT; y += 50) minor.push(0, -y, -38, WORLD_WIDTH, -y, -38);
    const minorGeometry = new THREE.BufferGeometry();
    minorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(minor, 3));
    this.scene.add(new THREE.LineSegments(minorGeometry, new THREE.LineBasicMaterial({ color: 0xcbd4dc, transparent: true, opacity: 0.22 })));

    const major: number[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 200) major.push(x, 0, -37, x, -WORLD_HEIGHT, -37);
    for (let y = 0; y <= WORLD_HEIGHT; y += 200) major.push(0, -y, -37, WORLD_WIDTH, -y, -37);
    const majorGeometry = new THREE.BufferGeometry();
    majorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(major, 3));
    this.scene.add(new THREE.LineSegments(majorGeometry, new THREE.LineBasicMaterial({ color: 0xaebbc6, transparent: true, opacity: 0.17 })));

    this.scene.add(new THREE.HemisphereLight(0xfbfdff, 0x56636f, 2.35));

    const key = new THREE.DirectionalLight(0xffffff, 3.6);
    key.position.set(260, 260, 950);
    key.target.position.set(800, -450, 0);
    this.scene.add(key, key.target);

    const fill = new THREE.DirectionalLight(0x92a8ff, 1.05);
    fill.position.set(1450, -850, 500);
    fill.target.position.set(850, -430, 0);
    this.scene.add(fill, fill.target);

    const rim = new THREE.PointLight(0x69d8b1, 1.15, 760, 2);
    rim.position.set(1410, -610, 220);
    this.scene.add(rim);
  }

  private addRail(key: string, length: number, x: number, y: number, angle: number, authored: boolean): void {
    const visual = makeRail(length, authored);
    setWorldTransform(visual.group, x, y, angle);
    this.scene.add(visual.group);
    this.railVisuals.set(key, visual);
  }

  private buildStaticRails(): void {
    for (const platform of ACTIVE_LEVEL.platforms) {
      if (platform.id === 'start-ramp' || platform.id === 'finish-ramp') {
        this.addRail(`platform:${platform.id}`, platform.width, platform.x, platform.y, platform.angle, true);
      }
    }
  }

  private buildReceiver(): void {
    const r = ACTIVE_LEVEL.receiver;
    const group = new THREE.Group();
    addContactShadow(group, r.innerWidth + r.wallThickness * 2 + 30);

    const shell = new THREE.MeshStandardMaterial({ color: 0x82939f, metalness: 0.64, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x31444d, metalness: 0.5, roughness: 0.4 });
    const pad = new THREE.MeshStandardMaterial({
      color: 0x70d7af,
      metalness: 0.03,
      roughness: 0.34,
      emissive: 0x2f9e78,
      emissiveIntensity: 0.38
    });

    const base = roundedSolid(r.innerWidth + r.wallThickness * 2 + 24, r.innerHeight + r.floorThickness + 34, 16, 22, dark, 2.2);
    base.position.z = -2;
    group.add(base);
    const landing = roundedSolid(r.innerWidth, r.innerHeight, 7, 17, pad, 1.6);
    landing.position.z = 12;
    group.add(landing);
    for (const side of [-1, 1]) {
      const wall = roundedSolid(r.wallThickness, r.innerHeight + r.floorThickness + 14, 21, 8, shell, 1.5);
      wall.position.set(side * (r.innerWidth / 2 + r.wallThickness / 2 + 5), 0, 14);
      group.add(wall);
    }
    const lower = roundedSolid(r.innerWidth + r.wallThickness * 2 + 10, r.floorThickness, 21, 8, shell, 1.5);
    lower.position.set(0, -(r.innerHeight / 2 + r.floorThickness / 2 + 4), 14);
    group.add(lower);
    setWorldTransform(group, r.x, r.y, 0);
    this.scene.add(group);
  }

  private buildBonuses(): void {
    for (const bonus of LEVEL01_BONUSES) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x8ea0ff,
        metalness: 0.28,
        roughness: 0.28,
        emissive: 0x5069e7,
        emissiveIntensity: 1.05
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 8, 6), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(bonus.x, -bonus.y, 14);
      this.scene.add(mesh);
      this.bonusVisuals.set(bonus.id, mesh);
    }
  }

  private ensureBall(): THREE.Mesh {
    if (this.ball) return this.ball;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(PARTS.ball.radius ?? 28, 32, 22),
      new THREE.MeshStandardMaterial({ color: 0x5169e3, metalness: 0.36, roughness: 0.18 })
    );
    this.scene.add(ball);
    this.ball = ball;
    return ball;
  }

  private syncCamera(): void {
    const rect = this.source.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.renderer.setSize(width, height, false);
      this.lastWidth = width;
      this.lastHeight = height;
    }
    const topLeft = this.source.screenToWorld(rect.left, rect.top);
    const bottomRight = this.source.screenToWorld(rect.right, rect.bottom);
    this.camera.left = topLeft.x;
    this.camera.right = bottomRight.x;
    this.camera.top = -topLeft.y;
    this.camera.bottom = -bottomRight.y;
    this.camera.updateProjectionMatrix();
  }

  private syncPlayerRails(frame: RenderFrame): void {
    const active = new Set<string>();
    for (const part of frame.snapshot.parts) {
      if (part.kind !== 'plank') continue;
      const key = `part:${part.id}`;
      active.add(key);
      let visual = this.railVisuals.get(key);
      if (!visual) {
        visual = makeRail(PARTS.plank.width);
        this.railVisuals.set(key, visual);
        this.scene.add(visual.group);
      }
      setWorldTransform(visual.group, part.x, part.y, part.angle);
      setRailState(visual, frame.mode === 'build' && frame.selectedId === part.id);
    }
    for (const [key, visual] of [...this.railVisuals]) {
      if (!key.startsWith('part:') || active.has(key)) continue;
      this.scene.remove(visual.group);
      this.railVisuals.delete(key);
    }
  }

  private syncBall(frame: RenderFrame): void {
    const state = frame.snapshot.parts.find((part: PartState) => part.kind === 'ball');
    if (!state) return;
    const ball = this.ensureBall();
    ball.position.set(state.x, -state.y, 28);
    ball.rotation.z = -state.angle;
  }

  private syncBonuses(): void {
    for (const bonus of LEVEL01_BONUSES) {
      const mesh = this.bonusVisuals.get(bonus.id);
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const collected = isLevel01BonusCollected(bonus.id);
      material.color.setHex(collected ? 0x69d7a8 : 0x8ea0ff);
      material.emissive.setHex(collected ? 0x2ba779 : 0x5069e7);
      material.emissiveIntensity = collected ? 1.55 : 1.05;
      mesh.scale.setScalar(collected ? 0.82 : 1);
    }
  }

  private syncGhostRoute(): void {
    if (!level01HintVisible()) {
      for (const ghost of this.ghostVisuals) ghost.group.visible = false;
      return;
    }
    const route = [
      { x: 548, y: 330, angle: 0.34 },
      { x: 758, y: 407, angle: 0.34 },
      { x: 965, y: 468, angle: 0.24 }
    ];
    while (this.ghostVisuals.length < route.length) {
      const ghost = makeRail(PARTS.plank.width, false, true);
      this.ghostVisuals.push(ghost);
      this.scene.add(ghost.group);
    }
    route.forEach((item, index) => {
      const ghost = this.ghostVisuals[index];
      ghost.group.visible = true;
      setWorldTransform(ghost.group, item.x, item.y, item.angle, -2);
    });
  }

  render(frame: RenderFrame): void {
    const now = performance.now();
    const interval = frame.mode === 'running' ? (isE2E ? 80 : 32) : (isE2E ? 40 : 16);
    if (this.lastRenderAt && now - this.lastRenderAt < interval) return;
    this.lastRenderAt = now;

    this.syncCamera();
    this.syncPlayerRails(frame);
    this.syncBall(frame);
    this.syncBonuses();
    this.syncGhostRoute();
    this.renderer.domElement.dataset.railCount = String(this.railVisuals.size);
    this.renderer.domElement.dataset.selectedRail = frame.selectedId ?? '';
    this.renderer.render(this.scene, this.camera);
  }
}

export function installThreeRailVisuals(): void {
  if (!isCanonicalLevel01() || !enableThreeInThisRun) return;
  const proto = CanvasRenderer.prototype as RendererPrototype;
  if (proto.__threeRailVisualsInstalled) return;
  proto.__threeRailVisualsInstalled = true;
  const previous = proto.render;
  proto.render = function renderWithThreeRailLayer(this: CanvasRenderer, frame: RenderFrame): void {
    previous.call(this, frame);
    let layer = layers.get(this);
    if (!layer) {
      try {
        layer = new ThreeRailLayer(this);
        layers.set(this, layer);
      } catch (error) {
        console.warn('Three.js visual layer unavailable; Canvas2D fallback remains active.', error);
        return;
      }
    }
    layer.render(frame);
  };
}
