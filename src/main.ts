// @ts-nocheck
import Phaser from 'phaser';
import './style.css';
import { EditorV4Scene, WORLD_HEIGHT, WORLD_WIDTH } from './editor/EditorV4Scene';
import { activeEditor } from './editor/EditorV2Scene';
import type { EditorPartKind } from './editor/catalog';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#d6c6b4',
  antialias: true,
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD_WIDTH, height: WORLD_HEIGHT },
  fps: { target: 60, min: 30, smoothStep: true },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: false,
      positionIterations: 14,
      velocityIterations: 12,
      constraintIterations: 16,
      runner: { fps: 120, frameDeltaSmoothing: true, frameDeltaSnapping: true },
      debug: false
    }
  },
  scene: [EditorV4Scene]
});

const byId = <T extends HTMLElement>(id: string): T | null => document.querySelector<T>(`#${id}`);

byId<HTMLButtonElement>('run-button')?.addEventListener('click', () => activeEditor?.startSimulation());
byId<HTMLButtonElement>('pause-button')?.addEventListener('click', () => activeEditor?.pauseOrResume());
byId<HTMLButtonElement>('stop-button')?.addEventListener('click', () => activeEditor?.stopSimulation());
byId<HTMLButtonElement>('reset-button')?.addEventListener('click', () => activeEditor?.resetLevel());
byId<HTMLButtonElement>('clear-button')?.addEventListener('click', () => activeEditor?.clearMachine());
byId<HTMLButtonElement>('rotate-left')?.addEventListener('click', () => activeEditor?.rotateSelected(-1));
byId<HTMLButtonElement>('rotate-right')?.addEventListener('click', () => activeEditor?.rotateSelected(1));
byId<HTMLButtonElement>('duplicate-button')?.addEventListener('click', () => activeEditor?.duplicateSelected());
byId<HTMLButtonElement>('fix-button')?.addEventListener('click', () => activeEditor?.toggleSelectedFixed());
byId<HTMLButtonElement>('rope-button')?.addEventListener('click', () => activeEditor?.armRopeTool());
byId<HTMLButtonElement>('hinge-button')?.addEventListener('click', () => activeEditor?.armHingeTool());
byId<HTMLButtonElement>('limit-button')?.addEventListener('click', () => activeEditor?.cycleSelectedHingeLimit());
byId<HTMLButtonElement>('remove-hinge-button')?.addEventListener('click', () => activeEditor?.removeSelectedHinge());
byId<HTMLButtonElement>('delete-button')?.addEventListener('click', () => activeEditor?.deleteSelected());
byId<HTMLButtonElement>('undo-button')?.addEventListener('click', () => activeEditor?.undo());
byId<HTMLButtonElement>('redo-button')?.addEventListener('click', () => activeEditor?.redo());
byId<HTMLButtonElement>('save-button')?.addEventListener('click', () => activeEditor?.saveMachine());
byId<HTMLButtonElement>('load-button')?.addEventListener('click', () => activeEditor?.loadMachine());
byId<HTMLButtonElement>('camera-button')?.addEventListener('click', () => activeEditor?.resetCamera());
byId<HTMLButtonElement>('result-again')?.addEventListener('click', () => activeEditor?.dismissResult());

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

function screenToWorld(clientX: number, clientY: number) {
  if (!activeEditor) return null;
  const canvas = activeEditor.game.canvas;
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  const gameX = (clientX - rect.left) * (WORLD_WIDTH / rect.width);
  const gameY = (clientY - rect.top) * (WORLD_HEIGHT / rect.height);
  return activeEditor.cameras.main.getWorldPoint(gameX, gameY);
}

function finishPaletteDrag(clientX: number, clientY: number): void {
  if (!paletteDrag) return;
  const drag = paletteDrag;
  paletteDrag = null;
  drag.ghost.remove();
  drag.source.classList.remove('drag-source');
  const position = screenToWorld(clientX, clientY);
  if (position) activeEditor?.addPartFromPalette(drag.kind, position);
}

paletteButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (!activeEditor || button.disabled || document.querySelector('#app')?.classList.contains('simulating')) return;
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) activeEditor?.redo(); else activeEditor?.undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); activeEditor?.saveMachine(); return;
  }
  if (event.code === 'Space') { event.preventDefault(); activeEditor?.startSimulation(); }
  if (event.key === 'Escape') activeEditor?.stopSimulation();
  if (event.key === 'Delete' || event.key === 'Backspace') activeEditor?.deleteSelected();
  if (event.key === 'ArrowLeft') activeEditor?.rotateSelected(-1);
  if (event.key === 'ArrowRight') activeEditor?.rotateSelected(1);
  if (event.key.toLowerCase() === 'h') activeEditor?.armHingeTool();
});
