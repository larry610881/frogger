import React from 'react';
import { Box, Text } from 'ink';
import os from 'node:os';

export interface SessionSummary {
  timeAgo: string;
  directory: string;
  messageCount: number;
}

interface WelcomeBannerProps {
  version: string;
  provider: string;
  model?: string;
  recentSessions: SessionSummary[];
}

function getUsername(): string {
  try { return os.userInfo().username; } catch { return 'user'; }
}

export function WelcomeBanner({ version, provider, model, recentSessions }: WelcomeBannerProps): React.ReactElement {
  const username = getUsername();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
    >
      <Text color="green" bold> Frogger v{version}</Text>
      <Text> </Text>

      <Box>
        {/* Left column */}
        <Box flexDirection="column" width="50%">
          <Text>  Welcome back <Text bold>{username}</Text>!</Text>
          <Text> </Text>
          <Text>         🐸</Text>
          <Text> </Text>
          <Text dimColor>  {provider}{model ? ` / ${model}` : ''}</Text>
          <Text dimColor>  {process.cwd()}</Text>
        </Box>

        {/* Right column */}
        <Box flexDirection="column" width="50%">
          <Text bold> Tips</Text>
          <Text dimColor> • /help for commands</Text>
          <Text dimColor> • Shift+Tab to switch mode</Text>
          <Text dimColor> • /setup to configure</Text>
          <Text> </Text>
          <Text bold> Recent sessions</Text>
          {recentSessions.length === 0 ? (
            <Text dimColor> No recent sessions</Text>
          ) : (
            recentSessions.map((s, i) => (
              <Text key={i} dimColor>
                {' '}{`• ${s.timeAgo} — ${s.directory} (${s.messageCount} msgs)`}
              </Text>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
