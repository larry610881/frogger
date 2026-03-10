/**
 * Truncate tool output to prevent overwhelming the LLM context.
 * When truncated, cuts at the nearest line boundary and appends a notice.
 */
export function truncateOutput(text: string, maxChars: number = 30_000): string {
  if (text.length <= maxChars) return text;
  let cutPoint = maxChars;
  const lastNewline = text.lastIndexOf('\n', maxChars);
  if (lastNewline > 0) cutPoint = lastNewline;
  const truncated = text.slice(0, cutPoint);
  return `${truncated}\n\n[output truncated: showing first ${cutPoint.toLocaleString()} of ${text.length.toLocaleString()} characters]`;
}
