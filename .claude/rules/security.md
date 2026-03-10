---
paths:
  - "**/*"
---

# CLI 安全規範

## CRITICAL — Shell Injection 防護
- 禁止用 template literal 或字串拼接構建 shell 命令
- 使用 `execa` 的陣列參數形式：`execa('git', ['status'])` 而非 `execa('git status')`
- 使用者輸入的路徑必須經過 `path.resolve()` + 邊界檢查
- bash tool 的命令必須經過 allowlist/blocklist 過濾

## CRITICAL — Path Traversal 防護
- 所有檔案操作必須限制在工作目錄內
- 使用 `path.resolve()` 後檢查是否在允許範圍內
- 禁止跟隨 symlink 到工作目錄外
- `..` 路徑必須正規化後再檢查

## CRITICAL — API Key 保護
- API key 存放在 `~/.frogger/config.json`，權限 600
- 禁止在 log / error message / LLM context 中洩露 API key
- 禁止將 API key 傳給 bash tool 執行的命令
- 環境變數中的 key 名稱：`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

## HIGH — LLM 回應安全
- LLM 回應中的 tool call 參數必須經過驗證（Zod schema）
- 禁止直接執行 LLM 回應中的任意程式碼
- 檔案寫入內容不做 eval / exec

## HIGH — 輸入驗證
- 所有 tool 輸入使用 Zod schema 驗證
- CLI 參數使用 commander 驗證
- 檔案路徑必須是字串且非空

## MEDIUM — 依賴安全
- 定期執行 `pnpm audit`
- 審查新依賴的安全性與維護狀態
- 禁止安裝不必要的依賴
