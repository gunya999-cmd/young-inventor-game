export type PartKind =
  | 'energy-ball'
  | 'beam'
  | 'start-cradle'
  | 'support'
  | 'button'
  | 'spring'
  | 'receiver';

export type BodyShape =
  | { type: 'circle'; radius: number }
  | { type: 'rectangle'; width: number; height: number };

export interface PartDefinition {
  id: string;
  kind: PartKind;
  displayName: string;
  assetKey: string;
  body: BodyShape;
  mass?: number;
  friction?: number;
  frictionAir?: number;
  restitution?: number;
  fixed?: boolean;
  rotatable?: boolean;
  rotationStepDeg?: number;
  minRotationDeg?: number;
  maxRotationDeg?: number;
  snapRadius?: number;
  connectionPoints?: Array<{ x: number; y: number }>;
}

export interface PlacedPart {
  instanceId: string;
  partId: string;
  x: number;
  y: number;
  rotationDeg: number;
  fixed?: boolean;
}

export type GoalDefinition =
  | {
      type: 'body-enters-sensor';
      bodyInstanceId: string;
      sensorInstanceId: string;
      holdMs?: number;
    }
  | {
      type: 'button-then-sensor';
      bodyInstanceId: string;
      buttonInstanceId: string;
      sensorInstanceId: string;
    };

export interface SnapTarget {
  id: string;
  acceptsPartIds: string[];
  x: number;
  y: number;
  rotationDeg: number;
  radius: number;
  angleToleranceDeg: number;
  positionTolerance: number;
}

export interface LevelDefinition {
  id: string;
  chapter: number;
  quest: number;
  title: string;
  objective: string;
  teachingPoint: string;
  introLine: string;
  availablePartIds: string[];
  placedParts: PlacedPart[];
  snapTargets: SnapTarget[];
  goal: GoalDefinition;
  simulationTimeoutMs: number;
  hint: string;
  successLine: string;
  failureHints: string[];
}
