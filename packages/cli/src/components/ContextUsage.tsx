import React from 'react';
import { Text } from 'ink';
import type { ContextBudget } from '@frogger/core';

interface ContextUsageProps {
  budget: ContextBudget | null;
}

export function ContextUsage({ budget }: ContextUsageProps): React.ReactElement | null {
  if (!budget) return null;

  const { usagePercent } = budget;
  let color: string;
  if (usagePercent > 90) {
    color = 'red';
  } else if (usagePercent >= 70) {
    color = 'yellow';
  } else {
    color = 'green';
  }

  return (
    <Text dimColor>
      ctx: <Text color={color}>{usagePercent}%</Text>
    </Text>
  );
}
