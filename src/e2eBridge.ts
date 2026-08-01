import { createInitialSnapshot, cloneSnapshot, SnapshotHistory, type MachineSnapshot, type Point } from './model';
import { ACTIVE_LEVEL } from './level';
import { createCampaignReferenceSolution } from './campaignReferenceSolutions';

type Internals = Record<string, any>;

export interface BrowserSmokeBridge {
  loadEditorFixture(): void;
  loadPointerFixture(): void;
  loadReferenceSolution(): void;
  snapshot(): MachineSnapshot;
  mode(): string;
  screenPoint(point: Point): Point;
  partCenter(partId: string): Point | null;
  rotationHandle(partId: string): Point | null;
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
  app.renderer.resetCamera();
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
    loadPointerFixture(): void {
      const snapshot = createInitialSnapshot();
      snapshot.parts.push(
        { id: 'pointer-plank-a', kind: 'plank', x: 590, y: 430, angle: 0, fixed: true },
        { id: 'pointer-plank-b', kind: 'plank', x: 930, y: 520, angle: 0, fixed: true }
      );
      installSnapshot(internals, snapshot, null);
    },
    loadReferenceSolution(): void {
      installSnapshot(internals, createCampaignReferenceSolution(ACTIVE_LEVEL), null);
    },
    snapshot(): MachineSnapshot {
      return cloneSnapshot(internals.snapshot);
    },
    mode(): string {
      return String(internals.mode);
    },
    screenPoint(point: Point): Point {
      return internals.renderer.worldToScreen(point);
    },
    partCenter(partId: string): Point | null {
      const part = internals.snapshot.parts.find((candidate: { id: string }) => candidate.id === partId);
      return part ? internals.renderer.worldToScreen({ x: part.x, y: part.y }) : null;
    },
    rotationHandle(partId: string): Point | null {
      const part = internals.snapshot.parts.find((candidate: { id: string }) => candidate.id === partId);
      return part ? internals.renderer.worldToScreen(internals.renderer.rotationHandle(part)) : null;
    }
  };
}
