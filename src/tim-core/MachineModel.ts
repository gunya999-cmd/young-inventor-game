import { cloneSnapshot } from './clone';
import type {
  AnchorDefinition,
  Connection,
  ConnectionId,
  Endpoint,
  MachineMode,
  MachineSnapshot,
  PartId,
  PartInstance,
  Transform,
  Vec2
} from './types';

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = angle % fullTurn;
  return normalized < -Math.PI
    ? normalized + fullTurn
    : normalized > Math.PI
      ? normalized - fullTurn
      : normalized;
}

export class MachineModel {
  private readonly parts = new Map<PartId, PartInstance>();
  private readonly connections = new Map<ConnectionId, Connection>();
  private buildSnapshot: MachineSnapshot | null = null;
  private _mode: MachineMode = 'build';

  get mode(): MachineMode {
    return this._mode;
  }

  getParts(): readonly PartInstance[] {
    return [...this.parts.values()];
  }

  getConnections(): readonly Connection[] {
    return [...this.connections.values()];
  }

  getPart(id: PartId): PartInstance {
    const part = this.parts.get(id);
    if (!part) throw new Error(`Unknown part: ${id}`);
    return part;
  }

  addPart(part: PartInstance): void {
    this.assertBuildMode();
    if (this.parts.has(part.id)) throw new Error(`Duplicate part id: ${part.id}`);
    this.parts.set(part.id, cloneSnapshot({ parts: [part], connections: [] }).parts[0]);
  }

  removePart(id: PartId): void {
    this.assertBuildMode();
    this.getPart(id);
    this.parts.delete(id);
    for (const [connectionId, connection] of this.connections) {
      const routedThroughPart = connection.route?.some((endpoint) => endpoint.partId === id) ?? false;
      if (connection.a.partId === id || connection.b.partId === id || routedThroughPart) {
        this.connections.delete(connectionId);
      }
    }
  }

  movePart(id: PartId, position: Vec2): void {
    this.assertBuildMode();
    const part = this.getPart(id);
    this.parts.set(id, {
      ...part,
      transform: { ...part.transform, position: { ...position } }
    });
  }

  rotatePart(id: PartId, angle: number): void {
    this.assertBuildMode();
    const part = this.getPart(id);
    if (!part.definition.canRotate) throw new Error(`Part cannot rotate: ${id}`);
    this.parts.set(id, {
      ...part,
      transform: { ...part.transform, angle: normalizeAngle(angle) }
    });
  }

  setPartTransform(id: PartId, transform: Transform): void {
    this.assertBuildMode();
    const part = this.getPart(id);
    if (!part.definition.canRotate && transform.angle !== part.transform.angle) {
      throw new Error(`Part cannot rotate: ${id}`);
    }
    this.parts.set(id, {
      ...part,
      transform: {
        position: { ...transform.position },
        angle: normalizeAngle(transform.angle)
      }
    });
  }

  setFixed(id: PartId, fixed: boolean): void {
    this.assertBuildMode();
    const part = this.getPart(id);
    this.parts.set(id, { ...part, fixed });
  }

  flipPart(id: PartId): void {
    this.assertBuildMode();
    const part = this.getPart(id);
    if (!part.definition.canFlip) throw new Error(`Part cannot flip: ${id}`);
    this.parts.set(id, { ...part, flipped: !part.flipped });
  }

  connect(connection: Connection): void {
    this.assertBuildMode();
    if (this.connections.has(connection.id)) {
      throw new Error(`Duplicate connection id: ${connection.id}`);
    }
    const anchorA = this.getAnchor(connection.a);
    const anchorB = this.getAnchor(connection.b);
    if (anchorA.kind !== connection.kind || anchorB.kind !== connection.kind) {
      throw new Error(`Connection ${connection.id} has incompatible anchor types`);
    }
    for (const endpoint of connection.route ?? []) {
      const routeAnchor = this.getAnchor(endpoint);
      if (routeAnchor.kind !== connection.kind) {
        throw new Error(`Connection ${connection.id} has incompatible route anchor`);
      }
    }
    if (connection.kind === 'rope' && (!connection.restLength || connection.restLength <= 0)) {
      throw new Error(`Rope ${connection.id} must have a positive rest length`);
    }
    this.connections.set(connection.id, cloneSnapshot({ parts: [], connections: [connection] }).connections[0]);
  }

  disconnect(id: ConnectionId): void {
    this.assertBuildMode();
    if (!this.connections.delete(id)) throw new Error(`Unknown connection: ${id}`);
  }

  captureSnapshot(): MachineSnapshot {
    return cloneSnapshot({
      parts: this.getParts(),
      connections: this.getConnections()
    });
  }

  loadSnapshot(snapshot: MachineSnapshot): void {
    this.assertBuildMode();
    this.replaceState(snapshot);
  }

  startSimulation(): MachineSnapshot {
    if (this._mode !== 'build') throw new Error(`Cannot start from mode: ${this._mode}`);
    this.buildSnapshot = this.captureSnapshot();
    this._mode = 'running';
    return cloneSnapshot(this.buildSnapshot);
  }

  pauseSimulation(): void {
    if (this._mode !== 'running') throw new Error(`Cannot pause from mode: ${this._mode}`);
    this._mode = 'paused';
  }

  resumeSimulation(): void {
    if (this._mode !== 'paused') throw new Error(`Cannot resume from mode: ${this._mode}`);
    this._mode = 'running';
  }

  stopSimulation(): void {
    if (this._mode === 'build') return;
    if (!this.buildSnapshot) throw new Error('Missing build snapshot');
    this.replaceState(this.buildSnapshot);
    this.buildSnapshot = null;
    this._mode = 'build';
  }

  private getAnchor(endpoint: Endpoint): AnchorDefinition {
    const part = this.getPart(endpoint.partId);
    const anchor = part.definition.anchors.find((candidate) => candidate.id === endpoint.anchorId);
    if (!anchor) throw new Error(`Unknown anchor: ${endpoint.partId}.${endpoint.anchorId}`);
    return anchor;
  }

  private replaceState(snapshot: MachineSnapshot): void {
    const cloned = cloneSnapshot(snapshot);
    this.parts.clear();
    this.connections.clear();
    for (const part of cloned.parts) {
      if (this.parts.has(part.id)) throw new Error(`Duplicate part id in snapshot: ${part.id}`);
      this.parts.set(part.id, part);
    }
    for (const connection of cloned.connections) {
      if (this.connections.has(connection.id)) {
        throw new Error(`Duplicate connection id in snapshot: ${connection.id}`);
      }
      this.getAnchor(connection.a);
      this.getAnchor(connection.b);
      this.connections.set(connection.id, connection);
    }
  }

  private assertBuildMode(): void {
    if (this._mode !== 'build') throw new Error('Machine can only be edited in build mode');
  }
}
