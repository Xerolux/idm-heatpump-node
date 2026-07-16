import {
  createModbusReadRequest,
  type ModbusReadRequest,
  type ModbusTransport,
  validateModbusWords,
} from "../../src/transport/types.js";

export type FakeModbusResponse =
  | Readonly<{ readonly kind: "words"; readonly words: readonly number[] }>
  | Readonly<{ readonly error: unknown; readonly kind: "error" }>;

export interface FakeModbusTransportOptions {
  readonly pauseReads?: boolean;
}

export type FakeModbusTransportEvent =
  | Readonly<{ readonly kind: "connect" }>
  | Readonly<{ readonly kind: "close" }>
  | Readonly<{ readonly kind: "destroy" }>
  | Readonly<{ readonly kind: "read"; readonly request: ModbusReadRequest }>;

interface PendingWaiter {
  readonly target: number;
  readonly resolve: () => void;
}

function cloneResponse(response: FakeModbusResponse): FakeModbusResponse {
  if (response.kind === "error") {
    return Object.freeze({ kind: "error", error: response.error });
  }
  return Object.freeze({ kind: "words", words: Object.freeze([...response.words]) });
}

export class FakeModbusTransport implements ModbusTransport {
  readonly #responses: FakeModbusResponse[];
  readonly #events: FakeModbusTransportEvent[] = [];
  readonly #pauseReads: boolean;
  readonly #pendingReleases: (() => void)[] = [];
  readonly #pendingWaiters: PendingWaiter[] = [];
  #connected = false;
  #activeRequests = 0;
  #maxActiveRequests = 0;

  public constructor(
    responses: readonly FakeModbusResponse[],
    options: FakeModbusTransportOptions = {},
  ) {
    this.#responses = responses.map((response) => cloneResponse(response));
    this.#pauseReads = options.pauseReads ?? false;
  }

  public get connected(): boolean {
    return this.#connected;
  }

  public get events(): readonly FakeModbusTransportEvent[] {
    return Object.freeze([...this.#events]);
  }

  public get remainingResponses(): number {
    return this.#responses.length;
  }

  public get activeRequests(): number {
    return this.#activeRequests;
  }

  public get maxActiveRequests(): number {
    return this.#maxActiveRequests;
  }

  public get pendingReads(): number {
    return this.#pendingReleases.length;
  }

  public async connect(): Promise<void> {
    for (const response of this.#responses) {
      if (response.kind === "words") {
        validateModbusWords(response.words);
      }
    }
    this.#connected = true;
    this.#events.push(Object.freeze({ kind: "connect" }));
  }

  public async close(): Promise<void> {
    this.#connected = false;
    this.#events.push(Object.freeze({ kind: "close" }));
  }

  public async destroy(): Promise<void> {
    this.#connected = false;
    this.#events.push(Object.freeze({ kind: "destroy" }));
  }

  public async read(request: ModbusReadRequest): Promise<readonly number[]> {
    if (!this.#connected) {
      throw new Error("Fake Modbus transport is disconnected");
    }

    const ownedRequest = createModbusReadRequest(request);
    const response = this.#responses[0];
    if (response === undefined) {
      throw new Error("Fake Modbus response script is exhausted");
    }
    if (response.kind === "words") {
      validateModbusWords(response.words, ownedRequest.count);
    }

    this.#responses.shift();
    this.#events.push(Object.freeze({ kind: "read", request: ownedRequest }));
    this.#activeRequests += 1;
    this.#maxActiveRequests = Math.max(this.#maxActiveRequests, this.#activeRequests);

    try {
      if (this.#pauseReads) {
        await new Promise<void>((resolve) => {
          this.#pendingReleases.push(resolve);
          this.#notifyPendingWaiters();
        });
      }
      if (response.kind === "error") {
        throw response.error;
      }
      return validateModbusWords(response.words, ownedRequest.count);
    } finally {
      this.#activeRequests -= 1;
    }
  }

  public assertResponsesConsumed(): void {
    if (this.#responses.length !== 0) {
      throw new Error(`Fake Modbus transport has ${this.#responses.length} unconsumed responses`);
    }
  }

  public waitForPendingReads(count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("Pending read count must be a non-negative integer");
    }
    if (this.pendingReads >= count) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.#pendingWaiters.push({ target: count, resolve });
    });
  }

  public releaseNextRead(): void {
    const release = this.#pendingReleases.shift();
    if (release === undefined) {
      throw new Error("No paused fake Modbus read is pending");
    }
    release();
  }

  public releaseAllReads(): void {
    while (this.#pendingReleases.length > 0) {
      this.releaseNextRead();
    }
  }

  #notifyPendingWaiters(): void {
    for (let index = this.#pendingWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.#pendingWaiters[index];
      if (waiter !== undefined && this.pendingReads >= waiter.target) {
        this.#pendingWaiters.splice(index, 1);
        waiter.resolve();
      }
    }
  }
}
