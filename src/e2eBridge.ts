import { createInitialSnapshot, cloneSnapshot, SnapshotHistory, type MachineSnapshot } from './model';
import { createLevel07ReferenceSolution } from './referenceSolution';

type Internals = Record<string, any>;

export interface BrowserSmokeBridge {
  loadEditorFixture(): void;
  loadReferenceSolution(): void;
  snapshot(): MachineSnapshot;
  mode(): string;
}

declare global {
  interface Window {
    __YOUNG_INVENTOR_E2E__?: BrowserSmokeBridge;
  }
}

function installSnapshot(app: Internals, snapshot: MachineSnapshot, selectedId: string | null): void {
  app.snapshot = cloneSnapshot(snapshot);
  app.runtimeSnapshot = cloneSnapshot(snapshot);
  app.runStartSnapshot = cloneSnapshot(snapshot);
  app.history = new SnapshotHistory(snapshot);
  app.physics = null;
  app.mode = 'build';
  app.completed = false;
  app.elapsed = 0;
  app.accumulator = 0;
  app.selectedId = selectedId;
  app.cancelTools();
  document.querySelector<HTMLElement>('#result-card')?.classList.remove('visible');
  app.updateUi();
}

export function installBrowserSmokeBridge(app: unknown): void {
  if (!new URLSearchParams(window.location.search).has('e2e')) return;
  const internals = app as Internals;
  window.__YOUNG_INVENTOR_E2E__ = {
    loadEditorFixture(): void {
      const snapshot = createInitialSnapshot();
      snapshot.parts.push({
        id: 'e2e-plank', kind: 'plank', x: 620, y: 430, angle: 0, fixed: true
      });
      installSnapshot(internals, snapshot, 'e2e-plank');
    },
    loadReferenceSolution(): void {
      installSnapshot(internals, createLevel07ReferenceSolution(), null);
    },
    snapshot(): MachineSnapshot {
      return cloneSnapshot(internals.snapshot);
    },
    mode(): string {
      return String(internals.mode);
    }
  };
}
