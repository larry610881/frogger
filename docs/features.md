# Frogger 功能清單

> 版本：v0.11.0 | 更新日期：2026-03-15

---

## Agent Engine（packages/core）

### Agent Loop

- **串流式 LLM 呼叫** — 基於 Vercel AI SDK `streamText()` 實作非同步串流
- **事件流輸出** — 產出型別化 `AgentEvent`（text_delta、thinking_delta、tool_call、tool_result、error、done）
- **多步驟 Tool Calling** — 支援連續多輪工具呼叫，最多 50 步（`MAX_STEPS`）
- **中斷支援** — 接受 `AbortSignal`，Ctrl+C 可中斷串流
- **自動重試** — 遇到暫時性 API 錯誤（429、500、502、503、ECONNRESET、ETIMEDOUT）自動重試，指數退避 + jitter；僅在尚未 yield 任何事件時重試（`hasYielded` 旗標防止 UI 收到不一致的部分事件流）；預設最多 3 次重試，可透過 `maxRetries` 參數調整；`sleep()` 正常 resolve 後自動清除 abort listener 防止記憶體洩漏
- **Context Hard Limit** — 壓縮後仍超限時，強制截斷最舊訊息（保留第一則 + 最近 4 則），防止超大 prompt 導致 API error
- **Token 用量回報** — 每輪結束時回報 promptTokens、completionTokens、totalTokens、reasoningTokens、cacheReadTokens、cacheCreationTokens
- **即時 Usage 更新** — 攔截 `finish-step` 事件，逐步累加 token 用量並發出 `usage_update` 事件
- **Extended Thinking** — 啟用 Anthropic Claude 推理模式，透過 `providerOptions.anthropic.thinking` 讓模型先推理再行動；可透過 `~/.frogger/config.json` 設定 `thinking.enabled` + `budgetTokens`（預設 10,000），CLI `--thinking` / `--no-thinking` 可覆蓋；僅 Anthropic provider 生效，其他 provider 靜默忽略
- **Extended Thinking UI** — 攔截 `reasoning-delta` 串流事件，透過 `ThinkingView` 元件即時顯示最後 5 行思考內容（dimColor + italic），收到正式回覆時自動清空；無思考內容時 fallback 為 Spinner
- **Prompt Caching** — 偵測到 Anthropic provider 時自動對 system prompt 附加 `cacheControl: { type: 'ephemeral' }`，長對話的 input token 成本可降低 90%；cache read tokens 按 10% input price 計費，cache creation tokens 按 125% input price 計費；無需使用者設定，透明優化

### Mode System

三種模式，循環順序：ask → plan → agent → ask。

- **ask 模式** — 唯讀模式，僅允許讀取類工具（read-file、glob、grep、list-files、web-search、analyze-repo）
- **plan 模式** — 探索模式，分析程式碼後產出高階計畫；禁止寫入；計畫完成後自動切換至 agent 模式執行；可使用 web-search、analyze-repo
- **agent 模式** — 完整存取，可使用全部 23 個工具（含 save-memory、web-search、gh-issue、gh-pr、analyze-repo）；寫入操作需使用者確認
- **ModeManager** — 提供 `getCurrentMode()`、`setMode()`、`cycle()` 方法管理模式狀態；支援 `policyOverride` 參數覆蓋 mode 預設的 `approvalPolicy`

### Tool System（23 tools）

#### 檔案系統 — 讀取（permission: auto）

- **read-file** — 讀取檔案內容，支援 `offset`（0-based 行號）與 `limit`（最大行數）參數做分段讀取，含路徑邊界檢查防護；檔案不存在時回傳 hint 建議使用 glob 搜尋
- **analyze-repo** — 分析倉庫結構：depth-aware 目錄樹（預設 3 層）、標記關鍵檔案（README、package.json、setup.py、Makefile、test 目錄）、檔案類型分佈統計；gitignore-aware 掃描；所有模式皆可使用
- **glob** — 以 glob 模式搜尋檔案，支援指定子目錄
- **grep** — 以正規表達式搜尋檔案內容，支援 `--include` 篩選、`ignoreCase` 不區分大小寫、`contextLines` 上下文行數、`filesOnly` 僅回傳檔案路徑
- **list-files** — 列出檔案與目錄，支援遞迴模式

#### 檔案系統 — 寫入（permission: confirm）

- **write-file** — 建立或覆寫檔案，自動建立父目錄，回傳 unified diff；原子寫入（先寫 `.frogger-tmp-*` 暫存檔再 `rename()`），防止中途 crash 損毀檔案
- **edit-file** — 搜尋替換編輯，支援精確比對與 fuzzy match（diff-match-patch），`replace_all` 選項可替換所有匹配，回傳 unified diff；匹配失敗時回傳錯誤恢復 hint 建議重新讀取檔案
- **bash** — 執行 shell 命令，可設定 `timeout`（預設 30 秒，最長 10 分鐘），內建危險命令封鎖清單，逾時自動終止並回報；非零退出時附加錯誤分析 hint

