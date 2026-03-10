#!/usr/bin/env bash
# check-idle.sh — TeammateIdle hook
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

CHANGES=$(git status --porcelain 2>/dev/null | head -20)

if [ -n "$CHANGES" ]; then
  echo "⚠️ 偵測到未 commit 的變更："
  echo "$CHANGES"
  echo ""
  echo "建議：在閒置前 commit 目前的進度。"
fi
