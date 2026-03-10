import { runAgent, loadConfig, createModel, createAgentTools, generateRepoMap } from '@frogger/core';
import { buildSystemPrompt, ModeManager, loadProjectContext } from '@frogger/core';
import fs from 'node:fs/promises';

export async function runPipeMode(options: {
  prompt: string;
  provider: string;
  model: string;
  workingDirectory: string;
  outputFile?: string;
  pipeAllow?: string[];
}): Promise<void> {
  // 1. Load config
  const config = loadConfig({ provider: options.provider, model: options.model });

  // 2. Create model
  const model = createModel(config.provider, config.model, { apiKey: config.apiKey });

  // 3. Set up ModeManager with 'agent' mode, get mode config
  const modeManager = new ModeManager('agent');
  const modeConfig = modeManager.getCurrentMode();

  // 4. Load project context + repo map
  const projectContext = await loadProjectContext(options.workingDirectory);
  const repoMap = await generateRepoMap({ workingDirectory: options.workingDirectory });

  // 5. Build system prompt
  const systemPrompt = buildSystemPrompt({
    modeConfig,
    workingDirectory: options.workingDirectory,
    projectContext,
    repoMap,
  });

  // 6. Create tools via factory — auto-approve all (headless), checkpoints enabled
  const effectiveTools = options.pipeAllow
    ? modeConfig.allowedTools.filter(t => options.pipeAllow!.includes(t))
    : [...modeConfig.allowedTools];

  const { tools } = await createAgentTools({
    workingDirectory: options.workingDirectory,
    allowedTools: effectiveTools,
    policy: 'auto',
    permissionCallback: async () => 'allow' as import('@frogger/shared').PermissionResponse,
  });

  // 7. Build messages
  const messages = [{ role: 'user' as const, content: options.prompt }];

  // 9. Run agent and stream JSON Lines to stdout
  let fullText = '';

  for await (const event of runAgent({ model, systemPrompt, messages, tools })) {
    switch (event.type) {
      case 'text_delta':
        fullText += event.textDelta;
        process.stdout.write(
          JSON.stringify({ type: 'text_delta', text: event.textDelta }) + '\n',
        );
        break;

      case 'tool_call':
        process.stdout.write(
          JSON.stringify({ type: 'tool_call', toolName: event.toolName, args: event.args }) + '\n',
        );
        break;

      case 'tool_result':
        process.stdout.write(
          JSON.stringify({ type: 'tool_result', toolName: event.toolName, result: event.result }) + '\n',
        );
        break;

      case 'usage_update':
        // Skip — not relevant for pipe consumers
        break;

      case 'error':
        process.stdout.write(
          JSON.stringify({ type: 'error', error: event.error }) + '\n',
        );
        break;

      case 'done':
        process.stdout.write(
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

  // 10. Write accumulated text to output file if specified
  if (options.outputFile) {
    await fs.writeFile(options.outputFile, fullText, 'utf-8');
  }
}
