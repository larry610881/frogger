import React, { useState, useEffect, useRef } from 'react';
import { Text } from 'ink';

const FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

export function Spinner({ label }: { label?: string }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAMES.length);
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const timeStr = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m${elapsed % 60}s`
    : `${elapsed}s`;

  return (
    <Text color="cyan">
      {FRAMES[frame]} {label ?? 'Loading...'} <Text dimColor>({timeStr})</Text>
    </Text>
  );
}
