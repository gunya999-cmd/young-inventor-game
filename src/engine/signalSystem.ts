import type { Body, Fixture } from 'planck';
import type { MachineSnapshot, PartState, SignalLink } from '../model';
import type { PhysicsBodyData } from './partFactory';

export class SignalRuntime {
  private readonly activeButtons = new Set<string>();
  private readonly releasedLatches = new Set<string>();

  constructor(
    private readonly snapshot: MachineSnapshot,
    private readonly bodies: Map<string, Body>
  ) {}

  handleContact(a: Fixture, b: Fixture): void {
    const dataA = a.getUserData() as PhysicsBodyData | undefined;
    const dataB = b.getUserData() as PhysicsBodyData | undefined;
    const buttonFixture = dataA?.kind === 'button-sensor' ? a : dataB?.kind === 'button-sensor' ? b : null;
    const otherFixture = buttonFixture === a ? b : buttonFixture === b ? a : null;
    if (!buttonFixture || !otherFixture || otherFixture.getBody().getType() !== 'dynamic') return;
    const buttonId = (buttonFixture.getUserData() as PhysicsBodyData | undefined)?.partId;
    if (buttonId) this.activateButton(buttonId);
  }

  isActive(partId: string): boolean {
    return this.activeButtons.has(partId) || this.releasedLatches.has(partId);
  }

  private activateButton(buttonId: string): void {
    if (this.activeButtons.has(buttonId)) return;
    this.activeButtons.add(buttonId);
    for (const link of (this.snapshot.signals ?? []) as SignalLink[]) {
      if (link.sourcePartId !== buttonId || link.action !== 'release') continue;
      const target = this.snapshot.parts.find((part: PartState) => part.id === link.targetPartId);
      if (target?.kind === 'latch') this.releaseLatch(target.id);
    }
  }

  private releaseLatch(latchId: string): void {
    if (this.releasedLatches.has(latchId)) return;
    const body = this.bodies.get(latchId);
    if (!body) return;
    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) fixture.setSensor(true);
    this.releasedLatches.add(latchId);
    for (const candidate of this.bodies.values()) {
      if (candidate.getType() === 'dynamic') candidate.setAwake(true);
    }
  }
}
