import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForUpdate, isNewerVersion, formatUpdateMessage, type UpdateCheckResult } from '../update-check.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('isNewerVersion', () => {
  it('detects newer major version', () => {
    expect(isNewerVersion('0.3.0', '1.0.0')).toBe(true);
  });

  it('detects newer minor version', () => {
    expect(isNewerVersion('0.3.0', '0.4.0')).toBe(true);
  });

  it('detects newer patch version', () => {
    expect(isNewerVersion('0.3.0', '0.3.1')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewerVersion('0.3.0', '0.3.0')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('1.0.0', '0.9.0')).toBe(false);
  });

  it('handles v prefix', () => {
    expect(isNewerVersion('v0.3.0', 'v0.4.0')).toBe(true);
  });

  it('handles mixed v prefix', () => {
    expect(isNewerVersion('0.3.0', 'v0.4.0')).toBe(true);
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('detects available update', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    });

    const result = await checkForUpdate('frogger', '0.3.0');
    expect(result.updateAvailable).toBe(true);
    expect(result.currentVersion).toBe('0.3.0');
    expect(result.latestVersion).toBe('1.0.0');
    expect(result.updateCommand).toContain('npm install -g frogger');
  });

  it('reports no update when current is latest', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.3.0' }),
    });

    const result = await checkForUpdate('frogger', '0.3.0');
    expect(result.updateAvailable).toBe(false);
  });

  it('throws on registry error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(checkForUpdate('nonexistent-pkg', '0.1.0')).rejects.toThrow('Registry returned 404');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(checkForUpdate('frogger', '0.3.0')).rejects.toThrow('Network error');
  });

  it('calls correct registry URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.3.0' }),
    });

    await checkForUpdate('frogger', '0.3.0');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/frogger/latest',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
  });
});

describe('formatUpdateMessage', () => {
  it('returns empty string when no update available', () => {
    const result: UpdateCheckResult = {
      currentVersion: '0.3.0',
      latestVersion: '0.3.0',
      updateAvailable: false,
      updateCommand: 'npm install -g frogger',
    };
    expect(formatUpdateMessage(result)).toBe('');
  });

  it('returns formatted message when update available', () => {
    const result: UpdateCheckResult = {
      currentVersion: '0.3.0',
      latestVersion: '1.0.0',
      updateAvailable: true,
      updateCommand: 'npm install -g frogger',
    };
    const msg = formatUpdateMessage(result);
    expect(msg).toContain('0.3.0');
    expect(msg).toContain('1.0.0');
    expect(msg).toContain('npm install -g frogger');
  });
});
