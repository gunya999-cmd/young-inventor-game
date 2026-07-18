// @ts-nocheck
export const WORLD_WIDTH = 1672;
export const WORLD_HEIGHT = 941;

export const app = document.querySelector<HTMLElement>('#app');
export const runButton = document.querySelector<HTMLButtonElement>('#run-button');
export const resetButton = document.querySelector<HTMLButtonElement>('#reset-button');
export const againButton = document.querySelector<HTMLButtonElement>('#again-button');
export const rotateLeftButton = document.querySelector<HTMLButtonElement>('#rotate-left');
export const rotateRightButton = document.querySelector<HTMLButtonElement>('#rotate-right');
export const hintButton = document.querySelector<HTMLButtonElement>('#hint-button');
export const soundButton = document.querySelector<HTMLButtonElement>('#sound-button');
export const timerElement = document.querySelector<HTMLElement>('#timer');
export const statusElement = document.querySelector<HTMLElement>('#status-message');
export const objectiveElement = document.querySelector<HTMLElement>('#objective-text');
export const resultCard = document.querySelector<HTMLElement>('#result-card');
export const partButtons = [...document.querySelectorAll<HTMLButtonElement>('.part-card')];

export let activeScene: any = null;
export function setActiveScene(scene: any): void { activeScene = scene; }
let soundEnabled = true;
let audioContext: AudioContext | null = null;
export function toggleSound(): boolean { soundEnabled = !soundEnabled; return soundEnabled; }

export function setStatus(message: string): void { if (statusElement) statusElement.textContent = message; }
export function setObjective(message: string): void { if (objectiveElement) objectiveElement.textContent = message; }
export function setTimer(seconds: number): void {
  if (!timerElement) return;
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const whole = Math.floor(seconds % 60).toString().padStart(2, '0');
  const tenths = Math.floor((seconds * 10) % 10);
  timerElement.textContent = `${minutes}:${whole}.${tenths}`;
}
export function setPartState(part: string, used: boolean, selected = false): void {
  const button = partButtons.find((item) => item.dataset.part === part);
  if (!button) return;
  button.classList.toggle('used', used);
  button.classList.toggle('selected', selected);
  const counter = button.querySelector('em');
  if (counter) counter.textContent = used ? '✓' : '×1';
}
export function resetHud(): void {
  app?.classList.remove('simulating', 'completed', 'failed');
  resultCard?.classList.remove('visible');
  if (runButton) runButton.innerHTML = '<span>▶</span><b>ПУСК</b>';
  setTimer(0);
  setObjective('Установи три недостающие детали');
  setStatus('Собери рабочую цепочку и запусти симуляцию.');
  partButtons.forEach((button) => {
    button.classList.remove('used', 'selected');
    const counter = button.querySelector('em');
    if (counter) counter.textContent = '×1';
  });
}
export function startSimulationHud(): void {
  app?.classList.add('simulating');
  if (runButton) runButton.innerHTML = '<span>■</span><b>РАБОТАЕТ</b>';
  setObjective('Добейся удара молотка по колоколу');
}
export function failHud(message: string): void {
  app?.classList.remove('simulating');
  app?.classList.add('failed');
  if (runButton) runButton.innerHTML = '<span>↻</span><b>НЕ СРАБОТАЛО</b>';
  setObjective('Измени конфигурацию и повтори');
  setStatus(message);
}
export function completeHud(time: number): void {
  app?.classList.remove('simulating', 'failed');
  app?.classList.add('completed');
  if (runButton) runButton.innerHTML = '<span>✓</span><b>ГОТОВО</b>';
  setStatus(`Цепная реакция завершена за ${time.toFixed(1)} сек.`);
  setObjective('Колокол прозвенел');
  resultCard?.classList.add('visible');
}
export function ringBell(): void {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  const now = audioContext.currentTime;
  [520, 780, 1040, 1320].forEach((frequency, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    oscillator.type = index < 2 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + 1.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15 / (index + 1), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7 + index * 0.16);
    oscillator.connect(gain).connect(audioContext!.destination);
    oscillator.start(now + index * 0.012);
    oscillator.stop(now + 2 + index * 0.16);
  });
}
