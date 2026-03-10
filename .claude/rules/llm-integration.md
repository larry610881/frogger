---
paths:
  - "packages/core/llm/**/*"
  - "packages/core/agent/**/*"
---

# Vercel AI SDK 使用規範

## 核心 API

### streamText — Agent Loop 主要 API
```typescript
import { streamText, stopWhen, stepCountIs } from 'ai';

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,
  messages: conversationHistory,
  tools: activeTools,          // 由 Mode 決定
  maxSteps: 50,                // 安全上限
  stopWhen: stepCountIs(30),   // 建議的迴圈上限
  onStepFinish: async ({ usage }) => {
    // 追蹤 token 使用量
    tokenTracker.add(usage);
  },
});

// 消費 fullStream 做 UI 渲染
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta': yield { type: 'text_delta', text: part.textDelta };
    case 'tool-call': yield { type: 'tool_call', ...part };
    case 'tool-result': yield { type: 'tool_result', ...part };
  }
}
```

### tool() — Tool 定義
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const myTool = tool({
  description: '...',
  parameters: z.object({ ... }),
  execute: async (params) => { ... },
});
```

## 重要注意事項（14 個 Gotcha）

1. **Zod schema 必須加 .describe()** — LLM 只看 JSON Schema 的 description
2. **streamText 的 tools 是 Record<string, Tool>** — key 就是 tool name
3. **maxSteps 是安全上限，stopWhen 是邏輯控制** — 兩個都要設
4. **onStepFinish 是 async** — 可以做 DB 寫入、token 追蹤
5. **result.usage 要 await** — `const usage = await result.usage`
6. **Anthropic 有 contextManagement** — 自動壓縮超長 context
7. **prepareStep 可做 per-step 模型切換** — 前幾步用大模型，後面切小模型
8. **toModelOutput 可截斷 tool output** — 避免大檔案佔滿 context
9. **錯誤回傳字串即可** — execute return string = 成功/失敗都行
10. **不要用 generateText 做 agent loop** — streamText + tools 才是正確做法
11. **message role 必須嚴格遵守** — system/user/assistant/tool 不能混
12. **Anthropic 不支援 parallel tool calls** — 同一輪只會呼叫一個 tool
13. **Token 計算用 result.usage** — 不要自己用 tiktoken 算
14. **Stream 只能消費一次** — fullStream 用完就沒了

## Error Handling

```typescript
try {
  const result = streamText({ ... });
  for await (const part of result.fullStream) { ... }
} catch (error) {
  if (error.name === 'AI_APICallError') {
    // 429 rate limit → exponential backoff retry
    // 401 auth error → 提示使用者檢查 API key
    // 500 server error → retry with delay
  }
}
```

## Token Budget 管理
- 每個 step 追蹤 input/output tokens
- 接近 context window 上限時觸發 compaction
- Compaction 策略：保留 system prompt + 最後 N 輪 + 摘要中間訊息
