import {
  createModbusReadRequest,
  createModbusWriteRequest,
  type ModbusReadRequest,
  type ModbusWriteRequest,
  type ModbusWriteTransport,
  validateModbusWords,
} from "../../src/transport/types.js";

export type FakeModbusResponse =
  | Readonly<{ readonly kind: "words"; readonly words: readonly number[] }>
  | Readonly<{ readonly error: unknown; readonly kind: "error" }>;

export type FakeModbusWriteResponse =
  | Readonly<{ readonly kind: "write_ok" }>
  | Readonly<{ readonly error: unknown; readonly kind: "error" }>;

export interface FakeModbusTransportOptions {
  readonly allowMismatchedResponseCount?: boolean;
  readonly initiallyConnected?: boolean;
  readonly pauseReads?: boolean;
  readonly pauseWrites?: boolean;
  readonly writeResponses?: readonly FakeModbusWriteResponse[];
}

export type FakeModbusTransportEvent =
  | Readonly<{ readonly kind: "connect" }>
  | Readonly<{ readonly kind: "close" }>
  | Readonly<{ readonly kind: "destroy" }>
  | Readonly<{ readonly kind: "read"; readonly request: ModbusReadRequest }>
  | Readonly<{ readonly kind: "write"; readonly request: ModbusWriteRequest }>;

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

function cloneWriteResponse(response: FakeModbusWriteResponse): FakeModbusWriteResponse {
  if (response.kind === "error") {
    return Object.freeze({ kind: "error", error: response.error });
  }
  return Object.freeze({ kind: "write_ok" });
}

export class FakeModbusTransport implements ModbusWriteTransport {
  readonly #responses: FakeModbusResponse[];
  readonly #writeResponses: FakeModbusWriteResponse[];
  readonly #events: FakeModbusTransportEvent[] = [];
  readonly #allowMismatchedResponseCount: boolean;
  readonly #pauseReads: boolean;
  readonly #pauseWrites: boolean;
  readonly #pendingReadReleases: (() => void)[] = [];
  readonly #pendingReadWaiters: PendingWaiter[] = [];
  readonly #pendingWriteReleases: (() => void)[] = [];
  readonly #pendingWriteWaiters: PendingWaiter[] = [];
  #connected = false;
  #activeRequests = 0;
  #maxActiveRequests = 0;

  public constructor(
    responses: readonly FakeModbusResponse[],
    options: FakeModbusTransportOptions = {},
  ) {
    this.#responses = responses.map((response) => cloneResponse(response));
    this.#writeResponses = (options.writeResponses ?? []).map((response) =>
      cloneWriteResponse(response),
    );
    this.#allowMismatchedResponseCount = options.allowMismatchedResponseCount ?? false;
    this.#pauseReads = options.pauseReads ?? false;
    this.#pauseWrites = options.pauseWrites ?? false;
    this.#connected = options.initiallyConnected ?? false;
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

  public get remainingWriteResponses(): number {
    return this.#writeResponses.length;
  }

  public get activeRequests(): number {
    return this.#activeRequests;
  }

  public get maxActiveRequests(): number {
    return this.#maxActiveRequests;
  }

  public get pendingReads(): number {
    return this.#pendingReadReleases.length;
  }

  public get pendingWrites(): number {
    return this.#pendingWriteReleases.length;
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
      validateModbusWords(
        response.words,
        this.#allowMismatchedResponseCount ? undefined : ownedRequest.count,
      );
    }

    this.#responses.shift();
    this.#events.push(Object.freeze({ kind: "read", request: ownedRequest }));
    this.#activeRequests += 1;
    this.#maxActiveRequests = Math.max(this.#maxActiveRequests, this.#activeRequests);

    try {
      if (this.#pauseReads) {
        await new Promise<void>((resolve) => {
          this.#pendingReadReleases.push(resolve);
          this.#notifyPendingReadWaiters();
        });
      }
      if (response.kind === "error") {
        throw response.error;
      }
      return validateModbusWords(
        response.words,
        this.#allowMismatchedResponseCount ? undefined : ownedRequest.count,
      );
    } finally {
      this.#activeRequests -= 1;
    }
  }

  public async write(request: ModbusWriteRequest): Promise<void> {
    if (!this.#connected) {
      throw new Error("Fake Modbus transport is disconnected");
    }

    const ownedRequest = createModbusWriteRequest(request);
    const response = this.#writeResponses[0];
    if (response === undefined) {
      throw new Error("Fake Modbus write response script is exhausted");
    }

    this.#writeResponses.shift();
    this.#events.push(Object.freeze({ kind: "write", request: ownedRequest }));
    this.#activeRequests += 1;
    this.#maxActiveRequests = Math.max(this.#maxActiveRequests, this.#activeRequests);

    try {
      if (this.#pauseWrites) {
        await new Promise<void>((resolve) => {
          this.#pendingWriteReleases.push(resolve);
          this.#notifyPendingWriteWaiters();
        });
      }
      if (response.kind === "error") {
        throw response.error;
      }
    } finally {
      this.#activeRequests -= 1;
    }
  }

  public assertResponsesConsumed(): void {
    const remaining = this.#responses.length + this.#writeResponses.length;
    if (remaining !== 0) {
      throw new Error(`Fake Modbus transport has ${String(remaining)} unconsumed responses`);
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
      this.#pendingReadWaiters.push({ target: count, resolve });
    });
  }

  public waitForPendingWrites(count: number): Promise<void> {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("Pending write count must be a non-negative integer");
    }
    if (this.pendingWrites >= count) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.#pendingWriteWaiters.push({ target: count, resolve });
    });
  }

  public releaseNextRead(): void {
    const release = this.#pendingReadReleases.shift();
    if (release === undefined) {
      throw new Error("No paused fake Modbus read is pending");
    }
    release();
  }

  public releaseAllReads(): void {
    while (this.#pendingReadReleases.length > 0) {
      this.releaseNextRead();
    }
  }

  public releaseNextWrite(): void {
    const release = this.#pendingWriteReleases.shift();
    if (release === undefined) {
      throw new Error("No paused fake Modbus write is pending");
    }
    release();
  }

  public releaseAllWrites(): void {
    while (this.#pendingWriteReleases.length > 0) {
      this.releaseNextWrite();
    }
  }

  #notifyPendingReadWaiters(): void {
    for (let index = this.#pendingReadWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.#pendingReadWaiters[index];
      if (waiter !== undefined && this.pendingReads >= waiter.target) {
        this.#pendingReadWaiters.splice(index, 1);
        waiter.resolve();
      }
    }
  }

  #notifyPendingWriteWaiters(): void {
    for (let index = this.#pendingWriteWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.#pendingWriteWaiters[index];
      if (waiter !== undefined && this.pendingWrites >= waiter.target) {
        this.#pendingWriteWaiters.splice(index, 1);
        waiter.resolve();
      }
    }
  }
}
