import React from 'react';
import { Box, Text } from 'ink';
import { DiffView } from './DiffView.js';

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
    const diffContent = diffMatch[1].trimEnd();

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

/** Simple Markdown renderer for assistant messages */
function MarkdownView({ content }: { content: string }): React.ReactElement {
  const elements: React.ReactElement[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <Box key={`code-${i}`} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginY={0}>
          {lang && <Text dimColor>{lang}</Text>}
          <Text color="green">{codeLines.join('\n')}</Text>
        </Box>
      );
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      elements.push(<Text key={`h-${i}`} bold underline>{headingMatch[2]}</Text>);
      i++;
      continue;
    }

    // List item
    if (line.match(/^\s*[-*]\s+/)) {
      const text = line.replace(/^\s*[-*]\s+/, '');
      elements.push(<Text key={`li-${i}`}>  {renderInline(`• ${text}`)}</Text>);
      i++;
      continue;
    }

    // Regular text with inline formatting
    if (line.trim()) {
      elements.push(<Text key={`p-${i}`}>{renderInline(line)}</Text>);
    } else {
      elements.push(<Text key={`br-${i}`}> </Text>);
    }
    i++;
  }

  return <>{elements}</>;
}

/** Render inline markdown: **bold** and `code` */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<Text key={match.index} bold>{match[2]}</Text>);
    } else if (match[3]) {
      // `inline code`
      parts.push(<Text key={match.index} color="yellow">{match[3]}</Text>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
