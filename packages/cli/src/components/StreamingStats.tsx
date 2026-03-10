import React, { useState, useEffect, useRef } from 'react';
import { Text } from 'ink';
import type { TokenUsage } from '@frogger/shared';
import { formatTokens, calculateCost } from '../hooks/useAgent.js';

interface StreamingStatsProps {
  usage: TokenUsage | null;
  model?: string;
}

export function StreamingStats({ usage, model }: StreamingStatsProps): React.ReactElement {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m${elapsed % 60}s`
    : `${elapsed}s`;

  const parts = [`⏱ ${timeStr}`];

  if (usage) {
    parts.push(`${formatTokens(usage.totalTokens)} tokens`);
    if (model) {
      const cost = calculateCost(usage.promptTokens, usage.completionTokens, model);
      if (cost !== null) {
        parts.push(`$${cost.toFixed(2)}`);
      }
    }
  }

  return <Text dimColor>{parts.join(' | ')}</Text>;
}
