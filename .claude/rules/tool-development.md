---
paths:
  - "packages/core/tools/**/*"
---

# Tool 開發規範

## Tool 結構模板

每個 Tool 包含一個檔案 + 一個測試檔案：
```
packages/core/src/tools/
├── read-file.ts       # Tool 實作
├── read-file.test.ts  # Tool 測試
```

## 實作模板

```typescript
import { z } from 'zod';
import { tool } from 'ai';

// 1. Input Schema（Zod → 自動轉 JSON Schema 給 LLM）
const inputSchema = z.object({
  path: z.string().describe('Absolute or relative file path to read'),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8').describe('File encoding'),
});

// 2. Tool Definition
export const readFileTool = tool({
  description: 'Read the contents of a file at the given path. Returns file content as string.',
  parameters: inputSchema,
  execute: async ({ path, encoding }) => {
    // 3. 實作邏輯
    const content = await fs.readFile(resolvedPath, encoding);
    return content;
  },
});
```

## 必須遵守

### Schema 規則
- 所有參數使用 Zod 定義，禁止 raw JSON Schema
- 每個參數加 `.describe()` — LLM 靠這個理解參數用途
- 提供合理的 `.default()` 值
- description 要精確：說明**什麼時候用**、**輸入什麼**、**輸出什麼**

### Error Handling
- 使用具名錯誤類型（ToolError）
- 回傳結構化錯誤：`{ error: string, code: string }`
- 禁止吞掉錯誤（silent catch）

### Permission Level
每個 Tool 宣告自己的 permission level：
| Level | 說明 | 範例 |
|-------|------|------|
| `auto` | 永遠自動執行 | read_file, glob, grep |
| `confirm` | 需要使用者確認 | write_file, edit_file, bash |

### Output Optimization
- 使用 `toModelOutput` 截斷過長輸出，避免浪費 token
- 大檔案只回傳前 N 行 + 總行數
- 搜尋結果只回傳前 N 個匹配 + 總數

### 測試要求
- Happy path（正常操作）
- Error path（檔案不存在、權限不足、無效輸入）
- Edge case（空檔案、超大檔案、特殊字元路徑）
- 使用 mock filesystem（memfs 或 vi.mock）
