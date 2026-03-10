import { useState, useCallback } from 'react';
import type { ModeName } from '@frogger/shared';

const MODE_CYCLE: ModeName[] = ['ask', 'plan', 'agent'];

export function useMode(initialMode: ModeName = 'agent') {
  const [mode, setMode] = useState<ModeName>(initialMode);

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const idx = MODE_CYCLE.indexOf(prev);
      return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    });
  }, []);

  return { mode, setMode, cycleMode };
}
