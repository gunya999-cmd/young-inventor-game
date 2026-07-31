import { PARTS, topPartAt, type MachineSnapshot, type PartKind, type SignalAction, type SignalLink } from './model';

interface AppBridge {
  snapshot: MachineSnapshot;
  mode: 'build' | 'running' | 'paused';
  renderer: {
    canvas: HTMLCanvasElement;
    screenToWorld(clientX: number, clientY: number): { x: number; y: number };
    worldToScreen(point: { x: number; y: number }): { x: number; y: number };
  };
  commit(message: string): void;
}

const SOURCE_KINDS = new Set<PartKind>(['button', 'switch']);
const ACTIVATABLE_KINDS = new Set<PartKind>(['switch', 'pulley', 'conveyor', 'spring', 'magnet']);

export function signalActionForTarget(kind: PartKind): SignalAction | null {
  if (kind === 'latch') return 'release';
  if (ACTIVATABLE_KINDS.has(kind)) return 'activate';
  return null;
}

export function addSignalLink(snapshot: MachineSnapshot, sourcePartId: string, targetPartId: string, action?: SignalAction): boolean {
  const source = snapshot.parts.find((part) => part.id === sourcePartId);
  const target = snapshot.parts.find((part) => part.id === targetPartId);
  if (!source || !target || source.id === target.id || !SOURCE_KINDS.has(source.kind)) return false;
  const resolvedAction = action ?? signalActionForTarget(target.kind);
  if (!resolvedAction || (resolvedAction === 'release' && target.kind !== 'latch')) return false;
  if (resolvedAction === 'activate' && !ACTIVATABLE_KINDS.has(target.kind)) return false;
  const signals = snapshot.signals ?? (snapshot.signals = []);
  if (signals.some((link) => link.sourcePartId === source.id && link.targetPartId === target.id && link.action === resolvedAction)) return false;
  signals.push({ id: `signal-${Date.now()}-${signals.length + 1}`, sourcePartId: source.id, targetPartId: target.id, action: resolvedAction });
  return true;
}

