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
    { id: 'start-rail', x: 275, y: 305, width: 420, height: 26, angle: 0.09 },
    { id: 'left-bench', x: 610, y: 470, width: 250, height: 24, angle: 0.015 },
    { id: 'barrier', x: 825, y: 585, width: 30, height: 400, angle: 0 },
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
    { id: 'target-ball', kind: 'ball', x: 170, y: 220, angle: 0, fixed: false, locked: true },
    // Suspended just below the left bench, then dropped onto the far left side of the player-built lever.
    { id: 'level-weight', kind: 'weight', x: 520, y: 520, angle: 0, fixed: false, locked: true },
    { id: 'level-latch', kind: 'latch', x: 520, y: 580, angle: 0, fixed: true, locked: true },
    // Side-mounted limit switch. Its sensor protrudes into the shaft; the ball can trigger it and keep falling.
    { id: 'level-button', kind: 'button', x: 735, y: 590, angle: Math.PI / 2, fixed: true, locked: true }
  ],
  initialSignals: [
    { id: 'level-signal', sourcePartId: 'level-button', targetPartId: 'level-latch', action: 'release' }
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
