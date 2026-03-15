import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock @frogger/core to avoid importing the real module
vi.mock('@frogger/core', () => ({}));

import { ContextUsage } from '../components/ContextUsage.js';

function makeBudget(usagePercent: number) {
  return {
    contextWindow: 200000,
    maxOutputTokens: 8192,
    availableInput: 172627,
    currentUsage: Math.round(172627 * usagePercent / 100),
    usagePercent,
    shouldCompact: usagePercent >= 80,
  };
}

describe('ContextUsage', () => {
  it('renders empty when budget is null', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: null }));
    // null return means no output
    expect(lastFrame()).toBe('');
  });

  it('shows "50%" for usagePercent=50', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(50) }));
    expect(lastFrame()).toContain('50%');
  });

  it('shows "70%" for usagePercent=70 (yellow boundary)', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(70) }));
    expect(lastFrame()).toContain('70%');
  });

  it('shows "80%" for usagePercent=80', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(80) }));
    expect(lastFrame()).toContain('80%');
  });

  it('shows "91%" for usagePercent=91 (red)', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(91) }));
    expect(lastFrame()).toContain('91%');
  });

  it('shows "100%" for usagePercent=100 (red)', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(100) }));
    expect(lastFrame()).toContain('100%');
  });

  it('shows "0%" for usagePercent=0 (green)', () => {
    const { lastFrame } = render(React.createElement(ContextUsage, { budget: makeBudget(0) }));
    expect(lastFrame()).toContain('0%');
  });
});
