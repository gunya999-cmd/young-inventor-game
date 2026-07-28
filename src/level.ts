import type { PartKind, PartState, SignalLink } from './model';

export interface LevelPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Screen-space radians. Positive angles slope downward to the right. */
  angle: number;
}

export interface LevelReceiver {
  x: number;
  y: number;
  innerWidth: number;
  innerHeight: number;
  wallThickness: number;
  floorThickness: number;
}

export interface LevelSpec {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  gravity: number;
  platforms: LevelPlatform[];
  receiver: LevelReceiver;
  initialParts: PartState[];
  initialSignals: SignalLink[];
  inventory: Readonly<Record<PartKind, number>>;
  maxRopes: number;
  maxHinges: number;
}

export const LEVEL_07: LevelSpec = {
  id: 'impulse-and-moment',
  number: 7,
  title: 'Импульс и момент',
  subtitle: 'Подними контрольный шар выше центральной перегородки и доставь его в приёмник.',
  gravity: 9.81,
  platforms: [
    { id: 'floor', x: 800, y: 815, width: 1500, height: 30, angle: 0 },
    { id: 'start-rail', x: 285, y: 295, width: 440, height: 26, angle: 0.24 },
    { id: 'left-bench', x: 610, y: 465, width: 250, height: 24, angle: 0.055 },
    { id: 'barrier', x: 825, y: 585, width: 30, height: 320, angle: 0 },
    { id: 'right-bench', x: 1080, y: 510, width: 300, height: 24, angle: 0.04 }
  ],
  receiver: {
    x: 1390,
    y: 650,
    innerWidth: 150,
    innerHeight: 110,
    wallThickness: 22,
    floorThickness: 22
  },
  initialParts: [
    { id: 'target-ball', kind: 'ball', x: 115, y: 170, angle: 0, fixed: false, locked: true },
    { id: 'level-weight', kind: 'weight', x: 440, y: 350, angle: 0, fixed: false, locked: true },
    { id: 'level-latch', kind: 'latch', x: 440, y: 410, angle: 0, fixed: true, locked: true },
    { id: 'level-lever-lock', kind: 'latch', x: 535, y: 642, angle: 0, fixed: true, locked: true },
    { id: 'level-button', kind: 'button', x: 825, y: 610, angle: -Math.PI / 2, fixed: true, locked: true }
  ],
  initialSignals: [
    { id: 'level-signal-weight', sourcePartId: 'level-button', targetPartId: 'level-latch', action: 'release' },
    { id: 'level-signal-lever', sourcePartId: 'level-button', targetPartId: 'level-lever-lock', action: 'release' }
  ],
  inventory: {
    ball: 0,
    plank: 3,
    wall: 0,
    lever: 1,
    pulley: 0,
    weight: 0,
    domino: 6,
    rubberball: 0,
    spring: 1,
    magnet: 0,
    sheave: 2,
    button: 0,
    latch: 0
  },
  maxRopes: 3,
  maxHinges: 2
};

export const ACTIVE_LEVEL = LEVEL_07;
