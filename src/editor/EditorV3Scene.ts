// @ts-nocheck
import Phaser from 'phaser';
import { EditorV2Scene, WORLD_HEIGHT, WORLD_WIDTH } from './EditorV2Scene';
import type { Connection, Endpoint, PartInstance, Vec2 } from '../tim-core/types';
import { getPartSpec } from './catalog';
import {
  buildWrappedRopePath,
  routedRopeLength,
  solveRoutedRope,
  type RopeRenderNode,
  type RopeSolverNode
} from './rope/RoutedRope';

export { WORLD_HEIGHT, WORLD_WIDTH };

interface RuntimeRope {
  readonly connection: Connection;
  readonly restLength: number;
}

export class EditorV3Scene extends EditorV2Scene {
  private ropeRoute: Endpoint[] = [];
  private runtimeRopes: RuntimeRope[] = [];

  create(): void {
    super.create();
    this.setStatus('Верёвка теперь прокладывается так: начало → один или несколько блоков → конечная деталь.');
    (window as Window & { __TIM_ROUTED_ROPES_READY__?: boolean }).__TIM_ROUTED_ROPES_READY__ = true;
  }

  update(time: number, delta: number): void {
    if (this.model.mode === 'running') this.solveRuntimeRopes();
    super.update(time, delta);
  }

  armRopeTool(): void {
    const wasArmed = this.ropeToolArmed;
    super.armRopeTool();
    if (!wasArmed || !this.ropeToolArmed) {
      this.ropeRoute = [];
      this.ropeStart = null;
    }
    if (this.ropeToolArmed) {
      this.setStatus('Верёвка: выбери начало, затем блоки по порядку, затем конечную деталь.');
    }
  }

  startSimulation(): void {
    super.startSimulation();
    if (this.model.mode !== 'running') return;

    // A pulley starts fixed, but the player may explicitly unpin it. Unlike the
    // previous sandbox, an unpinned pulley must become a genuine moving body.
    for (const part of this.model.getParts()) {
      if (part.definition.kind !== 'pulley' || part.fixed) continue;
      const visual = this.visuals.get(part.id);
      if (!visual) continue;
      visual.setStatic(false);
      visual.setFrictionAir(0.018);
    }
  }

  stopSimulation(): void {
    super.stopSimulation();
    this.ropeRoute = [];
  }

  protected chooseRopeEndpoint(partId: string, worldPoint: Vec2): void {
    if (!this.ropeToolArmed || this.model.mode !== 'build') return;
    const part = this.model.getPart(partId);
    const endpoint = this.pickRopeEndpoint(part, worldPoint);
    if (!endpoint) {
      this.setStatus('У этой детали нет точки крепления верёвки.');
      return;
    }

    if (this.ropeRoute.length === 0) {
      this.ropeRoute = [endpoint];
      this.ropeStart = endpoint;
      this.setStatus('Начало выбрано. Добавь блоки по порядку или коснись конечной детали.');
      this.updateInspector();
      return;
    }

    const last = this.ropeRoute[this.ropeRoute.length - 1];
    if (last.partId === endpoint.partId && last.anchorId === endpoint.anchorId) {
      this.setStatus('Эта точка уже последняя в маршруте. Выбери другую.');
      return;
    }

    if (part.definition.kind === 'pulley') {
      if (this.ropeRoute.some((item) => item.partId === endpoint.partId)) {
        this.setStatus('Один и тот же блок нельзя добавить в маршрут дважды.');
        return;
      }
      this.ropeRoute.push(endpoint);
      this.setStatus(`Блок добавлен в маршрут №${this.ropeRoute.length - 1}. Добавь ещё блок или конечную деталь.`);
      this.updateInspector();
      return;
    }

    const start = this.ropeRoute[0];
    if (start.partId === endpoint.partId && start.anchorId === endpoint.anchorId) {
      this.setStatus('Начало и конец верёвки должны быть разными.');
      return;
    }

    const ordered = [...this.ropeRoute, endpoint];
    const connection: Connection = {
      id: `rope-${this.nextConnectionNumber++}`,
      kind: 'rope',
      a: start,
      b: endpoint,
      route: this.ropeRoute.slice(1),
      restLength: Math.max(24, routedRopeLength(ordered.map((item) => this.anchorWorld(item))))
    };

    this.model.connect(connection);
    this.ropeRoute = [];
    this.ropeStart = null;
    this.ropeToolArmed = false;
    this.commit(connection.route?.length
      ? `Верёвка проведена через ${connection.route.length} блок(а).`
      : 'Прямая верёвка создана вручную.');
  }

  protected createRuntimeConstraints(): void {
    this.runtimeRopes = this.model.getConnections()
      .filter((connection) => connection.kind === 'rope')
      .map((connection) => ({
        connection,
        restLength: connection.restLength ?? this.connectionLength(connection)
      }));
  }

  protected removeRuntimeConstraints(): void {
    this.runtimeRopes = [];
    while (this.runtimeConstraints?.length > 0) {
      const constraint = this.runtimeConstraints.pop();
      if (constraint) this.matter.world.removeConstraint(constraint);
    }
  }

  protected drawConnections(): void {
    this.ropeGraphics.clear();
    this.drawRopesWithStyle(8, 0x362113, 0.34, 2, 3);
    this.drawRopesWithStyle(4, 0xd3a05a, 1, 0, 0);
  }

