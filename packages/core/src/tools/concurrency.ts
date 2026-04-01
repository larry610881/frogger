/**
 * ReadWriteLock for tool execution concurrency control.
 *
 * Read tools (permissionLevel: 'auto') acquire shared locks — up to maxReaders concurrent.
 * Write tools (permissionLevel: 'confirm') acquire exclusive locks — one at a time,
 * waiting for all active readers to finish first.
 *
 * Writer-priority: when a writer is waiting, new readers queue behind it
 * to prevent writer starvation.
 */
export class ReadWriteLock {
  private readers = 0;
  private writing = false;
  private readQueue: Array<() => void> = [];
  private writeQueue: Array<() => void> = [];
  private readonly maxReaders: number;

  constructor(maxReaders = 10) {
    this.maxReaders = maxReaders;
  }

  /**
   * Acquire a shared (read) lock. Multiple readers can hold the lock concurrently.
   * Blocks if a writer is active or waiting (writer priority).
   * Returns a release function that MUST be called when done.
   */
  async acquireRead(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (!this.writing && this.writeQueue.length === 0 && this.readers < this.maxReaders) {
      this.readers++;
      return () => this.releaseRead();
    }

    return new Promise<() => void>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.readQueue.indexOf(enqueue);
        if (idx !== -1) this.readQueue.splice(idx, 1);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      const enqueue = () => {
        signal?.removeEventListener('abort', onAbort);
        this.readers++;
        resolve(() => this.releaseRead());
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      this.readQueue.push(enqueue);
    });
  }

  /**
   * Acquire an exclusive (write) lock. Only one writer at a time.
   * Waits for all active readers and the current writer to finish.
   * Returns a release function that MUST be called when done.
   */
  async acquireWrite(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (!this.writing && this.readers === 0) {
      this.writing = true;
      return () => this.releaseWrite();
    }

    return new Promise<() => void>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.writeQueue.indexOf(enqueue);
        if (idx !== -1) this.writeQueue.splice(idx, 1);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      const enqueue = () => {
        signal?.removeEventListener('abort', onAbort);
        this.writing = true;
        resolve(() => this.releaseWrite());
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      this.writeQueue.push(enqueue);
    });
  }

  private releaseRead(): void {
    this.readers--;

    // If no more readers and a writer is waiting, let the writer proceed
    if (this.readers === 0 && this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      next();
    } else {
      // Try to admit more readers (if a writer was blocking them and is now done)
      this.drainReaders();
    }
  }

  private releaseWrite(): void {
    this.writing = false;

    // Writer priority: if another writer is waiting, let it go first
    if (this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      next();
      return;
    }

    // Otherwise, drain waiting readers
    this.drainReaders();
  }

  private drainReaders(): void {
    while (
      this.readQueue.length > 0 &&
      !this.writing &&
      this.writeQueue.length === 0 &&
      this.readers < this.maxReaders
    ) {
      const next = this.readQueue.shift()!;
      next();
    }
  }
}
