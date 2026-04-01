// Agent
export { runAgent, type RunAgentOptions, type ThinkingConfig } from './agent/agent.js';
export { AgentContext } from './agent/context.js';
export { SessionManager, type SessionData } from './agent/session.js';
export { resolveFileReferences, isImageFile, type FileReferenceResult, type ImageReference } from './agent/file-reference.js';
export { CheckpointManager, type Checkpoint, type RestoreResult } from './agent/checkpoint.js';
export { createAgentTools, type CreateAgentToolsOptions, type AgentToolsResult } from './agent/agent-tools.js';
export { generateRepoMap, type RepoMapOptions } from './agent/repo-map.js';
export { AuditLogger } from './audit/index.js';
export { BackgroundTaskManager, type BackgroundTaskInfo, type BackgroundTaskRunner, type BackgroundTaskStatus } from './agent/background-task.js';

// Context Management
export { estimateTokens, estimateMessagesTokens } from './agent/token-estimator.js';
export { ContextBudgetTracker, type ContextBudget } from './agent/context-budget.js';
export { compactMessages, type CompactResult } from './agent/compact.js';

// Commands
export { CommandRegistry } from './commands/registry.js';
export { clearCommand } from './commands/clear.js';
export { compactCommand } from './commands/compact.js';
export { compactThresholdCommand } from './commands/compact-threshold.js';
export { modelCommand } from './commands/model.js';
export { setupCommand } from './commands/setup.js';
export { undoCommand } from './commands/undo.js';
export { sessionsCommand } from './commands/sessions.js';
export { resumeCommand } from './commands/resume.js';
export { gitAuthCommand } from './commands/git-auth.js';
export { costCommand } from './commands/cost.js';
export { auditCommand } from './commands/audit.js';
export { mcpCommand } from './commands/mcp.js';
export { contextCommand } from './commands/context.js';
export { doctorCommand } from './commands/doctor.js';
export { createRewindCommand } from './commands/rewind.js';
export { initProjectCommand } from './commands/init-project.js';
export { rememberCommand } from './commands/remember.js';
export { issueCommand } from './commands/issue.js';
export { bgCommand } from './commands/bg.js';
export { tasksCommand, taskCommand } from './commands/tasks.js';
export { loadCustomCommands } from './commands/custom-loader.js';
export { updateCheckCommand, checkForUpdate, isNewerVersion, formatUpdateMessage, type UpdateCheckResult } from './commands/update-check.js';
export type { SlashCommand, SlashCommandContext, SlashCommandResult, BaseCommandContext, BudgetContext, ProviderContext, UsageContext } from './commands/types.js';

// Modes
export { ModeManager } from './modes/manager.js';
export { askMode } from './modes/ask.js';
export { planMode } from './modes/plan.js';
export { agentMode } from './modes/agent.js';

// LLM
export { createProvider, createModel } from './llm/provider.js';
export { buildSystemPrompt } from './llm/system-prompt.js';
export type { SystemPromptOptions } from './llm/system-prompt.js';
export { detectProjectInfo, formatProjectInfo } from './llm/project-detection.js';
export type { ProjectInfo } from './llm/project-detection.js';

// Tools & Permissions
export { ToolRegistry, createToolRegistry, type PermissionRequestCallback } from './tools/index.js';
export { PermissionManager } from './permission/permission.js';
export type { PermissionCallback } from './permission/permission.js';
export {
  resolvePermission, buildPermissionRule, savePermissionRule, loadPermissionRules,
  matchesRule, getProjectPermissionsPath, getGlobalPermissionsPath,
  type PermissionRulesFile,
} from './permission/rules.js';
export { isPermissionsConfirmed, confirmPermissions } from './permission/confirmed-permissions.js';

// Config
export {
  loadConfig, saveConfig, hasConfig, loadProjectContext,
  loadProviders, saveProviders, addProvider, removeProvider, findProvider, findModelInfo,
} from './config/config.js';
export type { FroggerConfig, NotificationsConfig } from './config/config.js';
export { loadRules } from './config/rules.js';
export { loadMemory } from './config/memory.js';

// Hooks
export { loadHooksConfig, runHooks, matchesToolName, type HooksConfig, type HookEntry, type HookContext, type HookResult } from './hooks/index.js';

// MCP
export {
  loadMCPConfig, MCPClientManager, convertMCPTools, createTransport, getTransportType,
  type MCPConfig, type MCPServerConfig, type MCPStdioConfig, type MCPSSEConfig, type MCPHTTPConfig, type MCPToolInfo,
} from './mcp/index.js';

// Logger
export { logger, setLogLevel, getLogLevel, setLogFormat, getLogFormat, type LogLevel, type LogFormat } from './utils/logger.js';

// Benchmark
export { BenchmarkRunner } from './benchmark/runner.js';
export { getAllTasks, getTask } from './benchmark/tasks/index.js';
export type { BenchmarkTask, BenchmarkResult, BenchmarkValidation } from './benchmark/types.js';
export { SWEBenchRunner } from './benchmark/swe-bench.js';
export type { SWEBenchTask, SWEBenchResult, SWEBenchReport, SWEBenchRunnerOptions } from './benchmark/swe-bench.js';
