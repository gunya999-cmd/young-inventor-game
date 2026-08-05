import './style.css';
import './gamefeel.css';
import './level01Experience.css';
import './bowlingBall3d.css';
import './bowlingBallLab.css';
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
import { installPart0913Lab, isPart0913Asset } from './parts0913Lab';
import { installPart14PulleyLab } from './part14Lab';
import { installPart15MotorLab } from './part15Lab';
import { installJackInTheBoxLab } from './jackInTheBoxLab';
import { installWindmillLab } from './windmillLab';
import { installRopeLab } from './ropeLab';
import { installMetalLoopHookLab } from './metalLoopHookLab';
import { installRevolverLab } from './revolverLab';
import { installScissors2DLab } from './scissors2dLab';
import { installScissors3DLabV12 } from './scissors3dLabV12';
import { installOutletSwitchLab } from './outletSwitchLab';
import { installGeneratorLabV2 } from './generatorLabV2';
import { installVerticalSliceStageV2 } from './verticalSliceStageV2';
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
const stagePreview = params.get('stage');

if (stagePreview === 'vertical-slice-01' || stagePreview === 'workshop' || stagePreview === 'rube-lab') {
  void installVerticalSliceStageV2().catch(showFatalError);
} else if (assetPreview === 'bowling-ball') {
  installBowlingBallLab();
} else if (assetPreview === 'basketball') {
  installBasketballLab();
} else if (assetPreview === 'cannonball') {
  installCannonballLab();
} else if (assetPreview === 'pulley') {
  installPart14PulleyLab();
} else if (assetPreview === 'motor') {
  installPart15MotorLab();
} else if (assetPreview === 'jack-in-the-box') {
  installJackInTheBoxLab();
} else if (assetPreview === 'windmill') {
  installWindmillLab();
} else if (assetPreview === 'rope') {
  installRopeLab();
} else if (assetPreview === 'metal-loop-hook' || assetPreview === 'hook') {
  installMetalLoopHookLab();
} else if (assetPreview === 'revolver' || assetPreview === 'gun') {
  installRevolverLab();
} else if (assetPreview === 'scissors-2d') {
  installScissors2DLab();
} else if (assetPreview === 'scissors' || assetPreview === 'scissors-3d') {
  installScissors3DLabV12();
} else if (assetPreview === 'outlet-switch' || assetPreview === 'switch-outlet') {
  installOutletSwitchLab();
} else if (assetPreview === 'generator') {
  installGeneratorLabV2();
} else if (isPart0408Asset(assetPreview)) {
  installPart0408Lab(assetPreview);
} else if (isPart0913Asset(assetPreview)) {
  installPart0913Lab(assetPreview);
} else {
  try {
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
  } catch (error) {
    showFatalError(error);
  }
}
