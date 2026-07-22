import './style.css';
import './gamefeel.css';
import { GameApp } from './app';
import { installExtendedParts } from './extendedParts';

function showFatalError(error: unknown): void {
  const panel = document.querySelector<HTMLElement>('#fatal-error');
  const message = error instanceof Error ? error.message : String(error);
  if (panel) {
    panel.hidden = false;
    panel.innerHTML = `<strong>ИГРОВОЙ ДВИЖОК НЕ ЗАПУСТИЛСЯ</strong><span>${message}</span><small>Обнови страницу. Сообщение сохранено для диагностики.</small>`;
  }
  console.error(error);
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  installExtendedParts();
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) throw new Error('Canvas игрового поля не найден.');
  new GameApp(canvas);
} catch (error) {
  showFatalError(error);
}
