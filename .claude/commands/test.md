# 執行測試

## 使用方式
- `/test` — 執行所有測試
- `/test core` — 只測 @frogger/core
- `/test cli` — 只測 @frogger/cli
- `/test --coverage` — 含覆蓋率

## 執行步驟

1. 若 `$ARGUMENTS` 為空：
```bash
pnpm test 2>&1
```

2. 若指定 package：
```bash
pnpm test --filter @frogger/$ARGUMENTS 2>&1
```

3. 若包含 `--coverage`：
```bash
pnpm test -- --coverage 2>&1
```

4. 分析結果，輸出通過/失敗摘要。
