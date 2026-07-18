import { describe, expect, it } from 'vitest';
import { createPartInstance, getPartSpec, isEditorPartKind, PART_CATALOG } from './catalog';

describe('TIM editor part catalog', () => {
  it('contains the playable engineering parts and internal level parts', () => {
    expect(Object.keys(PART_CATALOG).sort()).toEqual(['ball', 'gate', 'hinge', 'lever', 'plank', 'pulley', 'wall', 'weight']);
  });

  it('creates freely positioned instances without scripted slots', () => {
    const part = createPartInstance('plank', 'plank-1', { x: 413.5, y: 287.25 });
    expect(part.transform.position).toEqual({ x: 413.5, y: 287.25 });
    expect(part.fixed).toBe(true);
    expect(part.definition.canRotate).toBe(true);
  });

  it('exposes compatible rope anchors and a pulley route guide', () => {
    expect(getPartSpec('weight').definition.anchors).toContainEqual({
      id: 'top',
      kind: 'rope',
      localPosition: { x: 0, y: -35 }
    });
    const pulleyAnchors = getPartSpec('pulley').definition.anchors.filter((anchor) => anchor.kind === 'rope');
    expect(pulleyAnchors).toHaveLength(3);
    expect(pulleyAnchors).toContainEqual({ id: 'guide', kind: 'rope', localPosition: { x: 0, y: 0 } });
  });

  it('gives a lever two rope ends and a movable pivot anchor', () => {
    const lever = getPartSpec('lever');
    expect(lever.defaultFixed).toBe(false);
    expect(lever.definition.kind).toBe('lever');
    expect(lever.definition.anchors.filter((anchor) => anchor.kind === 'rope')).toHaveLength(2);
    expect(lever.definition.anchors).toContainEqual({ id: 'pivot', kind: 'hinge', localPosition: { x: 0, y: 0 } });
  });

  it('keeps internal hinge pins fixed and gates movable', () => {
    expect(createPartInstance('hinge', 'hinge-1', { x: 100, y: 100 }).fixed).toBe(true);
    expect(createPartInstance('gate', 'gate-1', { x: 100, y: 100 }).fixed).toBe(false);
  });

  it('keeps walls non-connectable and fixed by default', () => {
    const wall = createPartInstance('wall', 'wall-1', { x: 100, y: 100 });
    expect(wall.fixed).toBe(true);
    expect(wall.definition.anchors).toHaveLength(0);
  });

  it('rejects unknown palette kinds', () => {
    expect(isEditorPartKind('lever')).toBe(true);
    expect(isEditorPartKind('rocket')).toBe(false);
  });
});
