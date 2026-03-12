---
"@frogger/core": minor
"@frogger/cli": minor
"@frogger/shared": patch
---

feat(core): add MCP SSE/HTTP transport support and background tasks

**MCP SSE/HTTP Transport (#22b)**
- Config schema expanded with discriminated union: `z.union([sseSchema, httpSchema, stdioSchema])`
- New `transport-factory.ts` with `createTransport()` factory using dynamic imports
- `MCPClientManager.transports` generalized to `Transport` type
- Headers env var resolution via `resolveEnvVars()` for SSE/HTTP configs
- Backward compatible: existing stdio configs work without changes

**Background Tasks (#23)**
- `BackgroundTaskManager` with `start()`, `cancel()`, `cancelAll()`, `list()`, `get()`
- Max 5 concurrent tasks (`MAX_BACKGROUND_TASKS`)
- AbortController per task for clean cancellation
- `/bg <prompt>`, `/tasks`, `/task <id>`, `/task cancel <id>` commands
- `onComplete` callback for desktop notification integration
