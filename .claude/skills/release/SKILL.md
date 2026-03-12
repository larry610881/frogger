# 發布流程

執行 Changesets 版本升級 + npm publish。

## 使用方式
`/release`

## 流程
1. `pnpm test` 確認全部通過
2. `pnpm build` 建置所有 packages
3. `pnpm version`（即 `changeset version`）升版 + 生成 CHANGELOG
4. 確認變更後 commit 版本升級
5. `pnpm release`（build + `changeset publish`，需確認）