#### Git — 讀取（permission: auto）

- **git-status** — 顯示工作目錄狀態（porcelain 格式）
- **git-diff** — 顯示未暫存或已暫存的差異，可指定檔案
- **git-log** — 顯示提交歷史（oneline 格式），預設 10 筆、最多 50 筆

#### Git — 寫入（permission: confirm）

- **git-commit** — 暫存檔案並建立提交
- **git-init** — 初始化 Git 儲存庫，可設定預設分支名稱
- **git-branch** — 分支管理：列出、建立、切換、刪除（安全刪除，不強制）
- **git-remote** — 遠端管理：列出、新增（URL 驗證）、移除、取得 URL
- **git-push** — 推送至遠端，支援 `--set-upstream` 與 `--force-with-lease`，透過 `GIT_ASKPASS` 注入 PAT 驗證
- **git-pull** — 拉取遠端更新，支援 `--rebase`，偵測合併衝突與驗證失敗

#### 測試（permission: auto）

- **test-runner** — 自動偵測專案測試框架（vitest → jest → pytest → cargo → go → npm script）並執行測試；支援 `filter` 篩選測試檔/名稱、`framework` 手動指定框架、`timeout` 逾時設定（預設 60 秒）；回傳結構化 Markdown 摘要（## Test Summary + ### Failures + ## Raw Output），包含 pass/fail/skip 數量、失敗詳情（名稱 + 錯誤訊息）、執行命令；pytest/vitest/jest/go 各有專屬解析器

#### 記憶（permission: confirm）

- **save-memory** — 將記憶筆記儲存至 `~/.frogger/memory/MEMORY.md`，LLM 可主動呼叫以跨 session 記憶重要上下文；自動建立目錄與檔案，以 `---` 分隔符追加新條目；內建大小限制（`MAX_MEMORY_SIZE` 50KB），超限時自動截斷最舊條目並警告

#### 搜尋（permission: auto）

- **web-search** — 透過 Tavily API 搜尋網路資訊，回傳標題、URL、摘要；支援 `maxResults`（1-10）參數；需設定 `TAVILY_API_KEY` 環境變數，未設定時回傳友善提示；SearchProvider 抽象介面支援未來替換搜尋引擎

#### GitHub（gh CLI）

- **gh-issue**（permission: auto） — 讀取 GitHub issue 詳情（title、body、labels、assignees、comments），支援 `--repo` 指定跨 repo 查詢
- **gh-pr**（permission: confirm） — 建立 GitHub pull request，支援 title、body、base branch、head branch、draft、labels；使用 `execa` 陣列參數形式傳遞，防止 shell injection

#### 工具基礎架構

- **ToolRegistry** — 集中式工具註冊表，支援按模式篩選工具，支援 `onBeforeExecute` / `onAfterExecute` hook 在工具執行前後觸發回調；`getToolHints()` 方法依 category 分組產出 Markdown 格式的工具使用指南，注入 system prompt 輔助 LLM 選擇工具
- **Tool Hints & Category** — 每個工具的 `ToolMetadata` 包含 `hints`（使用建議）和 `category`（分類標籤：read/write/search/git/test/github/system），用於 system prompt 的工具指南區塊
- **Hooks System** — 透過 `.frogger/hooks.json`（專案級）或 `~/.frogger/hooks.json`（全域級）設定 PreToolUse / PostToolUse shell hooks；支援 `*`（全部）、精確匹配、前綴匹配（`git-*`）三種 matcher；環境變數注入 `FROGGER_TOOL_NAME`、`FROGGER_TOOL_ARGS`、`FROGGER_TOOL_RESULT`（自動截斷至 `MAX_TOOL_RESULT_SIZE` 100KB，防止超過 shell 128KB 環境變數限制）、`FROGGER_HOOK_TYPE`、`FROGGER_WORKING_DIR`；PreToolUse 失敗阻斷工具執行，PostToolUse 失敗僅警告；預設 timeout 10 秒，最大 60 秒；全域 hooks 先觸發、專案 hooks 後觸發；專案級 hooks.json 首次載入需使用者確認（SHA-256 hash 追蹤，內容變更後需重新確認），防止惡意 repo 植入
- **路徑安全防護** — `assertWithinBoundary()` 防止路徑穿越攻擊（涵蓋 read-file、write-file、edit-file、glob、grep、list-files）
- **Bash 封鎖清單** — 正規表達式封鎖危險命令（rm -rf /、fork bomb 等）
- **Diff 工具** — 自訂 unified diff 產生器，供 write-file 與 edit-file 使用
- **輸出截斷** — `truncateOutput()` 工具，當 bash/grep 輸出超過 30,000 字元時按行邊界截斷並附加通知，避免超載 LLM 上下文

