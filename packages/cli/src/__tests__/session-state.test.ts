import { describe, it, expect, beforeEach } from 'vitest';
import { sessionState } from '../session-state.js';

describe('sessionState', () => {
  beforeEach(() => {
    sessionState.sessionId = null;
    sessionState.hasMessages = false;
  });

  it('starts with null sessionId and false hasMessages', () => {
    expect(sessionState.sessionId).toBeNull();
    expect(sessionState.hasMessages).toBe(false);
  });

  it('allows setting sessionId and hasMessages', () => {
    sessionState.sessionId = 'abc-123';
    sessionState.hasMessages = true;

    expect(sessionState.sessionId).toBe('abc-123');
    expect(sessionState.hasMessages).toBe(true);
  });
});
