import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { APP_VERSION } from '@frogger/shared';
import { App } from './components/App.js';
import { InitSetup } from './components/InitSetup.js';
import { ProviderAddSetup } from './components/ProviderAddSetup.js';
import { sessionState } from './session-state.js';

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function printResumeHint(): void {
  if (sessionState.sessionId && sessionState.hasMessages) {
    console.log('');
    console.log(`To resume this session, run: frogger --resume ${sessionState.sessionId}`);
    console.log('Or to continue the latest session here: frogger -c');
  }
}

function renderInit(): void {
  const { unmount } = render(
    <InitSetup onComplete={() => {
      unmount();
      renderApp({});
    }} />
  );
}

function renderApp(opts: {
  prompt?: string;
  mode?: string;
  provider?: string;
  model?: string;
  resume?: string;
  continue?: boolean;
  verbose?: boolean;
  thinking?: boolean;
  notify?: boolean;
}): void {
  // Lazy check: if no config and no API key in env, guide user to init
  import('@frogger/core').then(async ({ loadConfig, SessionManager, setLogLevel }) => {
    if (opts.verbose) {
      setLogLevel('debug');
    }
    const config = loadConfig({ provider: opts.provider, model: opts.model, thinking: opts.thinking, notify: opts.notify });
    if (!config.apiKey) {
      console.log('🐸 No API key found. Running setup...\n');
      renderInit();
      return;
    }

    // Handle --continue flag: resume latest session for current directory
    let resumePrompt: string | undefined;
    if (opts.continue) {
      const sessionManager = new SessionManager();
      const session = await sessionManager.getLatestForDirectory(process.cwd());

      if (session) {
        console.log(`🐸 Resuming session: ${session.id}`);
        console.log(`   From: ${new Date(session.updatedAt).toLocaleString()}`);
        console.log(`   Directory: ${session.workingDirectory}`);
        console.log(`   Messages: ${session.messages.length}\n`);
        resumePrompt = `/resume ${session.id}`;
      } else {
        console.log(`⚠️  No previous session found for this directory: ${process.cwd()}`);
        console.log(`   Use "frogger" to start a new session.\n`);
        return;
      }
    }

    // Handle --resume flag
    if (!resumePrompt && opts.resume) {
      const sessionManager = new SessionManager();
      const session = opts.resume === 'latest'
        ? await sessionManager.getLatest()
        : await sessionManager.load(opts.resume);

      if (session) {
        console.log(`🐸 Resuming session: ${session.id}`);
        console.log(`   From: ${new Date(session.updatedAt).toLocaleString()}`);
        console.log(`   Messages: ${session.messages.length}\n`);
        resumePrompt = `/resume ${session.id}`;
      } else {
        console.log(`⚠️  Session not found: ${opts.resume}\n`);
      }
    }

    // Startup hint: detect recent session (only when not resuming)
    if (!resumePrompt) {
      const sm = new SessionManager();
      const recent = await sm.getLatestForDirectory(process.cwd());
      if (recent) {
        const ago = formatTimeAgo(recent.updatedAt);
        console.log(`💡 Previous session found (${ago}). Resume with: frogger -c\n`);
      }
    }

    const instance = render(
      <App
        initialPrompt={resumePrompt ?? opts.prompt}
        initialMode={opts.mode}
        provider={opts.provider ?? config.provider}
        model={opts.model ?? config.model}
        thinking={config.thinking}
        notifications={config.notifications}
      />
    );

    // Normal exit: print resume hint after Ink unmounts
    instance.waitUntilExit().then(() => printResumeHint()).catch((e) => console.error('[WARN] Exit handler:', e instanceof Error ? e.message : e));

    // Signal exit: print resume hint on SIGTERM/SIGHUP
    const onSignal = () => {
      printResumeHint();
      process.exit(0);
    };
    process.on('SIGTERM', onSignal);
    process.on('SIGHUP', onSignal);
  });
}