### Permission System

- **auto 策略** — 所有工具執行不需確認
- **confirm-writes 策略** — 寫入類工具需使用者核准，讀取類自動放行
- **confirm-all 策略** — 所有工具執行均需使用者核准
- **回應選項** — allow（允許一次）、deny（拒絕）、always-project（專案級持久化允許）、always-global（全域持久化允許）、deny-project（專案級持久化拒絕）、deny-global（全域持久化拒絕）
- **持久化規則** — 專案級儲存於 `{workDir}/.frogger/permissions.json`，全域級儲存於 `~/.frogger/permissions.json`
- **規則匹配** — 精確工具名匹配、bash 前綴匹配（`bash:npm test` 匹配 `npm test --watch`）、glob 匹配（`bash:git *`）
- **優先順序** — 專案 deny > 專案 allow > 全域 deny > 全域 allow > 提示使用者
- **Zod 驗證** — permissions.json 使用 Zod `safeParse` 驗證結構，malformed 資料安全降級為空規則
- **專案級確認** — 首次載入專案級 permissions.json 時需使用者確認，透過 SHA-256 hash 追蹤已確認檔案，檔案內容變更後需重新確認；自動清理不存在路徑的過期 hash 條目
- **PermissionManager.reset()** — 清除已記憶的 session 允許狀態（如 /clear 後）
- **ApprovalPolicy 覆蓋** — 使用者可在 `~/.frogger/config.json` 設定 `approvalPolicy`（auto/confirm-writes/confirm-all），覆蓋 mode 預設策略；優先順序：CLI args > config file > mode 預設值

### Context Management

- **AgentContext** — 維護有序的訊息歷史，支援新增、查詢、清除操作
- **ContextBudgetTracker** — 追蹤 token 用量佔比，計算可用輸入空間（含 10% 安全餘量）
- **自動壓縮** — 當用量達閾值（預設 80%）時自動觸發，節流間隔 30 秒
- **LLM 摘要壓縮** — 透過 `generateText()` 摘要較舊訊息，保留最近 4 則完整訊息
- **Token 估算** — 啟發式估算（ASCII ~4 字元/token，CJK ~1.5 字元/token）

### Session Management

Sessions 以 JSON 檔案持久化於 `~/.frogger/sessions/`。

- **儲存 Session** — 保存訊息、provider、model、token 統計、時間戳、工作目錄
- **載入 Session** — 依 ID 載入，損壞檔案回傳 null
- **列出 Sessions** — 依時間排序列出最近 N 筆（預設 10）
- **目錄篩選** — 可取得特定工作目錄的最近 session（供 `--continue` 使用）
- **自動儲存** — Agent 每輪結束後自動儲存/更新 session
- **自動清理** — `cleanup(maxCount=100, maxAgeDays=30)` 在每次儲存後自動清理過期 session，防止磁碟無限增長
- **刪除 Session** — 移除指定 session 檔案
- **Session Resume Hint** — 三層防護確保使用者知道如何恢復 session：(1) 正常退出（Ctrl+C / Ink unmount）後印出 `frogger --resume <id>` 及 `frogger -c` 提示；(2) SIGTERM/SIGHUP 信號退出時同步印出提示；(3) 下次啟動時偵測到同目錄的 recent session 自動提示 `frogger -c`（僅非 resume 模式時顯示）

### Checkpoint / Rewind

- **CheckpointManager** — 每個 mutating tool 執行前自動建立 checkpoint，快照目標檔案狀態
- **快照策略** — write-file/edit-file 快照目標檔案；bash（git repo）快照所有 dirty files；git-commit 記錄 HEAD hash
- **檔案大小限制** — 單檔超過 1MB 自動跳過快照，避免記憶體壓力
- **總快照記憶體上限** — 50MB 上限，超限自動淘汰最舊 checkpoint
- **恢復機制** — 還原檔案內容、刪除後續建立的檔案、git repo 可 soft reset 至記錄的 HEAD
- **對話截斷** — 恢復 checkpoint 時同步截斷訊息歷史至 checkpoint 時間點
- **自動偵測 Git** — `CheckpointManager.detectGitRepo()` 啟動時偵測是否在 git 工作目錄中

### Background Tasks

- **BackgroundTaskManager** — 管理背景任務生命週期，支援最多 `MAX_BACKGROUND_TASKS`（5）個併發任務
- **AbortSignal 支援** — 每個任務有獨立的 `AbortController`，取消時中斷進行中的 LLM 串流
- **狀態追蹤** — 四種狀態：running、completed、failed、cancelled；task info 含 prompt、startedAt、completedAt、error
- **完成回調** — `onComplete` callback 在任務完成/失敗時觸發，CLI 層複用桌面通知基礎設施

