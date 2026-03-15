import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PermissionResponse } from '@frogger/shared';

interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  onRespond: (response: PermissionResponse) => void;
}

const OPTIONS: { label: string; key: string; response: PermissionResponse; color: string }[] = [
  { label: 'Allow (once)', key: 'y', response: 'allow', color: 'green' },
  { label: 'Deny', key: 'n', response: 'deny', color: 'red' },
  { label: 'Always allow (project)', key: 'a', response: 'always-project', color: 'blue' },
  { label: 'Always allow (global)', key: 'g', response: 'always-global', color: 'magenta' },
  { label: 'Always deny (project)', key: 'd', response: 'deny-project', color: 'red' },
  { label: 'Always deny (global)', key: 'x', response: 'deny-global', color: 'red' },
];

export function PermissionPrompt({ toolName, args, onRespond }: PermissionPromptProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useInput((ch, key) => {
    if (key.upArrow) {
      setSelectedIdx(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIdx(prev => Math.min(OPTIONS.length - 1, prev + 1));
      return;
    }
    if (key.return) {
      onRespond(OPTIONS[selectedIdx]!.response);
      return;
    }

    // Shortcut keys
    const lower = ch?.toLowerCase();
    for (const opt of OPTIONS) {
      if (lower === opt.key) {
        onRespond(opt.response);
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Permission Required</Text>
      <Text>Tool: <Text bold>{toolName}</Text></Text>
      <Box marginLeft={2}>
        <Text dimColor>{JSON.stringify(args, null, 2)}</Text>
      </Box>
      <Text> </Text>
      {OPTIONS.map((opt, i) => {
        const isSelected = i === selectedIdx;
        return (
          <Box key={opt.key}>
            <Text color={isSelected ? opt.color : 'gray'}>
              {isSelected ? ' \u25B8 ' : '   '}
            </Text>
            <Text color={isSelected ? opt.color : 'gray'} bold={isSelected}>
              {opt.label}
            </Text>
            <Text dimColor>  [{opt.key}]</Text>
          </Box>
        );
      })}
      <Text> </Text>
      <Text dimColor>  ↑/↓ to select, Enter to confirm</Text>
    </Box>
  );
}
