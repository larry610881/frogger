---
name: tool-tester
description: Test individual Frogger tools in isolation with mock filesystem and shell
tools: Read, Glob, Grep, Bash
model: haiku
maxTurns: 10
---

# Tool Tester

## 測試流程
1. 讀取指定 tool 的 source 和 test
2. 執行 `npx vitest run packages/core/src/tools/<tool>.test.ts`
3. 若測試不足，建議補充的測試案例
4. 檢查 edge cases：空輸入、超大輸入、特殊字元、權限不足
