import * as THREE from 'three';
import { ACTIVE_LEVEL } from './level';
import { LEVEL01_BONUSES, isCanonicalLevel01, isLevel01BonusCollected, level01HintVisible } from './level01Gameplay';
import { PARTS, WORLD_HEIGHT, WORLD_WIDTH, type PartState } from './model';
import { CanvasRenderer, type RenderFrame } from './renderer';

type RendererPrototype = CanvasRenderer & { __threeRailVisualsInstalled?: boolean };

type RailVisual = {
  group: THREE.Group;
  glow: THREE.MeshBasicMaterial;
  socketLights: THREE.MeshStandardMaterial[];
  authored: boolean;
};

const layers = new WeakMap<CanvasRenderer, ThreeRailLayer>();

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

function roundedSolid(width: number, height: number, depth: number, radius: number, material: THREE.Material, bevel = 2): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
    depth,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
  const glowBody = roundedSolid(length + 16, 48, 2, 18, glow, 1);
  glowBody.position.z = -3;
  group.add(glowBody);

  if (ghost) {
    const ghostMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x91a2ff,
      metalness: 0.15,
      roughness: 0.4,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      emissive: 0x4f67d9,
      emissiveIntensity: 0.18
    });
    const ghostBody = roundedSolid(length, 28, 8, 10, ghostMaterial, 2);
    group.add(ghostBody);
    return { group, glow, socketLights: [], authored };
  }

  const underMaterial = new THREE.MeshStandardMaterial({ color: 0x20303e, metalness: 0.55, roughness: 0.43 });
  const underbody = roundedSolid(length - 4, 34, 12, 11, underMaterial, 2);
  underbody.position.z = -7;
  group.add(underbody);

  const chassisMaterial = new THREE.MeshPhysicalMaterial({
    color: authored ? 0x98a8b8 : 0xb7c4cf,
    metalness: 0.82,
    roughness: 0.24,
    clearcoat: 0.48,
    clearcoatRoughness: 0.2
  });
  const chassis = roundedSolid(length, 30, 18, 11, chassisMaterial, 2.4);
  chassis.position.z = 3;
  group.add(chassis);

  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8ed,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.35
  });
  for (const y of [-11, 11]) {
    const edge = roundedSolid(length - 28, 3.2, 4, 1.6, edgeMaterial, 0.7);
    edge.position.set(0, y, 14);
    group.add(edge);
  }

  const trackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x17232f,
    metalness: 0.15,
    roughness: 0.54,
    clearcoat: 0.18
  });
  const track = roundedSolid(length - 46, 10, 5, 4.5, trackMaterial, 1.2);
  track.position.z = 15;
  group.add(track);

  const capMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x293947,
    metalness: 0.48,
    roughness: 0.32,
    clearcoat: 0.28
  });
  const socketLights: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const x = side * (length / 2 - 14);
    const cap = roundedSolid(26, 26, 12, 8, capMaterial, 2);
    cap.position.set(x, 0, 9);
    group.add(cap);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aabb9,
      metalness: 0.88,
      roughness: 0.18,
      emissive: 0x5b75ff,
      emissiveIntensity: 0
    });
    socketLights.push(ringMaterial);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.3, 2.1, 16, 40), ringMaterial);
    ring.position.set(x, 0, 17);
    ring.castShadow = true;
    group.add(ring);

    const socketMaterial = new THREE.MeshStandardMaterial({ color: 0x172431, metalness: 0.5, roughness: 0.3 });
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 4, 24), socketMaterial);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(x, 0, 17.2);
    group.add(socket);
  }

  if (!authored) {
    const footMaterial = new THREE.MeshPhysicalMaterial({ color: 0x65798b, metalness: 0.72, roughness: 0.31 });
    for (const x of [-length * 0.29, length * 0.29]) {
      const foot = roundedSolid(34, 13, 8, 5, footMaterial, 1.4);
      foot.position.set(x, -21, -4);
      group.add(foot);
      const boltMaterial = new THREE.MeshStandardMaterial({ color: 0xc8d1d8, metalness: 0.95, roughness: 0.16 });
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 3.5, 24), boltMaterial);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, -21, 3);
      group.add(bolt);
    }
  }

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: authored ? 0x65788c : 0x667cff,
    metalness: 0.35,
    roughness: 0.3,
    emissive: authored ? 0x000000 : 0x3046bd,
    emissiveIntensity: authored ? 0 : 0.08
  });
  const accent = roundedSolid(Math.min(64, length * 0.3), 5, 3.5, 2, accentMaterial, 0.8);
  accent.position.set(-length * 0.18, 0, 18);
  group.add(accent);

  return { group, glow, socketLights, authored };
}

