import { MAX_DEVICE_POWER, MIN_DEVICE_POWER, PARTS, POWERED_PART_KINDS, clampDevicePower, devicePower, type PartState } from './model';

interface MutableGameApp {
  snapshot: { parts: PartState[] };
  selectedId: string | null;
  mode: string;
  history: { commit(snapshot: unknown): void };
  updateUi(): void;
  setStatus(message: string): void;
}

const LABELS: Partial<Record<PartState['kind'], string>> = {
  magnet: 'Сила магнита',
  conveyor: 'Скорость конвейера',
  pulley: 'Мощность вентилятора',
  spring: 'Жёсткость пружины'
};

export function installDeviceSettingsUi(appInstance: unknown): void {
  const app = appInstance as MutableGameApp;
  const inspector = document.querySelector<HTMLElement>('#inspector');
  if (!inspector || inspector.querySelector('#device-power-panel')) return;

  const panel = document.createElement('section');
  panel.id = 'device-power-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="device-power-heading">
      <strong id="device-power-label">Мощность устройства</strong>
      <output id="device-power-value">100%</output>
    </div>
    <input id="device-power-input" type="range" min="${MIN_DEVICE_POWER}" max="${MAX_DEVICE_POWER}" step="0.05" value="1" aria-label="Мощность устройства">
    <div class="device-power-scale"><span>25%</span><span>100%</span><span>200%</span></div>
  `;
  inspector.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #device-power-panel{margin-top:14px;padding:12px;border:1px solid rgba(115,190,220,.35);border-radius:12px;background:rgba(18,38,50,.72)}
    .device-power-heading,.device-power-scale{display:flex;justify-content:space-between;align-items:center;gap:12px}
    #device-power-value{font-weight:800;color:#8edcf4}.device-power-scale{font-size:11px;opacity:.65}
    #device-power-input{width:100%;margin:10px 0 5px;accent-color:#6fd0ec}
  `;
  document.head.appendChild(style);

  const input = panel.querySelector<HTMLInputElement>('#device-power-input')!;
  const label = panel.querySelector<HTMLElement>('#device-power-label')!;
  const output = panel.querySelector<HTMLOutputElement>('#device-power-value')!;
  let visiblePartId: string | null = null;
  let lastPower = -1;

  const selectedPart = (): PartState | null => {
    if (!app.selectedId) return null;
    return app.snapshot.parts.find((part) => part.id === app.selectedId) ?? null;
  };

  const refresh = (): void => {
    const part = selectedPart();
    const visible = app.mode === 'build' && Boolean(part && !part.locked && POWERED_PART_KINDS.has(part.kind));
    if (panel.hidden === visible) panel.hidden = !visible;
    if (!visible || !part) {
      visiblePartId = null;
      lastPower = -1;
      return;
    }
    const power = devicePower(part);
    const nextLabel = LABELS[part.kind] ?? `${PARTS[part.kind].label}: мощность`;
    if (label.textContent !== nextLabel) label.textContent = nextLabel;
    if (visiblePartId !== part.id || (document.activeElement !== input && power !== lastPower)) input.value = String(power);
    const nextOutput = `${Math.round(power * 100)}%`;
    if (output.value !== nextOutput) output.value = nextOutput;
    visiblePartId = part.id;
    lastPower = power;
  };

  input.addEventListener('input', () => {
    const part = selectedPart();
    if (!part || part.locked || !POWERED_PART_KINDS.has(part.kind)) return;
    part.power = clampDevicePower(Number(input.value));
    lastPower = part.power;
    output.value = `${Math.round(part.power * 100)}%`;
  });

  input.addEventListener('change', () => {
    const part = selectedPart();
    if (!part || part.locked || !POWERED_PART_KINDS.has(part.kind)) return;
    part.power = clampDevicePower(Number(input.value));
    app.history.commit(app.snapshot);
    app.setStatus(`${LABELS[part.kind] ?? 'Мощность'}: ${Math.round(part.power * 100)}%.`);
    app.updateUi();
  });

  window.setInterval(refresh, 180);
  refresh();
}
