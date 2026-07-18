import type { PartDefinition, PartInstance, PartKind, Vec2 } from '../tim-core/types';

export type EditorPartKind = 'ball' | 'plank' | 'wall' | 'pulley' | 'weight';

export interface EditorPartSpec {
  readonly kind: EditorPartKind;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly radius?: number;
  readonly defaultFixed: boolean;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly definition: PartDefinition;
}

const definitions: Record<EditorPartKind, EditorPartSpec> = {
  ball: {
    kind: 'ball',
    label: 'Шар',
    width: 54,
    height: 54,
    radius: 27,
    defaultFixed: false,
    density: 0.0024,
    friction: 0.035,
    restitution: 0.34,
    definition: {
      kind: 'ball',
      canRotate: false,
      canFlip: false,
      anchors: [{ id: 'center', kind: 'rope', localPosition: { x: 0, y: 0 } }]
    }
  },
  plank: {
    kind: 'plank',
    label: 'Доска',
    width: 210,
    height: 28,
    defaultFixed: true,
    density: 0.0012,
    friction: 0.55,
    restitution: 0.08,
    definition: {
      kind: 'plank',
      canRotate: true,
      canFlip: true,
      anchors: [
        { id: 'left', kind: 'rope', localPosition: { x: -88, y: 0 } },
        { id: 'right', kind: 'rope', localPosition: { x: 88, y: 0 } },
        { id: 'hinge', kind: 'hinge', localPosition: { x: 0, y: 0 } }
      ]
    }
  },
  wall: {
    kind: 'wall',
    label: 'Стена',
    width: 160,
    height: 28,
    defaultFixed: true,
    density: 0.004,
    friction: 0.7,
    restitution: 0.04,
    definition: {
      kind: 'wall',
      canRotate: true,
      canFlip: false,
      anchors: []
    }
  },
  pulley: {
    kind: 'pulley',
    label: 'Блок',
    width: 72,
    height: 72,
    radius: 36,
    defaultFixed: true,
    density: 0.002,
    friction: 0.18,
    restitution: 0.06,
    definition: {
      kind: 'pulley',
      canRotate: false,
      canFlip: false,
      anchors: [
        { id: 'guide', kind: 'rope', localPosition: { x: 0, y: 0 } },
        { id: 'rim-left', kind: 'rope', localPosition: { x: -29, y: 0 } },
        { id: 'rim-right', kind: 'rope', localPosition: { x: 29, y: 0 } },
        { id: 'axle', kind: 'hinge', localPosition: { x: 0, y: 0 } }
      ]
    }
  },
  weight: {
    kind: 'weight',
    label: 'Груз',
    width: 66,
    height: 82,
    defaultFixed: false,
    density: 0.006,
    friction: 0.42,
    restitution: 0.02,
    definition: {
      kind: 'weight',
      canRotate: true,
      canFlip: false,
      anchors: [{ id: 'top', kind: 'rope', localPosition: { x: 0, y: -35 } }]
    }
  }
};

export const PART_CATALOG: Readonly<Record<EditorPartKind, EditorPartSpec>> = definitions;

export function getPartSpec(kind: EditorPartKind): EditorPartSpec {
  return definitions[kind];
}

export function createPartInstance(kind: EditorPartKind, id: string, position: Vec2): PartInstance {
  const spec = getPartSpec(kind);
  return {
    id,
    definition: spec.definition,
    transform: { position: { ...position }, angle: 0 },
    fixed: spec.defaultFixed,
    flipped: false,
    metadata: {
      editorKind: kind,
      width: spec.width,
      height: spec.height,
      radius: spec.radius ?? 0,
      density: spec.density,
      friction: spec.friction,
      restitution: spec.restitution
    }
  };
}

export function isEditorPartKind(kind: PartKind | string): kind is EditorPartKind {
  return kind === 'ball' || kind === 'plank' || kind === 'wall' || kind === 'pulley' || kind === 'weight';
}
