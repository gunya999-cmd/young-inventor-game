import type { Connection, MachineSnapshot, PartInstance } from './types';

function clonePart(part: PartInstance): PartInstance {
  return {
    id: part.id,
    definition: {
      kind: part.definition.kind,
      canRotate: part.definition.canRotate,
      canFlip: part.definition.canFlip,
      anchors: part.definition.anchors.map((anchor) => ({
        id: anchor.id,
        kind: anchor.kind,
        localPosition: { ...anchor.localPosition }
      }))
    },
    transform: {
      position: { ...part.transform.position },
      angle: part.transform.angle
    },
    fixed: part.fixed,
    flipped: part.flipped,
    metadata: { ...part.metadata }
  };
}

function cloneConnection(connection: Connection): Connection {
  return {
    id: connection.id,
    kind: connection.kind,
    a: { ...connection.a },
    b: { ...connection.b },
    restLength: connection.restLength,
    route: connection.route?.map((endpoint) => ({ ...endpoint })),
    localPointA: connection.localPointA ? { ...connection.localPointA } : undefined,
    localPointB: connection.localPointB ? { ...connection.localPointB } : undefined,
    referenceAngle: connection.referenceAngle,
    minAngle: connection.minAngle,
    maxAngle: connection.maxAngle
  };
}

export function cloneSnapshot(snapshot: MachineSnapshot): MachineSnapshot {
  return {
    parts: snapshot.parts.map(clonePart),
    connections: snapshot.connections.map(cloneConnection)
  };
}
