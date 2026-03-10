---
paths:
  - "packages/cli/**/*"
---

# CLI UX 規範（Ink TUI）

## Ink 核心概念
- Ink = React renderer for terminal（Yoga flexbox layout）
- 30fps 渲染上限（terminal 限制）
- `<Box>` = flexbox 容器，`<Text>` = 文字節點
- `<Static>` = append-only 區域（歷史訊息，不重新渲染）

## 元件架構

```
packages/cli/src/
├── components/
│   ├── App.tsx              # Root: Static history + active area
│   ├── ChatView.tsx         # 對話顯示（user msg + assistant response）
│   ├── InputBox.tsx         # 使用者輸入（多行 textarea）
│   ├── ToolCallDisplay.tsx  # Tool call 顯示（名稱 + 參數 + 結果）
│   ├── PermissionPrompt.tsx # 權限確認（Y/n/always）
│   ├── ModeIndicator.tsx    # 底部模式指示器（ask | plan | code）
│   └── Spinner.tsx          # Loading 動畫
├── hooks/
│   ├── useAgent.ts          # Agent loop 控制（start, stop, events）
│   ├── useMode.ts           # Mode 切換（Shift+Tab cycle）
│   └── usePermission.ts     # 權限確認流程
└── app.tsx                  # Ink render 入口
```

## Key Binding 設計

### Shift+Tab — Mode 切換
```typescript
import { useInput } from 'ink';

useInput((input, key) => {
  if (key.tab && key.shift) {
    // cycle: ask → plan → code → ask
    modeManager.cycleMode();
  }
});
```

### 其他 Key Bindings
| Key | Action |
|-----|--------|
| `Shift+Tab` | 切換模式 |
| `Enter` | 送出訊息 |
| `Ctrl+C` | 終止當前操作 / 退出 |
| `Ctrl+D` | 退出程式 |
| `y` / `n` | 權限確認（在 PermissionPrompt 時） |
| `a` | Always allow（在 PermissionPrompt 時） |

## Static vs Dynamic 渲染

### 已完成的訊息 → `<Static>`
```tsx
<Static items={completedMessages}>
  {(msg) => <ChatView key={msg.id} message={msg} />}
</Static>
```
- 只 append，不重新渲染
- 效能關鍵：大量歷史訊息不會拖慢渲染

### 進行中的內容 → 正常 React
```tsx
<Box flexDirection="column">
  {isStreaming && <StreamingResponse text={partialText} />}
  {pendingToolCall && <ToolCallDisplay call={pendingToolCall} />}
  {needsPermission && <PermissionPrompt tool={pendingTool} />}
  <InputBox onSubmit={handleSubmit} disabled={isStreaming} />
  <ModeIndicator mode={currentMode} />
</Box>
```

## Output Formatting
- Markdown 渲染：使用 `ink-markdown` 或自行實作簡易版
- Code blocks：使用 `<Text color="green">` 或 syntax highlight
- 工具名稱：`<Text bold>` + `<Text dimColor>`
- 錯誤訊息：`<Text color="red">`
- 成功訊息：`<Text color="green">`

## 效能注意事項
- 長文字避免在 `<Text>` 內做複雜 transform（30fps 限制）
- 大量輸出用 `<Static>` 而非重複渲染
- 避免在 render 函數內建立新物件（React 慣例）
- Spinner 只在進行中顯示，完成後移除
