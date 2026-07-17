export interface GestureTransform {
  x: number;
  y: number;
  rotation: number;
}

export interface GestureCallbacks {
  getTransform: () => GestureTransform;
  setTransform: (transform: GestureTransform) => void;
  canInteract: () => boolean;
  onGestureEnd?: () => void;
}

export class GestureController {
  private pointers = new Map<number, { x: number; y: number }>();
  private startTransform?: GestureTransform;
  private startCenter?: { x: number; y: number };
  private startAngle = 0;

  constructor(private readonly callbacks: GestureCallbacks) {}

  pointerDown(id: number, x: number, y: number): void {
    if (!this.callbacks.canInteract()) return;
    this.pointers.set(id, { x, y });
    if (this.pointers.size === 2) this.beginTwoFingerGesture();
  }

  pointerMove(id: number, x: number, y: number): void {
    if (!this.pointers.has(id) || !this.callbacks.canInteract()) return;
    this.pointers.set(id, { x, y });
    if (this.pointers.size !== 2 || !this.startTransform || !this.startCenter) return;

    const [a, b] = [...this.pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    this.callbacks.setTransform({
      x: this.startTransform.x + center.x - this.startCenter.x,
      y: this.startTransform.y + center.y - this.startCenter.y,
      rotation: this.startTransform.rotation + angle - this.startAngle
    });
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    if (this.pointers.size < 2) {
      this.startTransform = undefined;
      this.startCenter = undefined;
      this.callbacks.onGestureEnd?.();
    }
  }

  cancel(): void {
    this.pointers.clear();
    this.startTransform = undefined;
    this.startCenter = undefined;
  }

  private beginTwoFingerGesture(): void {
    const [a, b] = [...this.pointers.values()];
    this.startTransform = { ...this.callbacks.getTransform() };
    this.startCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.startAngle = Math.atan2(b.y - a.y, b.x - a.x);
  }
}
