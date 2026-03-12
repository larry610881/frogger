import { MAX_BACKGROUND_TASKS } from '@frogger/shared';

export type BackgroundTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundTaskInfo {
  id: string;
  prompt: string;
  status: BackgroundTaskStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface BackgroundTaskRunner {
  run: (opts: { signal: AbortSignal }) => Promise<void>;
}

export interface BackgroundTaskManagerOptions {
  onComplete?: (task: BackgroundTaskInfo) => void;
}

interface InternalTask extends BackgroundTaskInfo {
  abortController: AbortController;
}

let nextId = 1;

export class BackgroundTaskManager {
  private tasks = new Map<string, InternalTask>();
  private onComplete?: (task: BackgroundTaskInfo) => void;

  constructor(options?: BackgroundTaskManagerOptions) {
    this.onComplete = options?.onComplete;
  }

  get runningCount(): number {
    return [...this.tasks.values()].filter(t => t.status === 'running').length;
  }

  /**
   * Start a new background task. Returns the task ID.
   * Throws if the maximum concurrent task limit is reached.
   */
  start(prompt: string, runner: BackgroundTaskRunner): string {
    if (this.runningCount >= MAX_BACKGROUND_TASKS) {
      throw new Error(`Maximum background tasks (${MAX_BACKGROUND_TASKS}) reached. Cancel a task first.`);
    }

    const id = `bg-${nextId++}`;
    const abortController = new AbortController();

    const task: InternalTask = {
      id,
      prompt,
      status: 'running',
      startedAt: Date.now(),
      abortController,
    };

    this.tasks.set(id, task);

    // Fire and forget — lifecycle managed via callbacks
    runner.run({ signal: abortController.signal }).then(
      () => {
        if (task.status === 'running') {
          task.status = 'completed';
          task.completedAt = Date.now();
          this.onComplete?.(this.toInfo(task));
        }
      },
      (err: unknown) => {
        if (task.status === 'running') {
          task.status = 'failed';
          task.completedAt = Date.now();
          task.error = err instanceof Error ? err.message : String(err);
          this.onComplete?.(this.toInfo(task));
        }
      },
    );

    return id;
  }

  /**
   * Get task info by ID.
   */
  get(id: string): BackgroundTaskInfo | undefined {
    const task = this.tasks.get(id);
    return task ? this.toInfo(task) : undefined;
  }

  /**
   * List all tasks (most recent first).
   */
  list(): BackgroundTaskInfo[] {
    return [...this.tasks.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(t => this.toInfo(t));
  }

  /**
   * Cancel a running task.
   */
  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return false;

    task.abortController.abort();
    task.status = 'cancelled';
    task.completedAt = Date.now();
    return true;
  }

  /**
   * Cancel all running tasks.
   */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        task.abortController.abort();
        task.status = 'cancelled';
        task.completedAt = Date.now();
      }
    }
  }

  private toInfo(task: InternalTask): BackgroundTaskInfo {
    return {
      id: task.id,
      prompt: task.prompt,
      status: task.status,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
    };
  }
}
