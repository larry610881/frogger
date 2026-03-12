import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingViewProps {
  text: string;
}

export function ThinkingView({ text }: ThinkingViewProps): React.ReactElement {
  const lines = text.split('\n');
  const display = lines.slice(-5).join('\n');
  return (
    <Box flexDirection="column" marginLeft={1}>
      <Text dimColor italic>Thinking...</Text>
      <Text dimColor>{display}</Text>
    </Box>
  );
}
