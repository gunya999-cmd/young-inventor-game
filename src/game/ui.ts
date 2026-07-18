// @ts-nocheck
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
export const FLOOR_Y = 760;

export const app = document.querySelector('#app');
export const runButton = document.querySelector('#run-button');
export const resetButton = document.querySelector('#reset-button');
export const againButton = document.querySelector('#again-button');
export const rotateLeftButton = document.querySelector('#rotate-left');
export const rotateRightButton = document.querySelector('#rotate-right');
export const hintButton = document.querySelector('#hint-button');
export const soundButton = document.querySelector('#sound-button');
export const timerElement = document.querySelector('#timer');
export const statusElement = document.querySelector('#status-message');
export const objectiveElement = document.querySelector('#objective-text');
export const resultCard = document.querySelector('#result-card');
export const partButtons = [...document.querySelectorAll('.part-card')];

export let activeScene = null;
export function setActiveScene(scene) { activeScene = scene; }

let soundEnabled = true;
let audioContext = null;

export function toggleSound() {
  soundEnabled = !soundEnabled;
  return soundEnabled;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
}

export function setObjective(message) {
  if (objectiveElement) objectiveElement.textContent = message;
}

export function setTimer(seconds) {
  if (!timerElement) return;
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const whole = Math.floor(seconds % 60).toString().padStart(2, '0');
  const tenths = Math.floor((seconds * 10) % 10);
  timerElement.textContent = `${minutes}:${whole}.${tenths}`;
}

export function setPartState(part, used, selected = false) {
  const button = partButtons.find((item) => item.dataset.part === part);
  if (!button) return;
  button.classList.toggle('used', used);
  button.classList.toggle('selected', selected);
  const counter = button.querySelector('em');
  if (counter) counter.textContent = used ? '×0' : '×1';
}

export function resetHud() {
  app?.classList.remove('simulating', 'completed', 'failed');
  resultCard?.classList.remove('visible');
  runButton?.classList.remove('running', 'failed');
  if (runButton) runButton.innerHTML = '<span>▶</span><b>ПУСК</b>';
  setTimer(0);
  setObjective('Установи 3 недостающие детали');
  setStatus('Выбери детали снизу и собери цепочку.');
  partButtons.forEach((button) => {
    button.classList.remove('used', 'selected');
    const counter = button.querySelector('em');
    if (counter) counter.textContent = '×1';
  });
}

export function startSimulationHud() {
  app?.classList.remove('failed');
  app?.classList.add('simulating');
  runButton?.classList.remove('failed');
  runButton?.classList.add('running');
  if (runButton) runButton.innerHTML = '<span>■</span><b>РАБОТАЕТ</b>';
  setObjective('Добейся удара по колоколу');
}

export function failHud() {
  app?.classList.remove('simulating');
  app?.classList.add('failed');
  runButton?.classList.remove('running');
  runButton?.classList.add('failed');
  if (runButton) runButton.innerHTML = '<span>↻</span><b>ПОВТОР</b>';
  setObjective('Механизм остановился');
  setStatus('Цепочка не сработала. Нажми «Повтор» и измени положение деталей.');
}

export function completeHud(time) {
  app?.classList.remove('simulating', 'failed');
  app?.classList.add('completed');
  runButton?.classList.remove('running', 'failed');
  if (runButton) runButton.innerHTML = '<span>✓</span><b>ГОТОВО</b>';
  setStatus(`Цепная реакция завершена за ${time.toFixed(1)} сек.`);
  setObjective('Колокол прозвенел');
  resultCard?.classList.add('visible');
}

export function ringBell() {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  const now = audioContext.currentTime;
  [520, 780, 1040, 1320].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .982, now + 1.7);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.16 / (index + 1), now + .012 + index * .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 1.6 + index * .18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + index * .01);
    oscillator.stop(now + 1.9 + index * .18);
  });
}