export function removeSignalLink(snapshot: MachineSnapshot, signalId: string): boolean {
  const signals = snapshot.signals ?? [];
  const next = signals.filter((link) => link.id !== signalId);
  if (next.length === signals.length) return false;
  snapshot.signals = next;
  return true;
}

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .signal-editor-panel{position:absolute;right:18px;top:92px;z-index:30;width:248px;padding:12px;border:1px solid #477c8c;border-radius:12px;background:rgba(18,28,34,.94);box-shadow:0 12px 32px #0008;color:#e9f4f6;font:13px system-ui}
    .signal-editor-panel[hidden]{display:none}.signal-editor-panel h3{margin:0 0 8px;font-size:14px}.signal-editor-panel button{width:100%;margin-top:7px;padding:8px;border:0;border-radius:8px;background:#477c8c;color:white;font-weight:700;cursor:pointer}.signal-editor-panel button.danger{background:#8f4b50}.signal-editor-panel select{width:100%;padding:6px;margin-top:6px;background:#152229;color:white;border:1px solid #477c8c;border-radius:7px}.signal-editor-panel small{display:block;opacity:.75;margin-top:6px;line-height:1.35}.signal-editor-toggle{position:absolute;right:18px;top:48px;z-index:31;padding:8px 12px;border-radius:9px;border:1px solid #477c8c;background:#20363f;color:#e9f4f6;font-weight:800;cursor:pointer}.signal-wire-layer{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:visible}.signal-wire{fill:none;stroke:#45d2dc;stroke-width:3;stroke-dasharray:8 5;filter:drop-shadow(0 0 4px #1aa0aa)}.signal-wire.release{stroke:#f3ae49}.signal-wire-hit{fill:none;stroke:transparent;stroke-width:16;pointer-events:stroke;cursor:pointer}.signal-editor-active canvas{cursor:crosshair!important}`;
  document.head.appendChild(style);
}

export function installSignalEditor(appInstance: unknown): void {
  const app = appInstance as AppBridge;
  if (!app?.renderer?.canvas) return;
  injectStyles();
  const canvas = app.renderer.canvas;
  const host = canvas.parentElement ?? document.body;
  if (getComputedStyle(host).position === 'static') (host as HTMLElement).style.position = 'relative';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('signal-wire-layer');
  host.appendChild(svg);

  const toggle = document.createElement('button');
  toggle.className = 'signal-editor-toggle';
  toggle.textContent = '⚡ Связи';
  host.appendChild(toggle);

  const panel = document.createElement('section');
  panel.className = 'signal-editor-panel';
  panel.hidden = true;
  panel.innerHTML = `<h3>Сигнальная связь</h3><div data-state>Выбери источник: кнопку или переключатель.</div><select data-action><option value="activate">Включить устройство</option><option value="release">Освободить защёлку</option></select><button data-cancel>Сбросить выбор</button><small>Клик по проводу удаляет связь. Голубой провод — включение, оранжевый — освобождение.</small>`;
  host.appendChild(panel);

  const state = panel.querySelector<HTMLElement>('[data-state]')!;
  const actionSelect = panel.querySelector<HTMLSelectElement>('[data-action]')!;
  let sourceId: string | null = null;
  let enabled = false;

  const reset = (message = 'Выбери источник: кнопку или переключатель.') => {
    sourceId = null;
    state.textContent = message;
  };
  panel.querySelector<HTMLButtonElement>('[data-cancel]')!.addEventListener('click', () => reset());
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    panel.hidden = !enabled;
    host.classList.toggle('signal-editor-active', enabled);
    toggle.textContent = enabled ? '⚡ Готово' : '⚡ Связи';
    reset();
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled || app.mode !== 'build' || event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const part = topPartAt(app.snapshot, app.renderer.screenToWorld(event.clientX, event.clientY));
    if (!part) return reset('Кликни по детали-источнику.');
    if (!sourceId) {
      if (!SOURCE_KINDS.has(part.kind)) return reset('Источником может быть только кнопка или переключатель.');
      sourceId = part.id;
      state.textContent = `Источник: ${PARTS[part.kind].label}. Теперь выбери устройство.`;
      return;
    }
    const automatic = signalActionForTarget(part.kind);
    const chosen = actionSelect.value as SignalAction;
    const action = chosen === automatic ? chosen : automatic;
    if (!action) return reset('Эта деталь не принимает сигналы. Выбери устройство или защёлку.');
    if (addSignalLink(app.snapshot, sourceId, part.id, action)) app.commit(action === 'release' ? 'Сигнал освобождения защёлки добавлен.' : 'Сигнал включения устройства добавлен.');
    else state.textContent = 'Такую связь создать нельзя или она уже существует.';
    sourceId = null;
  }, true);

  const render = () => {
    const rect = canvas.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${host.clientWidth} ${host.clientHeight}`);
    svg.innerHTML = '';
    for (const link of app.snapshot.signals ?? []) {
      const source = app.snapshot.parts.find((part) => part.id === link.sourcePartId);
      const target = app.snapshot.parts.find((part) => part.id === link.targetPartId);
      if (!source || !target) continue;
      const a = app.renderer.worldToScreen(source);
      const b = app.renderer.worldToScreen(target);
      const x1 = a.x - rect.left + canvas.offsetLeft, y1 = a.y - rect.top + canvas.offsetTop;
      const x2 = b.x - rect.left + canvas.offsetLeft, y2 = b.y - rect.top + canvas.offsetTop;
      const bend = Math.max(45, Math.abs(x2 - x1) * .35);
      const pathData = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      const visible = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      visible.setAttribute('d', pathData); visible.setAttribute('class', `signal-wire ${link.action}`); svg.appendChild(visible);
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', pathData); hit.setAttribute('class', 'signal-wire-hit');
      hit.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); if (app.mode === 'build' && removeSignalLink(app.snapshot, link.id)) app.commit('Сигнальная связь удалена.'); });
      svg.appendChild(hit);
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
