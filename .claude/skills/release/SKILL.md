# 發布流程

執行 npm publish + changelog 生成。

## 使用方式
`/release`

## 流程
1. `pnpm test` 確認全部通過
2. `pnpm build` 建置所有 packages
3. 更新 CHANGELOG.md（基於 git log）
4. `pnpm version <patch|minor|major>`
5. `pnpm publish --access public`（需確認）
