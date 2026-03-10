# Architecture Journal

## Table of Contents
- [2026-03-10: v0.1.9 Optimization Batch — Pipe Allow, Context Split, Permission Confirmation, Custom Commands, Repo Map](#2026-03-10-v019-optimization-batch--pipe-allow-context-split-permission-confirmation-custom-commands-repo-map)
- [2026-03-09: Wave 1+2 Stability & Architecture — Permission Tests, Abort Fix, Session Cleanup, CI/CD, useAgent Split, Zod Validation, Benchmark Timeout, Image Input](#2026-03-09-wave-12-stability--architecture--permission-tests-abort-fix-session-cleanup-cicd-useagent-split-zod-validation-benchmark-timeout-image-input)
- [2026-03-09: Phase 2 Batch — Security Fix, Pipe Mode, @file Reference, Checkpoint/Rewind](#2026-03-09-phase-2-batch--security-fix-pipe-mode-file-reference-checkpointrewind)
- [2026-03-09: SWE-bench Tool Enhancement Batch — bash timeout, read-file offset/limit, output truncation, grep enhancements, edit-file replace_all, system prompt strategy](#2026-03-09-swe-bench-tool-enhancement-batch--bash-timeout-read-file-offsetlimit-output-truncation-grep-enhancements-edit-file-replace_all-system-prompt-strategy)
- [2026-03-09: Phase 1 UX — Prompt History, Multiline, /cost, /context, /doctor, Logger](#2026-03-09-phase-1-ux--prompt-history-multiline-cost-context-doctor-logger)
- [2026-03-09: UX 三合一 — Permission 持久化 + Paste 偵測 + Welcome Banner](#2026-03-09-ux-三合一--permission-持久化--paste-偵測--welcome-banner)
- [2026-03-09: Streaming Stats — 即時 Token/Cost 顯示](#2026-03-09-streaming-stats--即時-tokencost-顯示)
- [2026-03-09: P1 Feature Batch — Permission, Git, Diff, Session, Markdown](#2026-03-09-p1-feature-batch--permission-git-diff-session-markdown)
- [2026-03-08: Dynamic Provider Registry + Agent Benchmark](#2026-03-08-dynamic-provider-registry--agent-benchmark)
<!-- New entries are inserted below -->

---

### 2026-03-10: v0.1.9 Optimization Batch — Pipe Allow, Context Split, Permission Confirmation, Custom Commands, Repo Map

**來源**: v0.1.8 盤點後的 6 Quick Fixes + 6 Medium Features（Q1-Q6, M1-M6）

**本次相關主題**: Intersection Type Decomposition, Plugin Loader Pattern, Hash-based Trust Verification, File Tree Generation, Pipe Mode Security

#### 做得好的地方
- **M3 SlashCommandContext 拆分使用 intersection type**: 將 10+ 欄位的 context 拆為 `BaseCommandContext & BudgetContext & ProviderContext & UsageContext`，`SlashCommandContext` 變為 type alias，零破壞性重構。現有命令無需修改，未來新命令可選用更窄型別
- **M4 Permission confirmation 的 hash 追蹤設計**: 使用 SHA-256 hash 而非時間戳，精確追蹤檔案內容變更。全域路徑自動信任（使用者自己的設定），僅專案路徑需確認。`confirmPermissions()` / `isPermissionsConfirmed()` API 乾淨無副作用
- **M5 Custom commands 極簡 Plugin Loader**: `loadCustomCommands()` 僅 ~30 行，掃描 `.frogger/commands/*.md` 並轉為 `SlashCommand` 物件。`$ARGUMENTS` 替換直覺且安全（無 eval），載入時機在 `useAgentServices` 初始化後，與 built-in 命令一起注冊
- **M2 `--pipe-allow` 白名單**: 用 `modeConfig.allowedTools.filter()` 實現，兩行核心邏輯。在 `createAgentTools` 之前過濾，確保 pipe mode 只能使用明確允許的工具
- **M6 Repo Map 的 globby + 樹狀渲染分離**: `generateRepoMap()` 分為三步：globby 掃描 → buildTree 建構 → renderTree 渲染。gitignore-aware 確保不掃描無關檔案。maxFiles / maxOutputChars 雙重限制防止大型 repo 的系統提示詞膨脹

#### 潛在隱憂
- **M5 Custom commands 無 name collision 檢查**: 若 `.frogger/commands/clear.md` 存在，會覆蓋 built-in `/clear` 命令（因 `registry.register()` 後註冊者覆蓋前者）。建議未來加入 name collision 警告或 namespace prefix → **優先級：中**
- **M6 Repo Map 在 monorepo 中的效能**: 500 檔案上限對小型專案合理，但 monorepo 可能剛好 500 檔但樹很深。`globby` 的 gitignore 解析在大型 repo 可能耗時（數百 ms）。考慮未來加入 caching 或 lazy loading → **優先級：低**
- **M4 confirmed-permissions.json 無自動清理**: 隨著使用者在不同專案間工作，`~/.frogger/confirmed-permissions.json` 會累積已刪除專案的 hash。考慮定期清理不存在路徑的條目 → **優先級：低**
- **M1 Checkpoint memory limit 的 totalSnapshotBytes 追蹤精確度**: 使用 `Buffer.byteLength(content, 'utf-8')` 計算，但 `checkpoints.slice()` 刪除時未減去 bytes（count-based eviction 路徑）。實務上 memory limit eviction 和 count limit eviction 不太可能同時觸發，但邏輯上不完全對稱 → **優先級：低**

#### 延伸學習
- **Intersection Type vs Interface Extension**: TypeScript 的 `type A = B & C` 與 `interface A extends B, C` 行為幾乎相同，但 intersection type 更適合「組合已存在的獨立 interface」場景，因為不需要宣告新 interface（可直接用 type alias）。M3 的做法是教科書級的 Interface Segregation Principle (ISP) 應用——每個命令只依賴它需要的 context 子集
- **Plugin Loader Pattern**: M5 的 custom commands 是最小可行的 plugin 系統。與 VS Code extensions、Webpack plugins 相比，它只做了「發現 + 載入 + 注冊」三步，沒有 lifecycle hooks 或 dependency injection。這是正確的起步——先驗證需求再增加複雜度。Aider 的 `/run` 和 Claude Code 的 custom commands 也採用類似的 file-based approach
- **Supply Chain Security in CLI Tools**: M4 的 permissions.json 確認機制是防禦「惡意 repo 預設權限」的第一道防線。類似 npm 的 `postinstall` 警告、GitHub Actions 的 `permissions:` 聲明。下一步可考慮像 Deno 的 `--allow-read` 粒度控制
- 若想深入：搜尋 "Interface Segregation Principle TypeScript" 或 "Plugin architecture patterns Node.js"

**思考題**：M5 的 custom commands 目前只支援注入 user message（`messagesRef.current.push`）。如果要支援更複雜的行為（如呼叫特定工具、修改 mode、觸發 compact），該如何設計 template 語法？考慮 Mustache-style 模板 vs YAML front-matter + body 的 trade-off。

---

### 2026-03-09: Wave 1+2 Stability & Architecture — Permission Tests, Abort Fix, Session Cleanup, CI/CD, useAgent Split, Zod Validation, Benchmark Timeout, Image Input

**來源**: Wave 1 穩定性補強 + Wave 2 架構健康 + P5 Image Input

**本次相關主題**: Hook Decomposition, Zod Runtime Validation, AbortController Lifecycle, Provider Capability Guard, CI/CD Pipeline

#### 做得好的地方
- **useAgent.ts 拆分（567 → 386 行）**: 依風險由低到高拆分為 3 個模組：`utils/format.ts`（純函式 + 常數）、`useAgentServices`（lazy init 服務）、`useContextBudget`（budget 追蹤 + 自動壓縮）。外部 API 完全不變，re-export 保持向後相容
- **Permission abort 修復用 ref 而非 state**: `pendingPermissionResolveRef` 確保 finally block 能在 React async state update 之外存取 resolve function，是 React hooks closure 陷阱的正確解法
- **Provider Zod 驗證的 safeParse + fallback**: 不用 `.parse()` 拋例外，而用 `.safeParse()` 優雅降級為預設 providers，使用者不會因為手動編輯 JSON 而 crash
- **Session cleanup fire-and-forget**: `save()` 後呼叫 `this.cleanup().catch(() => {})` 不阻塞返回，雙層防禦（cleanup 內部 try-catch + 外部 .catch）
- **Image Input 的 provider guard**: 在 `submitInternal()` 中用 `supportsVision(providerEntry.type)` 檢查，不支援時發出明確警告訊息並跳過圖片。guard 邏輯集中在一處，不分散到 file-reference 或 agent
- **Benchmark timeout 重用既有 abortSignal**: `runAgent()` 已接受 `AbortSignal`，只需在 runner 層加 `AbortController` + `setTimeout`，零侵入性

#### 潛在隱憂
- **useContextBudget 的 options 穩定性**: hook 接收 object 參數，若父元件每次 render 產生新 object reference 會導致不必要的 callback 重建。目前因 `useCallback` deps 只依賴基本型別（provider, model）所以不會有問題，但重構時需注意 → **優先級：低**
- **Image base64 記憶體用量**: 大圖片（如 4K 截圖 ~10MB）base64 編碼後 ~13MB 存入 `messagesRef`，長 session 累積多張圖片可能造成記憶體壓力。考慮加入檔案大小限制（如 5MB） → **優先級：中**
- **CI/CD lint 步驟預期失敗**: tsconfig composite 設定問題會導致 lint 步驟失敗，需另行修復才能讓 CI 全綠 → **優先級：高** ✅ 已解決：tsconfig 結構正確，lint 正常運行
- **ToolRegistry 測試 mock 了 rules 模組**: 10 個新測試使用 `vi.mock()` mock 了 `permission/rules.ts`，若 rules 的 API 變更，mock 可能遮蓋實際問題。考慮加入少量整合測試 → **優先級：低**

#### 延伸學習
- **Custom Hook Decomposition 原則**: React 官方建議「當一個 hook 超過 200 行，考慮拆分」。本次拆分遵循「Extract by cohesion」原則——每個提取的 hook 內聚一組相關的 state + effect + callback。與「Extract by feature」（按功能拆分元件）形成互補。關鍵判斷：拆出的 hook 是否能獨立測試？本次的 `useAgentServices` 和 `useContextBudget` 都可以
- **Multimodal Message Content 的型別安全**: Vercel AI SDK v6 的 `UserContent = string | Array<TextPart | ImagePart | FilePart>` 是 union type，TypeScript 不會阻止你把 image 送給不支援 vision 的 provider — 這會在 runtime API 層面才報錯。我們在應用層加入 `supportsVision()` guard 來提前攔截，這是 **Defensive Programming** 的實踐
- 若想深入：搜尋 "React custom hook extraction patterns" 或 "Zod safeParse vs parse error handling"

**思考題**：目前 `supportsVision()` 是靜態檢查 provider type（硬編碼 `['anthropic', 'openai']`）。如果使用者新增一個支援 vision 的 openai-compatible provider（如 Groq + Llama 3.2 Vision），目前會被錯誤地判定為不支援。該如何設計讓使用者可以自行聲明 provider 的能力？考慮 `ProviderEntry` 加入 `capabilities?: string[]` 欄位的 trade-off。

---

### 2026-03-09: Phase 2 Batch — Security Fix, Pipe Mode, @file Reference, Checkpoint/Rewind

**來源**: feat(core,cli): Phase 2 — 安全修復 + Pipe Mode + @file 引用 + Checkpoint/Rewind

**本次相關主題**: Interceptor Pattern (onBeforeExecute hook), Headless Agent Execution, File Reference Resolution, Checkpoint/Restore State Management

#### 做得好的地方
- **onBeforeExecute hook 設計**: 在 `ToolRegistry.getToolsWithPermission()` 加入可選的 `onBeforeExecute` 回調，在 permission 通過後、execute 之前觸發。Pipe Mode 和 Checkpoint 共用同一個 hook 介面，避免重複 wrapping 邏輯
- **Pipe Mode 極簡設計**: `pipe-mode.ts` 僅 ~100 行，完全重用 `runAgent()` + `loadConfig()` + `createToolRegistry()` 等既有模組。JSON Lines 格式讓消費端（SWE-bench harness、jq、其他 CLI 工具）零解析成本
- **@file 引用的防禦性設計**: 先用 `fs.access()` 檢查路徑是否存在，不存在直接跳過（視為 @mention），避免對每個 `@word` 都報錯。`assertWithinBoundary()` 確保不能讀取工作目錄外的檔案
- **Checkpoint 分層策略**: 不同工具類型採用不同快照策略（write-file/edit-file 快照目標檔案、bash 快照 git dirty files、git-commit 記錄 HEAD），平衡了完整性與效能
- **list-files 安全修復**: 補上遺漏的 `assertWithinBoundary()` 調用，與其他讀取工具（read-file、glob、grep）保持一致的安全邊界
- **registry.ts any 型別消除**: 用 `Record<string, unknown>` + explicit function type cast 取代 `as any`，提升型別安全性

#### 潛在隱憂
- **Checkpoint 記憶體用量**: 每個 checkpoint 持有完整的檔案內容字串。長 session 中若頻繁修改大檔案（接近 1MB 限制），50 個 checkpoints 可能消耗數十 MB 記憶體。考慮未來改為 diff-based 快照或限制單 checkpoint 的總快照大小 → **優先級：中**
- **Pipe Mode 全自動核准的安全性**: `--pipe` 模式下所有工具 permission 設為 auto，代表 LLM 可以不經確認執行任意 bash 命令。使用者需要了解這個安全取捨。考慮未來加入 `--pipe-allow` 白名單選項 → **優先級：中**
- **@file 引用的正則限制**: `/@([\w./\-]+)/g` 無法匹配包含空格或特殊字元的路徑。實務上大多數程式碼檔案路徑不含空格，但若需支援可改用引號語法如 `@"path with spaces"` → **優先級：低**
- **useAgent.ts 持續膨脹**: 這個 hook 現在承擔了 @file 解析、checkpoint 管理、命令分派等多項職責，行數持續增長。建議觀察：若超過 600 行應考慮拆分為多個 custom hooks → **優先級：中** ✅ 已解決於 Wave 2A（hook 拆分）

#### 延伸學習
- **Command Pattern + Memento Pattern**: `/rewind` 是 Command Pattern（命令分派）和 Memento Pattern（狀態快照/恢復）的經典組合。CheckpointManager 扮演 Caretaker 角色，保存工具執行前的 Memento（FileSnapshot），使用者透過 /rewind 命令觸發恢復。與 Git 的 stash/reflog 機制理念相似
- **JSON Lines (NDJSON) 作為 IPC 格式**: Pipe Mode 使用 JSON Lines 而非完整 JSON array，因為：(1) 串流友善——消費端可逐行解析不需等完整輸出；(2) 易於 pipe 串接（`jq -c .type`）；(3) 與 SWE-bench 等評測框架的 subprocess 通訊模式一致。替代方案 SSE (Server-Sent Events) 更適合 HTTP 場景
- 若想深入：搜尋 "Memento Pattern state management" 或 "NDJSON streaming protocol"

---

### 2026-03-09: SWE-bench Tool Enhancement Batch — bash timeout, read-file offset/limit, output truncation, grep enhancements, edit-file replace_all, system prompt strategy

**來源**: feat(core): SWE-bench 準備 Phase A — Tool 增強批次 + System Prompt 策略化重寫

**本次相關主題**: Tool Enhancement Pattern, Output Truncation, System Prompt Engineering, Cross-cutting Utility

#### 做得好的地方
- **向後相容的 Schema 擴展**: 所有 5 個工具增強都透過 Zod `.optional()` 新增參數，現有 LLM 呼叫不受影響。`edit-file replace_all` 在 `count > 1` 分支加入 `&& !replace_all` 守衛，零迴歸風險
- **輸出截斷作為橫切關注**: `truncateOutput()` 抽取為獨立 `output-utils.ts`，以組合方式注入 bash/grep 工具。30,000 字元的預設值在 LLM 上下文友善（~7,500 tokens）與完整輸出之間取得平衡
- **read-file offset/limit 的行號格式**: 使用 `  N\t<line>` 格式（1-based 行號 + tab 對齊），與 `cat -n` 一致。加上 `Lines X-Y of Z:` 標頭讓 LLM 知道檔案全貌，不會誤以為只有這些行
- **grep 選項互斥處理**: `filesOnly` 自動覆蓋 `contextLines`（`-l` + `-C` 組合無意義），避免使用者傳入矛盾參數時產生怪異輸出
- **System Prompt 結構化**: 5 步問題解決法（Understand→Locate→Plan→Implement→Verify）+ 工具最佳實踐 + 錯誤回復策略。模式感知——只在 agent mode 注入完整策略，ask/plan mode 保持簡潔

#### 潛在隱憂
- **bash 的 execa 標記模板 timeout 問題**: 測試發現 `execa({timeout: 1000})\`sleep 30\`` 的自訂 timeout 未生效（等待 30s 而非 1s）。雖然已加入 `timedOut` 檢查與 `forceKillAfterDelay`，但 shell mode 下的 timeout 行為需要進一步驗證。目前以 coreutils `timeout` 指令替代測試 → **優先級：中**
- **truncateOutput 截斷位置不感知語意**: 在 30,000 字元處硬截斷可能切在 UTF-8 多位元序列中間（雖然 JS string 是 UTF-16 所以不會損壞，但可能切在一行中間）。考慮改為按行截斷（找到最後一個 `\n`） → **優先級：低**
- **grep 參數組合爆炸**: 加入 `ignoreCase`、`contextLines`、`filesOnly` 後，grep 有 2³=8 種參數組合。測試覆蓋了主要路徑但非全部組合。建議未來加入 property-based testing → **優先級：低**

#### 延伸學習
- **LLM System Prompt Engineering**: 本次重寫 agent mode prompt 從單句提升到結構化指引。SWE-bench 排行榜前列的系統（如 SWE-agent、OpenHands）的 prompt 設計策略是重要參考。關鍵字：「SWE-agent ACI interface」、「ReAct prompting for code repair」
- **Tool Output Budget**: 30K 字元是經驗值。更好的做法是根據 model 的 context window 動態計算截斷閾值（例如保留 10% context 給單一工具輸出）。參考 Claude Code 的做法：按 token 計算而非字元

---

### 2026-03-09: Phase 1 UX — Prompt History, Multiline, /cost, /context, /doctor, Logger

**來源**: feat(core,cli): Phase 1 UX — history, multiline, /cost, /context, /doctor, logger

**本次相關主題**: Command Pattern Extension, Singleton Logger, Shell Readline UX, SlashCommandContext Evolution

#### 做得好的地方
- **Command Pattern 一致擴展**: 3 個新命令（cost/context/doctor）嚴格遵循 `SlashCommand` interface + `sessions.ts` 慣例，新增命令只需 3 步（新增檔案 → export → register），擴展成本極低
- **Logger stderr 分離**: 輸出到 `console.error`（stderr）而非 stdout，完全不干擾 Ink TUI 渲染。4 層級（debug/info/warn/error）覆蓋常見場景，`--verbose` flag 設定 debug 門檻，使用簡潔
- **History 瀏覽 UX 符合 shell readline 慣例**: ↑ 從末尾往前瀏覽、↓ 遞減回到當前輸入、按 ↑ 前保存 `savedInputRef` 避免遺失正在編輯的文字 — 與 bash/zsh 行為一致，使用者零學習成本
- **Multiline 與現有 paste 偵測共存**: Shift+Enter 插入 `\n` 走不同路徑（key.return + key.shift），不觸發 paste 偵測（paste 是 ch.includes('\n')）。逐行渲染用 `> ` / `· ` 前綴視覺區分首行與後續行
- **Session usage 追蹤利用現有 refs 模式**: `sessionPromptTokensRef` / `sessionCompletionTokensRef` 跟隨 `totalTokensRef` 的設計慣例，在 `done` event 中累加，零額外重繪

#### 潛在隱憂
- **`SlashCommandContext` 持續膨脹**: 從最初的 6 個欄位已成長到 10+ 個（新增 `sessionUsage`）。Context Object 反模式風險：所有命令共用同一巨大 context，大多數命令只用其中 1-2 個欄位。建議觀察：若超過 15 個欄位，應考慮拆分為 `BaseContext` + 按需注入的 extension → **優先級：中**
- **Logger 全域 mutable state**: `currentLevel` 是 module-level 變數，`setLogLevel()` 是全域副作用。在測試環境中若多個 test 平行執行，可能因 shared state 導致 flaky test。建議未來考慮 Logger instance 或測試時 reset → **優先級：低**
- **/doctor 的 `execa` dynamic import**: 每次執行 `/doctor` 都重新 `import('execa')`，雖然 Node.js 會 cache import，但語義上不明確。考慮在 module top-level import → **優先級：低**
- **Multiline 渲染在極長輸入時的效能**: 每行都是獨立 `<Box>` + `<Text>`，若使用者貼上幾十行文字（走 Shift+Enter 而非 paste 路徑），會產生大量 React elements。實務上 CLI 輸入少見此場景，但理論上可能觸發 Ink 30fps 限制 → **優先級：低**

#### 延伸學習
- **Context Object vs Parameter Object**: 本次 `SlashCommandContext` 的膨脹是 Context Object 反模式的教科書案例。Martin Fowler 的 Refactoring 建議：當一個「上下文袋」開始累積不相關欄位時，應考慮 Introduce Parameter Object 或 Dependency Injection。在 CLI 工具中，一個妥協方案是保持薄 context + 讓命令自行 import 需要的模組（如 /doctor 已在做的 `loadConfig()` 直接 import）
- **Readline History vs Shell History**: 本次實作是 in-memory session history（重啟即消失）。Bash 的 `.bash_history` 是跨 session 持久化 + `HISTSIZE` 控制上限 + `HISTCONTROL` 去重。若未來需要跨 session 歷史，可將 history 寫入 `~/.frogger/history`，但需注意敏感輸入（API key 等）不應持久化
- 若想深入：搜尋 "GNU Readline library architecture" 或 "Context Object antipattern"

**思考題**：目前 `SlashCommandContext` 的 `sessionUsage` 只在 `/cost` 中使用，而 `budgetTracker` 只在 `/context` 和 `/compact` 中使用。如果將每個命令改為「自行宣告需要的 context 子集」（類似 React Context 的 selective subscription），會帶來什麼 trade-off？在什麼規模下值得做這個重構？

---

### 2026-03-09: UX 三合一 — Permission 持久化 + Paste 偵測 + Welcome Banner

**來源**: feat(core,cli,shared): Permission 持久化 + Paste 偵測 + Welcome Banner

**本次相關主題**: Interceptor Pattern Extension, File-based Permission Rules, Terminal Paste Detection, Dual-column TUI Layout

#### 做得好的地方
- **Permission 持久化分層清晰**: `rules.ts` 作為純邏輯模組僅依賴 `node:fs`/`node:path`/`node:os`，不觸碰 UI。`registry.ts` 的 execute wrapper 按優先順序查詢（persisted rules → session set → user callback），職責分離乾淨
- **規則匹配彈性設計**: `matchesRule()` 支援三種匹配模式（精確匹配、bash 前綴匹配、glob 前綴匹配），涵蓋最常見的使用情境，同時保持邏輯簡單可測試
- **Paste 偵測利用 Ink 行為特性**: Ink useInput 的單次 callback 傳入完整貼上字串，不需要 debounce 或 stdin 監聽，實作乾淨。pastedBlocks 存在 ref 中不觸發額外重繪
- **WelcomeBanner 條件渲染**: `history.length === 0 && !isStreaming` 確保 banner 僅在初始畫面顯示，不會在對話中重繪浪費效能
- **型別一致性**: `PermissionResponse` 從 shared → core → cli 三層一致傳遞，避免字串字面值散落各處

#### 潛在隱憂
- **惡意 repo 的 `.frogger/permissions.json`**: 攻擊者可在 repo 中預設 `allowedTools: ["bash"]` 誘導使用者。`deniedTools` 優先於 `allowedTools` 提供基本防護，但建議未來加入首次載入確認提示 → **優先級：中**
- **permissions.json 無 schema 驗證**: 與 providers.json 相同問題，手動編輯導致 malformed 時靜默降級為空規則（safe fallback），但使用者可能不知道規則失效 → **優先級：低**
- **Paste 偵測的 backspace 處理**: 刪除到 paste marker 邊界時整段移除，但若使用者在 marker 中間插入文字（理論上不可能，因為 marker 是一次性插入），可能導致不一致 → **優先級：低**
- **WelcomeBanner `os.userInfo()` 可能拋錯**: 在某些受限環境（container without /etc/passwd）會 throw，建議加 try-catch fallback → **優先級：低**

#### 延伸學習
- **Strategy Pattern in Permission Resolution**: `resolvePermission()` 的四層查詢（project deny → project allow → global deny → global allow）本質是 Chain of Responsibility pattern。每層是一個「策略」，按優先順序短路返回。這與 CSS 的 specificity 規則、iptables 的 rule chain 有相同的設計哲學
- **Clipboard Detection in Terminal**: 終端的「貼上」沒有標準 API，Ink 利用 stdin 的批次寫入特性偵測（單次 callback 收到多字元 = 貼上）。這是 heuristic 方法，極快速打字理論上也可能觸發 false positive，但實務上 5+ 行閾值足以避免
- 若想深入：搜尋 "bracketed paste mode terminal" 或 "xterm paste detection sequence"

---

### 2026-03-09: Streaming Stats — 即時 Token/Cost 顯示

**來源**: feat(core,cli,shared): 即時 token/cost 串流統計 + 格式化

**本次相關主題**: Event Stream Extension, Real-time UI Feedback, Cost Calculation

#### 做得好的地方
- **Event-driven 擴展**: 在 `fullStream` 迴圈中新增 `finish-step` 攔截，累加 token 後發出 `usage_update` 事件 — 符合既有的 event stream 架構，agent.ts 保持薄層
- **格式化函式 export**: `formatTokens()` 和 `calculateCost()` 從 useAgent.ts export，供 StreamingStats 元件共用 — 避免重複邏輯
- **漸進增強**: 無定價資料時（非 DeepSeek model）不顯示 Cost — 功能不因缺少資料而報錯
- **liveUsage 生命週期乾淨**: 串流開始時重設 null → step-finish 更新 → 串流結束重設 null，不會殘留過期資料

#### 潛在隱憂
- **Vercel AI SDK v6 `finish-step` 的 `usage` 可能為 undefined**: 部分 provider 不回報 step-level usage，需確認 DeepSeek 在 multi-step 場景下是否正確回報 → **優先級：低**
- **MODEL_PRICING 硬編碼**: 定價資料寫死在常數中，DeepSeek 價格調整時需手動更新；未來可考慮從 provider config 動態載入 → **優先級：低**
- **StreamingStats 的 setInterval 1s 更新**: 在 Ink 30fps 渲染上限下，1 秒更新一次計時器合理，但若多個計時器同時存在（如 Spinner + StreamingStats）可能增加不必要的重繪 → **優先級：低**

#### 延伸學習
- **Observer Pattern in Streaming**: 本次的 `usage_update` 事件是 Agent loop 作為 Observable、CLI 作為 Observer 的典型實現。Vercel AI SDK 的 `fullStream` 本身就是 AsyncIterable，我們在其上加了一層事件轉換（`finish-step` → `usage_update`），這是 Adapter Pattern 的應用

---

### 2026-03-09: P1 Feature Batch — Permission, Git, Diff, Session, Markdown

**來源**: feat(core,cli): P1 feature batch — permission wiring, git tools, diff preview, session persistence, markdown rendering

**本次相關主題**: Tool Wrapping Pattern, Permission Interception, Unified Diff, Session Persistence, Lightweight Markdown Parser

#### 做得好的地方
- **Permission wrapping at registry level**: `getToolsWithPermission()` 在 tool registry 層攔截 `execute()`，透過 Promise 暫停執行等待 UI 回應，不需修改 Vercel AI SDK 或 agent loop — 保持了 agent.ts 的薄層原則
- **Diff 整合於 tool output**: edit-file/write-file 的 diff 嵌入在 tool result 字串中（`\`\`\`diff\n...\n\`\`\``），ChatView 自動偵測並用 DiffView 上色 — 零耦合，tool 不知道 UI 存在
- **Git tools 使用 execa 陣列參數**: `execa('git', ['commit', '-m', message])` 避免 shell injection，符合安全規範
- **Session auto-save 在 done event**: 非關鍵路徑（try-catch 靜默失敗），不影響主流程
- **Markdown renderer 整合在 ChatView**: 避免額外元件 import，inline code/bold/heading/code block/list 涵蓋最常見格式

#### 潛在隱憂
- **Permission callback closure 生命週期**: `setPendingPermission` 的 `resolve` callback 在 React state 中持有 Promise resolve，若 agent loop 被 abort 但 Promise 未 resolve，可能導致懸掛 → 建議在 abortSignal 觸發時 reject pending promises → **優先級：中** ✅ 已解決於 Wave 1B（ref fix）
- **Session file 大小無限增長**: 長對話的 `messages` 陣列可能達 MB 級別，`~/.frogger/sessions/` 目錄無自動清理機制 → 建議加 max session count 或 TTL 清理 → **優先級：低** ✅ 已解決於 Wave 1C（cleanup）
- **Diff generator 是簡化版**: `diff-utils.ts` 的 diff 演算法不是真正的 LCS/Myers diff，在複雜重排場景可能產生不準確的 diff output → 考慮未來引入 `diff` npm package → **優先級：低**
- **Tool name 不一致**: 既有 tools 在 registry 用 hyphens（`read-file`）但 mode 用 underscores（`read_file`），新 git tools 也用 hyphens。這會導致 `getToolsWithPermission()` 的 `allowedNames` 過濾可能不 match → **優先級：高** ✅ 已解決：全部工具一致使用 hyphens

#### 延伸學習
- **Interceptor Pattern**: 本次的 permission wrapping 本質是 AOP（Aspect-Oriented Programming）中的 Around Advice。Vercel AI SDK 不提供 middleware hook，所以在 tool 層自行實作。若未來 SDK 支援 `onToolCall` middleware，可遷移到更優雅的方案
- **Structured Concurrency**: Permission callback 的 Promise 需要跟 agent loop 的生命週期綁定。JavaScript 缺乏 structured concurrency（如 Kotlin coroutine scope），這類「跨越 scope 的 Promise」是常見的 resource leak 源頭
- 若想深入：搜尋 "JavaScript AbortController Promise patterns" 或 "Proxy pattern for function interception TypeScript"

---

### 2026-03-08: Dynamic Provider Registry + Agent Benchmark

**来源**: feat(core,cli,shared): Dynamic Provider Registry + Benchmark system

**本次相關主題**: Registry Pattern, Provider Abstraction, Benchmark Harness Design

#### 做得好的地方
- **Single Source of Truth**: Provider 資訊從 5 處硬編碼收斂到 `~/.frogger/providers.json` 一處，`DEFAULT_PROVIDERS` 常數作為 fallback
- **Type-driven dispatch**: `ProviderEntry.type` 欄位取代 switch/case on string union，新增 provider 不需改 code
- **Backward-compatible `createModel()`**: 同時接受 `ProviderEntry` 物件或 `string` name，既有 useAgent.ts 呼叫方式不需改動
- **Benchmark 隔離設計**: 每個 task 在獨立 `/tmp/frogger-bench-{timestamp}/` 目錄執行，避免 cross-contamination
- **Seed files + validate pattern**: BenchmarkTask interface 乾淨地分離「設置→執行→驗證」三步驟

#### 潛在隱憂
- **`loadProviders()` 同步寫入**: 首次呼叫時使用 `mkdirSync`/`writeFileSync` 創建預設檔案。若 home directory 無寫入權限會 throw → 建議 wrap try-catch 或改為 lazy async init → **優先級：低**
- **Provider registry 無 schema validation**: `providers.json` 讀取後直接 `as ProviderEntry[]`，若使用者手動編輯導致 malformed JSON 或缺欄位會產生 runtime error → 建議加 Zod parse → **優先級：中** ✅ 已解決於 Wave 2B（Zod safeParse）
- **Benchmark runner 無 timeout**: 如果 agent 進入死循環，benchmark task 永遠不結束 → 建議加 AbortController + timeout → **優先級：中** ✅ 已解決於 Wave 2C（AbortController）
- **`process.exit()` in benchmark CLI**: 直接 `process.exit(1)` 會跳過 cleanup，考慮改用 `process.exitCode` → **優先級：低**

#### 延伸學習
- **Registry Pattern vs Service Locator**: 本次實作是 file-based registry，跟 in-memory Service Locator 的 trade-off（持久化 vs 效能）
- **OpenTelemetry for Benchmarks**: 若想 track benchmark 趨勢，可以用 OTLP exporter 把 duration + token usage 送到 Grafana
- 若想深入：搜尋 "Plugin Registry Pattern TypeScript" 或參考 Nx/Turborepo 的 plugin system

---
<!-- Journal entries go here -->
