import { requireMechanic, type ConnectionKind, type LayerPolicy } from './mechanicsCatalog';

export type MachineLayer = 'back' | 'main' | 'front';
export type PortRole = 'input' | 'output' | 'bidirectional';

export type MachinePort = {
  id: string;
  kind: ConnectionKind;
  role: PortRole;
  allowsCrossLayer?: boolean;
};

export type MachinePartNode = {
  id: string;
  mechanicId: string;
  layer: MachineLayer;
  ports: readonly MachinePort[];
  transform: {
    x: number;
    y: number;
    z: number;
    rotationZ: number;
  };
};

export type MachineEndpoint = {
  partId: string;
  portId: string;
};

export type MachineConnection = {
  id: string;
  kind: ConnectionKind;
  from: MachineEndpoint;
  to: MachineEndpoint;
  route?: readonly MachineEndpoint[];
};

export type MachineGraphSnapshot = {
  parts: MachinePartNode[];
  connections: MachineConnection[];
};

export type ConnectionValidation =
  | { ok: true }
  | { ok: false; reason: string };

function clonePort(port: MachinePort): MachinePort {
  return { ...port };
}

function clonePart(part: MachinePartNode): MachinePartNode {
  return {
    ...part,
    ports: part.ports.map(clonePort),
    transform: { ...part.transform },
  };
}

function cloneConnection(connection: MachineConnection): MachineConnection {
  return {
    ...connection,
    from: { ...connection.from },
    to: { ...connection.to },
    route: connection.route?.map((endpoint) => ({ ...endpoint })),
  };
}

function layerPolicyAllows(
  policy: LayerPolicy,
  fromLayer: MachineLayer,
  toLayer: MachineLayer,
  fromPort: MachinePort,
  toPort: MachinePort,
): boolean {
  if (fromLayer === toLayer) return true;
  if (policy === 'all-layers') return true;
  if (policy === 'same-layer') return false;
  return Boolean(fromPort.allowsCrossLayer && toPort.allowsCrossLayer);
}

function rolesCompatible(a: PortRole, b: PortRole): boolean {
  if (a === 'bidirectional' || b === 'bidirectional') return true;
  return a !== b;
}

export class MachineGraph {
  private readonly parts = new Map<string, MachinePartNode>();
  private readonly connections = new Map<string, MachineConnection>();

  listParts(): readonly MachinePartNode[] {
    return [...this.parts.values()].map(clonePart);
  }

  listConnections(): readonly MachineConnection[] {
    return [...this.connections.values()].map(cloneConnection);
  }

  getPart(id: string): MachinePartNode | undefined {
    const part = this.parts.get(id);
    return part ? clonePart(part) : undefined;
  }

