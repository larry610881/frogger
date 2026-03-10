import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  matchesRule,
  buildPermissionRule,
  resolvePermission,
  loadPermissionRules,
  savePermissionRule,
  getProjectPermissionsPath,
  getGlobalPermissionsPath,
} from '../rules.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('matchesRule', () => {
  it('matches exact tool name', () => {
    expect(matchesRule('write-file', 'write-file', {})).toBe(true);
  });

  it('does not match different tool name', () => {
    expect(matchesRule('write-file', 'read-file', {})).toBe(false);
  });

  it('matches "bash" rule against any bash call', () => {
    expect(matchesRule('bash', 'bash', { command: 'anything' })).toBe(true);
  });

  it('does not match bash rule against non-bash tool', () => {
    expect(matchesRule('bash', 'write-file', {})).toBe(false);
  });

  it('matches bash prefix: "bash:npm test" matches "npm test"', () => {
    expect(matchesRule('bash:npm test', 'bash', { command: 'npm test' })).toBe(true);
  });

  it('matches bash prefix: "bash:npm test" matches "npm test --watch"', () => {
    expect(matchesRule('bash:npm test', 'bash', { command: 'npm test --watch' })).toBe(true);
  });

  it('does not match bash prefix: "bash:npm test" vs "npm run build"', () => {
    expect(matchesRule('bash:npm test', 'bash', { command: 'npm run build' })).toBe(false);
  });

  it('matches bash glob: "bash:git *" matches "git status"', () => {
    expect(matchesRule('bash:git *', 'bash', { command: 'git status' })).toBe(true);
  });

  it('matches bash glob: "bash:git *" matches "git commit -m fix"', () => {
    expect(matchesRule('bash:git *', 'bash', { command: 'git commit -m fix' })).toBe(true);
  });

  it('does not match bash glob: "bash:git *" vs "npm test"', () => {
    expect(matchesRule('bash:git *', 'bash', { command: 'npm test' })).toBe(false);
  });

  it('does not match bash-prefixed rule against non-bash tool', () => {
    expect(matchesRule('bash:npm test', 'write-file', {})).toBe(false);
  });
});

describe('buildPermissionRule', () => {
  it('returns "bash:{command}" for bash tool', () => {
    expect(buildPermissionRule('bash', { command: 'npm test' })).toBe('bash:npm test');
  });

  it('returns tool name for non-bash tools', () => {
    expect(buildPermissionRule('write-file', { path: 'test.ts' })).toBe('write-file');
  });

  it('returns "bash" when bash has no command arg', () => {
    expect(buildPermissionRule('bash', {})).toBe('bash');
  });
});

describe('loadPermissionRules', () => {
  it('returns empty rules when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const rules = loadPermissionRules('/some/path');
    expect(rules).toEqual({ allowedTools: [], deniedTools: [] });
  });

  it('returns empty rules for malformed JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json');
    const rules = loadPermissionRules('/some/path');
    expect(rules).toEqual({ allowedTools: [], deniedTools: [] });
  });

  it('parses valid JSON correctly', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedTools: ['write-file', 'bash:npm test'],
      deniedTools: ['bash:rm -rf *'],
    }));
    const rules = loadPermissionRules('/some/path');
    expect(rules.allowedTools).toEqual(['write-file', 'bash:npm test']);
    expect(rules.deniedTools).toEqual(['bash:rm -rf *']);
  });

  it('handles missing arrays gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ allowedTools: 'not-array' }));
    const rules = loadPermissionRules('/some/path');
    expect(rules).toEqual({ allowedTools: [], deniedTools: [] });
  });

  it('ignores extra unknown fields via Zod and parses correctly', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedTools: ['write-file'],
      deniedTools: ['bash:rm -rf *'],
      unknownField: 'should be ignored',
      nested: { deep: true },
    }));
    const rules = loadPermissionRules('/some/path');
    expect(rules.allowedTools).toEqual(['write-file']);
    expect(rules.deniedTools).toEqual(['bash:rm -rf *']);
  });
});

describe('savePermissionRule', () => {
  it('creates directory and writes file', () => {
    mockExistsSync.mockReturnValue(false);
    savePermissionRule('/project/.frogger/permissions.json', 'allow', 'write-file');
    expect(mockMkdirSync).toHaveBeenCalledWith('/project/.frogger', { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/project/.frogger/permissions.json',
      expect.stringContaining('"write-file"'),
      'utf-8',
    );
  });

  it('deduplicates rules', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedTools: ['write-file'],
      deniedTools: [],
    }));
    savePermissionRule('/some/path', 'allow', 'write-file');
    const written = mockWriteFileSync.mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.allowedTools).toEqual(['write-file']);
  });

  it('appends new rule without removing existing', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedTools: ['write-file'],
      deniedTools: [],
    }));
    savePermissionRule('/some/path', 'allow', 'bash:npm test');
    const written = mockWriteFileSync.mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.allowedTools).toEqual(['write-file', 'bash:npm test']);
  });
});

describe('resolvePermission', () => {
  it('returns null when no rules match', () => {
    mockExistsSync.mockReturnValue(false);
    expect(resolvePermission('write-file', {}, '/project')).toBeNull();
  });

  it('project deny overrides global allow', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((filePath: any) => {
      if (String(filePath).includes('.frogger/permissions.json') && String(filePath).startsWith('/project')) {
        return JSON.stringify({ allowedTools: [], deniedTools: ['write-file'] });
      }
      // Global
      return JSON.stringify({ allowedTools: ['write-file'], deniedTools: [] });
    });
    expect(resolvePermission('write-file', {}, '/project')).toBe('deny');
  });

  it('project allow works when no deny', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((filePath: any) => {
      if (String(filePath).startsWith('/project')) {
        return JSON.stringify({ allowedTools: ['write-file'], deniedTools: [] });
      }
      return JSON.stringify({ allowedTools: [], deniedTools: [] });
    });
    expect(resolvePermission('write-file', {}, '/project')).toBe('allow');
  });

  it('falls back to global allow', () => {
    mockExistsSync.mockImplementation((filePath: any) => {
      // Project file doesn't exist
      if (String(filePath).startsWith('/project')) return false;
      return true;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedTools: ['write-file'],
      deniedTools: [],
    }));
    expect(resolvePermission('write-file', {}, '/project')).toBe('allow');
  });
});

describe('path helpers', () => {
  it('getProjectPermissionsPath returns correct path', () => {
    expect(getProjectPermissionsPath('/my/project')).toBe('/my/project/.frogger/permissions.json');
  });

  it('getGlobalPermissionsPath returns path under home', () => {
    const globalPath = getGlobalPermissionsPath();
    expect(globalPath).toContain('.frogger/permissions.json');
  });
});
