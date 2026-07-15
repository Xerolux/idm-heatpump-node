import { performance } from "node:perf_hooks";

import { SemanticValidationError } from "./errors.js";

export interface AdaptiveBackoffOptions {
  readonly initial?: number;
  readonly multiplier?: number;
  readonly maximum?: number;
}

export class AdaptiveBackoff {
  readonly #initial: number;
  readonly #multiplier: number;
  readonly #maximum: number;
  #current: number;

  public constructor(options: AdaptiveBackoffOptions = {}) {
    const initial = options.initial ?? 5;
    const multiplier = options.multiplier ?? 3;
    const maximum = options.maximum ?? 300;
    if (initial <= 0) {
      throw new SemanticValidationError("register_invalid", "initial backoff must be positive");
    }
    if (multiplier < 1) {
      throw new SemanticValidationError("register_invalid", "backoff multiplier must be >= 1");
    }
    if (maximum < initial) {
      throw new SemanticValidationError("register_invalid", "maximum backoff must be >= initial");
    }
    this.#initial = initial;
    this.#multiplier = multiplier;
    this.#maximum = maximum;
    this.#current = initial;
  }

  public nextDelay(): number {
    const delay = this.#current;
    this.#current = Math.min(this.#current * this.#multiplier, this.#maximum);
    return delay;
  }

  public reset(): void {
    this.#current = this.#initial;
  }
}

export type MonotonicClock = () => number;

export interface PollRateLimiterOptions {
  readonly clock?: MonotonicClock;
}

const monotonicSeconds: MonotonicClock = () => performance.now() / 1000;

export class PollRateLimiter {
  readonly #interval: number;
  readonly #clock: MonotonicClock;
  #nextAllowed = 0;

  public constructor(interval: number, options: PollRateLimiterOptions = {}) {
    if (interval < 0) {
      throw new SemanticValidationError("register_invalid", "poll interval must be >= 0");
    }
    this.#interval = interval;
    this.#clock = options.clock ?? monotonicSeconds;
  }

  public get interval(): number {
    return this.#interval;
  }

  public remaining(): number {
    const remaining = this.#nextAllowed - this.#clock();
    return remaining > 0 ? remaining : 0;
  }

  public allow(): boolean {
    return this.remaining() <= 0;
  }

  public mark(): void {
    this.#nextAllowed = this.#clock() + this.#interval;
  }
}
