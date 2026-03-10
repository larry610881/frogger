import type { SlashCommand } from './types.js';
import { detectGitAuthStatus, loadGitCredentials, saveGitCredentials } from '../tools/git-auth-utils.js';

export const gitAuthCommand: SlashCommand = {
  name: 'git-auth',
  description: 'Check git authentication status and configure credentials',
  usage: '/git-auth [add <host> <username> <token>] [remove <host>]',

  async execute(args) {
    // /git-auth add <host> <username> <token>
    if (args[0] === 'add') {
      if (args.length < 4) {
        return {
          type: 'error',
          message: 'Usage: /git-auth add <host> <username> <token>\nExample: /git-auth add github.com myuser ghp_xxxxx',
        };
      }
      const [, host, username, token] = args;
      const creds = await loadGitCredentials();

      const existing = creds.credentials.findIndex(c => c.host === host);
      const entry = { host, username, token, createdAt: new Date().toISOString() };
      if (existing >= 0) {
        creds.credentials[existing] = entry;
      } else {
        creds.credentials.push(entry);
      }
      await saveGitCredentials(creds);

      return {
        type: 'message',
        message: `Credential saved for ${host} (user: ${username}).`,
      };
    }

    // /git-auth remove <host>
    if (args[0] === 'remove') {
      if (!args[1]) {
        return { type: 'error', message: 'Usage: /git-auth remove <host>' };
      }
      const creds = await loadGitCredentials();
      const before = creds.credentials.length;
      creds.credentials = creds.credentials.filter(c => c.host !== args[1]);
      if (creds.credentials.length === before) {
        return { type: 'error', message: `No credential found for ${args[1]}.` };
      }
      await saveGitCredentials(creds);
      return { type: 'message', message: `Credential removed for ${args[1]}.` };
    }

    // Default: show auth status
    const status = await detectGitAuthStatus();
    const lines: string[] = ['Git Authentication Status:', ''];

    // gh CLI
    if (status.ghCli.available) {
      if (status.ghCli.authenticated) {
        lines.push(`[ok] GitHub CLI: authenticated as ${status.ghCli.username}`);
      } else {
        lines.push('[!] GitHub CLI: installed but not authenticated (run: gh auth login)');
      }
    } else {
      lines.push('[-] GitHub CLI: not installed');
    }

    // SSH
    if (status.ssh.hasKeys) {
      lines.push(`[ok] SSH keys found: ${status.ssh.keyPaths.join(', ')}`);
    } else {
      lines.push('[-] SSH keys: none found');
    }

    // Credential helper
    if (status.credentialHelper.configured) {
      lines.push(`[ok] Git credential helper: ${status.credentialHelper.helper}`);
    } else {
      lines.push('[-] Git credential helper: not configured');
    }

    // Frogger PAT
    if (status.froggerPat.hasCredentials) {
      lines.push(`[ok] Frogger PAT: configured for ${status.froggerPat.hosts.join(', ')}`);
    } else {
      lines.push('[-] Frogger PAT: none configured');
    }

    lines.push('', 'To add a PAT: /git-auth add <host> <username> <token>');
    lines.push('To remove:    /git-auth remove <host>');

    return { type: 'message', message: lines.join('\n') };
  },
};
