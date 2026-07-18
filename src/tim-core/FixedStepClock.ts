export interface FixedStepClockOptions {
  readonly stepSeconds?: number;
  readonly maxFrameSeconds?: number;
  readonly maxSubSteps?: number;
}

export class FixedStepClock {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxSubSteps: number;
  private accumulatorSeconds = 0;
  private _simulationSeconds = 0;

  constructor(options: FixedStepClockOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 120;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.1;
    this.maxSubSteps = options.maxSubSteps ?? 16;
    if (this.stepSeconds <= 0) throw new Error('stepSeconds must be positive');
    if (this.maxFrameSeconds <= 0) throw new Error('maxFrameSeconds must be positive');
    if (this.maxSubSteps < 1) throw new Error('maxSubSteps must be at least 1');
  }

  get simulationSeconds(): number {
    return this._simulationSeconds;
  }

  reset(): void {
    this.accumulatorSeconds = 0;
    this._simulationSeconds = 0;
  }

  advance(frameSeconds: number, step: (dtSeconds: number) => void): number {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0) {
      throw new Error('frameSeconds must be a finite non-negative number');
    }

    this.accumulatorSeconds += Math.min(frameSeconds, this.maxFrameSeconds);
    let subSteps = 0;
    while (this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds && subSteps < this.maxSubSteps) {
      step(this.stepSeconds);
      this.accumulatorSeconds -= this.stepSeconds;
      this._simulationSeconds += this.stepSeconds;
      subSteps += 1;
    }

    if (subSteps === this.maxSubSteps && this.accumulatorSeconds >= this.stepSeconds) {
      this.accumulatorSeconds %= this.stepSeconds;
    }
    return subSteps;
  }

  interpolationAlpha(): number {
    return Math.min(1, Math.max(0, this.accumulatorSeconds / this.stepSeconds));
  }
}
