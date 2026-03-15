/**
 * Parse a semver-like version string and compare against a minimum major version.
 * Used to provide a clear error message when Node.js is too old.
 */
export function checkNodeVersion(
  current: string,
  requiredMajor: number,
): { ok: boolean; currentMajor: number } {
  const currentMajor = parseInt(current.split('.')[0], 10);
  return {
    ok: !isNaN(currentMajor) && currentMajor >= requiredMajor,
    currentMajor,
  };
}
