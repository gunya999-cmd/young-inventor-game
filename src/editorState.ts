import {
  INVENTORY,
  MAX_HINGES,
  MAX_ROPES,
  PARTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  cloneSnapshot,
  createInitialSnapshot,
  remaining,
  type HingeState,
  type MachineSnapshot,
  type PartKind,
  type PartState,
  type Point,
  type RopeState
} from './model';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isPartKind(value: unknown): value is PartKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PARTS, value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function movePart(snapshot: MachineSnapshot, partId: string, point: Point): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const part = next.parts.find((candidate) => candidate.id === partId);
  if (!part || part.locked) return next;
  const spec = PARTS[part.kind];
  part.x = clamp(point.x, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10);
  part.y = clamp(point.y, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10);
  return next;
}

export function rotatePart(snapshot: MachineSnapshot, partId: string, angle: number): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const part = next.parts.find((candidate) => candidate.id === partId);
  if (!part || part.locked || !Number.isFinite(angle) || part.kind === 'ball' || part.kind === 'rubberball' || part.kind === 'pulley' || part.kind === 'sheave') return next;
  part.angle = angle;
  return next;
}

export function duplicatePart(snapshot: MachineSnapshot, partId: string, newId: string, offset: Point = { x: 30, y: 30 }): MachineSnapshot {
  const source = snapshot.parts.find((candidate) => candidate.id === partId);
  if (!source || source.locked || !newId || snapshot.parts.some((part) => part.id === newId) || remaining(snapshot, source.kind) <= 0) {
    return cloneSnapshot(snapshot);
  }
  const next = cloneSnapshot(snapshot);
  next.parts.push({ ...source, id: newId, locked: false });
  return movePart(next, newId, { x: source.x + offset.x, y: source.y + offset.y });
}

export function togglePartFixed(snapshot: MachineSnapshot, partId: string): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const part = next.parts.find((candidate) => candidate.id === partId);
  if (!part || part.locked || part.kind === 'sheave' || next.hinges.some((hinge) => hinge.partId === partId)) return next;
  part.fixed = !part.fixed;
  return next;
}

export function clearPlayerParts(snapshot: MachineSnapshot): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const retainedIds = new Set(next.parts.filter((part) => part.locked).map((part) => part.id));
  next.parts = next.parts.filter((part) => part.locked);
  next.hinges = next.hinges.filter((hinge) => retainedIds.has(hinge.partId));
  next.ropes = next.ropes.filter((rope) =>
    retainedIds.has(rope.a.partId) && retainedIds.has(rope.b.partId) && (!rope.pulleyPartId || retainedIds.has(rope.pulleyPartId))
  );
  return next;
}

export function removePart(snapshot: MachineSnapshot, partId: string): MachineSnapshot {
  const part = snapshot.parts.find((candidate) => candidate.id === partId);
  if (!part || part.locked) return cloneSnapshot(snapshot);
  const next = cloneSnapshot(snapshot);
  next.parts = next.parts.filter((candidate) => candidate.id !== partId);
  next.hinges = next.hinges.filter((hinge) => hinge.partId !== partId);
  next.ropes = next.ropes.filter((rope) =>
    rope.a.partId !== partId && rope.b.partId !== partId && rope.pulleyPartId !== partId
  );
  return next;
}

export function upsertHinge(snapshot: MachineSnapshot, hinge: HingeState): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const part = next.parts.find((candidate) => candidate.id === hinge.partId);
  if (!part || part.locked || !PARTS[part.kind].canHinge) return next;
  next.hinges = next.hinges.filter((candidate) => candidate.partId !== hinge.partId);
  next.hinges.push({ ...hinge });
  part.fixed = false;
  return next;
}

export function addRope(snapshot: MachineSnapshot, rope: RopeState): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const partIds = new Set(next.parts.map((part) => part.id));
  if (!partIds.has(rope.a.partId) || !partIds.has(rope.b.partId) || rope.a.partId === rope.b.partId) return next;
  if (rope.pulleyPartId && !next.parts.some((part) => part.id === rope.pulleyPartId && part.kind === 'sheave')) return next;
  if (!Number.isFinite(rope.maxLength) || rope.maxLength <= 0 || next.ropes.length >= MAX_ROPES) return next;
  next.ropes.push({ ...rope, a: { ...rope.a }, b: { ...rope.b } });
  return next;
}

