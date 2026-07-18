// @ts-nocheck
import Phaser from 'phaser';
import './style.css';
import { WorkshopLevelV3 } from './game/WorkshopLevelV3';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  activeScene,
  againButton,
  hintButton,
  partButtons,
  resetButton,
  rotateLeftButton,
  rotateRightButton,
  runButton,
  soundButton,
  toggleSound
} from './game/ui';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#b8a28c',
  antialias: true,
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD_WIDTH, height: WORLD_HEIGHT },
  fps: { target: 60, min: 30, smoothStep: true },
  scene: [WorkshopLevelV3]
});

partButtons.forEach((button) => button.addEventListener('click', () => {
  const part = button.dataset.part;
  if (part === 'guide') activeScene?.addGuide();
  if (part === 'rope') activeScene?.connectRope();
  if (part === 'weight') activeScene?.addWeight();
}));
runButton?.addEventListener('click', () => {
  if (activeScene?.phase === 'failed') activeScene.resetLevel();
  else activeScene?.startSimulation();
});
resetButton?.addEventListener('click', () => activeScene?.resetLevel());
againButton?.addEventListener('click', () => activeScene?.resetLevel());
rotateLeftButton?.addEventListener('click', () => activeScene?.rotateGuide(-1));
rotateRightButton?.addEventListener('click', () => activeScene?.rotateGuide(1));
hintButton?.addEventListener('click', () => activeScene?.applyHint());
soundButton?.addEventListener('click', () => {
  const enabled = toggleSound();
  soundButton.textContent = enabled ? '🔊' : '🔇';
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (activeScene?.phase === 'failed') activeScene.resetLevel();
    else activeScene?.startSimulation();
  }
  if (event.key.toLowerCase() === 'r') activeScene?.resetLevel();
  if (event.key === 'ArrowLeft') activeScene?.rotateGuide(-1);
  if (event.key === 'ArrowRight') activeScene?.rotateGuide(1);
});
