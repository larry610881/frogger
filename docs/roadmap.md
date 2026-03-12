# Frogger 功能開發路線圖

> 版本：v0.2.0-dev | 更新日期：2026-03-11
>
> 來源：`feature-gap-analysis.md`（v0.1.2 競品分析）+ Claude Code CLI 功能差距分析（2026-03）

---

## 目錄

- [版本目標與指標](#版本目標與指標)
- [Phase 3：進階功能（v0.2.0）](#phase-3進階功能v020)
- [Phase 4：生態系（v0.3.0）](#phase-4生態系v030)
- [Phase 5：錦上添花（v1.0.0）](#phase-5錦上添花v100)
- [競品雷達對比](#競品雷達對比)
- [策略定位](#策略定位)
- [已完成 Phases](#已完成-phases)

---

## 版本目標與指標

| Phase | 目標版本 | 成功指標 |
|-------|---------|---------|
| Phase 3 | v0.2.0 | MCP stdio transport 至少 3 個社群 server 端對端測試通過 |
| Phase 4 | v0.3.0 | Subagent 能拆分 + 並行完成 2+ 子任務 |
| Phase 5 | v1.0.0 | API 穩定，全功能 polish |

---

## Phase 3：進階功能（v0.2.0）

> 中高難度，需要架構設計。按優先順序排列。

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 20 | **Prefix Caching** | 中 | 競品分析 (Claude Code) | Quick win — Anthropic prompt caching 降低成本與延遲，輸入 token 省 90%，零風險 |
| 15 | **Extended Thinking** | 中 | Claude Code | Thinking budget 控制、Tab 切換顯示（依賴 Anthropic provider 支援）。搭配 Prefix Caching 效果倍增 |
| 22 | **MCP 支援（stdio）** | 高 | 競品分析 (Cline, Goose) | **最大競品差距** — Model Context Protocol stdio transport，server 管理，tool 動態註冊。涵蓋 90%+ MCP servers，SSE/HTTP 留 Phase 4 |
| 14 | **Hooks 系統** | 中高 | Claude Code | PreToolUse / PostToolUse shell hook，在 tool execute 前後觸發使用者定義的 shell 命令。客製化基礎 |
| 35 | **Rules System** | 低 | P0 計畫 | 載入 `.frogger/rules/*.md` 注入 system prompt，讓使用者定義專案級行為規範 |
| 36 | **Memory 系統** | 中 | Claude Code | `/memory` 命令 + `.frogger/memory.md`（專案）+ `~/.frogger/memory.md`（全域），跨 session 持久化上下文 |
| 37 | **完整 Model Pricing** | 低 | Bug fix | `MODEL_PRICING` 補齊 Anthropic + OpenAI 定價，修復 `/cost` 對非 DeepSeek 用戶顯示 $0.00 的問題 |
| 16 | **FROGGER.md 自動生成** | 中 | Claude Code | `/init` 掃描 package.json、目錄結構、README 自動產出專案上下文檔案 |
| 19 | **Test Runner 整合** | 中 | 競品分析 (Claude Code) + SWE-bench | 自動偵測測試框架並執行、結構化解析結果。🔗 SWE-bench pytest 解析合併 |
| 17 | **Web Search** | 中 | 競品分析 (Codex) | 搜尋功能，讓 agent 能查詢外部資訊 |

---

## Phase 4：生態系（v0.3.0）

> 高難度，需要完整協議/架構設計

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 21 | **Subagent / 多 agent 並行** | 高 | 競品分析 + Claude Code | 主 agent 拆任務 → spawn 子 agent，需 task queue、agent pool、結果合併 |
| 22b | ~~**MCP SSE/HTTP transport**~~ ✅ | 高 | 競品分析 (Cline, Goose) | MCP 遠端 transport（SSE + Streamable HTTP），transport-factory + config discriminated union |
| 23 | ~~**Background tasks**~~ ✅ | 高 | Claude Code | `/bg` 背景執行任務，BackgroundTaskManager + `/tasks` + `/task` commands，最多 5 併發 |
| 24 | ~~**Sandbox 執行**~~ | 高 | 競品分析 (OpenHands) | ~~隔離環境執行危險操作~~ → 改用 Docker MCP server 替代，避免自建 |
| 25 | **VSCode Extension** | 高 | 競品分析 (Cline) | HostProvider 抽象層已預留，需實作 VSCode 端。⚠️ 建議 MCP 穩固後再啟動 |
| 26 | ~~**GitHub Issue → PR**~~ ✅ | 高 | 競品分析 (SWE-agent) | 自動從 Issue 分析需求、開分支、實作、發 PR — `/issue` 命令 + `gh-issue` / `gh-pr` 工具 |

### Phase 4 優化項目（Tech Debt）

> 來源：`docs/architecture-journal.md` 潛在隱憂盤點，中優先級

| # | 優化項目 | 難度 | 來源版本 | 說明 |
|---|---------|------|---------|------|
| O1 | ~~**Memory 大小限制**~~ ✅ | 低 | v0.3.0 | `MAX_MEMORY_SIZE` 50KB 限制 + 最舊條目截斷 |
| O2 | ~~**Hooks 首次確認機制**~~ ✅ | 中 | v0.2.1 | SHA-256 hash 確認專案級 hooks.json，防止惡意 repo 植入 |
| O3 | ~~**providerMetadata 結構測試**~~ ✅ | 低 | v0.2.0 | 5 個 unit test mock 驗證 metadata 結構（有/無/空/累加） |
| O4 | ~~**MCP lazy reconnect**~~ ✅ | 中 | v0.2.0 | exponential backoff 重試 + `/mcp reconnect` 命令 |
| O5 | ~~**Custom commands collision 檢查**~~ ✅ | 低 | v0.1.9 | 載入時偵測與 built-in 命令衝突並 log 警告 |
| O6 | ~~**bash execa timeout 驗證**~~ ✅ | 中 | Phase 2 | 已驗證正常運作 |

---

## Phase 5：錦上添花（v1.0.0）

> 非核心，視社群需求決定

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 27 | **Vim mode** | 中 | Claude Code | InputBox 加 normal/insert mode 切換 |
| 28 | **Auto-update** | 中 | Claude Code | npm registry 版本比對 + 提示升級 |
| 29 | **Parallel Worktrees** | 中高 | 競品分析 (Codex) | 多分支平行工作 |
| 30 | **Architect/Editor 分離** | 中 | 競品分析 (Aider) | 架構師模式與編輯器模式分離 |
| 31 | ~~**Vector Search**~~ | 中高 | 競品分析 (Aider, Continue) | ~~向量搜尋增強上下文檢索~~ → 改用 MCP server（如 Qdrant）驗證 MCP 策略 |
| 32 | **Remote Control** | 高 | Claude Code | WebSocket server + 手機端 UI |
| 33 | **GitHub Actions 整合** | 中 | Claude Code | PR review bot、CI 腳本模板 |
| 34 | **Multi-candidate patch ranking** | 高 | SWE-bench 準備 | 多候選 patch 產生 + 排名選最佳 |
| 38 | ~~**Desktop 通知**~~ ✅ | 低 | QoL | 長時間任務完成後發送系統通知（BEL 字元 + 可選 `node-notifier`），`--notify` / `--no-notify` flag |
| 39 | **智慧壓縮** | 中 | 架構改善 | Context compaction 改用 priority-based retention（tool result 低優先、user message 高優先） |

### Phase 5 優化項目（Tech Debt）

> 來源：`docs/architecture-journal.md` 潛在隱憂盤點，低優先級

| # | 優化項目 | 難度 | 來源版本 | 說明 |
|---|---------|------|---------|------|
| O7 | ~~**reasoning-delta 命名穩定性**~~ ✅ | 低 | v0.3.0 | 已有防禦性 fallback，SDK 升級時驗證 |
| O8 | ~~**Rules hot-reload**~~ ✅ | 低 | v0.2.1 | file set hash memoization，僅檔案變更時重載 |
| O9 | ~~**PostToolUse result 大小限制**~~ ✅ | 低 | v0.2.1 | `truncateOutput()` 截斷至 `MAX_TOOL_RESULT_SIZE` 100KB |
| O10 | ~~**jsonSchemaToZod 進階型別**~~ ✅ | 低 | v0.2.0 | 新增 `oneOf` → `z.union()` 和 `allOf` → `z.intersection()` 支援 |
| O11 | ~~**Test runner JSON 解析健壯性**~~ ✅ | 低 | v0.2.0 | 已有 text fallback 機制 |
| O12 | ~~**Repo Map monorepo 快取**~~ ✅ | 低 | v0.1.9 | module-level cache + 30 秒 TTL |
| O13 | ~~**confirmed-permissions.json 清理**~~ ✅ | 低 | v0.1.9 | `loadConfirmedHashes()` 自動過濾不存在路徑的條目 |
| O14 | ~~**Logger instance 化**~~ ✅ | 低 | Phase 1 | `createLogger(level?)` factory，全域 `logger` 保留為 default instance |
| O15 | ~~**@file 空格路徑支援**~~ ✅ | 低 | Phase 2 | 支援 `@"path with spaces"` 引號語法 |

---

## 競品雷達對比（v0.1.9 更新版）

| 維度 | Frogger | Aider | Cline | Claude Code | Codex | OpenHands |
|------|---------|-------|-------|-------------|-------|-----------|
| Tool Calling | ★★★★ | ★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Git Integration | ★★★★ | ★★★★★ | ★★★ | ★★★★ | ★★★★ | ★★ |
| Context Mgmt | ★★★★ | ★★★ | ★★★ | ★★★★★ | ★★★ | ★★★ |
| Permission/Safety | ★★★★★ | ★★ | ★★★★ | ★★★★ | ★★★ | ★★★★★ |
| Multi-Provider | ★★★★ | ★★★★★ | ★★★★★ | ★ | ★ | ★★★★ |
| UI/UX | ★★★ | ★★★ | ★★★★ | ★★★★ | ★★★ | ★★★★ |
| Extensibility (MCP) | ★ | ☆ | ★★★★★ | ★★★★ | ★★★ | ☆ |
| Session Persistence | ★★★★ | ★★★ | ★★★ | ★★★★ | ★★★ | ★★★ |
| Diff Preview | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★ | ★★ |

> v0.1.3 提升項目：Tool Calling ★★★→★★★★、Git ☆→★★★★、Permission ★★→★★★★、Session ☆→★★★★、Diff ☆→★★★★
>
> v0.1.8 提升項目：Context Mgmt ★★★→★★★★（自動壓縮 + budget tracker）、Permission/Safety ★★★★→★★★★½（Zod 驗證 + CI/CD + session cleanup）
>
> v0.1.9 提升項目：Permission/Safety ★★★★½→★★★★★（permissions.json Zod + 首次確認機制 + 5MB 圖片限制）、Extensibility ☆→★（Custom commands + Repo Map）

### 縮小差距行動計畫

| 維度 | 當前差距 | 行動項目 | Roadmap # |
|------|---------|---------|-----------|
| Extensibility (MCP) | ★→★★★+ | MCP stdio transport 支援 | #22 (Phase 3) |
| UI/UX | ★★★→★★★★ | Extended Thinking view + Desktop 通知 | #15, #38 |
| Tool Calling | ★★★★→★★★★★ | Test Runner + Web Search 整合 | #19, #17 |

---

## 策略定位

### 「開源、多 Provider、MCP 生態的 CLI Agent」

目前無競品佔據此定位：

| 競品 | 限制 |
|------|------|
| Claude Code | Anthropic-only |
| Cline | MCP 強但 VSCode-only |
| Aider | CLI 但無 MCP、無 TUI |
| Codex | OpenAI-only |

### 三支柱差異化

1. **Multi-provider**（已 ★★★★，維持優勢）
2. **MCP 生態**（★→★★★+，下一版本重點）
3. **Terminal-native TUI**（Ink-based，優於 Aider/Codex 的 readline）

### 應避免的反模式

- 不要在 MCP 穩固前做 VSCode Extension (#25) — 市場已有 Cline/Continue
- 不要自建 Sandbox (#24) — 用 Docker MCP server 替代
- 不要自建 Vector Search (#31) — 用 MCP server（如 Qdrant）驗證 MCP 策略

---

<details>
<summary>已完成 Phases（點擊展開）</summary>

## 已完成（v0.1.3 已實作）

原 `feature-gap-analysis.md` P0/P1 中已完成的項目：

- [x] **Permission 實際執行** — PermissionPrompt 已接通，工具等待 y/n/a 回應
- [x] **Git 整合** — 10 個 git tools（status/diff/log/commit/init/branch/remote/push/pull/clone）
- [x] **Diff 預覽** — DiffView 元件，write-file/edit-file 回傳 unified diff
- [x] **對話持久化** — SessionManager + /sessions + /resume + --continue
- [x] **Undo/Rollback** — /undo 透過 `git revert HEAD --no-edit`
- [x] **Markdown 渲染** — MarkdownView 元件（code block、標題、清單、粗體、inline code）

---

## Phase 1：UX 基礎

> 低難度、高感知改善，一個 sprint 可完成

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 1 | ~~**Prompt history (↑/Ctrl+R)**~~ ✅ | 低 | Claude Code | InputBox 加 history 陣列 + 方向鍵瀏覽、Ctrl+R 搜尋 |
| 2 | ~~**Multiline input (Shift+Enter)**~~ ✅ | 低 | Claude Code | InputBox 偵測 Shift+Return 插入換行，改用多行渲染 |
| 3 | ~~**/cost 或 /usage**~~ ✅ | 低 | 競品分析 + Claude Code | 顯示 token 用量 + 估算 $ 費用（已有 `totalTokensRef`） |
| 4 | ~~**/context 視覺化**~~ ✅ | 低 | Claude Code | Slash command 顯示 context 使用量彩色 bar（已有 `ContextBudget`） |
| 5 | ~~**/doctor 診斷**~~ ✅ | 低 | Claude Code | 檢查 git version、node version、API key、provider 連線狀態 |
| 6 | ~~**日誌系統**~~ ✅ | 低 | 競品分析 | Logging / debug mode，方便開發與除錯 |

---

## Phase 2：核心能力

> 中難度，顯著提升實用性

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 7 | ~~**Non-interactive pipe mode (`--pipe`)**~~ ✅ | 中 | Claude Code + SWE-bench | 不啟 Ink TUI，直接 `runAgent()` → JSON Lines stdout，可串接 Unix pipe |
| 8 | ~~**Checkpoint / Rewind**~~ ✅ | 中 | Claude Code + SWE-bench | Tool 寫檔前自動快照，`/rewind` 可恢復至任意檢查點 |
| 9 | ~~**@file 引用**~~ ✅ | 中 | Claude Code | 解析輸入中 `@path` → 自動讀取檔案內容注入 user message |
| 10 | ~~**Custom slash commands**~~ ✅ | 中 | Claude Code | 掃描 `.frogger/commands/*.md` 載入自訂命令，支援 `$ARGUMENTS` 變數替換 |
| 11 | ~~**多檔案上下文**~~ ✅ | 中 | 競品分析 (Aider) + SWE-bench | Repo Map Phase A：自動生成 gitignore-aware 檔案樹注入系統提示詞 |
| 12 | ~~**Tool 增強批次**~~ ✅ | 低 | SWE-bench 準備 | bash timeout 參數化、read-file offset/limit、工具輸出截斷、grep -i/-C/-l、edit-file replace_all |
| 13 | ~~**System Prompt 策略化重寫**~~ ✅ | 低 | SWE-bench 準備 | Agent mode 加入結構化問題解決策略（Understand→Locate→Plan→Implement→Verify） |

---

## Phase 2B：穩定性 & 架構健康

> v0.1.4 → v0.1.8 期間完成的穩定性補強與架構健康改善

- [x] ✅ **Registry 權限測試（1A）** — ToolRegistry permission wrapping 10+ 單元測試
- [x] ✅ **Permission abort fix（1B）** — `pendingPermissionResolveRef` 修復 closure 生命週期
- [x] ✅ **Session cleanup（1C）** — `cleanup(maxCount=100, maxAgeDays=30)` 自動清理過期 session
- [x] ✅ **GitHub Actions CI/CD（1D）** — `.github/workflows/ci.yml`，PR/push 觸發 lint→test→build
- [x] ✅ **useAgent hook 拆分（2A）** — 567→386 行，拆出 `useAgentServices` + `useContextBudget`
- [x] ✅ **Provider Zod 驗證（2B）** — `loadProviders()` 改用 Zod `safeParse` + fallback
- [x] ✅ **Benchmark timeout（2C）** — `AbortController` + 5 分鐘預設 timeout

---

## v0.1.9 已完成

- [x] ✅ **Image 輸入 (#18)** — 支援圖片貼上 / 路徑指定，base64 encode → multimodal API（單檔上限 5MB，僅 Anthropic/OpenAI 支援 vision）

</details>