function setRailState(visual: RailVisual, selected: boolean): void {
  visual.glow.opacity = selected ? 0.34 : 0;
  for (const material of visual.socketLights) material.emissiveIntensity = selected ? 2.1 : 0;
  visual.group.scale.setScalar(selected ? 1.015 : 1);
}

function setWorldTransform(group: THREE.Object3D, x: number, y: number, angle: number, z = 0): void {
  group.position.set(x, -y, z);
  group.rotation.set(0, 0, -angle);
}

class ThreeRailLayer {
  private readonly source: CanvasRenderer;
  private readonly host: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, WORLD_WIDTH, 0, -WORLD_HEIGHT, 0.1, 2500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly railVisuals = new Map<string, RailVisual>();
  private readonly bonusVisuals = new Map<string, THREE.Mesh>();
  private readonly ghostVisuals: RailVisual[] = [];
  private ball: THREE.Mesh | null = null;
  private receiver: THREE.Group | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(source: CanvasRenderer) {
    this.source = source;
    const host = source.canvas.parentElement;
    if (!host) throw new Error('Контейнер игрового поля не найден.');
    this.host = host;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.75, Math.max(1, window.devicePixelRatio || 1)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xeef3f7, 1);
    this.renderer.domElement.className = 'three-rail-layer';
    this.renderer.domElement.dataset.renderEngine = 'three-webgl';
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
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf1f4f6,
      metalness: 0.05,
      roughness: 0.84,
      clearcoat: 0.08
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT), floorMaterial);
    floor.position.set(WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, -45);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const minor: number[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 50) minor.push(x, 0, -38, x, -WORLD_HEIGHT, -38);
    for (let y = 0; y <= WORLD_HEIGHT; y += 50) minor.push(0, -y, -38, WORLD_WIDTH, -y, -38);
    const minorGeometry = new THREE.BufferGeometry();
    minorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(minor, 3));
    this.scene.add(new THREE.LineSegments(minorGeometry, new THREE.LineBasicMaterial({ color: 0xcbd4dc, transparent: true, opacity: 0.24 })));

    const major: number[] = [];
    for (let x = 0; x <= WORLD_WIDTH; x += 200) major.push(x, 0, -37, x, -WORLD_HEIGHT, -37);
    for (let y = 0; y <= WORLD_HEIGHT; y += 200) major.push(0, -y, -37, WORLD_WIDTH, -y, -37);
    const majorGeometry = new THREE.BufferGeometry();
    majorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(major, 3));
    this.scene.add(new THREE.LineSegments(majorGeometry, new THREE.LineBasicMaterial({ color: 0xaebbc6, transparent: true, opacity: 0.18 })));

    const hemi = new THREE.HemisphereLight(0xf8fbff, 0x52606e, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 4.1);
    key.position.set(260, 260, 950);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -950;
    key.shadow.camera.right = 950;
    key.shadow.camera.top = 700;
    key.shadow.camera.bottom = -700;
    key.shadow.bias = -0.0002;
    key.target.position.set(800, -450, 0);
    this.scene.add(key, key.target);

    const fill = new THREE.DirectionalLight(0x8ca4ff, 1.25);
    fill.position.set(1450, -850, 500);
    fill.target.position.set(850, -430, 0);
    this.scene.add(fill, fill.target);

    const rim = new THREE.PointLight(0x66d5ad, 1.6, 800, 2);
    rim.position.set(1420, -600, 260);
    this.scene.add(rim);
  }

  private addRail(key: string, length: number, x: number, y: number, angle: number, authored: boolean): void {
    const visual = makeRail(length, authored);
    setWorldTransform(visual.group, x, y, angle, 0);
    this.scene.add(visual.group);
    this.railVisuals.set(key, visual);
  }

  private buildStaticRails(): void {
    for (const platform of ACTIVE_LEVEL.platforms) {
      if (platform.id !== 'start-ramp' && platform.id !== 'finish-ramp') continue;
      this.addRail(`platform:${platform.id}`, platform.width, platform.x, platform.y, platform.angle, true);
    }
  }

  private buildReceiver(): void {
    const r = ACTIVE_LEVEL.receiver;
    const group = new THREE.Group();
    const shellMaterial = new THREE.MeshPhysicalMaterial({ color: 0x82939f, metalness: 0.68, roughness: 0.3, clearcoat: 0.25 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x31444d, metalness: 0.55, roughness: 0.38 });
    const padMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x70d7af,
      metalness: 0.05,
      roughness: 0.34,
      clearcoat: 0.65,
      emissive: 0x2f9e78,
      emissiveIntensity: 0.42
    });
    const base = roundedSolid(r.innerWidth + r.wallThickness * 2 + 24, r.innerHeight + r.floorThickness + 34, 18, 22, darkMaterial, 3);
    base.position.z = -2;
    group.add(base);
    const pad = roundedSolid(r.innerWidth, r.innerHeight, 8, 17, padMaterial, 2);
    pad.position.z = 12;
    group.add(pad);
    for (const side of [-1, 1]) {
      const wall = roundedSolid(r.wallThickness, r.innerHeight + r.floorThickness + 14, 24, 8, shellMaterial, 2);
      wall.position.set(side * (r.innerWidth / 2 + r.wallThickness / 2 + 5), 0, 14);
      group.add(wall);
    }
    const lowerWall = roundedSolid(r.innerWidth + r.wallThickness * 2 + 10, r.floorThickness, 24, 8, shellMaterial, 2);
    lowerWall.position.set(0, -(r.innerHeight / 2 + r.floorThickness / 2 + 4), 14);
    group.add(lowerWall);
    setWorldTransform(group, r.x, r.y, 0, 0);
    this.receiver = group;
    this.scene.add(group);
  }

  private buildBonuses(): void {
    for (const bonus of LEVEL01_BONUSES) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x8ea0ff,
        metalness: 0.32,
        roughness: 0.25,
        emissive: 0x5069e7,
        emissiveIntensity: 1.2
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 9, 6), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(bonus.x, -bonus.y, 14);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.bonusVisuals.set(bonus.id, mesh);
    }
  }

  private ensureBall(): THREE.Mesh {
    if (this.ball) return this.ball;
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x4c65e3,
      metalness: 0.38,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.1
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(PARTS.ball.radius ?? 28, 48, 32), material);
    ball.castShadow = true;
    ball.receiveShadow = true;
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
    const activeIds = new Set<string>();
    for (const part of frame.snapshot.parts) {
      if (part.kind !== 'plank') continue;
      const key = `part:${part.id}`;
      activeIds.add(key);
      let visual = this.railVisuals.get(key);
      if (!visual) {
        visual = makeRail(PARTS.plank.width, false);
        this.railVisuals.set(key, visual);
        this.scene.add(visual.group);
      }
      setWorldTransform(visual.group, part.x, part.y, part.angle, 0);
      setRailState(visual, frame.mode === 'build' && frame.selectedId === part.id);
    }
    for (const [key, visual] of [...this.railVisuals]) {
      if (!key.startsWith('part:') || activeIds.has(key)) continue;
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
      material.emissiveIntensity = collected ? 1.8 : 1.2;
      mesh.scale.setScalar(collected ? 0.82 : 1);
    }
  }

  private syncGhostRoute(): void {
    const visible = level01HintVisible();
    if (!visible) {
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
  if (!isCanonicalLevel01()) return;
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
