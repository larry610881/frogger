import { runAgent, loadConfig, createModel, createAgentTools, generateRepoMap, findProvider, detectProjectInfo, formatProjectInfo } from '@frogger/core';
import { buildSystemPrompt, ModeManager, loadProjectContext, loadRules, loadMemory } from '@frogger/core';
import { resolveCapabilities } from '@frogger/shared';
import fs from 'node:fs/promises';

async function safeWrite(data: string): Promise<void> {
  const canContinue = process.stdout.write(data);
  if (!canContinue) {
    await new Promise<void>((resolve) => process.stdout.once('drain', resolve));
  }
}

export async function runPipeMode(options: {
  prompt: string;
  provider: string;
  model: string;
  workingDirectory: string;
  outputFile?: string;
  pipeAllow?: string[];
}): Promise<void> {
  // Handle Unix pipe break gracefully
  process.on('SIGPIPE', () => process.exit(0));
  // 1. Load config
  const config = loadConfig({ provider: options.provider, model: options.model });

  // 2. Create model
  const model = createModel(config.provider, config.model, { apiKey: config.apiKey });

  // 3. Set up ModeManager with 'agent' mode, get mode config
  const modeManager = new ModeManager('agent');
  const modeConfig = modeManager.getCurrentMode();

  // 4. Load project context + repo map + rules + project info
  const projectContext = await loadProjectContext(options.workingDirectory);
  const repoMap = await generateRepoMap({ workingDirectory: options.workingDirectory });
  const rules = loadRules(options.workingDirectory);
  const memory = loadMemory();
  const projectInfoData = await detectProjectInfo(options.workingDirectory);
  const projectInfo = formatProjectInfo(projectInfoData);

  // 5. Create tools via factory — auto-approve all (headless), checkpoints enabled
  const effectiveTools = options.pipeAllow
    ? modeConfig.allowedTools.filter(t => options.pipeAllow!.includes(t))
    : [...modeConfig.allowedTools];

  const { tools, toolHints } = await createAgentTools({
    workingDirectory: options.workingDirectory,
    allowedTools: effectiveTools,
    policy: 'auto',
    permissionCallback: async () => 'allow' as import('@frogger/shared').PermissionResponse,
  });

  // 6. Build system prompt (after tools so we have toolHints)
  const systemPrompt = buildSystemPrompt({
    modeConfig,
    workingDirectory: options.workingDirectory,
    projectContext,
    repoMap,
    rules,
    memory,
    toolHints,
    projectInfo,
  });

  // 7. Build messages
  const messages = [{ role: 'user' as const, content: options.prompt }];

  // 8. Resolve provider capabilities
  const providerEntry = findProvider(config.provider);
  const capabilities = providerEntry ? resolveCapabilities(providerEntry) : undefined;

  // 9. Run agent and stream JSON Lines to stdout
  let fullText = '';

  try {
    for await (const event of runAgent({ model, systemPrompt, messages, tools, providerType: providerEntry?.type, capabilities })) {
      switch (event.type) {
        case 'text_delta':
          fullText += event.textDelta;
          await safeWrite(
            JSON.stringify({ type: 'text_delta', text: event.textDelta }) + '\n',
          );
          break;

        case 'tool_call':
          await safeWrite(
            JSON.stringify({ type: 'tool_call', toolName: event.toolName, args: event.args }) + '\n',
          );
          break;

        case 'tool_result':
          await safeWrite(
            JSON.stringify({ type: 'tool_result', toolName: event.toolName, result: event.result }) + '\n',
          );
          break;

        case 'usage_update':
          // Skip — not relevant for pipe consumers
          break;

        case 'error':
          await safeWrite(
            JSON.stringify({ type: 'error', error: event.error }) + '\n',
          );
          break;

        case 'done':
          await safeWrite(
            JSON.stringify({
              type: 'done',
              usage: {
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
              },
            }) + '\n',
          );
          break;
      }
    }
  } catch (err) {
    // EPIPE = pipe consumer closed, exit gracefully
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EPIPE') {
      return;
    }
    throw err;
  }

  // 10. Write accumulated text to output file if specified
  if (options.outputFile) {
    await fs.writeFile(options.outputFile, fullText, 'utf-8');
  }
}
