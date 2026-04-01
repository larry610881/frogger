import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ModeName } from '@frogger/shared';

interface ModeSwitchPromptProps {
  target: ModeName;
  reason: string;
  onRespond: (confirmed: boolean) => void;
}

const MODE_LABELS: Record<ModeName, { label: string; color: string }> = {
  ask: { label: 'Ask', color: 'blue' },
  plan: { label: 'Plan', color: 'yellow' },
  agent: { label: 'Agent', color: 'green' },
};

export function ModeSwitchPrompt({ target, reason, onRespond }: ModeSwitchPromptProps): React.ReactElement {
  useInput((ch) => {
    const lower = ch?.toLowerCase();
    if (lower === 'y') onRespond(true);
    if (lower === 'n') onRespond(false);
  });

  const { label, color } = MODE_LABELS[target];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Mode Switch Request</Text>
      <Text>Switch to: <Text bold color={color}>{label}</Text> mode</Text>
      <Text>Reason: <Text dimColor>{reason}</Text></Text>
      <Text> </Text>
      <Text><Text color="green" bold>[y]</Text> Allow  <Text color="red" bold>[n]</Text> Deny</Text>
    </Box>
  );
}
