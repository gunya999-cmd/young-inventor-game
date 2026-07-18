// @ts-nocheck
import Phaser from 'phaser';
import './style.css';
import { SandboxScene, WORLD_HEIGHT, WORLD_WIDTH, activeSandbox } from './editor/SandboxScene';
import type { EditorPartKind } from './editor/catalog';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#d6c6b4',
  antialias: true,
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance'
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT
  },
  fps: {
    target: 60,
    min: 30,
    smoothStep: true
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: false,
      positionIterations: 12,
      velocityIterations: 10,
      constraintIterations: 12,
      runner: {
        fps: 120,
        frameDeltaSmoothing: true,
        frameDeltaSnapping: true
      },
      debug: false
    }
  },
  scene: [SandboxScene]
});

const byId = <T extends HTMLElement>(id: string): T | null => document.querySelector<T>(`#${id}`);

byId<HTMLButtonElement>('run-button')?.addEventListener('click', () => activeSandbox?.startSimulation());
byId<HTMLButtonElement>('pause-button')?.addEventListener('click', () => activeSandbox?.pauseOrResume());
byId<HTMLButtonElement>('stop-button')?.addEventListener('click', () => activeSandbox?.stopSimulation());
byId<HTMLButtonElement>('clear-button')?.addEventListener('click', () => activeSandbox?.clearMachine());
byId<HTMLButtonElement>('rotate-left')?.addEventListener('click', () => activeSandbox?.rotateSelected(-1));
byId<HTMLButtonElement>('rotate-right')?.addEventListener('click', () => activeSandbox?.rotateSelected(1));
byId<HTMLButtonElement>('fix-button')?.addEventListener('click', () => activeSandbox?.toggleSelectedFixed());
byId<HTMLButtonElement>('rope-button')?.addEventListener('click', () => activeSandbox?.armRopeTool());
byId<HTMLButtonElement>('delete-button')?.addEventListener('click', () => activeSandbox?.deleteSelected());

const paletteButtons = [...document.querySelectorAll<HTMLButtonElement>('.palette-part')];
let paletteDrag: {
  pointerId: number;
  kind: EditorPartKind;
  ghost: HTMLElement;
  source: HTMLButtonElement;
} | null = null;

function moveGhost(clientX: number, clientY: number): void {
  if (!paletteDrag) return;
  paletteDrag.ghost.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
}

function finishPaletteDrag(clientX: number, clientY: number): void {
  if (!paletteDrag) return;
  const drag = paletteDrag;
  paletteDrag = null;
  drag.ghost.remove();
  drag.source.classList.remove('drag-source');
  const position = activeSandbox?.clientToWorld(clientX, clientY);
  if (position) activeSandbox?.addPartFromPalette(drag.kind, position);
}

paletteButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (!activeSandbox || document.querySelector('#app')?.classList.contains('simulating')) return;
    event.preventDefault();
    const kind = button.dataset.kind as EditorPartKind;
    const ghost = document.createElement('div');
    ghost.className = `palette-drag-ghost ghost-${kind}`;
    ghost.innerHTML = button.querySelector('.palette-icon')?.outerHTML ?? '';
    document.body.appendChild(ghost);
    button.classList.add('drag-source');
    paletteDrag = { pointerId: event.pointerId, kind, ghost, source: button };
    button.setPointerCapture?.(event.pointerId);
    moveGhost(event.clientX, event.clientY);
  });
});

window.addEventListener('pointermove', (event) => {
  if (paletteDrag?.pointerId === event.pointerId) {
    event.preventDefault();
    moveGhost(event.clientX, event.clientY);
  }
}, { passive: false });

window.addEventListener('pointerup', (event) => {
  if (paletteDrag?.pointerId === event.pointerId) finishPaletteDrag(event.clientX, event.clientY);
});

window.addEventListener('pointercancel', (event) => {
  if (paletteDrag?.pointerId === event.pointerId) finishPaletteDrag(-1000, -1000);
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    activeSandbox?.startSimulation();
  }
  if (event.key === 'Escape') activeSandbox?.stopSimulation();
  if (event.key === 'Delete' || event.key === 'Backspace') activeSandbox?.deleteSelected();
  if (event.key === 'ArrowLeft') activeSandbox?.rotateSelected(-1);
  if (event.key === 'ArrowRight') activeSandbox?.rotateSelected(1);
});