### @file 引用

- **resolveFileReferences()** — 解析使用者輸入中的 `@path/to/file` 語法，自動讀取檔案內容注入 user message；支援引號語法 `@"path with spaces/file.ts"` 處理含空格路徑
- **智慧過濾** — 僅對磁碟上實際存在的路徑生效，自動忽略 @mention、email 等非檔案路徑
- **路徑安全** — 所有 @file 路徑經過 `assertWithinBoundary()` 檢查，防止路徑穿越
- **XML 包裝** — 檔案內容以 `<file path="...">` 標籤包裝注入訊息
- **圖片輸入（Image Input）** — 支援 `@screenshot.png` 等圖片引用，自動 base64 編碼並以 multimodal `ImagePart` 格式注入（單檔上限 5MB）。僅 Anthropic/OpenAI provider 支援 vision，其他 provider 自動跳過並警告

### MCP（Model Context Protocol）

- **MCP Multi-Transport** — 支援 stdio、SSE、Streamable HTTP 三種 transport；透過 `.frogger/mcp.json`（專案級）或 `~/.frogger/mcp.json`（全域級）設定外部 MCP server，專案設定優先於全域設定
- **Transport 自動偵測** — Config schema 為 `z.union([sseSchema, httpSchema, stdioSchema])`，Zod 按序嘗試匹配；stdio 的 `transport` 欄位為 optional 保持向後相容
- **SSE Transport** — `{ transport: "sse", url, headers }` 設定，使用 `SSEClientTransport` 連線；headers 支援 `${ENV_VAR}` 環境變數解析
- **Streamable HTTP Transport** — `{ transport: "http", url, headers }` 設定，使用 `StreamableHTTPClientTransport` 連線；headers 同樣支援環境變數解析
- **Transport Factory** — `createTransport(config)` 工廠函數，依 config type 動態 import 對應 transport（SSE/HTTP 僅在需要時載入，stdio-only 使用者不會載入多餘依賴）
- **MCPClientManager** — 管理 MCP server 連線生命週期，啟動時連線、程式退出時關閉；連線失敗自動重試（exponential backoff，最多 3 次）；每次連線有 30 秒 timeout 防止 server 掛起導致 agent 凍結；支援 `reconnectAll()` 重新連線已斷線的 server；transports 泛化為 `Transport` 型別
- **工具轉換** — 自動將 MCP server 的 tool definitions 轉換為 Vercel AI SDK `tool()` 格式，名稱以 `mcp-{serverName}-{toolName}` 前綴避免衝突；支援 `oneOf` → `z.union()` 和 `allOf` → `z.intersection()` 進階 JSON Schema 轉換
- **Permission** — MCP 工具預設 `confirm` 權限等級（外部工具安全考量）
- **環境變數替換** — MCP config 的 `env`（stdio）和 `headers`（SSE/HTTP）值均支援 `${ENV_VAR}` 語法，啟動時自動解析
- **/mcp 命令** — 列出已設定的 MCP servers 及其啟用狀態（顯示 transport type + URL 或 command）

### Memory System

- **loadMemory()** — 載入 `~/.frogger/memory/MEMORY.md` 內容，注入 system prompt 的 `## Memory` 區塊，跨 session 持久化
- **save-memory tool** — LLM 主動呼叫，追加記憶條目（含日期戳記）
- **/remember command** — 使用者手動輸入，注入 user message 讓 LLM 呼叫 save-memory

### Command System（18+ slash commands）

