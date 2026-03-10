import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock logger to silence debug logs during tests
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock os.homedir() so SESSIONS_DIR resolves to a temp directory.
// This MUST be declared before the dynamic import of session.ts because
// SESSIONS_DIR is computed at module load time.
let tmpHome: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => tmpHome,
    },
  };
});

// Use dynamic import so the mock is in place when the module evaluates SESSIONS_DIR
let SessionManager: typeof import('../session.js').SessionManager;

describe('SessionManager', () => {
  let sessionsDir: string;
  let manager: InstanceType<typeof SessionManager>;

  beforeAll(async () => {
    // Create temp home directory before module loads
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'session-test-home-'));
    // Now dynamically import so the module picks up our mocked homedir
    const mod = await import('../session.js');
    SessionManager = mod.SessionManager;
  });

  beforeEach(async () => {
    // Compute the sessions dir that the module will use
    sessionsDir = path.join(tmpHome, '.frogger', 'sessions');
    // Ensure a clean state for each test
    await fs.rm(sessionsDir, { recursive: true, force: true });
    manager = new SessionManager();
  });

  afterAll(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  function makeOptions(overrides: Record<string, unknown> = {}) {
    return {
      workingDirectory: '/home/user/project',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      messages: [] as import('ai').ModelMessage[],
      totalTokens: 100,
      ...overrides,
    };
  }

  // ─── save() ────────────────────────────────────────────────────────

  describe('save()', () => {
    it('returns a generated ID', async () => {
      const id = await manager.save(makeOptions());

      expect(id).toMatch(/^\d+-[a-f0-9]{6}$/);
    });

    it('creates a JSON file with correct structure', async () => {
      const id = await manager.save(makeOptions({
        workingDirectory: '/test/dir',
        provider: 'openai',
        model: 'gpt-4o',
        totalTokens: 42,
      }));

      const filePath = path.join(sessionsDir, `${id}.json`);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      expect(content).toMatchObject({
        id,
        workingDirectory: '/test/dir',
        provider: 'openai',
        model: 'gpt-4o',
        messages: [],
        totalTokens: 42,
      });
      expect(content.createdAt).toBeDefined();
      expect(content.updatedAt).toBeDefined();
    });

    it('generates unique IDs for the same workingDirectory', async () => {
      const id1 = await manager.save(makeOptions());
      // Ensure a different timestamp by waiting a tick
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions());

      expect(id1).not.toBe(id2);
      // Same workingDirectory produces the same hash suffix
      const hash1 = id1.split('-')[1];
      const hash2 = id2.split('-')[1];
      expect(hash1).toBe(hash2);
    });
  });

  // ─── save() + load() roundtrip ────────────────────────────────────

  describe('save() + load() roundtrip', () => {
    it('preserves all fields', async () => {
      const messages = [
        { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      ] as import('ai').ModelMessage[];
      const opts = makeOptions({
        messages,
        totalTokens: 999,
      });

      const id = await manager.save(opts);
      const loaded = await manager.load(id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(id);
      expect(loaded!.workingDirectory).toBe('/home/user/project');
      expect(loaded!.provider).toBe('anthropic');
      expect(loaded!.model).toBe('claude-sonnet-4-20250514');
      expect(loaded!.messages).toEqual(messages);
      expect(loaded!.totalTokens).toBe(999);
      expect(loaded!.createdAt).toBeDefined();
      expect(loaded!.updatedAt).toBeDefined();
    });
  });

  // ─── load() ────────────────────────────────────────────────────────

  describe('load()', () => {
    it('returns null for non-existent ID', async () => {
      const result = await manager.load('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ─── save() with existingId ────────────────────────────────────────

  describe('save() with existingId', () => {
    it('updates the file when using existingId', async () => {
      const id = await manager.save(makeOptions({ totalTokens: 10 }));
      await manager.save(makeOptions({ existingId: id, totalTokens: 50 }));

      const loaded = await manager.load(id);
      expect(loaded).not.toBeNull();
      expect(loaded!.totalTokens).toBe(50);
    });

    it('preserves original createdAt when updating', async () => {
      const id = await manager.save(makeOptions());
      const original = await manager.load(id);
      const originalCreatedAt = original!.createdAt;

      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      await manager.save(makeOptions({ existingId: id, totalTokens: 200 }));

      const updated = await manager.load(id);
      expect(updated!.createdAt).toBe(originalCreatedAt);
      // updatedAt should be different (or at least not earlier)
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalCreatedAt).getTime(),
      );
    });

    it('uses current date as createdAt when existingId file does not exist', async () => {
      const before = new Date().toISOString();
      const id = await manager.save(makeOptions({ existingId: 'phantom-id' }));
      const after = new Date().toISOString();

      const loaded = await manager.load(id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('phantom-id');
      // createdAt should be between before and after
      expect(loaded!.createdAt >= before).toBe(true);
      expect(loaded!.createdAt <= after).toBe(true);
    });
  });

  // ─── list() ────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns sessions sorted by filename (newest first)', async () => {
      // Create sessions with small delays to ensure different timestamps
      const id1 = await manager.save(makeOptions({ totalTokens: 1 }));
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions({ totalTokens: 2 }));
      await new Promise(r => setTimeout(r, 5));
      const id3 = await manager.save(makeOptions({ totalTokens: 3 }));

      const sessions = await manager.list();

      expect(sessions).toHaveLength(3);
      // Filenames are timestamp-based, so reverse sort means newest first
      expect(sessions[0]!.id).toBe(id3);
      expect(sessions[1]!.id).toBe(id2);
      expect(sessions[2]!.id).toBe(id1);
    });

    it('respects limit parameter', async () => {
      await manager.save(makeOptions({ totalTokens: 1 }));
      await new Promise(r => setTimeout(r, 5));
      await manager.save(makeOptions({ totalTokens: 2 }));
      await new Promise(r => setTimeout(r, 5));
      const id3 = await manager.save(makeOptions({ totalTokens: 3 }));

      const sessions = await manager.list(1);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe(id3);
    });

    it('returns empty array when no sessions', async () => {
      const sessions = await manager.list();
      expect(sessions).toEqual([]);
    });

    it('skips corrupt JSON files', async () => {
      // Create a valid session
      const id = await manager.save(makeOptions({ totalTokens: 42 }));

      // Write a corrupt JSON file with a name that sorts after the valid one
      await fs.mkdir(sessionsDir, { recursive: true });
      await fs.writeFile(
        path.join(sessionsDir, '9999999999999-aaaaaa.json'),
        'this is not json{{{',
        'utf-8',
      );

      const sessions = await manager.list();

      // Should still return the valid session
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe(id);
      expect(sessions[0]!.totalTokens).toBe(42);
    });
  });

  // ─── getLatest() ──────────────────────────────────────────────────

  describe('getLatest()', () => {
    it('returns the most recent session', async () => {
      await manager.save(makeOptions({ totalTokens: 1 }));
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions({ totalTokens: 2 }));

      const latest = await manager.getLatest();

      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(id2);
      expect(latest!.totalTokens).toBe(2);
    });

    it('returns null when no sessions exist', async () => {
      const latest = await manager.getLatest();
      expect(latest).toBeNull();
    });
  });

  // ─── getLatestForDirectory() ──────────────────────────────────────

  describe('getLatestForDirectory()', () => {
    it('returns matching session for the given directory', async () => {
      await manager.save(makeOptions({ workingDirectory: '/other/dir', totalTokens: 1 }));
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions({ workingDirectory: '/target/dir', totalTokens: 2 }));
      await new Promise(r => setTimeout(r, 5));
      await manager.save(makeOptions({ workingDirectory: '/another/dir', totalTokens: 3 }));

      const result = await manager.getLatestForDirectory('/target/dir');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id2);
      expect(result!.workingDirectory).toBe('/target/dir');
    });

    it('returns null when no match found', async () => {
      await manager.save(makeOptions({ workingDirectory: '/some/dir' }));

      const result = await manager.getLatestForDirectory('/no/match');
      expect(result).toBeNull();
    });

    it('skips corrupt files and continues searching', async () => {
      const id = await manager.save(makeOptions({ workingDirectory: '/find/me' }));

      // Write a corrupt JSON file that sorts after the valid one
      await fs.writeFile(
        path.join(sessionsDir, '9999999999999-ffffff.json'),
        '{broken json!!!',
        'utf-8',
      );

      const result = await manager.getLatestForDirectory('/find/me');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
    });

    it('returns the most recent matching session when multiple exist', async () => {
      await manager.save(makeOptions({ workingDirectory: '/target', totalTokens: 10 }));
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions({ workingDirectory: '/target', totalTokens: 20 }));

      const result = await manager.getLatestForDirectory('/target');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id2);
      expect(result!.totalTokens).toBe(20);
    });
  });

  // ─── delete() ─────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the session file', async () => {
      const id = await manager.save(makeOptions());

      // Verify it exists
      expect(await manager.load(id)).not.toBeNull();

      await manager.delete(id);

      // Verify it's gone
      expect(await manager.load(id)).toBeNull();
    });

    it('is idempotent (no error for non-existent ID)', async () => {
      // Should not throw
      await expect(manager.delete('does-not-exist')).resolves.toBeUndefined();
    });
  });

  // ─── cleanup() ───────────────────────────────────────────────────

  describe('cleanup()', () => {
    it('removes oldest sessions when count exceeds maxCount', async () => {
      // Create 5 sessions with distinct timestamps
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(await manager.save(makeOptions({ totalTokens: i })));
        await new Promise(r => setTimeout(r, 5));
      }

      // Keep only the 3 newest
      await manager.cleanup({ maxCount: 3, maxAgeDays: 9999 });

      // The 2 oldest should be gone
      expect(await manager.load(ids[0]!)).toBeNull();
      expect(await manager.load(ids[1]!)).toBeNull();
      // The 3 newest should remain
      expect(await manager.load(ids[2]!)).not.toBeNull();
      expect(await manager.load(ids[3]!)).not.toBeNull();
      expect(await manager.load(ids[4]!)).not.toBeNull();
    });

    it('removes sessions older than maxAgeDays', async () => {
      // Create a session with a createdAt 60 days ago
      const oldId = await manager.save(makeOptions({ totalTokens: 1 }));
      const oldSession = await manager.load(oldId);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      // Manually overwrite the file with an old createdAt
      const oldFilePath = path.join(sessionsDir, `${oldId}.json`);
      await fs.writeFile(
        oldFilePath,
        JSON.stringify({ ...oldSession, createdAt: sixtyDaysAgo }),
        'utf-8',
      );

      // Create a recent session
      await new Promise(r => setTimeout(r, 5));
      const recentId = await manager.save(makeOptions({ totalTokens: 2 }));

      await manager.cleanup({ maxCount: 9999, maxAgeDays: 30 });

      // Old session should be removed
      expect(await manager.load(oldId)).toBeNull();
      // Recent session should remain
      expect(await manager.load(recentId)).not.toBeNull();
    });

    it('keeps sessions within both limits', async () => {
      // Create 3 recent sessions
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push(await manager.save(makeOptions({ totalTokens: i })));
        await new Promise(r => setTimeout(r, 5));
      }

      // maxCount=100, maxAgeDays=30 — all 3 should survive
      await manager.cleanup({ maxCount: 100, maxAgeDays: 30 });

      for (const id of ids) {
        expect(await manager.load(id)).not.toBeNull();
      }
    });

    it('handles missing/corrupt session files gracefully', async () => {
      await fs.mkdir(sessionsDir, { recursive: true });

      // Write a corrupt JSON file
      await fs.writeFile(
        path.join(sessionsDir, '0000000000001-aaaaaa.json'),
        'not valid json{{{',
        'utf-8',
      );

      // Write a valid session
      const id = await manager.save(makeOptions({ totalTokens: 42 }));

      // Should not throw
      await expect(manager.cleanup({ maxCount: 100, maxAgeDays: 30 })).resolves.toBeUndefined();

      // Valid session should still exist
      expect(await manager.load(id)).not.toBeNull();
    });

    it('uses default options when called without arguments', async () => {
      // Create 2 recent sessions — both should survive with defaults (maxCount=100, maxAgeDays=30)
      const id1 = await manager.save(makeOptions({ totalTokens: 1 }));
      await new Promise(r => setTimeout(r, 5));
      const id2 = await manager.save(makeOptions({ totalTokens: 2 }));

      await manager.cleanup();

      expect(await manager.load(id1)).not.toBeNull();
      expect(await manager.load(id2)).not.toBeNull();
    });

    it('cleanup after save is called automatically (non-blocking)', async () => {
      // Spy on cleanup
      const cleanupSpy = vi.spyOn(manager, 'cleanup');

      await manager.save(makeOptions());

      // cleanup should have been called (fire-and-forget after save)
      // Wait a tick for the microtask to settle
      await new Promise(r => setTimeout(r, 10));

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      cleanupSpy.mockRestore();
    });
  });
});
