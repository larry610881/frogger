import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, AUDIT_DIR } from '@frogger/shared';
import type { AuditEvent } from '@frogger/shared';
import type { SlashCommand } from './types.js';

function getAuditDir(): string {
  return join(homedir(), CONFIG_DIR, AUDIT_DIR);
}

function readTodayLog(): AuditEvent[] {
  const date = new Date().toISOString().split('T')[0];
  const filePath = join(getAuditDir(), `${date}.jsonl`);
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map(line => {
    try { return JSON.parse(line) as AuditEvent; } catch { return null; }
  }).filter((e): e is AuditEvent => e !== null);
}

function formatSummary(events: AuditEvent[]): string {
  if (events.length === 0) return 'No audit events today.';

  // Count by tool
  const toolCounts = new Map<string, number>();
  for (const e of events) {
    toolCounts.set(e.tool, (toolCounts.get(e.tool) ?? 0) + 1);
  }

  const sorted = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);

  const lines = [
    `Audit Summary (today):`,
    '',
    `  Total tool calls: ${events.length}`,
    '',
    '  Top tools:',
    ...top5.map(([tool, count]) => `    ${tool}: ${count}`),
  ];

  return lines.join('\n');
}

function formatTail(events: AuditEvent[], count: number): string {
  if (events.length === 0) return 'No audit events today.';

  const recent = events.slice(-count);
  const lines = ['Recent audit events:', ''];
  for (const e of recent) {
    const time = e.timestamp.split('T')[1]?.split('.')[0] ?? '';
    lines.push(`  ${time} | ${e.tool} | ${e.result} | ${e.durationMs}ms`);
  }
  return lines.join('\n');
}

export const auditCommand: SlashCommand = {
  name: 'audit',
  description: 'Show audit log summary or recent entries',
  usage: '/audit [tail [N]] | [files]',

  execute(args) {
    if (args[0] === 'tail') {
      const count = parseInt(args[1] ?? '10', 10);
      return { type: 'message', message: formatTail(readTodayLog(), count) };
    }

    if (args[0] === 'files') {
      const dir = getAuditDir();
      if (!existsSync(dir)) return { type: 'message', message: 'No audit logs found.' };
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().reverse().slice(0, 10);
      if (files.length === 0) return { type: 'message', message: 'No audit logs found.' };
      return { type: 'message', message: `Audit log files:\n\n${files.map(f => `  ${join(dir, f)}`).join('\n')}` };
    }

    return { type: 'message', message: formatSummary(readTodayLog()) };
  },
};