  addPart(part: MachinePartNode): void {
    if (this.parts.has(part.id)) throw new Error(`Duplicate machine part id: ${part.id}`);
    const mechanic = requireMechanic(part.mechanicId);
    for (const port of part.ports) {
      if (!mechanic.connections.includes(port.kind)) {
        throw new Error(`Port ${part.id}.${port.id} uses ${port.kind}, but ${part.mechanicId} does not allow it`);
      }
    }
    const ids = part.ports.map((port) => port.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate port id on part ${part.id}`);
    this.parts.set(part.id, clonePart(part));
  }

  updatePartTransform(partId: string, transform: Partial<MachinePartNode['transform']>): void {
    const part = this.parts.get(partId);
    if (!part) throw new Error(`Unknown machine part: ${partId}`);
    part.transform = { ...part.transform, ...transform };
  }

  movePartToLayer(partId: string, layer: MachineLayer): void {
    const part = this.parts.get(partId);
    if (!part) throw new Error(`Unknown machine part: ${partId}`);
    const mechanic = requireMechanic(part.mechanicId);
    if (mechanic.layerPolicy === 'same-layer' && this.connectionsForPart(partId).length > 0) {
      throw new Error(`Cannot move connected same-layer part ${partId} to another layer`);
    }
    part.layer = layer;
    part.transform.z = layer === 'back' ? -0.55 : layer === 'front' ? 0.55 : 0;
  }

  removePart(partId: string): void {
    if (!this.parts.delete(partId)) return;
    for (const connection of [...this.connections.values()]) {
      const usesPart = connection.from.partId === partId
        || connection.to.partId === partId
        || connection.route?.some((endpoint) => endpoint.partId === partId);
      if (usesPart) this.connections.delete(connection.id);
    }
  }

  connectionsForPart(partId: string): readonly MachineConnection[] {
    return [...this.connections.values()]
      .filter((connection) => connection.from.partId === partId
        || connection.to.partId === partId
        || connection.route?.some((endpoint) => endpoint.partId === partId))
      .map(cloneConnection);
  }

  validateConnection(connection: MachineConnection): ConnectionValidation {
    if (connection.kind === 'none') return { ok: false, reason: 'none is not a connectable port kind' };
    if (this.connections.has(connection.id)) return { ok: false, reason: `duplicate connection id: ${connection.id}` };
    if (connection.from.partId === connection.to.partId && connection.from.portId === connection.to.portId) {
      return { ok: false, reason: 'connection cannot target the same endpoint' };
    }

    const fromPart = this.parts.get(connection.from.partId);
    const toPart = this.parts.get(connection.to.partId);
    if (!fromPart || !toPart) return { ok: false, reason: 'connection endpoint part is missing' };

    const fromPort = fromPart.ports.find((port) => port.id === connection.from.portId);
    const toPort = toPart.ports.find((port) => port.id === connection.to.portId);
    if (!fromPort || !toPort) return { ok: false, reason: 'connection endpoint port is missing' };
    if (fromPort.kind !== connection.kind || toPort.kind !== connection.kind) {
      return { ok: false, reason: 'connection kind does not match both endpoint ports' };
    }
    if (!rolesCompatible(fromPort.role, toPort.role)) {
      return { ok: false, reason: 'endpoint port roles are incompatible' };
    }

    const fromMechanic = requireMechanic(fromPart.mechanicId);
    const toMechanic = requireMechanic(toPart.mechanicId);
    if (!layerPolicyAllows(fromMechanic.layerPolicy, fromPart.layer, toPart.layer, fromPort, toPort)
      || !layerPolicyAllows(toMechanic.layerPolicy, fromPart.layer, toPart.layer, fromPort, toPort)) {
      return { ok: false, reason: 'cross-layer connection requires compatible layer-bridge ports' };
    }

    if (connection.route) {
      for (const endpoint of connection.route) {
        const routePart = this.parts.get(endpoint.partId);
        const routePort = routePart?.ports.find((port) => port.id === endpoint.portId);
        if (!routePart || !routePort) return { ok: false, reason: 'route endpoint is missing' };
        if (connection.kind !== 'rope-anchor' && connection.kind !== 'rope-route') {
          return { ok: false, reason: 'only rope-style connections may contain a route' };
        }
        if (routePort.kind !== 'rope-route') return { ok: false, reason: 'rope route requires rope-route ports' };
      }
    }

    const duplicateEndpoints = [...this.connections.values()].some((existing) => {
      if (existing.kind !== connection.kind) return false;
      const direct = existing.from.partId === connection.from.partId
        && existing.from.portId === connection.from.portId
        && existing.to.partId === connection.to.partId
        && existing.to.portId === connection.to.portId;
      const reverse = existing.from.partId === connection.to.partId
        && existing.from.portId === connection.to.portId
        && existing.to.partId === connection.from.partId
        && existing.to.portId === connection.from.portId;
      return direct || reverse;
    });
    if (duplicateEndpoints) return { ok: false, reason: 'endpoint pair is already connected' };

    return { ok: true };
  }

  connect(connection: MachineConnection): void {
    const validation = this.validateConnection(connection);
    if (!validation.ok) throw new Error(validation.reason);
    this.connections.set(connection.id, cloneConnection(connection));
  }

  disconnect(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  snapshot(): MachineGraphSnapshot {
    return {
      parts: this.listParts().map(clonePart),
      connections: this.listConnections().map(cloneConnection),
    };
  }

  restore(snapshot: MachineGraphSnapshot): void {
    this.parts.clear();
    this.connections.clear();
    for (const part of snapshot.parts) this.addPart(part);
    for (const connection of snapshot.connections) this.connect(connection);
  }
}
