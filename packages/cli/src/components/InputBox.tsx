import React, { useState, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

export interface CommandHint {
  name: string;
  description: string;
}

interface PastedBlock {
  id: number;
  content: string;
  lineCount: number;
}

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  cycleMode: () => void;
  commands?: CommandHint[];
  inputHistory?: string[];
}

const PASTE_MARKER_RE = /\[pasted text #(\d+) \+\d+ lines\]/g;

export function InputBox({ onSubmit, disabled, cycleMode, commands = [], inputHistory = [] }: InputBoxProps): React.ReactElement {
  const inputRef = useRef('');
  const [, forceUpdate] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const pasteCountRef = useRef(0);
  const pastedBlocksRef = useRef<PastedBlock[]>([]);
  const historyIdxRef = useRef(-1);
  const savedInputRef = useRef('');

  const input = inputRef.current;

  // Compute completions when input starts with /
  const completions = useMemo(() => {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith('/') || !commands.length) return [];
    const prefix = trimmed.slice(1).split(/\s+/)[0] ?? '';
    // If there's a space after the command name, don't show completions
    if (trimmed.indexOf(' ') > 0) return [];
    return commands.filter(c => c.name.startsWith(prefix.toLowerCase()));
  }, [input, commands]);

  const showCompletions = completions.length > 0 && !disabled;

  useInput((ch, key) => {
    if (disabled) return;

    if (key.tab && key.shift) {
      cycleMode();
      return;
    }

    // Tab: accept selected completion
    if (key.tab && !key.shift && showCompletions) {
      const selected = completions[selectedIdx];
      if (selected) {
        inputRef.current = `/${selected.name} `;
        setSelectedIdx(0);
        forceUpdate(n => n + 1);
      }
      return;
    }

    // Arrow keys + Enter for completion selection
    if (showCompletions) {
      if (key.upArrow) {
        setSelectedIdx(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIdx(prev => Math.min(completions.length - 1, prev + 1));
        return;
      }
      // Enter: accept selected completion and submit immediately
      if (key.return && !key.shift) {
        const selected = completions[selectedIdx];
        if (selected) {
          const command = `/${selected.name}`;
          onSubmit(command);
          inputRef.current = '';
          setSelectedIdx(0);
          forceUpdate(n => n + 1);
        }
        return;
      }
    }

    // History navigation (↑/↓) when completions are not showing
    if (!showCompletions && inputHistory.length > 0) {
      if (key.upArrow) {
        if (historyIdxRef.current === -1) {
          savedInputRef.current = inputRef.current;
        }
        const nextIdx = Math.min(historyIdxRef.current + 1, inputHistory.length - 1);
        historyIdxRef.current = nextIdx;
        inputRef.current = inputHistory[inputHistory.length - 1 - nextIdx] ?? '';
        forceUpdate(n => n + 1);
        return;
      }
      if (key.downArrow && historyIdxRef.current >= 0) {
        const nextIdx = historyIdxRef.current - 1;
        historyIdxRef.current = nextIdx;
        inputRef.current = nextIdx === -1
          ? savedInputRef.current
          : (inputHistory[inputHistory.length - 1 - nextIdx] ?? '');
        forceUpdate(n => n + 1);
        return;
      }
    }

    // Shift+Enter: insert newline
    if (key.return && key.shift) {
      inputRef.current += '\n';
      forceUpdate(n => n + 1);
      return;
    }

    if (key.return && !key.shift && inputRef.current.trim()) {
      // Restore pasted blocks before submitting
      let finalText = inputRef.current.trim();
      for (const block of pastedBlocksRef.current) {
        finalText = finalText.replace(
          `[pasted text #${block.id} +${block.lineCount} lines]`,
          block.content,
        );
      }
      onSubmit(finalText);
      inputRef.current = '';
      pasteCountRef.current = 0;
      pastedBlocksRef.current = [];
      historyIdxRef.current = -1;
      setSelectedIdx(0);
      forceUpdate(n => n + 1);
      return;
    }

    if (key.backspace || key.delete) {
      const text = inputRef.current;
      if (!text) return;

      // Scan all marker positions — if the deletion point (end of string)
      // falls inside or at the boundary of any marker, remove the entire marker.
      const markerRe = /\[pasted text #(\d+) \+\d+ lines\]/g;
      let removed = false;
      let m: RegExpExecArray | null;
      while ((m = markerRe.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        // Deletion point is at text.length - 1 (the char about to be removed).
        // If that char falls within [start, end), the cursor is inside/at-end of this marker.
        if (text.length > start && text.length <= end) {
          const blockId = parseInt(m[1]!, 10);
          inputRef.current = text.slice(0, start) + text.slice(end);
          pastedBlocksRef.current = pastedBlocksRef.current.filter(b => b.id !== blockId);
          removed = true;
          break;
        }
      }
      if (!removed) {
        inputRef.current = text.slice(0, -1);
      }
      setSelectedIdx(0);
      forceUpdate(n => n + 1);
      return;
    }

    if (ch && !key.ctrl && !key.meta) {
      if (ch.includes('\n')) {
        // Paste detected
        const lines = ch.split('\n');
        if (lines.length >= 5) {
          // Fold: store in pastedBlocks, show marker in input
          pasteCountRef.current += 1;
          pastedBlocksRef.current.push({
            id: pasteCountRef.current,
            content: ch,
            lineCount: lines.length,
          });
          inputRef.current += `[pasted text #${pasteCountRef.current} +${lines.length} lines]`;
        } else {
          // Short paste: expand inline (replace newlines with spaces)
          inputRef.current += ch.replace(/\n/g, ' ');
        }
      } else {
        inputRef.current += ch;
      }
      historyIdxRef.current = -1;
      setSelectedIdx(0);
      forceUpdate(n => n + 1);
    }
  });

  // Render a single line with dimmed paste markers
  const renderLine = (line: string, keyPrefix: string) => {
    if (!line.includes('[pasted text #')) return <Text key={keyPrefix}>{line}</Text>;

    const parts: React.ReactElement[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(PASTE_MARKER_RE.source, 'g');
    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<Text key={`${keyPrefix}-t${lastIndex}`}>{line.slice(lastIndex, match.index)}</Text>);
      }
      parts.push(<Text key={`${keyPrefix}-p${match.index}`} dimColor>{match[0]}</Text>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(<Text key={`${keyPrefix}-t${lastIndex}`}>{line.slice(lastIndex)}</Text>);
    }
    return <>{parts}</>;
  };

  // Render input with multiline and dimmed paste markers
  const renderInput = () => {
    if (disabled) return <Text>...</Text>;

    const lines = input.split('\n');
    if (lines.length === 1) {
      return renderLine(input, 'l0');
    }

    // Multiline: first line has no extra prefix (> already shown),
    // subsequent lines get · prefix
    return (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Box key={`line-${i}`}>
            {i > 0 && <Text color="green" bold>{'· '}</Text>}
            {renderLine(line, `l${i}`)}
            {i === lines.length - 1 && <Text color="gray">{'\u2588'}</Text>}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {showCompletions && (
        <Box flexDirection="column" marginLeft={2} marginBottom={0}>
          {completions.map((c, i) => (
            <Box key={c.name}>
              <Text color={i === selectedIdx ? 'green' : 'gray'}>
                {i === selectedIdx ? '> ' : '  '}
              </Text>
              <Text color={i === selectedIdx ? 'green' : 'gray'} bold={i === selectedIdx}>
                /{c.name}
              </Text>
              <Text color="gray" dimColor> — {c.description}</Text>
            </Box>
          ))}
          <Text dimColor>  Enter to run, Tab to fill, ↑↓ to select</Text>
        </Box>
      )}
      <Box>
        <Text color="green" bold>{'> '}</Text>
        {input.includes('\n') ? (
          renderInput()
        ) : (
          <>{renderInput()}<Text color="gray">{'\u2588'}</Text></>
        )}
      </Box>
    </Box>
  );
}
