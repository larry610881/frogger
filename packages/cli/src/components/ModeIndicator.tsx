import React from 'react';
import { Box, Text } from 'ink';
import type { ModeName } from '@frogger/shared';

const MODE_COLORS: Record<ModeName, string> = {
  ask: 'blue',
  plan: 'yellow',
  agent: 'green',
};

export function ModeIndicator({ mode }: { mode: ModeName }): React.ReactElement {
  return (
    <Box>
      <Text dimColor>[</Text>
      <Text color={MODE_COLORS[mode]} bold>{mode.toUpperCase()}</Text>
      <Text dimColor>] Shift+Tab to switch</Text>
    </Box>
  );
}
