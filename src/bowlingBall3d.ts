import * as THREE from 'three';
import { createBowlingBallModel, setBowlingBallSelected, type BowlingBallModel } from './bowlingBallModel';
import { PARTS, type PartState } from './model';
import { CanvasRenderer, type RenderFrame } from './renderer';

type RendererPrototype = CanvasRenderer & { __bowlingBall3dInstalled?: boolean };

class BowlingBallVisual {
  readonly model: BowlingBallModel = createBowlingBallModel();
  get group(): THREE.Group { return this.model.group; }
  setSelected(selected: boolean): void { setBowlingBallSelected(this.model, selected); }
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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'bowling-ball-3d-layer';
    this.renderer.domElement.dataset.renderEngine = 'three-webgl';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // Neutral studio lighting. No colored hotspots: the material, not the lamps,
    // should define the object.
    this.scene.add(new THREE.HemisphereLight(0xf7f8fa, 0x55585f, 1.55));

    const key = new THREE.DirectionalLight(0xffffff, 2.25);
    key.position.set(-180, 240, 420);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdfe5ec, 0.78);
    fill.position.set(260, -120, 300);
    this.scene.add(fill);

    const edge = new THREE.DirectionalLight(0xffffff, 0.38);
    edge.position.set(320, 220, 40);
    this.scene.add(edge);

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
    this.renderer.domElement.dataset.assetVersion = 'bowling-ball-v2';
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
