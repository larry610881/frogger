---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
---

# TypeScript 開發規則

## 程式碼風格
- 2 空格縮排，分號結尾，單引號優先
- 只使用 Functional Components（Ink 也是 React）
- 禁止 `any`，用 `unknown` 或精確型別
- 使用 named exports（非 default export）
- Props 必須定義獨立的 type

## 命名慣例
| 對象 | 方式 | 範例 |
|------|------|------|
| 元件 | PascalCase | `ChatView`, `ToolCallDisplay` |
| 函式/變數 | camelCase | `executeToolCall` |
| 型別/介面 | PascalCase | `AgentMode`, `ToolDefinition` |
| 常數 | UPPER_SNAKE_CASE | `MAX_TOOL_RETRIES` |
| Hook | use 前綴 | `useAgent`, `useMode` |
| Event Handler | handle 前綴 | `handleToolApproval` |

## Node.js CLI 慣例
- 使用 `node:` 前綴 import 原生模組（`import { readFile } from 'node:fs/promises'`）
- 環境變數透過 `process.env` 存取
- 使用 `execa` 執行子程序（非 `child_process`）
- 路徑處理使用 `node:path`，禁止手動拼接

## React (Ink) 慣例
- Ink 元件放 `packages/cli/src/components/`
- Hook 放 `packages/cli/src/hooks/`
- 使用 `<Box>` 做佈局（Yoga flexbox）
- 使用 `<Text>` 顯示文字（支援 `color`, `bold`, `dimColor`）
- 使用 `<Static>` 渲染已完成的歷史訊息（append-only, 不重新渲染）

## 測試慣例（Vitest）
- 測試檔案與源碼同目錄：`foo.ts` → `foo.test.ts`
- 使用 `describe` / `it` / `expect`
- Mock 使用 `vi.fn()` / `vi.mock()`
- 測試使用者可見行為，禁止測試內部 state
- 每個 `it` 只測一件事
- 覆蓋率門檻：80%
