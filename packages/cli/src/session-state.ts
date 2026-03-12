/**
 * Module-level singleton bridging React component tree and Ink host.
 * Written by useAgent (on session save), read by app.tsx (on exit / signal).
 */
export const sessionState = {
  sessionId: null as string | null,
  hasMessages: false,
};
