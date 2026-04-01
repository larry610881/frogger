import { describe, it, expect } from 'vitest';
import { ReadWriteLock } from '../concurrency.js';

/** Helper: create a task that resolves after `ms` and records start/end times */
function timedTask(ms: number) {
  const record = { start: 0, end: 0 };
  const run = async () => {
    record.start = Date.now();
    await new Promise(r => setTimeout(r, ms));
    record.end = Date.now();
  };
  return { record, run };
}

describe('ReadWriteLock', () => {
  it('allows multiple concurrent readers', async () => {
    const lock = new ReadWriteLock();
    const t1 = timedTask(50);
    const t2 = timedTask(50);
    const t3 = timedTask(50);

    const run = async (task: ReturnType<typeof timedTask>) => {
      const release = await lock.acquireRead();
      try { await task.run(); } finally { release(); }
    };

    await Promise.all([run(t1), run(t2), run(t3)]);

    // All should have started at roughly the same time (within 30ms)
    const starts = [t1.record.start, t2.record.start, t3.record.start];
    const maxGap = Math.max(...starts) - Math.min(...starts);
    expect(maxGap).toBeLessThan(30);
  });

  it('serializes writers', async () => {
    const lock = new ReadWriteLock();
    const order: number[] = [];

    const writeTask = async (id: number) => {
      const release = await lock.acquireWrite();
      try {
        order.push(id);
        await new Promise(r => setTimeout(r, 30));
      } finally {
        release();
      }
    };

    await Promise.all([writeTask(1), writeTask(2), writeTask(3)]);

    // All three should have executed (order may vary but all present)
    expect(order).toHaveLength(3);
    expect(order).toContain(1);
    expect(order).toContain(2);
    expect(order).toContain(3);
  });

  it('write waits for active readers to finish', async () => {
    const lock = new ReadWriteLock();
    const events: string[] = [];

    const readRelease = await lock.acquireRead();
    events.push('read-acquired');

    // Start write in background — it should wait
    const writePromise = lock.acquireWrite().then(release => {
      events.push('write-acquired');
      return release;
    });

    // Give write a chance to acquire (it shouldn't)
    await new Promise(r => setTimeout(r, 20));
    expect(events).toEqual(['read-acquired']);

    // Release read → write should now proceed
    readRelease();
    const writeRelease = await writePromise;
    expect(events).toEqual(['read-acquired', 'write-acquired']);
    writeRelease();
  });

  it('readers wait for active writer to finish', async () => {
    const lock = new ReadWriteLock();
    const events: string[] = [];

    const writeRelease = await lock.acquireWrite();
    events.push('write-acquired');

    // Start read in background — it should wait
    const readPromise = lock.acquireRead().then(release => {
      events.push('read-acquired');
      return release;
    });

    await new Promise(r => setTimeout(r, 20));
    expect(events).toEqual(['write-acquired']);

    // Release write → read should proceed
    writeRelease();
    const readRelease = await readPromise;
    expect(events).toEqual(['write-acquired', 'read-acquired']);
    readRelease();
  });

  it('writer priority: new readers queue behind waiting writer', async () => {
    const lock = new ReadWriteLock();
    const events: string[] = [];

    // Hold a read lock
    const r1Release = await lock.acquireRead();

    // Queue a writer (will wait for reader)
    const writePromise = lock.acquireWrite().then(release => {
      events.push('write');
      return release;
    });

    // Queue another reader (should wait behind the writer)
    const r2Promise = lock.acquireRead().then(release => {
      events.push('read2');
      return release;
    });

    await new Promise(r => setTimeout(r, 20));
    expect(events).toEqual([]);

    // Release first reader → writer should go first, then reader
    r1Release();

    const wRelease = await writePromise;
    wRelease();
    const r2Release = await r2Promise;
    r2Release();

    expect(events).toEqual(['write', 'read2']);
  });

  it('respects maxReaders limit', async () => {
    const lock = new ReadWriteLock(2); // Only 2 concurrent readers
    const events: string[] = [];

    const r1Release = await lock.acquireRead();
    const r2Release = await lock.acquireRead();
    events.push('r1', 'r2');

    // Third reader should wait
    const r3Promise = lock.acquireRead().then(release => {
      events.push('r3');
      return release;
    });

    await new Promise(r => setTimeout(r, 20));
    expect(events).toEqual(['r1', 'r2']);

    // Release one → third reader should proceed
    r1Release();
    const r3Release = await r3Promise;
    expect(events).toEqual(['r1', 'r2', 'r3']);
    r2Release();
    r3Release();
  });

  it('rejects on abort signal', async () => {
    const lock = new ReadWriteLock();

    // Hold write lock
    const writeRelease = await lock.acquireWrite();

    const controller = new AbortController();

    // Try to acquire read with abort signal
    const readPromise = lock.acquireRead(controller.signal);

    // Abort before it can acquire
    controller.abort();

    await expect(readPromise).rejects.toThrow('Aborted');
    writeRelease();
  });

  it('rejects immediately if already aborted', async () => {
    const lock = new ReadWriteLock();
    const controller = new AbortController();
    controller.abort();

    await expect(lock.acquireRead(controller.signal)).rejects.toThrow('Aborted');
    await expect(lock.acquireWrite(controller.signal)).rejects.toThrow('Aborted');
  });
});
