import { describe, it, expect } from 'vitest';
import { checkNodeVersion } from '../check-node-version.js';

describe('checkNodeVersion', () => {
  it('should pass when major version meets requirement', () => {
    expect(checkNodeVersion('22.0.0', 22)).toEqual({ ok: true, currentMajor: 22 });
  });

  it('should pass when major version exceeds requirement', () => {
    expect(checkNodeVersion('23.1.0', 22)).toEqual({ ok: true, currentMajor: 23 });
  });

  it('should fail when major version is below requirement', () => {
    expect(checkNodeVersion('14.21.3', 22)).toEqual({ ok: false, currentMajor: 14 });
  });

  it('should fail for Node 12 (oldest ESM-capable)', () => {
    expect(checkNodeVersion('12.22.12', 22)).toEqual({ ok: false, currentMajor: 12 });
  });

  it('should fail for Node 18 LTS', () => {
    expect(checkNodeVersion('18.20.2', 22)).toEqual({ ok: false, currentMajor: 18 });
  });

  it('should fail for Node 20 LTS', () => {
    expect(checkNodeVersion('20.11.1', 22)).toEqual({ ok: false, currentMajor: 20 });
  });

  it('should handle version without patch', () => {
    expect(checkNodeVersion('22.0', 22)).toEqual({ ok: true, currentMajor: 22 });
  });

  it('should handle major-only version string', () => {
    expect(checkNodeVersion('22', 22)).toEqual({ ok: true, currentMajor: 22 });
  });

  it('should fail for invalid version string', () => {
    const result = checkNodeVersion('invalid', 22);
    expect(result.ok).toBe(false);
    expect(result.currentMajor).toBeNaN();
  });
});
