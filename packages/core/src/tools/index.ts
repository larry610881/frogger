import { ToolRegistry } from './registry.js';
import { createReadFileTool, readFileMetadata } from './read-file.js';
import { createGlobTool, globMetadata } from './glob.js';
import { createGrepTool, grepMetadata } from './grep.js';
import { createListFilesTool, listFilesMetadata } from './list-files.js';
import { createWriteFileTool, writeFileMetadata } from './write-file.js';
import { createEditFileTool, editFileMetadata } from './edit-file.js';
import { createBashTool, bashMetadata } from './bash.js';
import { createGitStatusTool, gitStatusMetadata } from './git-status.js';
import { createGitDiffTool, gitDiffMetadata } from './git-diff.js';
import { createGitLogTool, gitLogMetadata } from './git-log.js';
import { createGitCommitTool, gitCommitMetadata } from './git-commit.js';
import { createGitInitTool, gitInitMetadata } from './git-init.js';
import { createGitBranchTool, gitBranchMetadata } from './git-branch.js';
import { createGitRemoteTool, gitRemoteMetadata } from './git-remote.js';
import { createGitPushTool, gitPushMetadata } from './git-push.js';
import { createGitPullTool, gitPullMetadata } from './git-pull.js';
import { createGitCloneTool, gitCloneMetadata } from './git-clone.js';
import { createTestRunnerTool, testRunnerMetadata } from './test-runner.js';
import { createSaveMemoryTool, saveMemoryMetadata } from './save-memory.js';
import { createWebSearchTool, webSearchMetadata } from './web-search.js';
import { createGhIssueTool, ghIssueMetadata } from './gh-issue.js';
import { createGhPrTool, ghPrMetadata } from './gh-pr.js';

export { ToolRegistry, type PermissionRequestCallback } from './registry.js';
export { assertWithinBoundary } from './security.js';
export { createReadFileTool, readFileMetadata } from './read-file.js';
export { createGlobTool, globMetadata } from './glob.js';
export { createGrepTool, grepMetadata } from './grep.js';
export { createListFilesTool, listFilesMetadata } from './list-files.js';
export { createWriteFileTool, writeFileMetadata } from './write-file.js';
export { createEditFileTool, editFileMetadata } from './edit-file.js';
export { createBashTool, bashMetadata, isCommandBlocked } from './bash.js';
export { createGitStatusTool, gitStatusMetadata } from './git-status.js';
export { createGitDiffTool, gitDiffMetadata } from './git-diff.js';
export { createGitLogTool, gitLogMetadata } from './git-log.js';
export { createGitCommitTool, gitCommitMetadata } from './git-commit.js';
export { createGitInitTool, gitInitMetadata } from './git-init.js';
export { createGitBranchTool, gitBranchMetadata } from './git-branch.js';
export { createGitRemoteTool, gitRemoteMetadata } from './git-remote.js';
export { createGitPushTool, gitPushMetadata } from './git-push.js';
export { createGitPullTool, gitPullMetadata } from './git-pull.js';
export { createGitCloneTool, gitCloneMetadata } from './git-clone.js';
export { createTestRunnerTool, testRunnerMetadata } from './test-runner.js';
export { createSaveMemoryTool, saveMemoryMetadata } from './save-memory.js';
export { createWebSearchTool, webSearchMetadata } from './web-search.js';
export type { SearchProvider, SearchResult } from './web-search.js';
export { createGhIssueTool, ghIssueMetadata } from './gh-issue.js';
export { createGhPrTool, ghPrMetadata } from './gh-pr.js';
export {
  detectGitAuthStatus, resolveGitAuthEnv, resolveGitAuthEnvForUrl,
  loadGitCredentials, saveGitCredentials, extractHostFromRemoteUrl, filterSensitiveOutput,
  type GitAuthStatus,
} from './git-auth-utils.js';

export function createToolRegistry(workingDirectory: string): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register('read-file', createReadFileTool(workingDirectory), readFileMetadata);
  registry.register('glob', createGlobTool(workingDirectory), globMetadata);
  registry.register('grep', createGrepTool(workingDirectory), grepMetadata);
  registry.register('list-files', createListFilesTool(workingDirectory), listFilesMetadata);
  registry.register('write-file', createWriteFileTool(workingDirectory), writeFileMetadata);
  registry.register('edit-file', createEditFileTool(workingDirectory), editFileMetadata);
  registry.register('bash', createBashTool(workingDirectory), bashMetadata);
  registry.register('git-status', createGitStatusTool(workingDirectory), gitStatusMetadata);
  registry.register('git-diff', createGitDiffTool(workingDirectory), gitDiffMetadata);
  registry.register('git-log', createGitLogTool(workingDirectory), gitLogMetadata);
  registry.register('git-commit', createGitCommitTool(workingDirectory), gitCommitMetadata);
  registry.register('git-init', createGitInitTool(workingDirectory), gitInitMetadata);
  registry.register('git-branch', createGitBranchTool(workingDirectory), gitBranchMetadata);
  registry.register('git-remote', createGitRemoteTool(workingDirectory), gitRemoteMetadata);
  registry.register('git-push', createGitPushTool(workingDirectory), gitPushMetadata);
  registry.register('git-pull', createGitPullTool(workingDirectory), gitPullMetadata);
  registry.register('git-clone', createGitCloneTool(workingDirectory), gitCloneMetadata);
  registry.register('test-runner', createTestRunnerTool(workingDirectory), testRunnerMetadata);
  registry.register('save-memory', createSaveMemoryTool(), saveMemoryMetadata);
  registry.register('web-search', createWebSearchTool(workingDirectory), webSearchMetadata);
  registry.register('gh-issue', createGhIssueTool(workingDirectory), ghIssueMetadata);
  registry.register('gh-pr', createGhPrTool(workingDirectory), ghPrMetadata);

  return registry;
}
