# Frogger 功能開發路線圖

> 版本：v0.1.9 | 更新日期：2026-03-10
>
> 來源：`feature-gap-analysis.md`（v0.1.2 競品分析）+ Claude Code CLI 功能差距分析（2026-03）

---

## 目錄

- [已完成（v0.1.3 已實作）](#已完成v013-已實作)
- [Phase 1：UX 基礎](#phase-1ux-基礎)
- [Phase 2：核心能力](#phase-2核心能力)
- [Phase 2.5：穩定性 & 架構（Wave 1+2）](#phase-25穩定性--架構wave-12)
- [Phase 3：進階功能](#phase-3進階功能)
- [Phase 4：生態系](#phase-4生態系)
- [Phase 5：錦上添花](#phase-5錦上添花)
- [競品雷達對比](#競品雷達對比)

---

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

## Phase 2.5：穩定性 & 架構（Wave 1+2）

> v0.1.4 → v0.1.8 期間完成的穩定性補強與架構健康改善

- [x] ✅ **Registry 權限測試（1A）** — ToolRegistry permission wrapping 10+ 單元測試
- [x] ✅ **Permission abort fix（1B）** — `pendingPermissionResolveRef` 修復 closure 生命週期
- [x] ✅ **Session cleanup（1C）** — `cleanup(maxCount=100, maxAgeDays=30)` 自動清理過期 session
- [x] ✅ **GitHub Actions CI/CD（1D）** — `.github/workflows/ci.yml`，PR/push 觸發 lint→test→build
- [x] ✅ **useAgent hook 拆分（2A）** — 567→386 行，拆出 `useAgentServices` + `useContextBudget`
- [x] ✅ **Provider Zod 驗證（2B）** — `loadProviders()` 改用 Zod `safeParse` + fallback
- [x] ✅ **Benchmark timeout（2C）** — `AbortController` + 5 分鐘預設 timeout

---

## Phase 3：進階功能

> 中高難度，需要架構設計

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 14 | **Hooks 系統** | 中高 | Claude Code | PreToolUse / PostToolUse shell hook，在 tool execute 前後觸發使用者定義的 shell 命令 |
| 15 | **Extended thinking** | 中 | Claude Code | Thinking budget 控制、Tab 切換顯示（依賴 Anthropic provider 支援） |
| 16 | **FROGGER.md 自動生成** | 中 | Claude Code | `/init` 掃描 package.json、目錄結構、README 自動產出專案上下文檔案 |
| 17 | **Web Search** | 中 | 競品分析 (Codex) | 搜尋功能，讓 agent 能查詢外部資訊 |
| 18 | ~~**Image 輸入**~~ ✅ | 中高 | 競品分析 + Claude Code | 支援圖片貼上 / 路徑指定，base64 encode → multimodal API |
| 19 | **Test Runner 整合** | 中 | 競品分析 (Claude Code) + SWE-bench | 自動偵測測試框架並執行、結構化解析結果。🔗 SWE-bench pytest 解析合併 |
| 20 | **Prefix Caching** | 中 | 競品分析 (Claude Code) | 利用 Anthropic prompt caching 降低成本與延遲 |

---

## Phase 4：生態系

> 高難度，需要完整協議/架構設計

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 21 | **Subagent / 多 agent 並行** | 高 | 競品分析 + Claude Code | 主 agent 拆任務 → spawn 子 agent，需 task queue、agent pool、結果合併 |
| 22 | **MCP 支援** | 高 | 競品分析 (Cline, Goose) | Model Context Protocol — stdio/SSE/HTTP transport，server 管理，tool 動態註冊 |
| 23 | **Background tasks** | 高 | Claude Code | `&` prefix 背景執行任務，需 task manager、parallel agent、進度追蹤 |
| 24 | **Sandbox 執行** | 高 | 競品分析 (OpenHands) | 隔離環境執行危險操作，容器化或 VM |
| 25 | **VSCode Extension** | 高 | 競品分析 (Cline) | HostProvider 抽象層已預留，需實作 VSCode 端 |
| 26 | **GitHub Issue → PR** | 高 | 競品分析 (SWE-agent) | 自動從 Issue 分析需求、開分支、實作、發 PR |

---

## Phase 5：錦上添花

> 非核心，視社群需求決定

| # | 功能 | 難度 | 來源 | 說明 |
|---|------|------|------|------|
| 27 | **Vim mode** | 中 | Claude Code | InputBox 加 normal/insert mode 切換 |
| 28 | **Auto-update** | 中 | Claude Code | npm registry 版本比對 + 提示升級 |
| 29 | **Parallel Worktrees** | 中高 | 競品分析 (Codex) | 多分支平行工作 |
| 30 | **Architect/Editor 分離** | 中 | 競品分析 (Aider) | 架構師模式與編輯器模式分離 |
| 31 | **Vector Search** | 中高 | 競品分析 (Aider, Continue) | 向量搜尋增強上下文檢索 |
| 32 | **Remote Control** | 高 | Claude Code | WebSocket server + 手機端 UI |
| 33 | **GitHub Actions 整合** | 中 | Claude Code | PR review bot、CI 腳本模板 |
| 34 | **Multi-candidate patch ranking** | 高 | SWE-bench 準備 | 多候選 patch 產生 + 排名選最佳 |

---

## 競品雷達對比（v0.1.8 更新版）

| 維度 | Frogger | Aider | Cline | Claude Code | Codex | OpenHands |
|------|---------|-------|-------|-------------|-------|-----------|
| Tool Calling | ★★★★ | ★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Git Integration | ★★★★ | ★★★★★ | ★★★ | ★★★★ | ★★★★ | ★★ |
| Context Mgmt | ★★★★ | ★★★ | ★★★ | ★★★★★ | ★★★ | ★★★ |
| Permission/Safety | ★★★★½ | ★★ | ★★★★ | ★★★★ | ★★★ | ★★★★★ |
| Multi-Provider | ★★★★ | ★★★★★ | ★★★★★ | ★ | ★ | ★★★★ |
| UI/UX | ★★★ | ★★★ | ★★★★ | ★★★★ | ★★★ | ★★★★ |
| Extensibility (MCP) | ☆ | ☆ | ★★★★★ | ★★★★ | ★★★ | ☆ |
| Session Persistence | ★★★★ | ★★★ | ★★★ | ★★★★ | ★★★ | ★★★ |
| Diff Preview | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★ | ★★ |

> v0.1.3 提升項目：Tool Calling ★★★→★★★★、Git ☆→★★★★、Permission ★★→★★★★、Session ☆→★★★★、Diff ☆→★★★★
>
> v0.1.8 提升項目：Context Mgmt ★★★→★★★★（自動壓縮 + budget tracker）、Permission/Safety ★★★★→★★★★½（Zod 驗證 + CI/CD + session cleanup）
>
> v0.1.9 提升項目：Permission/Safety ★★★★½→★★★★★（permissions.json Zod + 首次確認機制 + 5MB 圖片限制）、Extensibility ☆→★（Custom commands + Repo Map）
