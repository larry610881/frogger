import { execa } from 'execa';
import { loadConfig, findProvider } from '../config/config.js';
import type { SlashCommand } from './types.js';

async function getVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const result = await execa(cmd, args, { timeout: 5000 });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

export const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: 'Check environment and configuration',
  usage: '/doctor',

  async execute(_args, context) {
    const checks: Array<{ label: string; ok: boolean; detail: string }> = [];

    // 1. Node.js — no exec needed
    checks.push({
      label: 'Node.js',
      ok: true,
      detail: process.version,
    });

    // 2. Git
    const gitVersion = await getVersion('git', ['--version']);
    checks.push({
      label: 'Git',
      ok: gitVersion !== null,
      detail: gitVersion ?? 'not found',
    });

    // 3. pnpm
    const pnpmVersion = await getVersion('pnpm', ['--version']);
    checks.push({
      label: 'pnpm',
      ok: pnpmVersion !== null,
      detail: pnpmVersion ?? 'not found',
    });

    // 4. API key
    const config = loadConfig();
    const hasKey = !!config.apiKey;
    const entry = findProvider(config.provider);
    const envKeyName = entry?.envKey ?? '';
    checks.push({
      label: 'API key',
      ok: hasKey,
      detail: hasKey
        ? `configured${envKeyName ? ` (${envKeyName})` : ''}`
        : 'not configured',
    });

    // 5. Provider / Model
    checks.push({
      label: 'Provider',
      ok: true,
      detail: `${context.currentProvider} — ${context.currentModel}`,
    });

    const lines = ['Environment Check:'];
    for (const c of checks) {
      const icon = c.ok ? '\u2713' : '\u2717';
      lines.push(`  ${icon} ${c.label.padEnd(12)} ${c.detail}`);
    }

    return { type: 'message', message: lines.join('\n') };
  },
};
