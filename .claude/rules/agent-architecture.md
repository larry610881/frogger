---
paths:
  - "packages/core/**/*"
---

# Agent 架構設計規範

## 三層分離原則（參考 Cline HostProvider pattern）

```
packages/core/
├── agent/          # Layer 1: Agent Loop（控制流）
│   ├── agent.ts        # ReAct loop: streamText → tool calls → loop
│   ├── events.ts       # AgentEvent stream (text_delta, tool_call, tool_result, error)
│   └── context.ts      # Message history + token budget management
├── modes/          # Layer 2: Mode System（策略）
│   ├── mode.ts         # AgentMode interface
│   ├── ask.ts          # Read-only mode
│   ├── plan.ts         # Plan-then-execute mode
│   ├── code.ts         # Full access mode
│   └── manager.ts      # ModeManager (cycle: ask → plan → code → ask)
├── tools/          # Layer 3: Tool System（能力）
│   ├── tool.ts         # Tool interface + ToolRegistry
│   ├── read-file.ts
│   ├── write-file.ts
│   ├── edit-file.ts
│   ├── bash.ts
│   ├── glob.ts
│   ├── grep.ts
│   └── list-files.ts
├── llm/            # LLM Provider（基礎設施）
│   └── provider.ts     # Vercel AI SDK wrapper
├── permission/     # Permission System（橫切關注）
│   └── permission.ts   # Approval flow
└── config/         # Configuration
    └── config.ts       # Global + project config loading
```

## 設計規則

### 1. Agent Loop 必須是薄層
- agent.ts 只負責控制流：build messages → call LLM → handle response → loop
- 業務邏輯分散到 Mode / Tool / Permission
- 禁止 agent.ts 超過 300 行（避免 Aider 的 god class 問題）

### 2. Mode 決定 Tool + Permission
- 每個 Mode 定義 `allowedTools: string[]` 和 `approvalPolicy`
- Agent Loop 透過 `ModeManager.getCurrentMode()` 取得設定
- Mode 切換透過 ModeManager，不在 Agent Loop 內處理

### 3. Tool 完全獨立
- 每個 Tool 是獨立檔案，包含 Zod schema + execute 函數
- Tool 之間禁止互相依賴
- ToolRegistry 集中管理所有 Tool

### 4. Event-Driven 通訊
- Agent Loop 產出 `AsyncIterable<AgentEvent>` stream
- CLI/VSCode 訂閱 event stream 做 UI 渲染
- Event 類型：text_delta, tool_call, tool_result, mode_change, error, done

### 5. Platform Agnostic
- `packages/core/` 禁止 import 任何 terminal / UI 套件
- 檔案操作透過 `node:fs` 抽象（未來可替換為 VSCode workspace API）
- 使用者互動透過 event + callback，不直接讀 stdin
