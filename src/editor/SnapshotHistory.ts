import { cloneSnapshot } from '../tim-core/clone';
import type { MachineSnapshot } from '../tim-core/types';

function key(snapshot: MachineSnapshot): string {
  return JSON.stringify(snapshot);
}

export class SnapshotHistory {
  private current: MachineSnapshot;
  private readonly undoStack: MachineSnapshot[] = [];
  private readonly redoStack: MachineSnapshot[] = [];

  constructor(initial: MachineSnapshot, private readonly limit = 80) {
    this.current = cloneSnapshot(initial);
  }

  reset(snapshot: MachineSnapshot): void {
    this.current = cloneSnapshot(snapshot);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  commit(snapshot: MachineSnapshot): boolean {
    if (key(snapshot) === key(this.current)) return false;
    this.undoStack.push(cloneSnapshot(this.current));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.current = cloneSnapshot(snapshot);
    this.redoStack.length = 0;
    return true;
  }

  undo(): MachineSnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(cloneSnapshot(this.current));
    this.current = cloneSnapshot(previous);
    return cloneSnapshot(this.current);
  }

  redo(): MachineSnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneSnapshot(this.current));
    this.current = cloneSnapshot(next);
    return cloneSnapshot(this.current);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
}