  protected drawRopePreview(): void {
    this.previewGraphics.clear();

    if (this.selectedId && this.rotationHandle.visible) {
      const visual = this.visuals.get(this.selectedId);
      if (visual) {
        this.previewGraphics.lineStyle(2, 0xffc56c, 0.8)
          .lineBetween(visual.x, visual.y, this.rotationHandle.x, this.rotationHandle.y);
      }
    }

    if (!this.ropeToolArmed || this.ropeRoute.length === 0) return;
    const nodes = [
      ...this.ropeRoute.map((endpoint) => this.renderNode(endpoint)),
      { x: this.pointerWorld.x, y: this.pointerWorld.y }
    ];
    this.drawWrappedPath(this.previewGraphics, buildWrappedRopePath(nodes), 4, 0xffc56c, 0.95, 0, 0);
  }

  protected updateInspector(): void {
    super.updateInspector();
    const rope = document.querySelector<HTMLButtonElement>('#rope-button');
    if (!rope) return;
    const routeCount = Math.max(0, this.ropeRoute.length - 1);
    rope.textContent = this.ropeToolArmed
      ? `〰 МАРШРУТ: ${routeCount} БЛ.`
      : `〰 ВЕРЁВКА ×${this.remainingRopes()}`;
  }

  private pickRopeEndpoint(part: PartInstance, point: Vec2): Endpoint | null {
    if (part.definition.kind === 'pulley') {
      const guide = part.definition.anchors.find((anchor) => anchor.kind === 'rope' && anchor.id === 'guide');
      if (guide) return { partId: part.id, anchorId: guide.id };
    }

    const candidates = part.definition.anchors.filter((anchor) => anchor.kind === 'rope');
    if (candidates.length === 0) return null;
    return candidates
      .map((anchor) => {
        const endpoint = { partId: part.id, anchorId: anchor.id };
        return {
          endpoint,
          distance: Phaser.Math.Distance.BetweenPoints(point, this.anchorWorld(endpoint))
        };
      })
      .sort((left, right) => left.distance - right.distance)[0].endpoint;
  }

  private solveRuntimeRopes(): void {
    const Body = Phaser.Physics.Matter.Matter.Body;
    for (let iteration = 0; iteration < 7; iteration += 1) {
      for (const runtime of this.runtimeRopes) {
        const endpoints = [
          runtime.connection.a,
          ...(runtime.connection.route ?? []),
          runtime.connection.b
        ];
        const nodes: RopeSolverNode[] = endpoints.map((endpoint) => {
          const part = this.model.getPart(endpoint.partId);
          const visual = this.visuals.get(part.id);
          const body = visual?.body;
          return {
            key: part.id,
            position: this.anchorWorld(endpoint),
            inverseMass: body && !body.isStatic ? Math.max(0, body.inverseMass || 0) : 0
          };
        });

        const result = solveRoutedRope(nodes, runtime.restLength, 0.82, 0.12);
        for (const [partId, rawCorrection] of result.corrections) {
          const visual = this.visuals.get(partId);
          if (!visual || visual.body.isStatic) continue;
          const length = Math.hypot(rawCorrection.x, rawCorrection.y);
          const factor = length > 14 ? 14 / length : 1;
          Body.translate(visual.body, {
            x: rawCorrection.x * factor,
            y: rawCorrection.y * factor
          }, false);
        }
      }
    }
  }

  private connectionLength(connection: Connection): number {
    return routedRopeLength([
      connection.a,
      ...(connection.route ?? []),
      connection.b
    ].map((endpoint) => this.anchorWorld(endpoint)));
  }

  private renderNode(endpoint: Endpoint): RopeRenderNode {
    const point = this.anchorWorld(endpoint);
    const part = this.model.getPart(endpoint.partId);
    const kind = part.metadata.editorKind as string;
    const radius = kind === 'pulley' ? Math.max(20, Number(part.metadata.radius ?? getPartSpec('pulley').radius ?? 30) - 7) : 0;
    return { x: point.x, y: point.y, radius };
  }

  private drawRopesWithStyle(
    width: number,
    color: number,
    alpha: number,
    offsetX: number,
    offsetY: number
  ): void {
    for (const connection of this.model.getConnections()) {
      if (connection.kind !== 'rope') continue;
      const nodes = [
        connection.a,
        ...(connection.route ?? []),
        connection.b
      ].map((endpoint) => this.renderNode(endpoint));
      this.drawWrappedPath(
        this.ropeGraphics,
        buildWrappedRopePath(nodes),
        width,
        color,
        alpha,
        offsetX,
        offsetY
      );
    }
  }

  private drawWrappedPath(
    graphics: Phaser.GameObjects.Graphics,
    path: ReturnType<typeof buildWrappedRopePath>,
    width: number,
    color: number,
    alpha: number,
    offsetX: number,
    offsetY: number
  ): void {
    graphics.lineStyle(width, color, alpha);
    for (const [start, end] of path.lines) {
      graphics.beginPath();
      graphics.moveTo(start.x + offsetX, start.y + offsetY);
      graphics.lineTo(end.x + offsetX, end.y + offsetY);
      graphics.strokePath();
    }
    for (const arc of path.arcs) {
      graphics.beginPath();
      graphics.arc(
        arc.center.x + offsetX,
        arc.center.y + offsetY,
        arc.radius,
        arc.startAngle,
        arc.endAngle,
        arc.anticlockwise
      );
      graphics.strokePath();
    }
  }
}
