export const WORLD = { w: 900, h: 640 };

export type PartKind = "plank" | "domino" | "trampoline" | "weight";

export const PART_INFO: Record<
  PartKind,
  { label: string; hint: string; rotatable: boolean }
> = {
  plank: { label: "Доска", hint: "Наклонный жёлоб для скатывания", rotatable: true },
  trampoline: { label: "Батут", hint: "Упругая площадка, шар отскакивает", rotatable: true },
  domino: { label: "Домино", hint: "Падает и толкает соседей", rotatable: false },
  weight: { label: "Гиря", hint: "Тяжёлый груз, давит вниз", rotatable: false },
};

/** Parts the player may place on this level. */
export const INVENTORY: { kind: PartKind; count: number }[] = [
  { kind: "plank", count: 3 },
  { kind: "trampoline", count: 1 },
  { kind: "domino", count: 3 },
  { kind: "weight", count: 1 },
];

export const BALL_START = { x: 70, y: 96, r: 15 };

/** Static level scenery: fixed rectangles [x, y, w, h, angle]. */
export const SCENERY: { x: number; y: number; w: number; h: number; a: number }[] = [
  { x: 92, y: 124, w: 150, h: 14, a: 0.26 },
  { x: 300, y: 330, w: 240, h: 14, a: 0.2 },
  { x: 470, y: 530, w: 22, h: 220, a: 0 },
];

export const BASKET = { x: 760, y: 560, w: 150, h: 90 };