export function startCli(): void {
  // Set terminal tab title
  process.stdout.write('\x1b]0;frogger\x07');

  const program = new Command()
    .name('frogger')
    .description('AI Coding Agent')
    .version(APP_VERSION);

  program
    .command('init')
    .description('Configure provider, model, and API key')
    .action(() => {
      renderInit();
    });

  // -----------------------------------------------------------------------
  // Provider management
  // -----------------------------------------------------------------------
  const providerCmd = program
    .command('provider')
    .description('Manage LLM providers');

  providerCmd
    .command('list')
    .description('List registered providers')
    .action(async () => {
      const { loadProviders } = await import('@frogger/core');
      const providers = loadProviders();

      console.log('\nRegistered Providers:\n');
      console.log(
        'Name'.padEnd(16) +
        'Label'.padEnd(24) +
        'Type'.padEnd(20) +
        'Default Model'.padEnd(28) +
        'Env Key'
      );
      console.log('-'.repeat(100));
      for (const p of providers) {
        console.log(
          p.name.padEnd(16) +
          p.label.padEnd(24) +
          p.type.padEnd(20) +
          p.defaultModel.padEnd(28) +
          p.envKey
        );
      }
      console.log(`\nTotal: ${providers.length} provider(s)\n`);
    });

  providerCmd
    .command('add')
    .description('Add a new provider (interactive)')
    .action(() => {
      const { unmount } = render(
        <ProviderAddSetup onComplete={(entry) => {
          unmount();
          if (entry) {
            console.log(`\nProvider "${entry.name}" added successfully.\n`);
          } else {
            console.log('\nCancelled.\n');
          }
        }} />
      );
    });

  providerCmd
    .command('remove <name>')
    .description('Remove a registered provider')
    .action(async (name: string) => {
      try {
        const { removeProvider } = await import('@frogger/core');
        await removeProvider(name);
        console.log(`\nProvider "${name}" removed.\n`);
      } catch (err) {
        console.error(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  // -----------------------------------------------------------------------
  // Benchmark
  // -----------------------------------------------------------------------
  program
    .command('benchmark')
    .description('Run agent benchmark tasks')
    .option('--task <name>', 'Run a specific task')
    .option('--list', 'List available tasks')
    .option('-p, --provider <provider>', 'LLM provider')
    .option('--model <model>', 'Model name')
    .action(async (options: { task?: string; list?: boolean; provider?: string; model?: string }) => {
      const { getAllTasks, getTask, BenchmarkRunner } = await import('@frogger/core');

      if (options.list) {
        const tasks = getAllTasks();
        console.log('\nAvailable benchmark tasks:\n');
        console.log('  Name          Difficulty  Description');
        console.log('  ' + '-'.repeat(60));
        for (const t of tasks) {
          const name = t.name.padEnd(14);
          const diff = t.difficulty.padEnd(12);
          console.log(`  ${name}${diff}${t.description}`);
        }
        console.log('');
        return;
      }

      const runner = new BenchmarkRunner({
        provider: options.provider,
        model: options.model,
      });

      const tasks = options.task ? [getTask(options.task)].filter(Boolean) : getAllTasks();

      if (tasks.length === 0) {
        console.error(`Unknown task: ${options.task}`);
        process.exitCode = 1;
        return;
      }

      console.log(`\nRunning ${tasks.length} benchmark task(s)...\n`);

      let passed = 0;
      const results = [];

      for (const task of tasks) {
        process.stdout.write(`  [....] ${task!.name} (${task!.difficulty})`);
        const result = await runner.run(task!);
        results.push(result);

        const status = result.pass ? 'PASS' : 'FAIL';
        const duration = (result.durationMs / 1000).toFixed(1) + 's';
        const tokens = result.usage ? ` | ${result.usage.totalTokens} tokens` : '';

        // Clear line and rewrite with result
        process.stdout.write(`\r  [${status}] ${task!.name} (${task!.difficulty}) — ${duration}${tokens}\n`);

        if (!result.pass) {
          console.log(`         ${result.message}`);
        }

        if (result.pass) passed++;
      }

      console.log(`\nResults: ${passed}/${tasks.length} passed\n`);
      process.exitCode = passed === tasks.length ? 0 : 1;
    });

  program
    .argument('[prompt]', 'Initial prompt')
    .option('-m, --mode <mode>', 'Initial mode (ask/plan/agent)', 'agent')
    .option('-p, --provider <provider>', 'LLM provider (deepseek/anthropic/openai)')
    .option('--model <model>', 'Model name')
    .option('--pipe', 'Run in non-interactive pipe mode (JSON Lines output)')
    .option('--pipe-allow <tools>', 'Comma-separated list of allowed tools in pipe mode')
    .option('--output <file>', 'Write final text output to file (pipe mode)')
    .option('--resume <id>', 'Resume a previous session (use "latest" for most recent)')
    .option('-c, --continue', 'Continue the last session for the current directory')
    .option('-v, --verbose', 'Enable debug logging (stderr)')
    .option('--thinking', 'Enable extended thinking (Anthropic only)')
    .option('--no-thinking', 'Disable extended thinking')
    .option('--notify', 'Enable desktop notifications on task completion')
    .option('--no-notify', 'Disable desktop notifications')
    .action(async (prompt, options) => {
      if (options.pipe) {
        // Pipe mode: read prompt from arg or stdin
        let pipePrompt = prompt;
        if (!pipePrompt && !process.stdin.isTTY) {
          // Read from stdin
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          pipePrompt = Buffer.concat(chunks).toString('utf-8').trim();
        }
        if (!pipePrompt) {
          console.error('Error: pipe mode requires a prompt argument or stdin input');
          process.exitCode = 1;
          return;
        }
        const { runPipeMode } = await import('./pipe-mode.js');
        await runPipeMode({
          prompt: pipePrompt,
          provider: options.provider ?? 'deepseek',
          model: options.model ?? 'deepseek-chat',
          workingDirectory: process.cwd(),
          outputFile: options.output,
          pipeAllow: options.pipeAllow ? options.pipeAllow.split(',').map((t: string) => t.trim()) : undefined,
        });
        return;
      }

      renderApp({
        prompt,
        mode: options.mode,
        provider: options.provider,
        model: options.model,
        resume: options.resume,
        continue: options.continue,
        verbose: options.verbose,
        thinking: options.thinking,
        notify: options.notify,
      });
    });

  program.parse();
}