- **/help** — 列出所有已註冊命令及其用法與描述
- **/clear** — 清除當前對話的所有訊息
- **/compact** — 手動觸發 LLM 上下文壓縮
- **/compact-threshold** — 查詢或設定自動壓縮閾值（10–100%）
- **/cost** — 顯示 session 累計 token 用量與估算費用
- **/context** — 顯示 context window 詳細用量（ASCII bar + token 數據）
- **/doctor** — 診斷環境（Node.js、Git、pnpm、GitHub CLI 認證狀態、API key、Provider/Model、版本更新檢查、Provider Capabilities 顯示 vision/thinking/caching/tool-use ✓/✗）
- **/update** — 檢查 npm registry 是否有新版本，顯示 `currentVersion → latestVersion` 及升級命令
- **/model** — 開啟互動式 provider/model 選擇器
- **/setup** — 啟動完整設定精靈（provider、API key、model）
- **/undo** — 透過 `git revert HEAD --no-edit` 撤銷上一次提交
- **/rewind** — 列出 checkpoint 或回到指定檢查點（`/rewind last` 或 `/rewind <id>`），恢復檔案狀態並截斷對話
- **/sessions** — 列出最近 10 筆 session（日期、目錄、訊息數、token 數）
- **/resume** — 恢復指定 session 的訊息歷史至當前對話
- **/git-auth** — 查看 Git 驗證狀態或管理 PAT 憑證
- **/mcp** — 列出已設定的 MCP servers 及其啟用/停用狀態，無設定時顯示使用範例；`/mcp reconnect` 子命令可重新連線已斷線的 server
- **/remember** — 使用者手動記憶，注入 prompt 讓 LLM 呼叫 save-memory tool 儲存至 `~/.frogger/memory/MEMORY.md`
- **/init-project** — 掃描 `package.json`（名稱、描述、scripts）與目錄結構（排除 dotfiles 與 node_modules），自動產生 FROGGER.md 模板；已存在時拒絕覆蓋
- **/issue** — 從 GitHub issue 開始工作：驗證 `gh` 認證 → 讀取 issue 資料 → 推導分支名（bug → `fix/<num>-<slug>`、其他 → `feature/<num>-<slug>`）→ 注入結構化工作流程 message 讓 agent 自動開分支、實作、測試、commit、push、建 PR
- **/bg** — 啟動背景任務（`/bg <prompt>`），建立獨立 agent 在背景執行長時間任務，自動核准所有權限；完成時觸發桌面通知
- **/tasks** — 列出所有背景任務（running/completed/failed/cancelled）及其耗時
- **/task** — 查看背景任務詳情（`/task <id>`）或取消任務（`/task cancel <id>`）
- **自訂命令** — 從 `~/.frogger/commands/*.md`（全域）和 `.frogger/commands/*.md`（專案級）載入自訂 slash command，支援 `$ARGUMENTS` 變數替換；專案命令覆蓋同名全域命令

**命令基礎架構**：

- **CommandRegistry** — 命令註冊與分派，支援前綴自動補全
- **Tab 補全** — 輸入 `/` 後依前綴篩選命令清單
- **Custom Loader** — 啟動時掃描 `~/.frogger/commands/`（全域）和 `.frogger/commands/`（專案級）目錄，自動載入 `.md` 模板為自訂命令，專案命令覆蓋同名全域命令；自動偵測與 built-in 命令的名稱衝突並 log 警告

### LLM Provider

#### 內建 Providers

- **DeepSeek** — deepseek-chat（128K）、deepseek-reasoner（128K/16K output）
- **Anthropic** — claude-sonnet-4（200K）、claude-opus-4（200K）
- **OpenAI** — gpt-4o（128K）、gpt-4o-mini（128K）、o3-mini（200K/100K output）
- **OpenAI-compatible** — 支援自訂端點（Groq、Ollama、Together AI 等）

#### 設定優先順序

1. CLI flag（`--provider`、`--model`）
2. 環境變數（`FROGGER_PROVIDER`、`FROGGER_MODEL`）
3. `~/.frogger/config.json`
4. 預設值（DeepSeek / deepseek-chat）

#### Provider 管理

- **loadProviders()** — 讀取 providers.json，以 Zod schema 驗證結構完整性，損壞或無效資料自動 fallback 到預設值
- **addProvider() / removeProvider()** — 動態新增或移除 provider
- **findModelInfo()** — 查詢 model 的 contextWindow 與 maxOutputTokens
- **ProviderCapabilities** — 結構化能力偵測系統，取代硬編碼 `isAnthropic` 檢查；`ProviderCapabilities` 介面定義 vision/thinking/caching/toolUse 四項能力；`DEFAULT_CAPABILITIES` 記錄各 provider 預設能力；`resolveCapabilities(entry)` 合併預設與自訂能力；`supportsCapability(entry, key)` 查詢特定能力；`ProviderEntry` 可透過 `capabilities?` 欄位自訂覆蓋（如 openai-compatible provider 啟用 vision）

#### Extended Thinking & Prompt Caching

- **Extended Thinking** — Anthropic provider 可啟用 thinking 模式（`config.json > thinking.enabled`），模型在回應前進行推理；reasoning tokens 按 output pricing 計費
- **Prompt Caching** — Anthropic provider 自動啟用 system prompt 的 `cacheControl: ephemeral`，重複的 system prompt 享受 90% 折扣

#### 系統提示詞

