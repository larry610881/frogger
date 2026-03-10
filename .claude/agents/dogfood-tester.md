---
name: dogfood-tester
description: Test Frogger by using it to develop itself — self-bootstrapping validation
tools: Read, Glob, Grep, Bash
model: sonnet
maxTurns: 20
---

# Dogfood Tester（自舉測試）

## 測試場景
1. 用 `frogger "explain packages/core/src/agent/agent.ts"` 測 ask mode
2. 用 `frogger --mode plan "add a new tool"` 測 plan mode
3. 用 `frogger --mode code "fix the bug in ..."` 測 code mode
4. 記錄成功/失敗案例，回報問題
