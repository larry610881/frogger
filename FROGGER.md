# Frogger

AI Coding Agent — CLI-first, with future VSCode extension support.

## Project Structure

This is a TypeScript monorepo managed by pnpm + Turborepo.

- `packages/shared/` — Common types, constants, utilities
- `packages/core/` — Platform-agnostic agent engine (agent loop, modes, tools, LLM, permissions)
- `packages/cli/` — Ink TUI frontend (components, hooks, key bindings)