- **Section-based 動態組成** — 以純函式逐段組建：應用身份 + @file 引用說明 + 模式指示 + Tool Hints + 錯誤回復（ask/plan 限定）+ Repo Map + Rules + Memory + 專案偵測資訊 + FROGGER.md 專案上下文；`SystemPromptOptions` 介面集中管理所有參數
- **Tool Hints 注入** — `ToolRegistry.getToolHints()` 依 category（Reading/Writing/Search/Git/Testing/GitHub/System）分組，產出 Markdown 格式的工具使用指南注入 system prompt，引導 LLM 選擇正確工具
- **專案偵測（Project Detection）** — `detectProjectInfo()` 掃描工作目錄的檔案系統標記（tsconfig.json、lockfiles、package.json dependencies、pytest.ini 等），自動偵測語言、套件管理器、框架、測試框架、monorepo、git repo 狀態；`formatProjectInfo()` 格式化為 system prompt 注入段落
- **錯誤回復指引** — ask/plan 模式注入額外的錯誤回復策略（建議使用者切換至 agent 模式），agent 模式則依賴模式自身的策略化提示
- **Rules 注入** — 自動掃描 `~/.frogger/rules/*.md`（全域）和 `{workDir}/.frogger/rules/*.md`（專案級）的 Markdown 規則檔，按全域先、專案後、同級字母排序的順序合併注入 system prompt；上限 50,000 字元，超限自動截斷並警告；內建 memoization 機制（file set hash 比對），僅在規則檔案變更時重新載入
- **Repo Map** — 自動生成 gitignore-aware 檔案樹狀結構（上限 500 檔案 / 8000 字元）注入系統提示詞，幫助 LLM 理解專案結構；內建 30 秒 TTL 快取，避免同一 session 重複掃描
- **Agent 模式策略化提示** — 結構化問題解決方法（Understand→Locate→Plan→Implement→Verify）、工具使用最佳實踐、錯誤回復策略；SWE-bench 策略強化（Repository Exploration、Bug Localization Strategy、Multi-File Editing 三段指引）
- **破壞性操作安全警告** — Agent 模式 system prompt 包含 Safety section，列出高危操作（rm -rf、git push --force、git reset --hard、DROP/TRUNCATE 等），指示 LLM 執行前暫停說明意圖並等待使用者確認

#### Git 驗證

- **多方法偵測** — 並行偵測 gh CLI、SSH key、credential helper、Frogger PAT
- **GIT_ASKPASS 注入** — 透過暫存腳本傳遞 token，PAT 不進入 LLM 上下文或命令參數
- **敏感資訊過濾** — 過濾 git 命令輸出中包含 password/token/credential 的行

### Benchmark System

- **BenchmarkRunner** — 在隔離的 `/tmp/frogger-bench-*` 目錄中執行測試任務，內建 timeout 機制（預設 5 分鐘）防止 agent 無限迴圈
- **5 個測試任務** — hello（簡單）、fizzbuzz（簡單）、snake（中等）、debug（中等）、refactor（困難）
- **結果回報** — 包含 pass/fail、訊息、耗時、token 用量

---

## CLI Frontend（packages/cli）

### TUI Components

- **App** — 根元件，組合所有子元件，使用 `<Static>` 渲染已完成訊息（僅追加不重繪）
- **ChatView** — 渲染對話訊息（使用者/助手/工具結果），提取 diff 區塊交由 DiffView 顯示
- **MarkdownView** — 豐富 Markdown 渲染：code block（含語言標籤）、標題、清單（有序+無序）、粗體、行內程式碼、blockquote（`│` 前綴）、table（自動對齊欄寬）、link（藍色底線）、strikethrough（dimColor）
- **InputBox** — 文字輸入，方塊游標，`/` 開頭時顯示 Tab 補全下拉選單；支援 paste 偵測（5+ 行自動摺疊為 `[pasted text #N +X lines]`，短 paste 展開為空格分隔）；Backspace 刪除到 paste marker 邊界時整段移除（全域位置掃描）；↑/↓ 箭頭鍵瀏覽歷史輸入；Shift+Enter 插入換行（多行輸入）
- **PermissionPrompt** — 黃色圓角邊框彈窗，顯示工具名稱與參數，6 個選項（Allow/Deny/Always allow project/Always allow global/Always deny project/Always deny global）支援 ↑/↓ 箭頭鍵選取 + Enter 確認 + y/n/a/g/d/x 快捷鍵
- **WelcomeBanner** — 雙欄式歡迎橫幅（🐸 logo + 使用者名稱 + provider/model + 工作目錄 | Tips + Recent sessions），僅在初始畫面顯示
- **ModeIndicator** — 左下角狀態列，以顏色顯示當前模式（藍=ask、黃=plan、綠=agent）
- **ContextUsage** — 右下角狀態列，以顏色顯示上下文用量百分比（綠<70%、黃70-90%、紅>90%）
- **ThinkingView** — 顯示 Extended Thinking 推理內容（最後 5 行，dimColor + italic），無內容時 fallback 為 Spinner
- **Spinner** — 動畫 braille 旋轉指示器，附帶經過時間計數器
- **StreamingStats** — 串流期間即時顯示經過時間、token 數（K/M 格式）與成本（USD），置於 footer 狀態列
- **DiffView** — 渲染 unified diff，語法著色（+綠/-紅/@@青/header 暗粗體），含行號 gutter（解析 hunk header `@@ -a,b +c,d @@`，`+` 行顯示 new line number，`-` 行顯示 old line number，context 行顯示雙欄行號）
- **InitSetup** — 多步驟設定精靈：選擇 provider → 輸入 API key → 確認 model → 儲存
- **ProviderAddSetup** — 互動式新增 provider 精靈：名稱→標籤→類型→baseURL→envKey→models→defaultModel

