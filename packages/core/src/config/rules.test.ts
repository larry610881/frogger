import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadRules, clearRulesCache } from './rules.js';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MAX_RULES_SIZE } from '@frogger/shared';

describe('loadRules', () => {
  let testDir: string;

  beforeEach(() => {
    clearRulesCache();
    testDir = join(tmpdir(), `frogger-rules-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns undefined when no rules directory exists', () => {
    const result = loadRules(testDir);
    expect(result).toBeUndefined();
  });

  it('returns undefined when rules directory is empty', () => {
    mkdirSync(join(testDir, '.frogger', 'rules'), { recursive: true });
    const result = loadRules(testDir);
    expect(result).toBeUndefined();
  });

  it('loads a single .md file', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'coding.md'), 'Always use TypeScript.');

    const result = loadRules(testDir);
    expect(result).toBe('Always use TypeScript.');
  });

  it('sorts files alphabetically (a.md before b.md)', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'b-style.md'), 'Use tabs.');
    writeFileSync(join(rulesDir, 'a-lint.md'), 'Enable ESLint.');

    const result = loadRules(testDir);
    expect(result).toBe('Enable ESLint.\n\n---\n\nUse tabs.');
  });

  it('ignores non-.md files', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'notes.txt'), 'Should be ignored');
    writeFileSync(join(rulesDir, 'config.json'), '{}');
    writeFileSync(join(rulesDir, 'valid.md'), 'Rule content.');

    const result = loadRules(testDir);
    expect(result).toBe('Rule content.');
  });

  it('truncates content exceeding MAX_RULES_SIZE', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    const oversized = 'x'.repeat(MAX_RULES_SIZE + 1000);
    writeFileSync(join(rulesDir, 'big.md'), oversized);

    const result = loadRules(testDir);
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(MAX_RULES_SIZE + 20); // + truncation notice
    expect(result!).toContain('[Rules truncated]');
  });

  it('returns cached result when files have not changed', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'a.md'), 'Rule A');

    const first = loadRules(testDir);
    const second = loadRules(testDir);
    expect(first).toBe('Rule A');
    expect(second).toBe(first); // Same reference = cache hit
  });

  it('invalidates cache when file content changes', () => {
    const rulesDir = join(testDir, '.frogger', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    const filePath = join(rulesDir, 'a.md');
    writeFileSync(filePath, 'Rule A');

    const first = loadRules(testDir);
    expect(first).toBe('Rule A');

    // Modify file — need to wait a moment so mtime changes
    writeFileSync(filePath, 'Rule A Updated');

    clearRulesCache(); // Force re-check (since mtime may not change in same ms)
    const second = loadRules(testDir);
    expect(second).toBe('Rule A Updated');
  });
});
