import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownViewProps {
  content: string;
}

/** Rich Markdown renderer for assistant messages */
export function MarkdownView({ content }: MarkdownViewProps): React.ReactElement {
  const elements: React.ReactElement[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
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

    // Table row: | col | col |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|') && lines[i]!.trim().endsWith('|')) {
        tableLines.push(lines[i]!);
        i++;
      }
      elements.push(<TableView key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      elements.push(<Text key={`h-${i}`} bold underline>{headingMatch[2]}</Text>);
      i++;
      continue;
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      const text = line.replace(/^>\s?/, '');
      elements.push(
        <Text key={`bq-${i}`} dimColor italic>{`│ ${text}`}</Text>
      );
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
    if (olMatch) {
      const indent = olMatch[1] ?? '';
      const num = olMatch[2];
      const text = olMatch[3]!;
      elements.push(<Text key={`ol-${i}`}>{`${indent}${num}. `}{renderInline(text)}</Text>);
      i++;
      continue;
    }

    // Unordered list item
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

/** Render inline markdown: **bold**, `code`, [link](url), ~~strike~~ */
export function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/g;
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
    } else if (match[4] && match[5]) {
      // [link text](url)
      parts.push(<Text key={match.index} color="blue" underline>{match[4]}</Text>);
    } else if (match[6]) {
      // ~~strikethrough~~
      parts.push(<Text key={match.index} dimColor strikethrough>{match[6]}</Text>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

/** Parse and render a Markdown table with aligned columns */
function TableView({ lines }: { lines: string[] }): React.ReactElement {
  // Parse rows into cells
  const rows = lines.map(line =>
    line.split('|').slice(1, -1).map(cell => cell.trim())
  );

  if (rows.length === 0) return <Text />;

  // Detect separator row (e.g. | --- | --- |)
  const isSeparator = (row: string[]) => row.every(cell => /^[-:]+$/.test(cell));

  // Calculate max width per column
  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = Array(colCount).fill(0);
  for (const row of rows) {
    if (isSeparator(row)) continue;
    for (let c = 0; c < row.length; c++) {
      colWidths[c] = Math.max(colWidths[c]!, row[c]!.length);
    }
  }

  return (
    <Box flexDirection="column" marginLeft={1}>
      {rows.map((row, ri) => {
        if (isSeparator(row)) {
          // Render separator as dashes
          const sep = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
          return <Text key={ri} dimColor>{`├${sep}┤`}</Text>;
        }
        const cells = row.map((cell, ci) => cell.padEnd(colWidths[ci]!));
        return (
          <Text key={ri}>
            {'│ '}
            {cells.map((cell, ci) => (
              <React.Fragment key={ci}>
                {ci > 0 && ' │ '}
                {ri === 0 ? <Text bold>{cell}</Text> : renderInline(cell)}
              </React.Fragment>
            ))}
            {' │'}
          </Text>
        );
      })}
    </Box>
  );
}
