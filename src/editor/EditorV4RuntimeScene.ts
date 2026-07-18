// @ts-nocheck
import { EditorV4Scene, WORLD_HEIGHT, WORLD_WIDTH } from './EditorV4Scene';
import type { Connection } from '../tim-core/types';

export { WORLD_HEIGHT, WORLD_WIDTH };

/**
 * Runtime safety layer for interactions that are difficult to cover in the
 * pure model tests: mutually exclusive tools and iPad hit targets after Stop.
 */
export class EditorV4RuntimeScene extends EditorV4Scene {
  armRopeTool(): void {
    this.hingeToolArmed = false;
    super.armRopeTool();
    this.updateInspector();
  }

  clearMachine(): void {
    this.hingeToolArmed = false;
    super.clearMachine();
  }

  undo(): void {
    this.hingeToolArmed = false;
    super.undo();
  }

  redo(): void {
    this.hingeToolArmed = false;
    super.redo();
  }

  stopSimulation(): void {
    super.stopSimulation();
    for (const part of this.model.getParts()) {
      if (part.metadata.editorKind !== 'hinge') continue;
      const visual = this.visuals.get(part.id);
      visual?.disableInteractive();
      if (visual) this.input.setDraggable(visual, false);
    }
  }

  private limitLabel(connection: Connection): string {
    if (connection.minAngle === undefined || connection.maxAngle === undefined) return '∠ БЕЗ ОГР.';
    const fullRangeDegrees = Math.round((connection.maxAngle - connection.minAngle) * 180 / Math.PI);
    return fullRangeDegrees < 120 ? '∠ ±36°' : '∠ ±83°';
  }
}
