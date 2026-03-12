import { useCallback, useRef } from 'react';

/**
 * Lazy-initializes and manages shared agent services:
 * - ContextBudgetTracker
 * - CommandRegistry (with all slash commands)
 * - CheckpointManager
 */
export function useAgentServices(provider: string, model?: string) {
  const budgetTrackerRef = useRef<import('@frogger/core').ContextBudgetTracker | null>(null);
  const commandRegistryRef = useRef<import('@frogger/core').CommandRegistry | null>(null);
  const checkpointManagerRef = useRef<import('@frogger/core').CheckpointManager | null>(null);
  const checkpointInitPromiseRef = useRef<Promise<void> | null>(null);

  const ensureCheckpointManager = useCallback(async () => {
    if (checkpointManagerRef.current) return;
    if (!checkpointInitPromiseRef.current) {
      checkpointInitPromiseRef.current = (async () => {
        const { CheckpointManager } = await import('@frogger/core');
        const workingDirectory = process.cwd();
        const isGitRepo = await CheckpointManager.detectGitRepo(workingDirectory);
        checkpointManagerRef.current = new CheckpointManager({ workingDirectory, isGitRepo });
      })();
    }
    await checkpointInitPromiseRef.current;
  }, []);

  const ensureInitialized = useCallback(async () => {
    if (!budgetTrackerRef.current || !commandRegistryRef.current) {
      const {
        ContextBudgetTracker, CommandRegistry, findModelInfo,
        clearCommand, compactCommand, compactThresholdCommand, modelCommand, setupCommand,
        undoCommand, sessionsCommand, resumeCommand, gitAuthCommand,
        costCommand, contextCommand, doctorCommand, createRewindCommand,
        loadCustomCommands, mcpCommand, initProjectCommand, rememberCommand, issueCommand,
        bgCommand, tasksCommand, taskCommand, updateCheckCommand,
      } = await import('@frogger/core');

      const modelInfo = findModelInfo(provider, model ?? 'deepseek-chat');

      if (!budgetTrackerRef.current) {
        budgetTrackerRef.current = new ContextBudgetTracker(modelInfo);
      }

      // Ensure checkpoint manager is ready before registering /rewind
      await ensureCheckpointManager();

      if (!commandRegistryRef.current) {
        const registry = new CommandRegistry();
        registry.register(clearCommand);
        registry.register(compactCommand);
        registry.register(compactThresholdCommand);
        registry.register(modelCommand);
        registry.register(setupCommand);
        registry.register(undoCommand);
        registry.register(sessionsCommand);
        registry.register(resumeCommand);
        registry.register(gitAuthCommand);
        registry.register(costCommand);
        registry.register(contextCommand);
        registry.register(doctorCommand);
        registry.register(updateCheckCommand);
        registry.register(createRewindCommand(checkpointManagerRef.current!));
        registry.register(mcpCommand);
        registry.register(initProjectCommand);
        registry.register(rememberCommand);
        registry.register(issueCommand);
        registry.register(bgCommand);
        registry.register(tasksCommand);
        registry.register(taskCommand);
        // Load custom commands from .frogger/commands/*.md
        const customCommands = loadCustomCommands(process.cwd());
        for (const cmd of customCommands) registry.register(cmd);
        commandRegistryRef.current = registry;
      }
    }
    return {
      budgetTracker: budgetTrackerRef.current!,
      commandRegistry: commandRegistryRef.current!,
    };
  }, [provider, model, ensureCheckpointManager]);

  return {
    budgetTrackerRef,
    checkpointManagerRef,
    ensureInitialized,
    ensureCheckpointManager,
  };
}
