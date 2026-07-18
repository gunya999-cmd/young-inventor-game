export type PartId = string;
export type ConnectionId = string;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Transform {
  readonly position: Vec2;
  readonly angle: number;
}

export type PartKind =
  | 'ball'
  | 'plank'
  | 'wall'
  | 'pulley'
  | 'rope'
  | 'belt'
  | 'gear'
  | 'lever'
  | 'spring'
  | 'motor'
  | 'fan'
  | 'bucket'
  | 'weight'
  | 'custom';

export type AnchorKind = 'rope' | 'belt' | 'hinge' | 'rigid';

export interface AnchorDefinition {
  readonly id: string;
  readonly kind: AnchorKind;
  readonly localPosition: Vec2;
}

export interface PartDefinition {
  readonly kind: PartKind;
  readonly anchors: readonly AnchorDefinition[];
  readonly canRotate: boolean;
  readonly canFlip: boolean;
}

export interface PartInstance {
  readonly id: PartId;
  readonly definition: PartDefinition;
  readonly transform: Transform;
  readonly fixed: boolean;
  readonly flipped: boolean;
  readonly metadata: Readonly<Record<string, number | string | boolean>>;
}

export interface Endpoint {
  readonly partId: PartId;
  readonly anchorId: string;
}

export interface Connection {
  readonly id: ConnectionId;
  readonly kind: AnchorKind;
  readonly a: Endpoint;
  readonly b: Endpoint;
  readonly restLength?: number;
  readonly route?: readonly Endpoint[];
}

export interface MachineSnapshot {
  readonly parts: readonly PartInstance[];
  readonly connections: readonly Connection[];
}

export type MachineMode = 'build' | 'running' | 'paused';
