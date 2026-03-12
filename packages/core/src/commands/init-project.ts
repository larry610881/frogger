import type { SlashCommand } from './types.js';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_FILE } from '@frogger/shared';

export const initProjectCommand: SlashCommand = {
  name: 'init-project',
  description: 'Generate FROGGER.md from project structure',
  usage: '/init-project',
  execute(_args, _context) {
    const workDir = process.cwd();
    const targetPath = path.join(workDir, PROJECT_FILE);

    if (fs.existsSync(targetPath)) {
      return { type: 'message', message: `${PROJECT_FILE} already exists. Delete it first to regenerate.` };
    }

    // Scan package.json
    let pkgInfo = '';
    const pkgPath = path.join(workDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      pkgInfo = `Project: ${pkg.name ?? path.basename(workDir)}\n`;
      if (pkg.description) pkgInfo += `Description: ${pkg.description}\n`;
      if (pkg.scripts) {
        pkgInfo += `\nScripts:\n${Object.entries(pkg.scripts).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n')}\n`;
      }
    }

    // Scan top-level directory structure
    const entries = fs.readdirSync(workDir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.isDirectory() ? `${e.name}/` : e.name)
      .slice(0, 30);

    const content = `# ${path.basename(workDir)}\n\n${pkgInfo}\n## Directory Structure\n\n\`\`\`\n${entries.join('\n')}\n\`\`\`\n\n## Notes\n\n<!-- Add project-specific instructions for the AI here -->\n`;

    fs.writeFileSync(targetPath, content, 'utf-8');
    return { type: 'message', message: `Created ${PROJECT_FILE} — edit it to add project-specific instructions.` };
  },
};
