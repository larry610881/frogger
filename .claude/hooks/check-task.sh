#!/usr/bin/env bash
# check-task.sh — TaskCompleted hook
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "🔍 檢查測試狀態..."

if [ -f "pnpm-workspace.yaml" ]; then
  echo "▶ 執行 pnpm test..."
  if pnpm test 2>&1; then
    echo "✅ 所有測試通過"
  else
    echo "❌ 測試失敗"
    exit 1
  fi
fi

echo "✅ 檢查完成"
