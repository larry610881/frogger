# 生成自定義 Mode

根據使用者描述，生成新的 AgentMode 定義。

## 使用方式
`/mode <name>` — 例如 `/mode debug`

## 生成內容
1. `packages/core/src/modes/<name>.ts` — Mode 定義
2. 包含 allowedTools、approvalPolicy、systemPrompt
3. 在 ModeManager 中註冊
