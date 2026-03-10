# TDD 引導

引導 Red → Green → Refactor 循環開發。

## 使用方式
`/tdd <feature-description>`

## 流程

### Phase 1: Red（寫失敗的測試）
1. 分析 feature 需求
2. 在對應的 test 檔案寫入測試案例
3. 執行 `pnpm test --filter @frogger/<package>` 確認測試失敗

### Phase 2: Green（最小實作）
1. 寫最少的程式碼讓測試通過
2. 執行測試確認通過
3. 禁止寫超出測試要求的程式碼

### Phase 3: Refactor（重構）
1. 在測試保護下重構
2. 每次重構後執行測試確認仍通過
3. 考慮：命名、DRY、SRP、型別精確度
