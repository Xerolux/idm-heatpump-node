function requireMonotonicSeconds(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || Object.is(value, -0)) {
    throw new RangeError(`${field} must be a finite non-negative number`);
  }
}

export class FakeClock {
  #now: number;
  readonly #delays: number[] = [];
  readonly #observations: number[] = [];

  public constructor(initial = 0) {
    requireMonotonicSeconds(initial, "initial");
    this.#now = initial;
  }

  public now(): number {
    return this.#now;
  }

  public get delays(): readonly number[] {
    return Object.freeze([...this.#delays]);
  }

  public get observations(): readonly number[] {
    return Object.freeze([...this.#observations]);
  }

  public async sleep(seconds: number): Promise<void> {
    requireMonotonicSeconds(seconds, "seconds");
    this.#delays.push(seconds);
    this.#now += seconds;
    this.#observations.push(this.#now);
  }

  public advance(seconds: number): void {
    requireMonotonicSeconds(seconds, "seconds");
    this.#now += seconds;
  }
}
