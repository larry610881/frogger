import { describe, it, expect } from 'vitest';
import { AgentContext } from './context.js';

describe('AgentContext', () => {
  it('stores working directory', () => {
    const ctx = new AgentContext('/home/user/project');
    expect(ctx.workingDirectory).toBe('/home/user/project');
  });

  it('starts with empty messages', () => {
    const ctx = new AgentContext('/tmp');
    expect(ctx.getMessages()).toEqual([]);
  });

  it('adds user messages', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Hello');
    const messages = ctx.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('adds assistant messages', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addAssistantMessage('Hi there');
    const messages = ctx.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'assistant', content: 'Hi there' });
  });

  it('preserves message order', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Q1');
    ctx.addAssistantMessage('A1');
    ctx.addUserMessage('Q2');
    const messages = ctx.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
  });

  it('getLastMessages returns last N messages', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Q1');
    ctx.addAssistantMessage('A1');
    ctx.addUserMessage('Q2');
    ctx.addAssistantMessage('A2');

    const last2 = ctx.getLastMessages(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]).toEqual({ role: 'user', content: 'Q2' });
    expect(last2[1]).toEqual({ role: 'assistant', content: 'A2' });
  });

  it('getLastMessages returns all if N > length', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Q1');
    expect(ctx.getLastMessages(5)).toHaveLength(1);
  });

  it('getMessages returns a copy', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Hello');
    const messages = ctx.getMessages();
    messages.push({ role: 'user', content: 'injected' });
    expect(ctx.getMessages()).toHaveLength(1);
  });

  it('clear removes all messages', () => {
    const ctx = new AgentContext('/tmp');
    ctx.addUserMessage('Q1');
    ctx.addAssistantMessage('A1');
    ctx.clear();
    expect(ctx.getMessages()).toEqual([]);
  });
});
