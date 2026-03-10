---
paths:
  - "**/*"
---

# Monorepo 慣例（pnpm + Turborepo）

## 目錄邊界
- `packages/core/` — 平台無關的 agent 引擎，禁止 import `packages/cli/`
- `packages/cli/` — CLI 前端，可 import `packages/core/` 和 `packages/shared/`
- `packages/shared/` — 共用型別和常數，禁止 import 其他 packages

## 依賴方向（嚴格單向）
```
shared ← core ← cli
```
違反方向 = 違規（例如 core import cli）。

## 套件管理
- 統一使用 pnpm（禁止 npm / yarn）
- 新增依賴：`pnpm add <pkg> --filter @frogger/<package>`
- 全域開發依賴：`pnpm add -Dw <pkg>`
- Lock 檔案：`pnpm-lock.yaml`（禁止 commit package-lock.json / yarn.lock）

## Turborepo Pipeline
- `turbo run build` — 按依賴順序建置
- `turbo run test` — 並行執行所有 package 測試
- `turbo run lint` — 並行 lint 所有 packages

## Package 命名
- Scope: `@frogger/`
- 名稱: `@frogger/core`, `@frogger/cli`, `@frogger/shared`

## 環境變數
- API keys 存放在 `~/.frogger/config.json`（全域設定）
- 專案設定在 `FROGGER.md`（類似 CLAUDE.md）
- 禁止在專案目錄放 `.env`（CLI 工具不需要）

## tsconfig
- Root `tsconfig.json` — 基礎設定 + project references
- 每個 package 有自己的 `tsconfig.json` extends root
- 統一 target: ES2022, module: Node16
