import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModelMessage } from 'ai';
import type { ModeName, TokenUsage, PermissionResponse } from '@frogger/shared';
import type { UserContent } from 'ai';
import type { PermissionRequestCallback } from '@frogger/core';
import {
  COMMAND_HINTS, formatTokens, calculateCost, formatStats, formatToolSummary,
  type ChatMessage, type PendingToolCall,
} from '../utils/format.js';
import { useAgentServices } from './useAgentServices.js';
import { useContextBudget } from './useContextBudget.js';

// Re-export utilities for backward compatibility
export { formatTokens, calculateCost };

interface UseAgentOptions {
  provider: string;
  model?: string;
  mode: ModeName;
  initialPrompt?: string;
  onMessage: (msg: ChatMessage) => void;
  onModeChange?: (mode: ModeName) => void;
  onClearHistory?: () => void;
  onProviderModelChange?: (provider: string, model: string) => void;
  onTriggerSetup?: () => void;
}

export function useAgent(options: UseAgentOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [liveUsage, setLiveUsage] = useState<TokenUsage | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
  const [pendingPermission, setPendingPermission] = useState<{
    toolName: string;
    args: Record<string, unknown>;
    resolve: (response: PermissionResponse) => void;
  } | null>(null);

  // Track pending permission resolve function via ref so the finally block
  // can resolve it on abort (React state updates are async and unreliable in closures)
  const pendingPermissionResolveRef = useRef<((response: PermissionResponse) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ModelMessage[]>([]);
  const initialSubmittedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const totalTokensRef = useRef(0);
  const sessionPromptTokensRef = useRef(0);
  const sessionCompletionTokensRef = useRef(0);
  // Queue for auto-execute after plan mode
  const autoExecuteRef = useRef<string | null>(null);
  const modeRef = useRef(options.mode);
  modeRef.current = options.mode;

  // Extracted hooks
  const { budgetTrackerRef, checkpointManagerRef, ensureInitialized, ensureCheckpointManager } =
    useAgentServices(options.provider, options.model);

  const { contextBudget, updateBudget, maybeAutoCompact } = useContextBudget({
    provider: options.provider,
    model: options.model,
    messagesRef,
    ensureInitialized,
    onMessage: options.onMessage,
  });

  const submitInternal = useCallback(async (text: string, overrideMode?: ModeName) => {
    const activeMode = overrideMode ?? modeRef.current;

    // Resolve @file references before adding to messages
    const { resolveFileReferences, findProvider: lookupProvider } = await import('@frogger/core');
    const { supportsVision } = await import('@frogger/shared');
    const workingDirectory = process.cwd();
    const { cleanText, references, imageReferences, errors } = await resolveFileReferences(text, workingDirectory);

    // Show errors for failed file references
    if (errors.length > 0) {
      options.onMessage({
        id: `file-ref-err-${Date.now()}`,
        role: 'tool',
        content: `File reference errors: ${errors.join(', ')}`,
      });
    }

    // Check provider vision support for image references
    const providerEntry = lookupProvider(options.provider);
    const visionSupported = providerEntry ? supportsVision(providerEntry.type) : false;

    // Warn and skip images if provider doesn't support vision
    if (imageReferences.length > 0 && !visionSupported) {
      const skippedFiles = imageReferences.map(r => r.path).join(', ');
      options.onMessage({
        id: `vision-warn-${Date.now()}`,
        role: 'tool',
        content: `Image input is not supported with the current provider (${providerEntry?.label ?? options.provider}). Skipping: ${skippedFiles}. Switch to Anthropic or OpenAI to use image input.`,
      });
    }

    // Build augmented message with file contents
    const textContent = references.length > 0
      ? `${cleanText}\n\n${references.map(r => `<file path="${r.path}">\n${r.content}\n</file>`).join('\n\n')}`
      : text;

    options.onMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
    });

    // Build message: use multimodal content when images present + vision supported
    if (imageReferences.length > 0 && visionSupported) {
      const parts: UserContent = [{ type: 'text', text: textContent }];
      for (const img of imageReferences) {
        parts.push({ type: 'image', image: img.base64, mediaType: img.mediaType });
      }
      messagesRef.current.push({ role: 'user', content: parts });
    } else {
      messagesRef.current.push({ role: 'user', content: textContent });
    }

    setIsStreaming(true);
    setStreamingText('');
    setLiveUsage(null);

    const taskStart = performance.now();

    try {
      const { runAgent, loadConfig, createModel, ModeManager, buildSystemPrompt, createAgentTools, loadProjectContext, generateRepoMap } = await import('@frogger/core');

      const config = loadConfig({ provider: options.provider, model: options.model });
      const model = createModel(config.provider, config.model, { apiKey: config.apiKey });
      const modeManager = new ModeManager(activeMode);
      const modeConfig = modeManager.getCurrentMode();
      const projectContext = await loadProjectContext(workingDirectory);
      const repoMap = await generateRepoMap({ workingDirectory });
      const systemPrompt = buildSystemPrompt({ modeConfig, workingDirectory, projectContext, repoMap });

      const permissionCallback: PermissionRequestCallback = (toolName, args) => {
        return new Promise((resolve) => {
          pendingPermissionResolveRef.current = resolve;
          setPendingPermission({ toolName, args, resolve });
        });
      };

      // Ensure shared checkpoint manager is ready (also used by /rewind)
      await ensureCheckpointManager();

      // createAgentTools: encapsulates registry + permission + checkpoint wiring
      const { tools } = await createAgentTools({
        workingDirectory,
        allowedTools: [...modeConfig.allowedTools],
        policy: modeConfig.approvalPolicy,
        permissionCallback,
        existingCheckpointManager: checkpointManagerRef.current!,
        getMessageCount: () => messagesRef.current.length,
      });

      let currentText = '';
      let fullText = '';
      const abortController = new AbortController();
      abortRef.current = abortController;

      for await (const event of runAgent({
        model,
        systemPrompt,
        messages: [...messagesRef.current],
        tools,
        abortSignal: abortController.signal,
      })) {
        switch (event.type) {
          case 'text_delta':
            currentText += event.textDelta;
            fullText += event.textDelta;
            setStreamingText(currentText);
            break;

          case 'tool_call': {
            if (currentText.trim()) {
              options.onMessage({
                id: `text-${Date.now()}`,
                role: 'assistant',
                content: currentText.trim(),
              });
              currentText = '';
              setStreamingText('');
            }
            setPendingToolCall({ toolName: event.toolName, args: event.args });
            break;
          }

          case 'tool_result': {
            const summary = formatToolSummary(event.toolName, pendingToolCall?.args ?? {}, event.result);
            options.onMessage({
              id: `tool-${Date.now()}`,
              role: 'tool',
              content: summary,
            });
            setPendingToolCall(null);
            currentText = '';
            setStreamingText('');
            break;
          }

          case 'usage_update':
            setLiveUsage(event.usage);
            break;

          case 'done': {
            if (currentText.trim()) {
              options.onMessage({
                id: `text-${Date.now()}`,
                role: 'assistant',
                content: currentText.trim(),
              });
            }
            if (fullText) {
              messagesRef.current.push({ role: 'assistant', content: fullText });
            }

            // Show task elapsed time + token usage
            const elapsed = performance.now() - taskStart;
            const tokens = event.usage;
            const resolvedModel = config.model;
            options.onMessage({
              id: `stats-${Date.now()}`,
              role: 'tool',
              content: formatStats(elapsed, tokens, resolvedModel),
            });

            // Accumulate session-level token usage
            sessionPromptTokensRef.current += tokens?.promptTokens ?? 0;
            sessionCompletionTokensRef.current += tokens?.completionTokens ?? 0;

            // Update context budget after completion
            await updateBudget(systemPrompt);

            // Auto-save session
            totalTokensRef.current += tokens?.totalTokens ?? 0;
            try {
              const { SessionManager } = await import('@frogger/core');
              const sessionManager = new SessionManager();
              sessionIdRef.current = await sessionManager.save({
                workingDirectory,
                provider: options.provider,
                model: options.model ?? config.model,
                messages: messagesRef.current,
                totalTokens: totalTokensRef.current,
                existingId: sessionIdRef.current ?? undefined,
              });
            } catch {
              // Session save failure is non-critical
            }
            break;
          }
        }
      }

      // Plan mode auto-execute: switch to Agent mode and execute the plan
      if (activeMode === 'plan' && fullText.trim()) {
        autoExecuteRef.current = fullText.trim();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      options.onMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      setLiveUsage(null);
      setPendingToolCall(null);
      // Resolve any pending permission promise with 'deny' before clearing,
      // so the agent loop can terminate cleanly instead of leaking the Promise.
      if (pendingPermissionResolveRef.current) {
        pendingPermissionResolveRef.current('deny');
        pendingPermissionResolveRef.current = null;
      }
      setPendingPermission(null);
      abortRef.current = null;

      // After plan finishes, auto-switch to agent mode and execute
      if (autoExecuteRef.current) {
        const planText = autoExecuteRef.current;
        autoExecuteRef.current = null;

        options.onModeChange?.('agent');
        options.onMessage({
          id: `system-${Date.now()}`,
          role: 'tool',
          content: '⚡ Plan complete — switching to Agent mode to execute...',
        });

        // Small delay to let mode state propagate
        await new Promise(r => setTimeout(r, 50));
        await submitInternal(
          `Execute the plan above. Here is the plan for reference:\n\n${planText}`,
          'agent',
        );
      }
    }
  }, [options, pendingToolCall, updateBudget, ensureInitialized, ensureCheckpointManager, checkpointManagerRef]);

  const submit = useCallback(async (text: string) => {
    const { commandRegistry } = await ensureInitialized();

    // Intercept slash commands
    if (commandRegistry.isCommand(text)) {
      const { loadConfig, createModel, loadProviders, findModelInfo } = await import('@frogger/core');
      const config = loadConfig({ provider: options.provider, model: options.model });
      const providers = loadProviders();

      let model = null;
      try {
        model = createModel(config.provider, config.model, { apiKey: config.apiKey });
      } catch {
        // Model may not be configured yet
      }

      const sessionTotalTokens = sessionPromptTokensRef.current + sessionCompletionTokensRef.current;
      const result = await commandRegistry.execute(text, {
        messagesRef,
        budgetTracker: budgetTrackerRef.current,
        model,
        providers,
        currentProvider: options.provider,
        currentModel: options.model ?? config.model,
        sessionUsage: {
          promptTokens: sessionPromptTokensRef.current,
          completionTokens: sessionCompletionTokensRef.current,
          totalTokens: sessionTotalTokens,
          estimatedCost: calculateCost(sessionPromptTokensRef.current, sessionCompletionTokensRef.current, options.model ?? config.model),
        },
        onClearHistory: options.onClearHistory,
        onProviderModelChange: (provider, modelName) => {
          // Update budget tracker with new model info
          const modelInfo = findModelInfo(provider, modelName);
          budgetTrackerRef.current?.setModelInfo(modelInfo);
          options.onProviderModelChange?.(provider, modelName);
        },
        onTriggerSetup: options.onTriggerSetup,
        onCompactDone: (_summary, _count) => {
          void updateBudget();
        },
      });

      if (result) {
        options.onMessage({
          id: `cmd-${Date.now()}`,
          role: 'tool',
          content: result.message,
        });

        // Handle /rewind conversation truncation
        const rewindResult = result as { messageIndex?: number };
        if (rewindResult.messageIndex !== undefined) {
          messagesRef.current = messagesRef.current.slice(0, rewindResult.messageIndex);
        }

        // Update budget after command execution
        await updateBudget();
      }
      return;
    }

    // Normal message: check auto-compact then submit
    await maybeAutoCompact();
    await submitInternal(text);
  }, [submitInternal, ensureInitialized, options, maybeAutoCompact, updateBudget, budgetTrackerRef]);

  useEffect(() => {
    if (options.initialPrompt && !initialSubmittedRef.current) {
      initialSubmittedRef.current = true;
      submit(options.initialPrompt);
    }
  }, [options.initialPrompt, submit]);

  const respondPermission = useCallback((response: PermissionResponse) => {
    if (pendingPermission) {
      pendingPermission.resolve(response);
      pendingPermissionResolveRef.current = null;
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  return { isStreaming, streamingText, liveUsage, pendingToolCall, pendingPermission, contextBudget, commandHints: COMMAND_HINTS, submit, respondPermission };
}
