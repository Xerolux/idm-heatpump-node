export class FifoGate {
  #tail: Promise<void> = Promise.resolve();

  public async runExclusive<T>(operation: () => Promise<T> | T): Promise<T> {
    const predecessor = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await predecessor;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
