export type PartKind = 'plank' | 'trampoline' | 'domino' | 'weight';

export const WORLD = { w: 960, h: 540 } as const;

export const BALL_START = {
  x: 105,
  y: 92,
  r: 18,
} as const;

export const BASKET = {
  x: 842,
  y: 430,
  w: 108,
  h: 118,
} as const;

export const SCENERY = [
  { x: 168, y: 174, w: 255, h: 18, a: 0.18 },
  { x: 392, y: 305, w: 185, h: 18, a: -0.14 },
  { x: 680, y: 218, w: 170, h: 18, a: 0.08 },
] as const;

export const INVENTORY: { kind: PartKind; count: number }[] = [
  { kind: 'plank', count: 3 },
  { kind: 'trampoline', count: 1 },
  { kind: 'domino', count: 4 },
  { kind: 'weight', count: 1 },
];

export const PART_INFO: Record<
  PartKind,
  { label: string; hint: string; rotatable: boolean }
> = {
  plank: {
    label: 'Доска',
    hint: 'Статичная направляющая. Можно вращать.',
    rotatable: true,
  },
  trampoline: {
    label: 'Батут',
    hint: 'Сильно отбрасывает шар при столкновении.',
    rotatable: true,
  },
  domino: {
    label: 'Домино',
    hint: 'Подвижный элемент для цепной реакции.',
    rotatable: true,
  },
  weight: {
    label: 'Груз',
    hint: 'Тяжёлый динамический блок.',
    rotatable: false,
  },
};