### Hooks

- **useAgent** — 核心 agent 協調 hook：管理串流、訊息歷史、工具呼叫、權限請求（含 abort 時自動 deny）、圖片輸入、plan 模式自動執行、即時 token/cost 追蹤
- **useAgentServices** — 服務初始化 hook：lazy init ContextBudgetTracker、CommandRegistry、CheckpointManager
- **useContextBudget** — 上下文預算 hook：token 用量追蹤、自動壓縮觸發、budget 狀態管理
- **useMode** — 模式狀態 hook：提供 mode、setMode、cycleMode

### Keyboard Shortcuts

- **Shift+Tab** — 切換模式：ask → plan → agent → ask
- **Enter** — 送出輸入（非串流中且輸入非空時）
- **Shift+Enter** — 插入換行（多行輸入模式）
- **Tab** — 接受選中的命令補全
- **↑/↓ Arrow** — 瀏覽歷史輸入（無補全選單時）／命令補全下拉選單導航
- **Backspace/Delete** — 刪除最後一個字元
- **y/n/a/g/d/x** — 在 PermissionPrompt 中允許/拒絕/專案級永久允許/全域永久允許/專案級永久拒絕/全域永久拒絕
- **↑/↓ + Enter** — 在 PermissionPrompt 中以箭頭鍵選取選項並確認
- **Ctrl+C** — 中斷串流或退出程式
- **Escape** — 退出設定精靈

### CLI Flags

#### 主命令：`frogger [prompt]`

- **[prompt]** — 可選的初始提示詞，啟動時直接送出
- **-m, --mode** — 起始模式：ask、plan、agent（預設 agent）
- **-p, --provider** — 覆蓋設定的 LLM provider
- **--model** — 覆蓋設定的 model 名稱
- **--pipe** — 非互動式 pipe 模式，輸出 JSON Lines 到 stdout（不啟動 Ink TUI）
- **--pipe-allow** — 逗號分隔的工具白名單，限制 pipe 模式中可用的工具（如 `--pipe-allow read-file,glob`）
- **--output** — 將最終文字輸出寫入檔案（配合 `--pipe` 使用）
- **--resume** — 依 ID 或 `latest` 恢復 session
- **-c, --continue** — 恢復當前工作目錄的最近 session
- **--thinking / --no-thinking** — 覆蓋 config 中的 Extended Thinking 設定（僅 Anthropic provider）
- **--notify / --no-notify** — 覆蓋 config 中的桌面通知設定（預設啟用，任務耗時 > 15 秒時觸發 BEL 字元 + node-notifier）
- **-v, --verbose** — 啟用 debug 日誌（輸出至 stderr）

### Desktop 通知

- **BEL 字元通知** — 任務完成且耗時 > 15 秒時，寫入 `\x07` BEL 字元到 stderr，所有終端皆支援，零依賴
- **node-notifier 增強** — 可選安裝 `node-notifier`，提供作業系統原生桌面通知（title + message + sound）；未安裝時 graceful fallback 至 BEL
- **智慧觸發** — 僅在 TTY 模式且任務耗時超過 `NOTIFICATION_MIN_DURATION_MS`（15 秒）時觸發，pipe mode 自動跳過
- **設定優先順序** — `--notify` CLI flag > `~/.frogger/config.json` > 預設 enabled

### Pipe Mode（非互動式）

`frogger --pipe "prompt" [--output file]` — 不啟動 TUI，直接執行 agent 並輸出 JSON Lines。

- **JSON Lines 輸出** — 每個 event 一行 JSON（text_delta、tool_call、tool_result、error、done）；支援 backpressure 處理（stdout.write 返回 false 時 await drain）；EPIPE 錯誤優雅退出；SIGPIPE 信號處理
- **Headless 執行** — 所有 permission 自動核准（auto），適用於 SWE-bench harness 和 CI/CD
- **工具白名單** — `--pipe-allow <tools>` 限制可用工具，強化 pipe mode 安全性
- **stdin 支援** — 非 TTY 時從 stdin 讀取 prompt（`echo "fix bug" | frogger --pipe`）
- **檔案輸出** — `--output file.txt` 將累積的文字結果寫入指定檔案

