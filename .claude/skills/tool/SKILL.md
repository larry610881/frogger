# 生成新 Tool 骨架

根據使用者指定的 tool 名稱，生成完整的 tool 實作骨架。

## 使用方式
`/tool <name>` — 例如 `/tool search-replace`

## 生成內容

### 1. Tool 實作
建立 `packages/core/src/tools/<name>.ts`，包含：
- Zod input schema（附 .describe()）
- tool() 定義（附 description）
- execute 函數骨架
- permission level 宣告

### 2. Tool 測試
建立 `packages/core/src/tools/<name>.test.ts`，包含：
- Happy path test
- Error path test
- Edge case test placeholder

### 3. 註冊
在 `packages/core/src/tools/registry.ts` 加入新 tool。

## 模板

```typescript
// packages/core/src/tools/$ARGUMENTS.ts
import { z } from 'zod';
import { tool } from 'ai';

const inputSchema = z.object({
  // TODO: 定義參數
});

export const ${camelCase($ARGUMENTS)}Tool = tool({
  description: 'TODO: 描述何時使用此工具',
  parameters: inputSchema,
  execute: async (params) => {
    // TODO: 實作
    throw new Error('Not implemented');
  },
});
```
