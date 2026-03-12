import React, { useState, useEffect, useMemo } from 'react';
import { Box, Static, Text } from 'ink';
import { APP_VERSION } from '@frogger/shared';
import type { ModeName } from '@frogger/shared';
import path from 'node:path';
import { ChatView } from './ChatView.js';
import { InputBox } from './InputBox.js';
import { ModeIndicator } from './ModeIndicator.js';
import { ContextUsage } from './ContextUsage.js';
import { Spinner } from './Spinner.js';
import { WelcomeBanner, type SessionSummary } from './WelcomeBanner.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { InitSetup } from './InitSetup.js';
import { StreamingStats } from './StreamingStats.js';
import { ThinkingView } from './ThinkingView.js';
import { useAgent } from '../hooks/useAgent.js';
import { useMode } from '../hooks/useMode.js';

interface AppProps {
  initialPrompt?: string;
  initialMode?: string;
  provider?: string;
  model?: string;
  thinking?: { enabled: boolean; budgetTokens: number };
  notifications?: { enabled: boolean; minDurationMs?: number };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function App({ initialPrompt, initialMode, provider, model, thinking, notifications }: AppProps): React.ReactElement {
  const { mode, setMode, cycleMode } = useMode((initialMode as ModeName) ?? 'agent');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [activeProvider, setActiveProvider] = useState(provider ?? 'deepseek');
  const [activeModel, setActiveModel] = useState(model);
  const [showSetup, setShowSetup] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);

  const inputHistory = useMemo(
    () => history.filter(m => m.role === 'user').map(m => m.content),
    [history],
  );

  const { isStreaming, streamingText, thinkingText, liveUsage, pendingToolCall, pendingPermission, contextBudget, commandHints, submit, respondPermission } = useAgent({
    provider: activeProvider,
    model: activeModel,
    mode,
    initialPrompt,
    thinking,
    notifications,
    onMessage: (msg) => setHistory(prev => [...prev, msg]),
    onModeChange: setMode,
    onClearHistory: () => setHistory([]),
    onProviderModelChange: (newProvider, newModel) => {
      setActiveProvider(newProvider);
      setActiveModel(newModel);
    },
    onTriggerSetup: () => setShowSetup(true),
  });

  // Load recent sessions for welcome banner
  useEffect(() => {
    (async () => {
      try {
        const { SessionManager } = await import('@frogger/core');
        const sm = new SessionManager();
        const sessions = await sm.list(3);
        setRecentSessions(sessions.map(s => ({
          timeAgo: formatTimeAgo(s.updatedAt),
          directory: path.basename(s.workingDirectory),
          messageCount: s.messages.length,
        })));
      } catch {
        // Non-critical — show empty sessions
      }
    })();
  }, []);

  if (showSetup) {
    return <InitSetup onComplete={() => setShowSetup(false)} />;
  }

  return (
    <Box flexDirection="column">
      {history.length === 0 && !isStreaming && (
        <Box marginBottom={1}>
          <WelcomeBanner
            version={APP_VERSION}
            provider={activeProvider}
            model={activeModel}
            recentSessions={recentSessions}
          />
        </Box>
      )}

      <Static items={history}>
        {(msg) => <ChatView key={msg.id} message={msg} />}
      </Static>

      {isStreaming && streamingText && (
        <Box marginLeft={1}>
          <Text color="cyan">{streamingText}</Text>
        </Box>
      )}

      {pendingToolCall && (
        <Box marginLeft={1}>
          <Spinner label={`Running ${pendingToolCall.toolName}...`} />
        </Box>
      )}

      {pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          args={pendingPermission.args}
          onRespond={respondPermission}
        />
      )}

      {isStreaming && !streamingText && !pendingToolCall && !pendingPermission && (
        thinkingText ? <ThinkingView text={thinkingText} /> : <Spinner label="Thinking..." />
      )}

      <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      <InputBox onSubmit={submit} disabled={isStreaming} cycleMode={cycleMode} commands={commandHints} inputHistory={inputHistory} />
      <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      <Box justifyContent="space-between">
        <ModeIndicator mode={mode} />
        {isStreaming && <StreamingStats usage={liveUsage} model={activeModel} />}
        <ContextUsage budget={contextBudget} />
      </Box>
    </Box>
  );
}
