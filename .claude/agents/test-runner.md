---
name: test-runner
description: Run Vitest test suite across all packages, analyze failures, check coverage
tools: Read, Glob, Grep, Bash
model: haiku
maxTurns: 10
---

# Test Runner

## 你的任務
執行 Vitest 測試、分析結果、確認覆蓋率達標。

## 執行流程

### 1. 執行測試

全部：
```bash
pnpm test 2>&1
```

指定 package：
```bash
pnpm test --filter @frogger/core 2>&1
```

指定檔案：
```bash
cd packages/core && npx vitest run $ARGUMENTS --reporter=verbose 2>&1
```

### 2. 失敗分析
- 列出所有失敗測試名稱和錯誤摘要
- 分類：Import 錯誤 / 斷言錯誤 / Mock 錯誤 / Timeout / Type 錯誤
- 檢查 vitest.config.ts 設定

### 3. 覆蓋率檢查
```bash
pnpm test -- --coverage 2>&1
```
- 門檻：80%
- 低於 80% 則列出覆蓋率最低的 5 個模組

## 輸出格式
```
## 測試結果

- 總數: X tests
- 通過: X / 失敗: X / 跳過: X
- 覆蓋率: XX%（門檻 80%）

### 失敗分析（如有）
| 測試 | 錯誤類型 | 原因 | 建議修復 |
|------|---------|------|---------|

### 結論
- 狀態：通過 / 需修復
```
