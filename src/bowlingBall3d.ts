import * as THREE from 'three';
import { PARTS, type PartState } from './model';
import { CanvasRenderer, type RenderFrame } from './renderer';

type RendererPrototype = CanvasRenderer & { __bowlingBall3dInstalled?: boolean };

class BowlingBallVisual {
  readonly group = new THREE.Group();
  private readonly shellMaterial: THREE.MeshPhysicalMaterial;
  private readonly rimMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly selectionHalo: THREE.Mesh;

  constructor() {
    this.group.userData.kind = 'bowling-ball-3d';
    this.group.userData.snapPoints = [];

    this.shellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x101821,
      metalness: 0.06,
      roughness: 0.21,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
      emissive: 0x000000,
      emissiveIntensity: 0
    });

    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 44), this.shellMaterial);
    shell.name = 'BowlingBallShell';
    shell.castShadow = false;
    shell.receiveShadow = false;
    this.group.add(shell);

    const cavityMaterial = new THREE.MeshStandardMaterial({
      color: 0x020508,
      metalness: 0,
      roughness: 0.84
    });

    const holeSpecs = [
      { x: -0.22, y: 0.22, radius: 0.125 },
      { x: 0.20, y: 0.22, radius: 0.125 },
      { x: 0, y: -0.15, radius: 0.145 }
    ];

    for (const [index, hole] of holeSpecs.entries()) {
      const cavity = new THREE.Mesh(new THREE.CircleGeometry(hole.radius * 0.82, 40), cavityMaterial);
      cavity.name = `FingerHoleCavity${index + 1}`;
      cavity.position.set(hole.x, hole.y, 0.994);
      this.group.add(cavity);

      const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x687786,
        metalness: 0.72,
        roughness: 0.24,
        emissive: 0x5971ff,
        emissiveIntensity: 0
      });
      this.rimMaterials.push(rimMaterial);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(hole.radius, hole.radius * 0.09, 12, 48), rimMaterial);
      rim.name = `FingerHoleRim${index + 1}`;
      rim.position.set(hole.x, hole.y, 1.002);
      this.group.add(rim);
    }

    const accentMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x526de7,
      metalness: 0.28,
      roughness: 0.26,
      clearcoat: 0.45,
      emissive: 0x1d2d8c,
      emissiveIntensity: 0.18
    });
    const accent = new THREE.Mesh(new THREE.CircleGeometry(0.032, 24), accentMaterial);
    accent.name = 'BowlingBallAccent';
    accent.position.set(0, -0.56, 0.997);
    this.group.add(accent);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x6680ff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.selectionHalo = new THREE.Mesh(new THREE.TorusGeometry(1.075, 0.035, 12, 64), haloMaterial);
    this.selectionHalo.name = 'BowlingBallSelectionHalo';
    this.selectionHalo.visible = false;
    this.selectionHalo.position.z = -0.03;
    this.group.add(this.selectionHalo);
  }

  setSelected(selected: boolean): void {
    this.selectionHalo.visible = selected;
    this.shellMaterial.emissive.setHex(selected ? 0x111d61 : 0x000000);
    this.shellMaterial.emissiveIntensity = selected ? 0.32 : 0;
    for (const material of this.rimMaterials) material.emissiveIntensity = selected ? 1.7 : 0;
  }
}

class BowlingBall3DLayer {
  private readonly source: CanvasRenderer;
  private readonly host: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly visuals = new Map<string, BowlingBallVisual>();
  private cssWidth = 1;
  private cssHeight = 1;

  constructor(source: CanvasRenderer) {
    this.source = source;
    const host = source.canvas.parentElement;
    if (!host) throw new Error('Контейнер игрового поля не найден.');
    this.host = host;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.6, Math.max(1, window.devicePixelRatio || 1)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'bowling-ball-3d-layer';
    this.renderer.domElement.dataset.renderEngine = 'three-webgl';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xf7fbff, 0x52606d, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 4.6);
    key.position.set(-180, 220, 420);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8aa2ff, 1.05);
    fill.position.set(260, -140, 280);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x8fe9d2, 0.5);
    rim.position.set(320, 260, 80);
    this.scene.add(rim);

    document.documentElement.dataset.bowlingBall3d = 'ready';
  }

  render(frame: RenderFrame): void {
    this.resize();
    const balls = frame.snapshot.parts.filter((part) => part.kind === 'ball');
    const activeIds = new Set(balls.map((part) => part.id));

    for (const [id, visual] of this.visuals) {
      if (activeIds.has(id)) continue;
      this.scene.remove(visual.group);
      this.visuals.delete(id);
    }

    for (const part of balls) this.syncPart(part, frame.selectedId === part.id);

    const first = balls[0];
    this.renderer.domElement.dataset.bowlingBallCount = String(balls.length);
    if (first) {
      this.renderer.domElement.dataset.ballX = first.x.toFixed(2);
      this.renderer.domElement.dataset.ballY = first.y.toFixed(2);
      this.renderer.domElement.dataset.ballAngle = first.angle.toFixed(4);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private syncPart(part: PartState, selected: boolean): void {
    let visual = this.visuals.get(part.id);
    if (!visual) {
      visual = new BowlingBallVisual();
      visual.group.name = `BowlingBall:${part.id}`;
      this.visuals.set(part.id, visual);
      this.scene.add(visual.group);
    }

    const hostRect = this.host.getBoundingClientRect();
    const screen = this.source.worldToScreen({ x: part.x, y: part.y });
    const edge = this.source.worldToScreen({ x: part.x + (PARTS.ball.radius ?? 28), y: part.y });
    const radiusPixels = Math.max(1, Math.hypot(edge.x - screen.x, edge.y - screen.y));

    visual.group.position.set(screen.x - hostRect.left - this.cssWidth / 2, this.cssHeight / 2 - (screen.y - hostRect.top), 0);
    visual.group.rotation.set(0, 0, -part.angle);
    visual.group.scale.setScalar(radiusPixels);
    visual.setSelected(selected);
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (width === this.cssWidth && height === this.cssHeight) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }
}

const layers = new WeakMap<CanvasRenderer, BowlingBall3DLayer>();

export function installBowlingBall3D(): void {
  const prototype = CanvasRenderer.prototype as RendererPrototype;
  if (prototype.__bowlingBall3dInstalled) return;
  prototype.__bowlingBall3dInstalled = true;

  const originalRender = prototype.render;
  prototype.render = function renderWithBowlingBall3D(frame: RenderFrame): void {
    originalRender.call(this, frame);
    let layer = layers.get(this);
    if (!layer) {
      try {
        layer = new BowlingBall3DLayer(this);
        layers.set(this, layer);
      } catch (error) {
        document.documentElement.dataset.bowlingBall3d = 'fallback';
        console.warn('Bowling Ball 3D fallback to Canvas2D.', error);
        return;
      }
    }
    layer.render(frame);
  };
}
