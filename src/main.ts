import { installPhysicsFoundation } from './physicsFoundationView';

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  document.body.innerHTML = `<main style="font-family:system-ui;padding:32px"><h1>ИГРОВОЙ ДВИЖОК НЕ ЗАПУСТИЛСЯ</h1><p>${message}</p></main>`;
  console.error(error);
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  installPhysicsFoundation();
} catch (error) {
  showFatalError(error);
}
