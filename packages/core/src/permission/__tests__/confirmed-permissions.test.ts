import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock homedir to return tmpDir for test isolation
let mockHome = '';
vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return {
    ...original,
    homedir: () => mockHome,
  };
});

import { isPermissionsConfirmed, confirmPermissions } from '../confirmed-permissions.js';

describe('confirmed-permissions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'confirm-perm-'));
    mockHome = tmpDir;
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns false for unconfirmed project permissions', () => {
    const projectDir = path.join(tmpDir, 'project');
    const permPath = path.join(projectDir, '.frogger', 'permissions.json');
    fs.mkdirSync(path.dirname(permPath), { recursive: true });
    fs.writeFileSync(permPath, JSON.stringify({ allowedTools: ['write-file'], deniedTools: [] }));

    expect(isPermissionsConfirmed(permPath)).toBe(false);
  });

  it('returns true after confirmPermissions is called', () => {
    const projectDir = path.join(tmpDir, 'project');
    const permPath = path.join(projectDir, '.frogger', 'permissions.json');
    fs.mkdirSync(path.dirname(permPath), { recursive: true });
    fs.writeFileSync(permPath, JSON.stringify({ allowedTools: ['write-file'], deniedTools: [] }));

    confirmPermissions(permPath);
    expect(isPermissionsConfirmed(permPath)).toBe(true);
  });

  it('returns false when file content changes after confirmation', () => {
    const projectDir = path.join(tmpDir, 'project');
    const permPath = path.join(projectDir, '.frogger', 'permissions.json');
    fs.mkdirSync(path.dirname(permPath), { recursive: true });
    fs.writeFileSync(permPath, JSON.stringify({ allowedTools: ['write-file'], deniedTools: [] }));

    confirmPermissions(permPath);
    expect(isPermissionsConfirmed(permPath)).toBe(true);

    // Modify the file
    fs.writeFileSync(permPath, JSON.stringify({ allowedTools: ['bash'], deniedTools: [] }));
    expect(isPermissionsConfirmed(permPath)).toBe(false);
  });

  it('returns true for global permissions path', () => {
    const globalPath = path.join(tmpDir, '.frogger', 'permissions.json');
    fs.mkdirSync(path.dirname(globalPath), { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify({ allowedTools: ['bash'], deniedTools: [] }));

    expect(isPermissionsConfirmed(globalPath)).toBe(true);
  });

  it('returns true when file does not exist', () => {
    const nonExistent = path.join(tmpDir, 'project', '.frogger', 'permissions.json');
    expect(isPermissionsConfirmed(nonExistent)).toBe(true);
  });

  it('auto-cleans stale entries for non-existent paths', () => {
    const projectDir = path.join(tmpDir, 'project');
    const permPath = path.join(projectDir, '.frogger', 'permissions.json');
    fs.mkdirSync(path.dirname(permPath), { recursive: true });
    fs.writeFileSync(permPath, JSON.stringify({ allowedTools: ['write-file'] }));

    confirmPermissions(permPath);
    expect(isPermissionsConfirmed(permPath)).toBe(true);

    // Read the stored hashes file and inject a stale entry
    const storePath = path.join(tmpDir, '.frogger', 'confirmed-permissions.json');
    const hashes = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    hashes['/tmp/nonexistent/path/permissions.json'] = 'deadbeef';
    fs.writeFileSync(storePath, JSON.stringify(hashes));

    // Loading should trigger cleanup
    expect(isPermissionsConfirmed(permPath)).toBe(true);

    // Verify stale entry was removed
    const cleaned = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    expect(cleaned['/tmp/nonexistent/path/permissions.json']).toBeUndefined();
    // Valid entry should remain
    expect(cleaned[path.resolve(permPath)]).toBeDefined();
  });
});
