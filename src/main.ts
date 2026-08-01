import './style.css';
import './gamefeel.css';
import { GameApp } from './app';
import { installExtendedParts } from './extendedParts';
import { installPulleySystem } from './pulleySystem';
import { installSpringSystem } from './springSystem';
import { installEventSystem } from './eventSystem';
import { installFinalVisuals } from './finalVisuals';
import { installLevelVisuals } from './levelVisuals';
import { installCompletionGuard } from './gameFlowGuard';
import { installEditorUiIntegration } from './editorUiIntegration';
import { installBrowserSmokeBridge } from './e2eBridge';
import { installSignalEditor } from './signalEditor';
import { installDeviceSettingsUi } from './deviceSettingsUi';
import { installLevelEditor } from './levelEditor';
import { installCampaign } from './campaign';
import { installCampaignCompletionHook } from './campaignHook';

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
  installPulleySystem();
  installSpringSystem();
  installEventSystem();
  installFinalVisuals();
  installLevelVisuals();
  installEditorUiIntegration();
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) throw new Error('Canvas игрового поля не найден.');
  const app = new GameApp(canvas);
  installCampaignCompletionHook(app);
  installCampaign();
  installSignalEditor(app);
  installDeviceSettingsUi(app);
  installLevelEditor(app);
  installCompletionGuard();
  installBrowserSmokeBridge(app);
} catch (error) {
  showFatalError(error);
}
