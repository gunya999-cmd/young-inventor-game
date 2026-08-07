import './style.css';
import './gamefeel.css';
import './level01Experience.css';
import './bowlingBall3d.css';
import './bowlingBallLab.css';
import './cleanMinimalLevel01.css';
import { GameApp } from './app';
import { installExtendedParts } from './extendedParts';
import { installPulleySystem } from './pulleySystem';
import { installSpringSystem } from './springSystem';
import { installEventSystem } from './eventSystem';
import { installFinalVisuals } from './finalVisuals';
import { installLevelVisuals } from './levelVisuals';
import { installActiveLevelUi } from './levelUi';
import { installLevel01Experience } from './level01Experience';
import { installBowlingBall3D } from './bowlingBall3d';
import { installBowlingBallLab } from './bowlingBallLab';
import { installBasketballLab } from './basketballLab';
import { installCannonballLab } from './cannonballLab';
import { installPart0408Lab, isPart0408Asset } from './parts0408Lab';
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

const params = new URLSearchParams(location.search);
const assetPreview = params.get('asset');
const levelPreview = params.get('level');

async function boot(): Promise<void> {
  if (levelPreview === 'clean01') {
    const { installCleanMinimalLevel01 } = await import('./cleanMinimalLevel01');
    installCleanMinimalLevel01();
    return;
  }

  if (assetPreview === 'bowling-ball') {
    installBowlingBallLab();
  } else if (assetPreview === 'basketball') {
    installBasketballLab();
  } else if (assetPreview === 'cannonball') {
    installCannonballLab();
  } else if (isPart0408Asset(assetPreview)) {
    installPart0408Lab(assetPreview);
  } else {
    installExtendedParts();
    installPulleySystem();
    installSpringSystem();
    installEventSystem();
    installFinalVisuals();
    installLevelVisuals();
    installActiveLevelUi();
    installEditorUiIntegration();
    installBowlingBall3D();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) throw new Error('Canvas игрового поля не найден.');
    const app = new GameApp(canvas);
    installCampaignCompletionHook(app);
    installCampaign();
    installLevel01Experience(app);
    installSignalEditor(app);
    installDeviceSettingsUi(app);
    installLevelEditor(app);
    installCompletionGuard();
    installBrowserSmokeBridge(app);
  }
}

boot().catch(showFatalError);
