---
# 全域套用（無 paths 前綴）
---

# 功能文檔同步維護規則（docs-sync）

> **目的**：確保 `docs/features.md` 隨功能變動保持最新，避免文檔與程式碼脫節。

## 觸發時機

以下任一情況發生時，**必須同步更新 `docs/features.md`**：

| 情境 | 說明 |
|------|------|
| **新增功能（feat）** | 在對應模組區塊新增功能條目 |
| **修改既有功能行為** | 更新對應條目的描述文字 |
| **刪除功能** | 移除對應條目 |
| **版本升級** | 更新頂部版本號與日期 |

## 更新規則

### 1. 更新對應模組區塊

- 功能條目格式：`- **功能名** — 一句話描述`
- 新增條目插入至該分類的適當位置（依邏輯分組，非單純追加至底部）
- 修改條目時保留原有格式，僅更新描述
- 刪除條目時完整移除該行

### 2. 更新頂部版本號

- 每次更新時同步修改頂部的版本號與日期：
  ```
  > 版本：vX.Y.Z | 更新日期：YYYY-MM-DD
  ```

### 3. 與 learning-review 的協同

- 若本次任務同時觸發 `learning-review.md`（非 trivial 任務），則 `docs/features.md` 和 `docs/architecture-journal.md` **兩份文檔一起更新**
- 在架構學習筆記中可引用 `docs/features.md` 的對應區塊作為上下文

## 模組對應表

| 程式碼位置 | features.md 區塊 |
|-----------|------------------|
| `packages/core/src/agent/` | Agent Engine → Agent Loop / Context Management / Session Management |
| `packages/core/src/modes/` | Agent Engine → Mode System |
| `packages/core/src/tools/` | Agent Engine → Tool System |
| `packages/core/src/permission/` | Agent Engine → Permission System |
| `packages/core/src/commands/` | Agent Engine → Command System |
| `packages/core/src/llm/` | Agent Engine → LLM Provider |
| `packages/core/src/benchmark/` | Agent Engine → Benchmark System |
| `packages/cli/src/components/` | CLI Frontend → TUI Components |
| `packages/cli/src/hooks/` | CLI Frontend → Hooks |
| `packages/cli/src/app.tsx` | CLI Frontend → CLI Flags |
| `packages/shared/` | Shared → Types & Constants |

## 不需更新的情況

- 純重構（refactor）且未改變功能行為
- 測試新增 / 修改（test）
- 文檔修正（docs）— 除非涉及功能描述變更
- 建置設定變更（chore）
