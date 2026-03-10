/**
 * Generate a unified diff string from old and new file content.
 * Lightweight implementation — no external dependency needed.
 */
export function generateUnifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
): string {
  if (oldContent === newContent) return '';

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunks: string[] = [];

  hunks.push(`--- a/${filePath}`);
  hunks.push(`+++ b/${filePath}`);

  // Simple diff: find changed regions
  const maxLen = Math.max(oldLines.length, newLines.length);
  let i = 0;

  while (i < maxLen) {
    // Skip unchanged lines
    if (i < oldLines.length && i < newLines.length && oldLines[i] === newLines[i]) {
      i++;
      continue;
    }

    // Found a difference — collect the hunk
    const hunkStart = i;
    const contextBefore = Math.max(0, hunkStart - 3);
    let oldEnd = i;
    let newEnd = i;

    // Find extent of changes (with up to 3 lines of shared context between changes)
    let unchangedStreak = 0;
    while (oldEnd < oldLines.length || newEnd < newLines.length) {
      if (
        oldEnd < oldLines.length &&
        newEnd < newLines.length &&
        oldLines[oldEnd] === newLines[newEnd]
      ) {
        unchangedStreak++;
        if (unchangedStreak > 6) break;
        oldEnd++;
        newEnd++;
      } else {
        unchangedStreak = 0;
        // Advance whichever side has more remaining, or both
        if (oldEnd < oldLines.length) oldEnd++;
        if (newEnd < newLines.length) newEnd++;
      }
    }

    // Trim trailing unchanged lines from hunk (keep max 3 context)
    const contextAfter = Math.min(unchangedStreak, 3);
    oldEnd -= unchangedStreak - contextAfter;
    newEnd -= unchangedStreak - contextAfter;

    const oldHunkStart = contextBefore + 1;
    const newHunkStart = contextBefore + 1;
    const oldHunkLen = oldEnd - contextBefore;
    const newHunkLen = newEnd - contextBefore;

    hunks.push(`@@ -${oldHunkStart},${oldHunkLen} +${newHunkStart},${newHunkLen} @@`);

    // Context before
    for (let c = contextBefore; c < hunkStart && c < oldLines.length; c++) {
      hunks.push(` ${oldLines[c]}`);
    }

    // Changed lines — use LCS for accurate diff within hunk
    const oldChanged = oldLines.slice(hunkStart, oldEnd - contextAfter);
    const newChanged = newLines.slice(hunkStart, newEnd - contextAfter);

    for (const line of oldChanged) {
      if (!newChanged.includes(line)) {
        hunks.push(`-${line}`);
      } else {
        hunks.push(` ${line}`);
      }
    }
    for (const line of newChanged) {
      if (!oldChanged.includes(line)) {
        hunks.push(`+${line}`);
      }
    }

    // Context after
    for (let c = 0; c < contextAfter; c++) {
      const idx = oldEnd - contextAfter + c;
      if (idx < oldLines.length) {
        hunks.push(` ${oldLines[idx]}`);
      }
    }

    i = Math.max(oldEnd, newEnd);
  }

  return hunks.join('\n');
}