#### 子命令

- **frogger init** — 互動式初始設定精靈
- **frogger provider list** — 列出所有已註冊 providers
- **frogger provider add** — 互動式新增 provider
- **frogger provider remove** — 移除指定 provider
- **frogger benchmark** — 執行基準測試（`--list` 列出任務、`--task` 指定任務）

---

## Shared（packages/shared）

### Types

- **ModeName** — 模式名稱聯合型別：`'ask' | 'plan' | 'agent'`
- **ApprovalPolicy** — 核准策略：`'auto' | 'confirm-writes' | 'confirm-all'`
- **ModeConfig** — 模式設定：名稱、顯示名稱、允許工具、核准策略、系統提示詞後綴
- **AgentEvent** — Agent 事件辨別聯合型別：text_delta、thinking_delta、tool_call、tool_result、usage_update、mode_change、error、done
- **TokenUsage** — Token 用量：promptTokens、completionTokens、totalTokens、reasoningTokens（optional）、cacheReadTokens（optional）、cacheCreationTokens（optional）
- **ProviderType** — Provider 類型：`'openai-compatible' | 'anthropic' | 'openai'`
- **ModelInfo** — Model 資訊：名稱、contextWindow、maxOutputTokens
- **ProviderEntry** — Provider 完整定義：名稱、標籤、類型、端點、環境變數、models、`capabilities?`（自訂能力覆蓋）
- **ProviderCapabilities** — Provider 能力介面：`{ vision, thinking, caching, toolUse }`
- **ToolCategory** — 工具分類標籤：`'read' | 'write' | 'search' | 'git' | 'test' | 'github' | 'system'`
- **PermissionLevel** — 權限等級：`'auto' | 'confirm'`
- **PermissionResponse** — 權限回應：`'allow' | 'deny' | 'always-project' | 'always-global'`
- **ToolMetadata** — 工具元資料：名稱、描述、權限等級、`hints?`（使用建議）、`category?`（分類標籤）

### Constants

- **APP_VERSION** — 透過 tsup `define` 在建置時從 `package.json` 注入版本號（`__APP_VERSION__`），開發環境 fallback 為 `'0.1.9'`；顯示於啟動橫幅與 `--version`
- **MAX_IMAGE_FILE_SIZE** — `5 * 1024 * 1024`（5MB），圖片檔案大小上限
- **APP_NAME** — `'frogger'`，用於系統提示詞身份識別
- **CONFIG_DIR** — `'.frogger'`，`~` 下的設定/session 子目錄
- **PROJECT_FILE** — `'FROGGER.md'`，專案上下文檔案
- **MAX_STEPS** — `50`，每輪最多 LLM 工具呼叫步數
- **DEFAULT_MODEL / DEFAULT_PROVIDER** — `'deepseek-chat'` / `'deepseek'`
- **DEFAULT_CONTEXT_WINDOW** — `128000`，未知 model 的預設上下文視窗
- **DEFAULT_MAX_OUTPUT_TOKENS** — `8192`，未知 model 的預設最大輸出 token
- **DEFAULT_COMPACT_THRESHOLD** — `80`，自動壓縮觸發百分比
- **COMPACT_PRESERVE_RECENT** — `4`，壓縮時保留的最近訊息數
- **NOTIFICATION_MIN_DURATION_MS** — `15000`（15 秒），桌面通知最短任務耗時門檻
- **MAX_BACKGROUND_TASKS** — `5`，最大併發背景任務數
- **MODEL_PRICING** — 模型定價表（每 1M tokens 的 USD 成本），涵蓋 23 個模型：DeepSeek（chat/reasoner）、Anthropic Claude 4.6/4.5/4.1/4 全系列（含日期後綴別名）、OpenAI GPT-4.1/o1/o3/o4-mini/GPT-4o 全系列
- **MAX_MEMORY_SIZE** — `50000`（~50KB），Memory 檔案大小上限，超限時截斷最舊條目
- **MAX_TOOL_RESULT_SIZE** — `100000`（~100KB），PostToolUse hook 的 `FROGGER_TOOL_RESULT` 環境變數大小上限
- **IMAGE_EXTENSIONS** — 支援的圖片副檔名集合（.png、.jpg、.jpeg、.gif、.webp）
- **IMAGE_MEDIA_TYPES** — 圖片副檔名對應 IANA media type 映射表

---

## Infrastructure

### CI/CD

- **GitHub Actions** — `.github/workflows/ci.yml`，PR 與 push 觸發，pipeline：pnpm install → lint → test → build → security audit（`pnpm audit --audit-level=high`，advisory 不阻塞 CI）→ test with coverage
- **Release Workflow** — `.github/workflows/release.yml`，push to main 觸發 changesets/action 自動版本管理與 npm publish
