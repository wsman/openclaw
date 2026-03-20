export class SingleWriterQueue {
  #tail: Promise<unknown> = Promise.resolve();

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(task, task);
    this.#tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
