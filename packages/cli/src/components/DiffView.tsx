import React from 'react';
import { Box, Text } from 'ink';

interface DiffViewProps {
  diff: string;
}

/**
 * Parse hunk header to extract starting line numbers.
 * Format: @@ -oldStart,count +newStart,count @@
 */
function parseHunkHeader(line: string): { oldStart: number; newStart: number } | null {
  const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return null;
  return { oldStart: parseInt(match[1]!, 10), newStart: parseInt(match[2]!, 10) };
}

/** Format a line number into a fixed-width gutter cell (4 chars) */
function formatLineNo(n: number | null): string {
  if (n === null) return '    ';
  return String(n).padStart(4);
}

export function DiffView({ diff }: DiffViewProps): React.ReactElement {
  const lines = diff.split('\n');

  let oldLine = 0;
  let newLine = 0;

  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => {
        // File headers: --- and +++
        if (line.startsWith('+++') || line.startsWith('---')) {
          return (
            <Text key={i} bold dimColor>
              {'         '}{line}
            </Text>
          );
        }

        // Hunk header: @@ -a,b +c,d @@
        if (line.startsWith('@@')) {
          const parsed = parseHunkHeader(line);
          if (parsed) {
            oldLine = parsed.oldStart;
            newLine = parsed.newStart;
          }
          return (
            <Text key={i} color="cyan">
              {'         '}{line}
            </Text>
          );
        }

        // Added line: only new line number
        if (line.startsWith('+')) {
          const gutter = `${formatLineNo(null)} ${formatLineNo(newLine)} `;
          newLine++;
          return (
            <Text key={i} color="green">
              {gutter}{line}
            </Text>
          );
        }

        // Removed line: only old line number
        if (line.startsWith('-')) {
          const gutter = `${formatLineNo(oldLine)} ${formatLineNo(null)} `;
          oldLine++;
          return (
            <Text key={i} color="red">
              {gutter}{line}
            </Text>
          );
        }

        // Context line: both line numbers
        const gutter = `${formatLineNo(oldLine)} ${formatLineNo(newLine)} `;
        oldLine++;
        newLine++;
        return (
          <Text key={i} dimColor>
            {gutter}{line}
          </Text>
        );
      })}
    </Box>
  );
}