export function replacePart(snapshot: MachineSnapshot, replacement: PartState): MachineSnapshot {
  const next = cloneSnapshot(snapshot);
  const index = next.parts.findIndex((part) => part.id === replacement.id);
  if (index < 0 || next.parts[index].locked) return next;
  next.parts[index] = { ...replacement, locked: false };
  return next;
}

export function encodeSnapshot(snapshot: MachineSnapshot): string {
  return JSON.stringify(cloneSnapshot(snapshot));
}

export function decodeSnapshot(raw: string): MachineSnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MachineSnapshot>;
  if (!Array.isArray(candidate.parts) || !Array.isArray(candidate.ropes) || !Array.isArray(candidate.hinges)) return null;

  let result = createInitialSnapshot();
  const usedIds = new Set(result.parts.map((part) => part.id));
  const usedByKind = new Map<PartKind, number>();

  for (const entry of candidate.parts) {
    if (!entry || typeof entry !== 'object') continue;
    const part = entry as Partial<PartState>;
    if (part.locked || typeof part.id !== 'string' || !part.id || usedIds.has(part.id) || !isPartKind(part.kind)) continue;
    if (!finite(part.x) || !finite(part.y) || !finite(part.angle) || typeof part.fixed !== 'boolean') continue;
    const count = usedByKind.get(part.kind) ?? 0;
    if (count >= INVENTORY[part.kind]) continue;
    const spec = PARTS[part.kind];
    result.parts.push({
      id: part.id,
      kind: part.kind,
      x: clamp(part.x, spec.width / 2 + 10, WORLD_WIDTH - spec.width / 2 - 10),
      y: clamp(part.y, spec.height / 2 + 10, WORLD_HEIGHT - spec.height / 2 - 10),
      angle: part.angle,
      fixed: part.kind === 'sheave' ? true : part.fixed,
      locked: false
    });
    usedIds.add(part.id);
    usedByKind.set(part.kind, count + 1);
  }

  for (const entry of candidate.hinges.slice(0, MAX_HINGES)) {
    if (!entry || typeof entry !== 'object') continue;
    const hinge = entry as Partial<HingeState>;
    if (typeof hinge.id !== 'string' || typeof hinge.partId !== 'string') continue;
    if (!finite(hinge.localX) || !finite(hinge.localY) || !finite(hinge.referenceAngle)) continue;
    const part = result.parts.find((item) => item.id === hinge.partId && !item.locked);
    if (!part || !PARTS[part.kind].canHinge || result.hinges.some((item) => item.partId === part.id)) continue;
    result = upsertHinge(result, {
      id: hinge.id,
      partId: part.id,
      localX: hinge.localX,
      localY: 0,
      referenceAngle: hinge.referenceAngle,
      lowerAngle: finite(hinge.lowerAngle) ? hinge.lowerAngle : -Math.PI * 0.82,
      upperAngle: finite(hinge.upperAngle) ? hinge.upperAngle : Math.PI * 0.82
    });
  }

  for (const entry of candidate.ropes.slice(0, MAX_ROPES)) {
    if (!entry || typeof entry !== 'object') continue;
    const rope = entry as Partial<RopeState>;
    if (typeof rope.id !== 'string' || !rope.a || !rope.b || !finite(rope.maxLength)) continue;
    if (typeof rope.a.partId !== 'string' || typeof rope.b.partId !== 'string') continue;
    if (!finite(rope.a.localX) || !finite(rope.a.localY) || !finite(rope.b.localX) || !finite(rope.b.localY)) continue;
    result = addRope(result, {
      id: rope.id,
      a: { partId: rope.a.partId, localX: rope.a.localX, localY: rope.a.localY },
      b: { partId: rope.b.partId, localX: rope.b.localX, localY: rope.b.localY },
      maxLength: rope.maxLength,
      pulleyPartId: typeof rope.pulleyPartId === 'string' ? rope.pulleyPartId : undefined,
      ratio: finite(rope.ratio) ? rope.ratio : undefined
    });
  }

  return result;
}
