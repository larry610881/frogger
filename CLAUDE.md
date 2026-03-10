# Frogger - AI Coding Agent

## Project Overview
TypeScript monorepo AI coding agent. CLI-first, future VSCode extension via HostProvider pattern.

## Tech Stack
- TypeScript 5.x, Node.js 22+, pnpm + Turborepo
- Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`)
- Ink v5 (React for Terminal) + @inkjs/ui
- Zod (tool schemas → JSON Schema auto-conversion)
- Vitest (testing), tsup (bundling)

## Monorepo Structure
- `packages/core/` — Platform-agnostic agent engine (agent loop, modes, tools, LLM, permissions)
- `packages/cli/` — Ink TUI frontend (components, hooks, key bindings)
- `packages/shared/` — Common types, constants, utilities

## Architecture Key Patterns
- **Agent Loop**: `streamText()` → tool calls → permission check → execute → loop back
- **Mode System**: ask (read-only) / plan (explore→approve→execute) / code (full access)
- **Tool System**: Zod schema + `tool()` from Vercel AI SDK → native function calling
- **Permission**: auto / confirm-writes / confirm-all (per-mode default)
- **HostProvider**: Abstraction layer for CLI vs VSCode (future P3)

## Development Workflow
1. Write failing test: `pnpm test --filter @frogger/<package>`
2. Implement feature in `packages/<package>/src/`
3. Verify: `pnpm test` (all packages)
4. Lint: `pnpm lint`
5. Commit: Conventional Commits (`feat(core): ...`)

## Bug-Driven Testing
When fixing a bug, **always write a failing test first** before applying the fix:
1. Reproduce the bug in a test → `it('should not crash when X', ...)` → confirm it fails
2. Fix the code
3. Confirm the test passes
4. Never skip step 1 — a bug without a regression test is a bug that will come back

## Commands
- `pnpm dev` — Watch mode development
- `pnpm build` — Build all packages (`turbo run build`)
- `pnpm test` — Run all Vitest tests (`turbo run test`)
- `pnpm test:coverage` — Run tests with v8 coverage report (`turbo run test:coverage`)
- `pnpm lint` — ESLint + `tsc --noEmit` (`turbo run lint`)
- `pnpm link --global` — Install `frogger` CLI globally for testing
