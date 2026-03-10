import React from 'react';
import { Box, Text } from 'ink';

interface DiffViewProps {
  diff: string;
}

export function DiffView({ diff }: DiffViewProps): React.ReactElement {
  const lines = diff.split('\n');

  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => {
        if (line.startsWith('+++') || line.startsWith('---')) {
          return <Text key={i} bold dimColor>{line}</Text>;
        }
        if (line.startsWith('@@')) {
          return <Text key={i} color="cyan">{line}</Text>;
        }
        if (line.startsWith('+')) {
          return <Text key={i} color="green">{line}</Text>;
        }
        if (line.startsWith('-')) {
          return <Text key={i} color="red">{line}</Text>;
        }
        return <Text key={i} dimColor>{line}</Text>;
      })}
    </Box>
  );
}
