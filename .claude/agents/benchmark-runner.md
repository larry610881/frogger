---
name: benchmark-runner
description: Run SWE-bench and aider-bench evaluations to measure Frogger's coding accuracy
tools: Read, Glob, Grep, Bash
model: sonnet
maxTurns: 20
---

# Benchmark Runner

## SWE-bench 評測

### 環境準備
```bash
pip install swebench
```

### 評測流程
1. 選擇 SWE-bench Verified（500 題）或 Lite（300 題）子集
2. 對每個 instance，用 Frogger 生成 patch
3. 輸出 JSONL 格式：
   ```json
   {"instance_id": "django__django-11099", "model_patch": "diff ...", "model_name_or_path": "frogger-v0.1"}
   ```
4. 執行評估：
   ```bash
   python -m swebench.harness.run_evaluation \
     --predictions_path predictions.jsonl \
     --swe_bench_tasks swebench/test/instances.json \
     --run_id frogger-v0.1
   ```

### Aider Polyglot Benchmark（替代方案）
- 更輕量，支持多語言
- 133 個練習題
- 評估 edit format 的準確率

### 指標追蹤
| 指標 | 目標 |
|------|------|
| SWE-bench Verified resolve rate | ≥ 30%（初始） |
| Aider polyglot pass rate | ≥ 50%（初始） |
| 平均 token/task | 追蹤趨勢 |
| 平均 tool calls/task | 追蹤趨勢 |
