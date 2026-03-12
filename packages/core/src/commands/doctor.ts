import { execa } from 'execa';
import { loadConfig, findProvider } from '../config/config.js';
import { checkForUpdate, formatUpdateMessage } from './update-check.js';
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

    // 4. GitHub CLI
    const ghVersion = await getVersion('gh', ['--version']);
    let ghDetail = ghVersion ?? 'not found';
    let ghOk = false;
    if (ghVersion) {
      const ghAuth = await execa('gh', ['auth', 'status'], { reject: false, timeout: 5000 });
      ghOk = ghAuth.exitCode === 0;
      ghDetail = ghOk
        ? `${ghVersion.split('\n')[0]} (authenticated)`
        : `${ghVersion.split('\n')[0]} (not authenticated)`;
    }
    checks.push({
      label: 'GitHub CLI',
      ok: ghOk,
      detail: ghDetail,
    });

    // 5. API key
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

    // 6. Provider / Model
    checks.push({
      label: 'Provider',
      ok: true,
      detail: `${context.currentProvider} — ${context.currentModel}`,
    });

    // 7. Update check (non-blocking)
    let updateMsg = '';
    try {
      const updateResult = await checkForUpdate();
      checks.push({
        label: 'Updates',
        ok: !updateResult.updateAvailable,
        detail: updateResult.updateAvailable
          ? `${updateResult.currentVersion} → ${updateResult.latestVersion} available`
          : `up to date (${updateResult.currentVersion})`,
      });
      updateMsg = formatUpdateMessage(updateResult);
    } catch {
      checks.push({
        label: 'Updates',
        ok: true,
        detail: 'could not check (offline?)',
      });
    }

    const lines = ['Environment Check:'];
    for (const c of checks) {
      const icon = c.ok ? '\u2713' : '\u2717';
      lines.push(`  ${icon} ${c.label.padEnd(12)} ${c.detail}`);
    }

    if (updateMsg) {
      lines.push('', updateMsg);
    }

    return { type: 'message', message: lines.join('\n') };
  },
};
