import {
  PARTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  cloneSnapshot,
  type HingeState,
  type MachineSnapshot,
  type PartState,
  type Point,
  type RopeState
} from './model';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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
  if (!part || part.locked || part.kind === 'ball' || part.kind === 'rubberball' || part.kind === 'pulley' || part.kind === 'sheave') return next;
  part.angle = angle;
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
