import './style.css';

type PartType = 'plank-long' | 'plank-short' | 'spring' | 'lever' | 'rope' | 'weight' | 'fan';

type Placement = {
  id: number;
  type: PartType;
  x: number;
  y: number;
  rotation: number;
};

const workspace = document.querySelector<HTMLElement>('#workspace');
const placedLayer = document.querySelector<HTMLElement>('#placed-layer');
const runButton = document.querySelector<HTMLButtonElement>('#run-button');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button');
const rotateButton = document.querySelector<HTMLButtonElement>('#rotate-button');
const trashButton = document.querySelector<HTMLButtonElement>('#trash-button');

if (!workspace || !placedLayer || !runButton || !resetButton || !rotateButton || !trashButton) {
  throw new Error('Game UI failed to initialize');
}

const counts: Record<PartType, number> = {
  'plank-long': 2,
  'plank-short': 2,
  spring: 1,
  lever: 1,
  rope: 2,
  weight: 2,
  fan: 1
};

let nextId = 1;
let selectedId: number | null = null;
let running = false;
const placements: Placement[] = [];

const partLabels: Record<PartType, string> = {
  'plank-long': 'Длинная доска',
  'plank-short': 'Короткая доска',
  spring: 'Пружина',
  lever: 'Рычаг',
  rope: 'Верёвка',
  weight: 'Груз',
  fan: 'Вентилятор'
};

function updateInventory(): void {
  document.querySelectorAll<HTMLButtonElement>('.inventory-item').forEach((button) => {
    const type = button.dataset.part as PartType;
    const badge = button.querySelector('b');
    if (badge) badge.textContent = `×${counts[type]}`;
    button.disabled = counts[type] <= 0 || running;
    button.style.opacity = counts[type] <= 0 ? '.38' : '1';
  });
}

function createPlacedElement(placement: Placement): HTMLDivElement {
  const element = document.createElement('div');
  element.className = `placed-part ${placement.type}`;
  element.dataset.id = String(placement.id);
  element.title = partLabels[placement.type];
  element.style.left = `${placement.x}px`;
  element.style.top = `${placement.y}px`;
  element.style.transform = `translate(-50%, -50%) rotate(${placement.rotation}deg)`;
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', partLabels[placement.type]);

  let pointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener('pointerdown', (event) => {
    if (running) return;
    pointerId = event.pointerId;
    element.setPointerCapture(event.pointerId);
    selectPlacement(placement.id);
    const rect = workspace.getBoundingClientRect();
    offsetX = event.clientX - rect.left - placement.x;
    offsetY = event.clientY - rect.top - placement.y;
  });

  element.addEventListener('pointermove', (event) => {
    if (running || pointerId !== event.pointerId) return;
    const rect = workspace.getBoundingClientRect();
    placement.x = Math.max(20, Math.min(rect.width - 20, event.clientX - rect.left - offsetX));
    placement.y = Math.max(20, Math.min(rect.height - 20, event.clientY - rect.top - offsetY));
    element.style.left = `${placement.x}px`;
    element.style.top = `${placement.y}px`;
  });

  element.addEventListener('pointerup', (event) => {
    if (pointerId === event.pointerId) pointerId = null;
  });

  return element;
}

function addPart(type: PartType): void {
  if (running || counts[type] <= 0) return;
  const rect = workspace.getBoundingClientRect();
  const placement: Placement = {
    id: nextId++,
    type,
    x: rect.width * (0.42 + Math.random() * 0.18),
    y: rect.height * (0.58 + Math.random() * 0.12),
    rotation: type.startsWith('plank') ? -10 : 0
  };
  counts[type] -= 1;
  placements.push(placement);
  placedLayer.append(createPlacedElement(placement));
  selectPlacement(placement.id);
  updateInventory();
}

function selectPlacement(id: number | null): void {
  selectedId = id;
  document.querySelectorAll<HTMLElement>('.placed-part').forEach((element) => {
    element.classList.toggle('selected', Number(element.dataset.id) === id);
  });
}

function rotateSelected(): void {
  if (running || selectedId === null) return;
  const placement = placements.find((item) => item.id === selectedId);
  const element = placedLayer.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
  if (!placement || !element) return;
  placement.rotation = (placement.rotation + 15) % 360;
  element.style.transform = `translate(-50%, -50%) rotate(${placement.rotation}deg)`;
}

function deleteSelected(): void {
  if (running || selectedId === null) return;
  const index = placements.findIndex((item) => item.id === selectedId);
  if (index < 0) return;
  const [removed] = placements.splice(index, 1);
  counts[removed.type] += 1;
  placedLayer.querySelector(`[data-id="${selectedId}"]`)?.remove();
  selectedId = null;
  updateInventory();
}

function resetScene(): void {
  running = false;
  document.body.classList.remove('running');
  runButton.innerHTML = '▶ <span>ЗАПУСК</span>';
  placements.forEach((placement) => { counts[placement.type] += 1; });
  placements.splice(0, placements.length);
  placedLayer.replaceChildren();
  selectedId = null;
  updateInventory();
}

function toggleRun(): void {
  running = !running;
  document.body.classList.toggle('running', running);
  runButton.innerHTML = running ? '■ <span>СТОП</span>' : '▶ <span>ЗАПУСК</span>';
  updateInventory();

  if (!running) return;
  document.querySelectorAll<HTMLElement>('.placed-part').forEach((element, index) => {
    const placement = placements[index];
    if (!placement) return;
    element.animate(
      [
        { transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)` },
        { transform: `translate(-50%, calc(-50% + 3px)) rotate(${placement.rotation + (placement.type === 'fan' ? 12 : 0)}deg)` },
        { transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)` }
      ],
      { duration: 520, iterations: Infinity, easing: 'ease-in-out' }
    );
  });
}

document.querySelectorAll<HTMLButtonElement>('.inventory-item').forEach((button) => {
  button.addEventListener('click', () => addPart(button.dataset.part as PartType));
});

rotateButton.addEventListener('click', rotateSelected);
trashButton.addEventListener('click', deleteSelected);
runButton.addEventListener('click', toggleRun);
resetButton.addEventListener('click', resetScene);
workspace.addEventListener('pointerdown', (event) => {
  if (event.target === workspace || event.target === placedLayer) selectPlacement(null);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
  if (event.key.toLowerCase() === 'r') rotateSelected();
  if (event.code === 'Space') {
    event.preventDefault();
    toggleRun();
  }
});

updateInventory();
