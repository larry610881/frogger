# Architecture Journal

## Table of Contents
- [2026-03-15: v0.11.0 SWE-bench Competitiveness + System Stability Sprint](#2026-03-15-v0110-swe-bench-competitiveness--system-stability-sprint)
- [2026-03-13: Permission System Enhancement — System Prompt Safety + Always-Deny + Policy Override](#2026-03-13-permission-system-enhancement--system-prompt-safety--always-deny--policy-override)
- [2026-03-13: v0.9.0 穩定性優先 — 測試覆蓋 + Deprecated 清理 + Flaky 修復](#2026-03-13-v090-穩定性優先--測試覆蓋--deprecated-清理--flaky-修復)
- [2026-03-13: v0.8.0 Provider Capabilities + Tool Hints + Project Detection + System Prompt Rewrite](#2026-03-13-v080-provider-capabilities--tool-hints--project-detection--system-prompt-rewrite)
- [2026-03-12: v0.7.0 Test Coverage + Auto-Update Check](#2026-03-12-v070-test-coverage--auto-update-check)
- [2026-03-12: v0.6.0 Stability & UX Sprint — Retry, MarkdownView, DiffView, Silent Catch, CI](#2026-03-12-v060-stability--ux-sprint--retry-markdownview-diffview-silent-catch-ci)
- [2026-03-12: Session Resume Hint — 三層退出提示](#2026-03-12-session-resume-hint--三層退出提示)
- [2026-03-12: v0.5.1 MODEL_PRICING 擴充 + /mcp /remember 測試補齊](#2026-03-12-v051-model_pricing-擴充--mcp-remember-測試補齊)
- [2026-03-12: v0.5.0 MCP SSE/HTTP Transport + Background Tasks](#2026-03-12-v050-mcp-ssehttp-transport--background-tasks)
- [2026-03-11: v0.4.0 Desktop 通知 + GitHub Issue → PR](#2026-03-11-v040-desktop-通知--github-issue--pr)
- [2026-03-11: v0.3.1 Tech Debt Batch — O1-O15 全面清理（12 項）](#2026-03-11-v031-tech-debt-batch--o1-o15-全面清理12-項)
- [2026-03-11: v0.3.0 Memory System + FROGGER.md Init + Web Search + Extended Thinking UI](#2026-03-11-v030-memory-system--froggermd-init--web-search--extended-thinking-ui)
- [2026-03-11: v0.2.1 Rules System + Hooks System](#2026-03-11-v021-rules-system--hooks-system)
- [2026-03-11: v0.2.0 Feature Batch — Extended Thinking, Prompt Caching, Test Runner, MCP stdio Transport](#2026-03-11-v020-feature-batch--extended-thinking-prompt-caching-test-runner-mcp-stdio-transport)
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

### 2026-03-15: v0.11.0 SWE-bench Competitiveness + System Stability Sprint

**來源**: SWE-bench 競爭力提升計畫（B1-B5 穩定性修復 + S1-S5 能力強化 + S8 評估框架）

**本次相關主題**: Agent Team 並行開發、Tool Error Recovery、Atomic File Operations、SWE-bench Evaluation

#### 做得好的地方

- **Agent Team 並行架構設計良好** — 4 個 agent 並行開發，透過檔案衝突分析確保無衝突。唯一共享檔案 `modes/agent.ts` 明確分割職責（Agent C 改 allowedTools、Agent D 改 systemPromptSuffix），成功避免 merge conflict
- **Error Recovery Hints 提升 LLM 自主修復能力** — edit-file/read-file/bash 的錯誤回應包含 actionable hints，引導 LLM 下一步動作（re-read → retry、glob search、analyze error），預期可減少 SWE-bench 上因工具錯誤導致的失敗循環
- **Atomic Write 防護** — write-file 改用 tmp + rename 模式，防止中途 crash 損毀檔案。長時間 SWE-bench 任務中 agent 可能被 timeout kill，atomic write 確保不留下半寫入的檔案
- **MCP Timeout** — 30 秒連線 timeout 防止 MCP server 掛起凍結 agent，SWE-bench 場景中 agent 不會因外部 server 問題卡死
- **Context Hard Limit** — 大型 repo 修復可能產生極長對話，hard limit 確保 API call 不會因超限而失敗

#### 潛在隱憂

- **analyze-repo 的 depth 遍歷效能** — 大型 monorepo（10K+ 檔案）在 depth=3 時可能掃描大量目錄。建議加入檔案數上限（如 MAX_FILES=1000）作為安全網 → 優先級：中
- **SWE-bench runner 的 git clone 網路依賴** — 評估框架需要 clone 完整 repo，網路不穩定或 rate limit 可能導致測試失敗。考慮支援 local repo path 作為替代 → 優先級：中
- **test-runner 結構化輸出的 JSON 解析健壯性** — vitest/jest 的 JSON output 可能被 console.log 汙染，current regex 可能匹配錯誤的 JSON block → 優先級：低

#### 延伸學習

- **Atomic File Operations**: Linux `rename(2)` 在同一 filesystem 上是 atomic 的，跨 filesystem 不保證。Frogger 的 tmp 檔案使用 `${resolved}.frogger-tmp-*` 確保在同目錄（同 filesystem），正確實作
- **Agent Evaluation Frameworks**: SWE-bench 是目前最具影響力的 coding agent benchmark，但其評估方式（test patch pass rate）有局限 — 不衡量代碼品質、修復效率或副作用。更全面的評估應結合 pass rate + token efficiency + edit minimality

---

### 2026-03-13: Permission System Enhancement — System Prompt Safety + Always-Deny + Policy Override

**來源**: P0/P1/P2 三層安全增強計畫 — System Prompt 加入破壞性操作警告、PermissionPrompt 增加 Always Deny、ApprovalPolicy 可覆蓋

**本次相關主題**: Defense in Depth, LLM Safety Guardrails, Configuration Override Pattern, Permission System

#### 做得好的地方
- **三層防禦設計（Defense in Depth）**：P0 在 LLM 層（system prompt 警告）、P1 在 UI 層（always-deny 持久化）、P2 在 config 層（policy override）分別加固。任一層失效，其他層仍可攔截危險操作
- **最小變更原則**：P0 僅在 `systemPromptSuffix` 插入 12 行文字，不改變任何邏輯；P1 的 deny-project/deny-global 複用既有的 `buildPermissionRule` + `savePermissionRule` 基礎設施；P2 的 `policyOverride` 透過一個 spread 覆蓋就完成，不改 ModeConfig 結構
- **快捷鍵設計**：`d` = deny-project（直覺）、`x` = deny-global（避免和 `g` = global-allow 混淆），符合最小驚訝原則

#### 潛在隱憂
- [deny-project 在沒有 workingDirectory 時靜默跳過持久化] → [可考慮向使用者顯示警告] → [優先級：低]
- [approvalPolicy override 是全域覆蓋所有 mode，無法針對個別 mode 設定不同 policy] → [未來可擴展為 per-mode 覆蓋 `{ ask: 'auto', agent: 'confirm-all' }`] → [優先級：低]

#### 延伸學習
- **Defense in Depth（縱深防禦）**：安全架構原則，不依賴單一防線。本次實作的三層（LLM prompt → UI permission → config policy）即為此模式的應用
- 若想深入：搜尋「OWASP Defense in Depth」或「Swiss Cheese Model」

---

### 2026-03-13: v0.9.0 穩定性優先 — 測試覆蓋 + Deprecated 清理 + Flaky 修復

**來源**: v0.9.0 計畫 — 全面審計後的穩定性衝刺，新增 ~54 個 test cases，清理 deprecated code，修復 flaky test

**本次相關主題**: Test Strategy for React Hooks, Deprecated Code Lifecycle, Flaky Test Root Cause Analysis, Pattern-based Testing

#### 做得好的地方
- **Hook 測試策略**：CLI 的四個 hook（useMode、useContextBudget、useAgentServices、useAgent）採用「核心邏輯測試」而非「React hook 渲染測試」的策略。提取 hook 內的純邏輯（cycle 算法、throttle 判斷、singleton 模式）直接測試，避免了 `renderHook` + `act()` 的 async 複雜度。此策略在 hook 邏輯重而 UI 狀態輕的場景下效率最高
- **Flaky Test 根因分析**：git-clone 測試對不存在的 HTTPS URL 發起真實 DNS 查詢，在某些網路環境下 30 秒仍不足。根本修復：將需要網路的 URL 格式驗證測試改為直接測試 regex pattern，消除網路依賴。保留其他使用 local bare repo 的整合測試不受影響
- **Deprecated 清理流程**：移除 `supportsVision()` 前先 grep 確認無 production code 引用（僅 test + docs），清理 constant + function + test + docs 四處，pnpm build 確認 downstream packages 無編譯錯誤
- **Command 邊界案例覆蓋**：doctor（capabilities 顯示、gh auth 狀態、update check 失敗）、cost（reasoning tokens、cache tokens、cache 隱藏）、git-auth（status 顯示、all-negative、remove、update existing）、sessions（HOME 替換 ~）、resume（empty messages）— 每個都是 production 可能遇到的邊界
- **Checkpoint 擴充**：覆蓋 edit-file、bash non-git、git-commit 三種 mutating tool 路徑，以及 MAX_FILE_SIZE 跳過和 getCheckpoint 查詢

#### 潛在隱憂
- [Hook 測試的核心邏輯提取模式無法覆蓋 React state + async interaction] → [未來可考慮加入少量 integration test 使用 `renderHook`] → [優先級：低]
- [vi.fn() mock warning（`did not use 'function' or 'class'`）表示 vitest 4.x 對 mock 實作有更嚴格的檢查] → [將 mock factory 改用 class 或 named function] → [優先級：低]

#### 延伸學習
- **Test Double 分類學（Meszaros）**：本次大量使用 mock（mock return value）而非 stub/spy/fake，因為 hook 的依賴都是外部模組。理解 mock vs stub vs fake 的選擇時機有助於寫出更不脆弱的測試
- 若想深入：搜尋「Gerard Meszaros xUnit Test Patterns」或「Martin Fowler Mocks Aren't Stubs」

---

### 2026-03-13: v0.8.0 Provider Capabilities + Tool Hints + Project Detection + System Prompt Rewrite

**來源**: v0.8.0 計畫 — 跨 core/cli/shared 三個 packages 的四大功能（Part A-D）+ CLI 元件測試

**本次相關主題**: Capability Detection Pattern, Tool Metadata Extension, Section-based Prompt Composition, Filesystem-based Project Detection, Build-time Constant Injection

#### 做得好的地方
- **ProviderCapabilities 取代 `isAnthropic` 硬編碼**：`DEFAULT_CAPABILITIES` record + `resolveCapabilities()` 合併函式 + `supportsCapability()` 查詢函式，形成三層 API。`ProviderEntry.capabilities?` 允許使用者覆蓋預設（如 openai-compatible + vision），解決了先前架構筆記 v0.2.0 中 Wave 2B 思考題提出的問題。向後相容——`supportsVision()` 標記 deprecated 但仍可用
- **Tool Hints 的 category 分組設計**：22 個工具各自宣告 `hints` + `category`，`getToolHints()` 以固定 category 順序（read→write→search→git→test→github→system）輸出分組 Markdown。分散宣告 + 集中聚合的模式讓新增工具時只需在工具檔案中加兩個欄位，registry 自動收集
- **Section-based System Prompt 純函式組建**：每個 section（identity、fileReferenceNote、modeGuidance、toolHints、errorRecovery、repoMap、rules、memory、projectContext）都是獨立純函式，`buildSystemPrompt()` 只做 filter + join。易測試（每個函式單獨驗證）、易擴展（新增 section 只需加一個函式 + 在陣列中插入）
- **Project Detection 的 Convention-based 偵測**：掃描 tsconfig.json/jsconfig.json（語言）、lockfiles（套件管理器）、package.json dependencies（框架）、pytest.ini/Cargo.toml 等（測試框架）、pnpm-workspace.yaml/lerna.json（monorepo）。與 test-runner 的框架偵測是同一模式，但作用於 system prompt 層，讓 LLM 理解專案技術棧
- **Build-time Version Injection**：`tsup.config.ts` 讀取 `package.json` version 透過 `define` 注入 `__APP_VERSION__`，`constants.ts` 使用 `typeof __APP_VERSION__ !== 'undefined'` 做 runtime fallback。單一來源（package.json）消除版本不一致風險
- **CLI 元件測試全面覆蓋**：6 個新測試檔案（ThinkingView、ContextUsage、ChatView、PermissionPrompt、InputBox、App）共 32 個 test cases，使用 `ink-testing-library` + `React.createElement` 模式，每個元件獨立 mock 依賴

#### 潛在隱憂
- **`detectProjectInfo()` 同步掃描多個路徑** → 每次 agent turn 都呼叫 `existsSync()` / `readFileSync()` 掃描 10+ 個檔案。目前是同步 I/O，在 NFS 或慢磁碟上可能增加延遲。考慮加入 TTL cache（類似 repoMap 的 30 秒快取）→ 優先級：低
- **Tool hints 硬編碼在各工具檔案中** → hints 文字分散在 22 個檔案，若需統一更新措辭或翻譯需逐檔修改。考慮未來抽取到集中式 config（如 `tool-hints.json`）→ 優先級：低
- **`getToolHints()` 的 category 順序硬編碼** → `categoryOrder` 陣列寫死在方法中，新增 category 時需同步更新兩處（type + order array）。可改為從 `ToolCategory` type 自動推導順序 → 優先級：低
- **ProviderCapabilities Zod schema 未強制型別** → `config.ts` 的 `capabilities` 欄位使用 `z.object({...}).optional()`，各欄位都是 optional boolean。惡意 config 可以設定 `{ thinking: true }` 讓不支援 thinking 的 provider 嘗試啟用，可能導致 API 錯誤。`resolveCapabilities()` 的 merge 邏輯信任使用者輸入 → 優先級：低

#### 延伸學習
- **Capability Detection vs Feature Flags**：本次的 `ProviderCapabilities` 是 runtime capability detection，類似瀏覽器的 `navigator.mediaDevices` 或 Node.js 的 `process.features`。與 feature flags（LaunchDarkly 式的遠端配置）不同之處在於：capabilities 是靜態的（由 provider 決定），feature flags 是動態的（由運營決定）。兩者可組合——capability 判斷「能不能用」，feature flag 判斷「要不要用」
- **Section-based Prompt Engineering**：將 system prompt 拆為獨立 section 的做法在 LLM 應用中越來越常見。SWE-agent 的 ACI prompt、OpenHands 的 micro-agent prompt 都採用類似結構。好處是可以針對不同 mode/context 組合不同 section，而非維護多份完整 prompt。trade-off 是 section 之間可能有語義重複或矛盾，需要仔細管理 section 順序和內容邊界
- 若想深入：搜尋 "capability detection pattern software design" 或 "modular prompt engineering LLM agents"

**思考題**：`detectProjectInfo()` 目前僅偵測第一層（工作目錄）的技術棧。在 monorepo 中，子 package 可能使用不同語言/框架（如 `packages/api` 用 Express、`packages/web` 用 Next.js）。如何設計 per-package detection + 上下文感知的 prompt injection？考慮在 tool call 時根據目標檔案路徑動態切換 project info 的 trade-off。

---

### 2026-03-12: v0.7.0 Test Coverage + Auto-Update Check

**來源**: 測試覆蓋補齊 + Auto-update 檢查功能（#28）— 跨 core/cli packages

**本次相關主題**: Integration Testing with Real Git Repos, npm Registry API, Semver Comparison, SlashCommand Extension

#### 做得好的地方
- **Git 工具整合測試使用真實 tmpDir repo**：git-status/diff/log/commit 測試在 `beforeEach` 建立真實 git 倉庫（`git init -b main` + config user），`afterEach` 清理。這比 mock `execa` 更能捕捉實際 git 行為（如 porcelain 格式、empty repo 的 log 錯誤）
- **write-file 測試覆蓋安全邊界**：path traversal 測試（`../../etc/passwd`）驗證 `assertWithinBoundary` 防護生效、diff 輸出驗證（覆寫 vs 新建 vs 相同內容）、parent dir 自動建立
- **diff-utils 純函式測試**：10 個 test case 覆蓋所有 edge case（空內容、新檔案、刪除檔案、相同內容、混合修改），零依賴零 mock
- **Auto-update 與 /doctor 無縫整合**：`checkForUpdate()` 純函式設計，回傳結構化 `UpdateCheckResult`；doctor 命令中 catch 網路錯誤顯示 "could not check (offline?)" 而非報錯；`isNewerVersion()` 獨立提取為可測試的純函式
- **55 個新測試案例**：git-core-tools（24）、write-file（7）、diff-utils（10）、update-check（14）— 全部通過

#### 潛在隱憂
- **Doctor 命令呼叫 `checkForUpdate()` 兩次** → 第一次用於 checks 列表，若偵測到更新又呼叫一次取得 `formatUpdateMessage`。應快取首次結果 → 優先級：低
- **npm registry 查詢無快取** → 每次 `/doctor` 或 `/update` 都發 HTTP 請求。可加 5 分鐘 in-memory cache 避免同 session 重複查詢 → 優先級：低

#### 延伸學習
- **Integration vs Unit Testing for CLI Tools**：git tools 選擇 integration test（真實 git repo）而非 mock `execa`，因為 git 的行為細節（exit code、output format、error message）難以精確 mock。trade-off 是測試較慢（15s vs <1s），但可靠性更高。mock 適用於 API 呼叫（如 web-search、update-check），integration 適用於本地 CLI 工具
- 若想深入：搜尋 "testing CLI tools with real filesystem" 或 "npm registry API documentation"

---

### 2026-03-12: v0.6.0 Stability & UX Sprint — Retry, MarkdownView, DiffView, Silent Catch, CI

**來源**: v0.6.0 Sprint — 跨 core/cli 的穩定性 + UX 批次改善（17 檔案變更）

**本次相關主題**: Retry with hasYielded Guard, Line-by-line Markdown Parser Extension, Hunk Header Parsing, Silent Catch Anti-pattern, Snapshot Testing

#### 做得好的地方
- **`hasYielded` 旗標的精妙設計**：Agent retry loop 的核心安全機制——只在「尚未發出任何事件」時才允許重試。一旦 UI 收到 partial data（text_delta、tool_call 等），重試會導致使用者看到重複或不一致的內容。這個 boolean flag 用最小代價解決了 generator-based stream retry 的核心難題
- **MarkdownView 提取為獨立元件**：從 ChatView 的 private function 提升為 exported component，同時擴展 5 種新語法（blockquote、ordered list、table、link、strikethrough）。`renderInline` 的 regex 擴展向後相容——新增的 capture groups 不影響既有 `**bold**` 和 `` `code` `` 的匹配
- **DiffView 行號的 hunk header 解析**：`parseHunkHeader()` 解析 `@@ -a,b +c,d @@` 格式，維護 `oldLine`/`newLine` 計數器。每種行類型（+/-/context）正確遞增對應計數器，多 hunk 場景下自動重置
- **Silent catch 分層處理策略**：CLI 層（teardown 時 import 不穩定）使用 `console.error`，core 層使用 `logger.warn`。四處修改遵循同一模式：不改變控制流（仍然 catch），只增加可觀測性
- **Mode config snapshot tests**：3 行 test code 就能偵測任何對 mode 配置的意外修改（allowedTools、approvalPolicy、systemPromptSuffix），防止 refactor 時的 silent regression

#### 潛在隱憂
- **Retry 與 Vercel AI SDK 的 `streamText` 內建 retry 可能重疊** → Vercel AI SDK 某些 provider adapter 內建了 HTTP retry 邏輯，疊加 agent-level retry 可能導致 429 被重試多次（最多 3×3=9 次）。建議觀察實際行為，必要時降低 `maxRetries` → 優先級：中
- **TableView 的 column width 計算未考慮 inline formatting** → `cell.length` 計算包含 `**bold**` 的 markdown 語法字元，導致對齊時 bold 欄比實際顯示更寬。需要 strip markdown 後再計算寬度 → 優先級：低
- **DiffView 行號在非標準 diff 格式下可能失準** → 如果 diff 輸出不含 hunk header（如 `git diff --no-headers`），`oldLine`/`newLine` 從 0 開始計數。目前的 tool 輸出都包含 hunk header，但需注意 edge case → 優先級：低

#### 延伸學習
- **Generator Retry Pattern**：在 `AsyncGenerator` 中加 retry 比普通 `Promise` 更複雜，因為 generator 是有狀態的——一旦 yield 了值，consumer 已經消費，無法「回溯」。`hasYielded` 是最簡單的守衛，更進階的做法是 buffering（先收集所有事件，確認無錯誤後再 yield），但這會犧牲串流的即時性。本次選擇即時串流 + 放棄 partial retry 是正確的 trade-off
- **Snapshot Testing 的適用場景**：Snapshot test 最適合「結構穩定但內容豐富」的資料——如 mode config、CLI output、serialized state。不適合頻繁變動的資料（如 timestamp、random ID）。本次 mode config 是理想案例：結構很少變但一旦變動影響深遠
- 若想深入：搜尋 "retry pattern async generator JavaScript" 或 "vitest snapshot testing best practices"

---

### 2026-03-12: Session Resume Hint — 三層退出提示

**來源**: UX Enhancement — cli/src/app.tsx + cli/src/hooks/useAgent.ts + cli/src/session-state.ts

**本次相關主題**: Module-level Singleton Bridge, Signal Handling, Ink Lifecycle

#### 做得好的地方
- **Module-level singleton 作為 React ↔ Host 橋樑**：`sessionState` 是純 JS 物件，不受 React state 非同步更新影響。`useAgent` 在 session save 成功後同步寫入，`app.tsx` 的 `waitUntilExit()` 和 signal handler 讀取——單向資料流清晰，無 race condition
- **三層防護互補**：正常退出（`waitUntilExit`）→ 信號退出（SIGTERM/SIGHUP）→ 異常退出（下次啟動偵測 recent session），覆蓋所有場景；每層獨立運作，不互相依賴
- **最小侵入性**：新功能僅新增 1 個小檔案（session-state.ts），修改 2 個既有檔案各 ~3 行，對既有架構零衝擊

#### 潛在隱憂
- **signal handler 中的 `process.exit(0)`** → 會跳過 Ink 的正常清理流程（`waitUntilExit` 不會觸發），但此時 Ink 可能已無法正常渲染。可接受的 trade-off → 優先級：低
- **`formatTimeAgo` 在 app.tsx 內 inline** → 若未來其他檔案也需要類似功能，需提取到 shared utils。目前 single usage 不值得抽離 → 優先級：低

#### 延伸學習
- **Node.js Signal Handling**：SIGINT 由 Ink 內部處理（Ctrl+C），SIGTERM/SIGHUP 需手動攔截。SIGKILL 和 SIGSTOP 無法被任何 process 攔截，這是 OS 層面的硬性限制
- 若想深入：搜尋 `Node.js process signal events` 和 `graceful shutdown patterns`

---

### 2026-03-12: v0.5.1 MODEL_PRICING 擴充 + /mcp /remember 測試補齊

**來源**: Quick Wins + Stability — shared constants 擴充 + core commands 測試

**本次相關主題**: Pricing Data Maintenance, Command Test Patterns

#### 做得好的地方
- **MODEL_PRICING 結構化分組**：以註解按 provider + generation 分組（Claude 4.6 → 4.5 → 4.1 → 4 legacy），方便未來維護時快速定位；alias model IDs（如 `claude-opus-4-5` 與 `claude-opus-4-5-20251101`）並列確保 `/cost` 對任何 model ID 都能正確計算
- **/mcp 測試完整覆蓋**：6 個 test cases 覆蓋所有 code paths——空 config、stdio server、SSE/HTTP server、reconnect without manager、all connected、mixed results——使用 `vi.mock` 隔離 `loadMCPConfig` 檔案系統依賴
- **/remember 測試精簡有效**：2 tests 驗證核心行為（空 args → usage、有 args → push message），不過度 mock

#### 潛在隱憂
- **Pricing 數據易過時** → 目前為 hardcoded constants，model 定價變更（如 Anthropic 調價）需手動更新程式碼。考慮未來從遠端 API 或 config 動態載入 → 優先級：低（目前 model 數量可控，手動維護足夠）

#### 如果沒有明顯隱憂
本次任務規模小（3 檔案變更 + 2 新測試檔），無重大架構隱憂。延伸思考：**pricing data 的 single source of truth** 問題——當 `MODEL_PRICING` 與 `providers.json` 中的 model list 不同步時，`/cost` 會回傳 `null`。可考慮在 `/doctor` 命令中加入 pricing coverage check，確保所有已註冊 model 都有對應定價。

---

### 2026-03-12: v0.5.0 MCP SSE/HTTP Transport + Background Tasks

**來源**: Phase 4 (#22b, #23) — 跨 core/cli/shared 的雙功能開發

**本次相關主題**: Discriminated Union Schema, Transport Factory, Background Task Lifecycle, AbortController Pattern

#### 做得好的地方
- **#22b Config Discriminated Union**：`z.union([sseSchema, httpSchema, stdioSchema])` 順序確保 Zod 按嚴格到鬆散的順序匹配（SSE/HTTP 有 `transport` literal，stdio 的 `transport` optional），保持向後相容——現有 stdio config 無需修改
- **#22b Transport Factory SRP**：`transport-factory.ts` 抽離 transport 建立邏輯，`client.ts` 只依賴 generic `Transport` 介面。SSE/HTTP transport 用 dynamic `await import()` 避免 stdio-only 使用者載入不必要的依賴
- **#22b Headers 環境變數解析**：`resolveEnvVars()` 提升為 exported function，同時處理 stdio `env` 和 SSE/HTTP `headers` 的 `${ENV_VAR}` 替換，保障 API token 不寫死在 config 中
- **#23 BackgroundTaskManager 純粹的 Core 層設計**：Manager 在 core 層僅依賴 `BackgroundTaskRunner` interface（`{ run: (opts: { signal }) => Promise<void> }`），不直接依賴 agent 或 CLI——CLI 層提供 `createBackgroundAgent` factory，符合依賴反轉原則
- **#23 AbortController 一致性**：每個 background task 持有獨立 `AbortController`，cancel 時 `abort()` → `streamText` 中斷 → catch 設 status `cancelled`，與主 agent 的 Ctrl+C 中斷模式一致

#### 潛在隱憂
- **SSE/HTTP reconnect 未驗證** → MCPClientManager 的 `reconnectAll()` 是為 stdio 設計的（斷線後重建 process），SSE/HTTP 的斷線語義不同（HTTP 本身是 stateless，SSE 需要 EventSource 重連）。需端對端測試驗證 → 優先級：中
- **Background task 缺乏 result persistence** → 目前只有 in-memory 狀態（task info），app 退出後所有 background task 歷史消失。Plan 提到 `events.jsonl` persistence 但未實作 → 優先級：低（MVP 先 in-memory，有需求再加持久化）
- **Background task 無 output 可見性** → 使用者只能看到 status（running/completed/failed），看不到 agent 的實際輸出。需要 event streaming 回 main agent 或 log to file → 優先級：中

#### 延伸學習
- **Discriminated Union vs Tagged Union**：Zod `z.union()` 依序嘗試匹配，`z.discriminatedUnion()` 用指定欄位直接跳轉。本次用 `z.union()` 因為 stdio 的 `transport` 是 optional——如果所有 transport 都有 `transport` 欄位，`z.discriminatedUnion('transport', [...])` 更高效
- **Transport Pattern in MCP SDK**：MCP SDK 的 `Transport` 介面（`start()`, `send()`, `close()`）是典型的 Strategy Pattern，client 不關心底層是 stdio pipe、SSE stream 還是 HTTP request

---

### 2026-03-11: v0.4.0 Desktop 通知 + GitHub Issue → PR

**來源**: Phase 4 (#26) + Phase 5 Quick Win (#38) — 跨 3 packages 的雙功能開發

**本次相關主題**: BEL Character Notification, Graceful Dynamic Import, Slash Command → Agent Orchestration, gh CLI Integration Security

#### 做得好的地方
- **#38 零依賴通知架構**：BEL 字元（`\x07`）作為 universal fallback，`node-notifier` 透過 `try { await import() } catch {}` 實現 graceful degradation。不需新增任何 `dependencies`，安裝 `node-notifier` 是可選增強。這是 Progressive Enhancement 的教科書應用
- **#38 通知邏輯完全在 CLI 層**：`notify.ts` 放在 `packages/cli/src/utils/`，core 保持 platform-agnostic。Config schema（`NotificationsConfig`）在 core 定義但通知行為在 CLI 實作，符合 HostProvider 抽象目標——未來 VSCode extension 可用 `vscode.window.showInformationMessage()` 替換
- **#26 Hybrid 策略（/issue 命令 + gh-issue/gh-pr 工具）**：`/issue` 做 orchestration（驗證 gh auth → 讀取 issue → 推導分支名 → 注入結構化 message），`gh-issue` / `gh-pr` 作為獨立工具讓 agent 在後續流程中自主使用。這比純命令式（全部在 /issue 中完成）更靈活——agent 可在非 /issue 流程中也使用 gh 工具
- **#26 安全分層**：`gh-issue` 為 `auto`（read-only），`gh-pr` 為 `confirm`（state-changing），與既有 git-status/git-push 的 permission 模式一致。`execa` 全部使用陣列參數形式，issue title 中的特殊字元（`$`、`"`、`` ` ``）不會觸發 shell injection
- **分支名 slug 化**：`slugify()` 使用 `replace(/[^a-z0-9-]+/g, '-')` + `.slice(0, 40)` 限制長度，防止特殊字元和超長 title 導致的 git branch 名稱問題

#### 潛在隱憂
- **`node-notifier` 的 macOS/Linux 依賴**：`node-notifier` 在 macOS 使用 `terminal-notifier`，Linux 使用 `notify-send`，若系統未安裝這些工具，dynamic import 成功但通知靜默失敗（非 crash）。BEL fallback 確保基本功能，但使用者可能不知道為何沒看到桌面通知 → **優先級：低**
- **`/issue` 命令的 `execa` 同步呼叫阻塞 UI**：`gh auth status` 和 `gh issue view` 在 slash command 中同步等待，若 GitHub API 慢（> 5 秒），使用者會感覺卡住。考慮未來加入 loading indicator → **優先級：低**
- **`gh-pr` 工具的 `--label` 逗號連接**：`labels.join(',')` 傳給 `--label` flag，若 label 名稱本身包含逗號會被錯誤分割。gh CLI 的 `--label` 支援多次傳遞（`--label a --label b`），更安全但目前簡化為逗號格式 → **優先級：低**

#### 延伸學習
- **Progressive Enhancement in CLI Tools**：#38 的 BEL + node-notifier 是 Progressive Enhancement 在 CLI 領域的應用。核心體驗（BEL 聲音）零依賴，增強體驗（桌面通知）按需啟用。類似 Web 開發中的「先保證基本 HTML 可用，再逐步加入 CSS/JS 增強」
- **Slash Command as Orchestrator**：#26 的 `/issue` 命令複用 `/remember` 的 pattern（push structured message to messagesRef），但更進一步——它先做環境驗證（gh auth）和資料獲取（issue view），再將結構化工作流程注入對話。這是「命令作為 agent 編排器」的模式，與 Claude Code 的 `/init` 類似
- 若想深入：搜尋 "Progressive Enhancement principle" 或 "Orchestrator Pattern microservices"

**思考題**：`/issue` 目前在命令執行時就驗證 `gh auth status`。如果使用者的 GitHub token 在長任務執行中過期（如 fine-grained PAT 設定了 1 小時過期），agent 在後續呼叫 `gh-pr` 時會失敗。該如何設計 token 有效性的 lazy verification 或自動 refresh 機制？考慮在 `gh-pr` tool 的 execute 中加入 auth 重試 vs. 在 `/issue` 開始時取得長效 token 的 trade-off。

---

### 2026-03-11: v0.3.1 Tech Debt Batch — O1-O15 全面清理（12 項）

**來源**: v0.3.1 Tech Debt 清理 — 12 項優化，涵蓋安全、穩定性、UX、品質、打磨五個維度

**本次相關主題**: SHA-256 Trust Verification, Factory Pattern, Cache Invalidation Strategy, Defensive Input Truncation, Cross-system Batch Refactoring

#### 做得好的地方
- **SHA-256 信任模式複用（O2）**：hooks 首次確認完全複用 `confirmed-permissions.ts` 的 `loadConfirmedHashes()` / `saveConfirmedHash()` pattern，API 一致（`isHooksConfirmed()` / `confirmHooks()`），使用者心智模型統一。專案級 hooks.json 和 permissions.json 的安全模型對齊，降低被惡意 repo 攻擊的風險
- **三種快取策略各得其所（O8、O12）**：Rules 使用 file-set hash memoization（適合「檔案集合可能變更」的場景），Repo Map 使用 TTL-based cache（適合「短期內不變」的場景）。兩者都是 module-level cache，避免了 WeakRef 或 LRU 的過度工程
- **Factory Pattern 向後相容（O14）**：`createLogger(level?)` factory 取代直接修改全域 state，但保留 `export const logger = createLogger()` 作為 default instance，所有 20+ 處 import 零修改。這是 Strangler Fig Pattern 的微型應用——逐步替換而非一次重寫
- **Defensive Truncation 雙層防護（O1、O9）**：Memory 大小限制在 tool 層截斷（按 `---` 語意分隔符切割最舊條目），Hook result 在 executor 層截斷（按字元數硬截斷）。兩層獨立運作，即使一層失效另一層仍有防護
- **12 項變更零迴歸**：所有變更都有配套的回歸測試（共 30+ 個新 test case），且所有既有測試通過。批次修改的風險透過「每項 TDD + 子系統分組」策略有效控制

#### 潛在隱憂
- **Rules memoization 的 hash 精確度**：`computeFileSetHash()` 使用 `path:size:mtime` 作為 hash 輸入，不讀檔案內容。理論上兩次修改 mtime 相同但內容不同的邊界情況不會偵測到（極罕見）。若需更高精確度可改為內容 hash，但效能代價更高 → **優先級：低**
- **MCP reconnect 的並行安全**：`reconnectAll()` 對所有斷線 server 依序重連，若某個 server 重連耗時，後續 server 會被阻塞。考慮未來改為 `Promise.allSettled` 並行重連 → **優先級：低**
- **`BUILT_IN_COMMANDS` set 需手動維護**：新增 built-in 命令時需同步更新 `BUILT_IN_COMMANDS`，遺漏則 collision 檢查失效。考慮未來從 `CommandRegistry.getAll()` 動態產生 → **優先級：低**

#### 延伸學習
- **Cache Invalidation 的三種策略**：本次實作展示了三種經典 cache invalidation 策略：(1) **TTL-based**（Repo Map 30s）——簡單但可能讀到過期資料；(2) **Content-hash-based**（Rules file set hash）——精確但有計算成本；(3) **Manual invalidation**（`clearRepoMapCache()` / `clearRulesCache()`）——測試和 edge case 的逃生口。生產系統通常混用多種策略，與本次做法一致
- **Strangler Fig Pattern**：O14 的 logger factory 化是 Strangler Fig Pattern 的微型應用。Martin Fowler 描述此模式為：在舊系統旁邊建立新系統，逐步將流量導向新系統，最終移除舊系統。這裡的「新系統」是 `createLogger()`，「舊系統」是全域 `logger`，「流量」是各模組的 import。未來可逐步讓各模組改用 `createLogger()` 創建獨立 instance
- 若想深入：搜尋 "cache invalidation strategies distributed systems" 或 "Strangler Fig application modernization"

**思考題**：本次 12 項 tech debt 中有 3 項涉及快取（O8 Rules、O12 Repo Map、O1 Memory truncation）。如果 Frogger 未來支援 multi-agent 並行（Phase 4 O21），這些 module-level cache 會成為共享可變狀態。在 Node.js 的 `worker_threads` 或獨立 process 場景下，該如何設計跨 agent 的快取共享或隔離策略？

---

### 2026-03-11: v0.3.0 Memory System + FROGGER.md Init + Web Search + Extended Thinking UI

**來源**: v0.3.0 功能開發 — 4 個獨立功能：Memory 持久化、專案初始化、Web 搜尋、思考 UI

**本次相關主題**: Provider Pattern（SearchProvider）, Global Config Path Convention, Event Stream Extension, Parallel Agent Implementation

#### 做得好的地方
- **SearchProvider 抽象層設計**：`web-search.ts` 定義 `SearchProvider` 介面 + `TavilySearchProvider` 預設實作，未來替換為其他搜尋引擎（Brave、Google）只需新增 class。API key 缺失時回傳友善提示而非 throw，LLM 可理解並告知使用者
- **Memory System 極簡設計**：`loadMemory()` 10 行、`save-memory` tool 20 行。全域路徑（`~/.frogger/memory/MEMORY.md`）不受 `workingDirectory` 約束，自然跨專案共享。`buildSystemPrompt()` 只新增一個 `memory?` 參數，零破壞
- **Event Stream 可擴展性驗證**：新增 `thinking_delta` 事件只需：1) shared types 加一行 union member、2) agent.ts 加一個 switch case、3) CLI 端加狀態處理。三層分離（Agent→Event→CLI）讓每層變更獨立
- **4 個功能完全並行開發**：透過 isolated worktree 讓 4 個 agent 各自在獨立環境中工作，共用檔案（index.ts、modes、useAgent.ts）的衝突在最終合併時統一解決
- **`/init-project` 的防禦設計**：已存在 FROGGER.md 時拒絕覆蓋，排除 dotfiles 和 node_modules，截斷到 30 個項目——小決策防止大問題

#### 潛在隱憂
- **Memory 無大小限制** — `MEMORY.md` 持續 append 無截斷，長期使用後可能膨脹到影響 system prompt token 預算 → 建議加入 `MAX_MEMORY_SIZE` 常數 + 截斷警告 → 優先級：中
- **Tavily API key 在 request body** — API key 以 `api_key` 欄位傳入 POST body 而非 Authorization header，符合 Tavily API 規格但不符一般最佳實踐 → Tavily API 限制，無需改動 → 優先級：低
- **`reasoning-delta` vs `reasoning` 命名** — Vercel AI SDK 版本間可能改變 stream part 名稱（v5 用 `reasoning`、v6 用 `reasoning-delta`），需注意升級風險 → 建議在 SDK 版本升級時驗證 → 優先級：低

#### 延伸學習
- **Strategy Pattern + Provider 抽象**：`SearchProvider` 是典型 Strategy Pattern，與 ModeConfig 的 `allowedTools` 策略同源。可搜尋「Strategy Pattern vs Template Method」理解差異
- **Event Sourcing in CLI**：`AgentEvent` 串流本質上是 Event Sourcing 的簡化版——每個事件代表狀態變更，UI 是 projection。未來若需 replay/debug 功能，此架構天然支持

---

### 2026-03-11: v0.2.1 Rules System + Hooks System

**來源**: v0.2.1 功能開發 — Rules 注入 system prompt + PreToolUse/PostToolUse shell hooks

**本次相關主題**: Config Loading Pattern, Hook/Interceptor Pattern, callWithHooks Refactor, Dynamic Import for Test Isolation

#### 做得好的地方
- **Rules 實作極簡且零破壞**：`loadRules()` 60 行，複用 `CONFIG_DIR` 常數和 `loadMdFiles()` 私有 helper（參考 `custom-loader.ts` 模式）。`buildSystemPrompt()` 只新增一個可選 `rules` 參數，所有既有測試零修改即通過
- **Hooks Config 的 Zod 驗證 + 安全降級**：`HooksConfigSchema` 使用 `safeParse` + 預設空陣列，malformed JSON 或 schema 不匹配都安全降級為空 config，不影響 agent 啟動。與 MCP config 和 permissions.json 的處理模式一致
- **callWithHooks helper 消除重複**：`registry.ts` 原有 6+ 處 `origExecute.call(t, args, opts)` 重複呼叫，每處都需手動處理 `onBeforeExecute`。抽取為 `callWithHooks()` 後統一處理 pre/post hooks + 錯誤攔截，降低遺漏風險
- **PreToolUse 阻斷透過 throw + catch 實現**：`callWithHooks()` 在 `onBeforeExecute` 拋錯時攔截並回傳 error message 給 LLM，而非中斷整個 agent loop。LLM 收到錯誤訊息後可自行調整策略
- **Hooks 動態 import 隔離**：與 MCP 相同模式，hooks 模組在 `createAgentTools()` 內動態 import，避免 `node:child_process` 干擾既有 agent-tools 測試

#### 潛在隱憂
- **Rules 不支援 hot-reload**：`loadRules()` 在每次 agent turn 開始時呼叫（因為 `buildSystemPrompt` 在 `submitInternal` 中重建），但如果使用者在 session 中修改 rules 檔案，新規則會在下一次 submit 時生效，非即時。目前可接受 → **優先級：低**
- **Hooks 的 shell 命令安全性**：hooks.json 由使用者自行編寫，命令直接透過 `sh -c` 執行，沒有額外的沙箱隔離。這是設計如此（對標 Claude Code hooks），但專案級 hooks.json 可能被惡意 repo 植入。考慮未來加入類似 permissions.json 的首次確認機制 → **優先級：中**
- **PostToolUse hook 拿到的 result 是完整字串**：大型工具輸出（如 `bash` 的長輸出）會完整傳入 `FROGGER_TOOL_RESULT` 環境變數，可能超過 shell 環境變數限制（Linux ~128KB）。考慮未來對 result 做截斷或改用 stdin 傳遞 → **優先級：低**

#### 延伸學習
- **Interceptor Pattern vs Event Pattern**：本次 hooks 採用 interceptor 模式（同步攔截 + 決定是否繼續），而非 event/observer 模式（非同步通知）。Interceptor 適用於「需要控制流的場景」（PreToolUse 可阻斷執行），event 適用於「純通知場景」（PostToolUse 失敗不影響結果）。Claude Code 也採用相同設計——PreToolUse 可 block，PostToolUse 只是 fire-and-forget
- **若想深入**：搜尋「Chain of Responsibility Pattern」和「Middleware Pattern」（Express.js 的 `next()`），這些都是 interceptor 模式的變體

---

### 2026-03-11: v0.2.0 Feature Batch — Extended Thinking, Prompt Caching, Test Runner, MCP stdio Transport

**來源**: v0.2.0 功能開發計畫 — 4 個功能批次實作

**本次相關主題**: Provider-specific Options Pattern, Cache-aware Cost Model, Auto-detection Tool Design, External Tool Integration (MCP), Dynamic Import for Test Isolation

#### 做得好的地方
- **providerOptions 條件組建**：透過 `isAnthropic` flag 條件性注入 `thinking` + `cacheControl`，非 Anthropic provider 完全不受影響。JSON object 合併簡潔（`Object.keys(anthropicOptions).length > 0`），避免傳遞空 `providerOptions`
- **Cache-aware 費用計算精確建模**：`calculateCost()` 精確反映 Anthropic 定價（cache read 10%、cache creation 125%、reasoning 按 output price）。純函式設計，向後相容——所有新參數都是 optional
- **Test Runner 的偵測 → 建構 → 解析三段式**：`detectTestFramework()` / `buildTestCommand()` / `parseTestOutput()` 各自獨立可測試，符合 Single Responsibility。偵測順序（vitest → jest → pytest → cargo → go）按 Node.js 生態常見度排列
- **MCP 動態 import 解決 test isolation**：將 `import('../mcp/index.js')` 從 top-level 改為 `createAgentTools()` 內的動態 import，避免 `@modelcontextprotocol/sdk` 的載入干擾既有 agent-tools 測試。`AgentToolsResult.mcpClientManager` 使用結構型別 `{ closeAll(): Promise<void> }` 而非具體 class import，進一步解耦
- **MCP Config 合併策略清晰**：project config 覆蓋 global config（同名 server），`${ENV_VAR}` 解析在載入時完成，Zod v4 schema 驗證確保 config 結構正確
- **test-runner 加入所有模式**：ask/plan/agent 三個模式都可用 test-runner（permission: auto），因為執行測試是唯讀操作，不修改程式碼

#### 潛在隱憂
- **providerMetadata 結構依賴 Vercel AI SDK 內部格式**：`part.providerMetadata?.anthropic?.reasoningTokens` 和 `cacheReadInputTokens` 的欄位名稱來自 SDK 內部，非公開 API。SDK 版本升級可能改變欄位名稱。建議未來加入 unit test mock 驗證 metadata 結構 → **優先級：中**
- **MCP server 連線失敗不影響啟動但無重試**：`connect()` 失敗只 log warning 並跳過，不會重試。如果 MCP server 暫時不可用（如 npx 下載延遲），使用者需要重啟 frogger 才能載入。考慮未來加入 lazy reconnect 或 `/mcp reconnect` 命令 → **優先級：中**
- **jsonSchemaToZod 簡化轉換**：僅支援 string/number/boolean/array/object 基本型別，不支援 `oneOf`、`allOf`、`enum`、`format` 等進階 JSON Schema 特性。對於複雜 MCP tool schema 可能丟失驗證資訊（退化為 `z.any()`）。考慮未來使用 `json-schema-to-zod` npm 套件 → **優先級：低**
- **Test runner 的 JSON 輸出解析假設特定格式**：vitest `--reporter=json` 和 jest `--json` 的輸出格式可能隨版本變化。`parseTestOutput()` 有 text fallback 機制，但 JSON 解析失敗會退化為正規表達式匹配，準確度下降 → **優先級：低**
- **Zod v4 的 `z.record()` 行為變更**：Zod v4 要求 `z.record(z.string(), valueSchema)` 明確指定 key type（v3 只需一個參數）。若未來升級 Zod 版本需注意此差異 → **優先級：低**

#### 延伸學習
- **Provider-specific Options 的封裝策略**：本次在 `agent.ts` 中直接條件組建 `providerOptions`，這是最簡單的做法。當支援更多 provider 特有功能時（如 OpenAI 的 `logprobs`、DeepSeek 的 `reasoning_content`），可考慮抽取為 `buildProviderOptions(provider, config)` 工廠函式，封裝各 provider 的差異。這與 Vercel AI SDK 的 provider adapter 模式互補——SDK 封裝了 API 呼叫差異，我們封裝了 options 構建差異
- **外部工具整合的信任邊界**：MCP tools 預設 `confirm` permission 是正確的安全決策——外部 server 的工具可能執行任意副作用（檔案寫入、網路請求、程序執行）。這與 VS Code 的 extension trust 和 npm 的 `postinstall` 安全模型類似。下一步可考慮：(1) per-tool permission override in mcp.json；(2) sandbox 模式限制 MCP tool 的能力
- **Auto-detection Pattern**：test-runner 的框架偵測是「Convention over Configuration」原則的應用——掃描已知的 config 檔案（vitest.config.ts → jest.config.js → pytest.ini）來推斷意圖。這與 package manager 偵測（lockfile → pnpm/yarn/npm）、CI 系統偵測（.github → GitHub Actions）是同一模式。關鍵設計決策：偵測優先序 + fallback 策略 + 可手動覆蓋
- 若想深入：搜尋 "MCP Model Context Protocol specification" 或 "Convention over Configuration pattern"

**思考題**：MCP 目前僅支援 stdio transport。如果要新增 SSE/HTTP transport（適用於遠端 MCP server），`MCPClientManager` 需要如何重構？考慮 Transport 作為 Strategy Pattern 注入 vs. 在 Manager 內部 switch 的 trade-off。同時，遠端 transport 帶來的新安全考量（TLS、認證、CORS）該如何融入現有的 permission 體系？

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
