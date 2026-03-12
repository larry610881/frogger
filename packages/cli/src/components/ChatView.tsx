import React from 'react';
import { Box, Text } from 'ink';
import { DiffView } from './DiffView.js';
import { MarkdownView } from './MarkdownView.js';

interface ChatViewProps {
  message: { role: 'user' | 'assistant' | 'tool'; content: string };
}

export function ChatView({ message }: ChatViewProps): React.ReactElement {
  if (message.role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="green">{`> ${message.content}`}</Text>
      </Box>
    );
  }

  if (message.role === 'tool') {
    return renderToolMessage(message.content);
  }

  // assistant — use MarkdownView for rich rendering
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">Frogger:</Text>
      <Box marginLeft={2} flexDirection="column">
        <MarkdownView content={message.content} />
      </Box>
    </Box>
  );
}

/** Render a tool result message, extracting diff blocks for colored display */
function renderToolMessage(content: string): React.ReactElement {
  const [header, ...rest] = content.split('\n');
  const restText = rest.join('\n');

  // Check for diff block
  const diffMatch = restText.match(/```diff\n([\s\S]*?)```/);

  if (diffMatch) {
    const beforeDiff = restText.slice(0, diffMatch.index).trim();
    const diffContent = diffMatch[1]!.trimEnd();

    return (
      <Box flexDirection="column" marginLeft={1}>
        <Text color="yellow">{`  ✦ ${header}`}</Text>
        {beforeDiff && (
          <Box marginLeft={4}>
            <Text dimColor>{beforeDiff}</Text>
          </Box>
        )}
        <DiffView diff={diffContent} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={1}>
      <Text color="yellow">{`  ✦ ${header}`}</Text>
      {rest.length > 0 && (
        <Box marginLeft={4}>
          <Text dimColor>{restText}</Text>
        </Box>
      )}
    </Box>
  );
}
