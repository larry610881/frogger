import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundTaskManager, type BackgroundTaskInfo } from '../background-task.js';

describe('BackgroundTaskManager', () => {
  let manager: BackgroundTaskManager;

  beforeEach(() => {
    manager = new BackgroundTaskManager();
  });

  afterEach(() => {
    manager.cancelAll();
  });

  describe('task lifecycle', () => {
    it('starts a task and assigns an id', () => {
      const id = manager.start('test prompt', { run: vi.fn().mockResolvedValue(undefined) });
      expect(id).toBeTruthy();
      expect(manager.get(id)?.status).toBe('running');
      expect(manager.get(id)?.prompt).toBe('test prompt');
    });

    it('lists running tasks', () => {
      manager.start('task 1', { run: vi.fn().mockResolvedValue(undefined) });
      manager.start('task 2', { run: vi.fn().mockResolvedValue(undefined) });

      const tasks = manager.list();
      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.status === 'running')).toBe(true);
    });

    it('marks task as completed when run resolves', async () => {
      let resolveRun!: () => void;
      const runPromise = new Promise<void>(r => { resolveRun = r; });
      const id = manager.start('task', {
        run: vi.fn().mockReturnValue(runPromise),
      });

      expect(manager.get(id)?.status).toBe('running');

      resolveRun();
      // Wait for microtask
      await new Promise(r => setTimeout(r, 10));

      expect(manager.get(id)?.status).toBe('completed');
    });

    it('marks task as failed when run rejects', async () => {
      const id = manager.start('task', {
        run: vi.fn().mockRejectedValue(new Error('boom')),
      });

      // Wait for microtask
      await new Promise(r => setTimeout(r, 10));

      const task = manager.get(id)!;
      expect(task.status).toBe('failed');
      expect(task.error).toBe('boom');
    });

    it('marks task as cancelled on cancel', async () => {
      let resolveRun!: () => void;
      const runPromise = new Promise<void>(r => { resolveRun = r; });
      const id = manager.start('task', {
        run: vi.fn().mockReturnValue(runPromise),
      });

      manager.cancel(id);
      expect(manager.get(id)?.status).toBe('cancelled');

      resolveRun(); // cleanup
    });

    it('returns undefined for unknown task id', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });
  });

  describe('concurrency limit', () => {
    it('enforces MAX_BACKGROUND_TASKS limit', () => {
      // Start 5 tasks (max)
      for (let i = 0; i < 5; i++) {
        manager.start(`task ${i}`, { run: vi.fn().mockResolvedValue(undefined) });
      }

      // 6th should throw
      expect(() => {
        manager.start('task 6', { run: vi.fn().mockResolvedValue(undefined) });
      }).toThrow(/maximum.*background.*task/i);
    });

    it('allows new tasks after previous ones complete', async () => {
      const resolvers: Array<() => void> = [];
      for (let i = 0; i < 5; i++) {
        const promise = new Promise<void>(r => { resolvers.push(r); });
        manager.start(`task ${i}`, { run: vi.fn().mockReturnValue(promise) });
      }

      // Complete one
      resolvers[0]!();
      await new Promise(r => setTimeout(r, 10));

      // Now we can start another
      const id = manager.start('task 6', { run: vi.fn().mockResolvedValue(undefined) });
      expect(id).toBeTruthy();

      // Cleanup
      resolvers.slice(1).forEach(r => r());
    });
  });

  describe('AbortSignal', () => {
    it('passes AbortSignal to the run function', () => {
      const runFn = vi.fn().mockResolvedValue(undefined);
      manager.start('task', { run: runFn });

      expect(runFn).toHaveBeenCalledWith(expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
    });

    it('aborts the signal on cancel', () => {
      const signals: AbortSignal[] = [];
      const runFn = vi.fn().mockImplementation(({ signal }) => {
        signals.push(signal);
        return new Promise(() => {}); // never resolves
      });

      const id = manager.start('task', { run: runFn });
      expect(signals[0]?.aborted).toBe(false);

      manager.cancel(id);
      expect(signals[0]?.aborted).toBe(true);
    });
  });

  describe('onComplete callback', () => {
    it('calls onComplete when task completes successfully', async () => {
      const onComplete = vi.fn();
      manager = new BackgroundTaskManager({ onComplete });

      manager.start('done task', { run: vi.fn().mockResolvedValue(undefined) });
      await new Promise(r => setTimeout(r, 10));

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'done task', status: 'completed' }),
      );
    });

    it('calls onComplete when task fails', async () => {
      const onComplete = vi.fn();
      manager = new BackgroundTaskManager({ onComplete });

      manager.start('fail task', { run: vi.fn().mockRejectedValue(new Error('oops')) });
      await new Promise(r => setTimeout(r, 10));

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'fail task', status: 'failed', error: 'oops' }),
      );
    });

    it('does not call onComplete on cancel', () => {
      const onComplete = vi.fn();
      manager = new BackgroundTaskManager({ onComplete });

      const id = manager.start('cancel task', {
        run: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      manager.cancel(id);

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('cancelAll', () => {
    it('cancels all running tasks', () => {
      manager.start('a', { run: vi.fn().mockReturnValue(new Promise(() => {})) });
      manager.start('b', { run: vi.fn().mockReturnValue(new Promise(() => {})) });

      manager.cancelAll();

      const tasks = manager.list();
      expect(tasks.every(t => t.status === 'cancelled')).toBe(true);
    });
  });

  describe('runningCount', () => {
    it('tracks running task count correctly', async () => {
      expect(manager.runningCount).toBe(0);

      let resolveRun!: () => void;
      const runPromise = new Promise<void>(r => { resolveRun = r; });
      manager.start('a', { run: vi.fn().mockReturnValue(runPromise) });
      expect(manager.runningCount).toBe(1);

      manager.start('b', { run: vi.fn().mockReturnValue(new Promise(() => {})) });
      expect(manager.runningCount).toBe(2);

      resolveRun();
      await new Promise(r => setTimeout(r, 10));
      expect(manager.runningCount).toBe(1);

      manager.cancelAll();
      expect(manager.runningCount).toBe(0);
    });
  });
});
