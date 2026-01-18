# Implementation Plan - Mistral VS Code Extension

This plan outlines the creation of a new "SOTA 2026" VS Code extension for Mistral, providing a polished UI and seamless integration.

## Goal Description

Create a new repository `mistral-vscode` to host a Visual Studio Code extension. This extension will serve as a rich graphical interface for the `mistral-cli`, leveraging the existing Python logic while providing a premium, native user experience ("SOTA January 2026").

The architecture will be **Hybrid**:
- **Frontend**: A VS Code Webview using **React** and the **VS Code Webview UI Toolkit** for native aesthetics.
- **Backend**: The existing `mistral-cli` running in a new `server` mode (JSON-RPC), preserving all agentic capabilities.

## User Review Required

> [!IMPORTANT]
> **New Repository**: This plan assumes we will create a NEW folder/workspace for `mistral-vscode`.
> **Python Dependency**: The extension will require `mistral-cli` to be installed (or will bundle a standalone executable in the future). For now, it will look for `mistral` in the user's path.
> **CLI Update**: We need to update `mistral-cli` to support a `server` command (JSON-RPC) to allow structured communication with the extension.

---

## Phase 1: CLI Server Mode (Python) - PREREQUISITE

> [!NOTE]
> This phase must be completed first. The VS Code extension depends on the server mode.

### [MODIFY] `mistral-cli/src/mistral_cli/cli.py`
- Add `server` command to Click CLI group.

### [NEW] `mistral-cli/src/mistral_cli/server.py`

Implements JSON-RPC 2.0 over stdio with **newline-delimited JSON (ndjson)** framing.

**Protocol Specification:**
- Each message is a single line of JSON terminated by `\n`
- Requests have `id` field; notifications do not
- Leverage patterns from existing `mcp_client.py:138-195`

**RPC Methods (Client → Server):**
| Method | Parameters | Description |
|--------|------------|-------------|
| `chat` | `message`, `context_files[]` | Simple chat completion |
| `agent.run` | `task`, `context_files[]` | Start agentic task |
| `agent.cancel` | - | Cancel running task |
| `agent.confirm` | `tool_call_id`, `approved` | Respond to tool confirmation |
| `context.add` | `file_path` | Add file to context |
| `context.remove` | `file_path` | Remove file from context |
| `context.list` | - | List current context files |

**Event Notifications (Server → Client):**
| Event | Payload | Description |
|-------|---------|-------------|
| `content.delta` | `text` | Streaming token output |
| `content.done` | `full_text` | Response complete |
| `thinking.update` | `thought` | Agent thinking step |
| `tool.pending` | `tool_call_id`, `tool`, `args` | Awaiting confirmation |
| `tool.result` | `tool_call_id`, `success`, `output` | Tool execution result |
| `token.usage` | `prompt`, `completion`, `total` | Token counts (via `mistral-common`) |
| `error` | `code`, `message` | Error notification |

**Wire Agent Callbacks:**
- `Agent.on_thinking` → `thinking.update` event
- `Agent.on_tool_call` → `tool.pending` event (await `agent.confirm`)
- `Agent.on_tool_result` → `tool.result` event
- `Agent.on_response` → `content.delta` / `content.done` events
- `tokens.count_tokens()` → `token.usage` event

---

## Phase 2: VS Code Extension Scaffold (TypeScript)

### Repository Structure

```text
mistral-vscode/
├── package.json            # Extension manifest
├── tsconfig.json           # TypeScript config
├── esbuild.js              # Extension bundler (fast builds)
├── src/
│   ├── extension.ts        # Main entry point
│   ├── client/
│   │   └── rpc.ts          # JSON-RPC client over stdio
│   ├── panels/
│   │   └── MistralSidebarProvider.ts
│   └── webview/            # React App (separate build)
│       ├── vite.config.ts  # Webview bundler (HMR support)
│       ├── App.tsx
│       ├── index.css       # VS Code Design Tokens
│       └── components/
│           ├── ChatMessage.tsx
│           ├── CodeBlock.tsx
│           ├── InputArea.tsx
│           ├── ContextPanel.tsx
│           └── ToolConfirmation.tsx
├── resources/              # Icons/Media
│   └── icon.png
└── .vscodeignore
```

### Build Tooling

| Component | Tool | Rationale |
|-----------|------|-----------|
| Extension | **esbuild** | Fast, official VS Code recommendation |
| Webview | **Vite** | React HMR, modern DX |

### [NEW] `package.json`

```json
{
  "name": "mistral-vscode",
  "displayName": "Mistral AI",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "mistral",
        "title": "Mistral",
        "icon": "resources/icon.png"
      }]
    },
    "views": {
      "mistral": [{
        "type": "webview",
        "id": "mistral.chat",
        "name": "Chat"
      }]
    },
    "commands": [
      { "command": "mistral.newChat", "title": "New Chat" },
      { "command": "mistral.addContext", "title": "Add File to Context" },
      { "command": "mistral.settings", "title": "Mistral Settings" }
    ]
  }
}
```

### [NEW] `src/extension.ts`

- **Dependency Check on Activation**:
  - Verify `mistral` CLI is in PATH using `which`/`where`
  - Show error notification with install instructions if missing
  - Optionally prompt: "Install via pip?"
- Register `MistralSidebarProvider`
- Register commands: `mistral.newChat`, `mistral.addContext`, `mistral.settings`

### [NEW] `src/client/rpc.ts`

JSON-RPC client implementation:
- Spawn `mistral server` subprocess via `child_process.spawn`
- Request/response correlation via `id` field
- Event listener pattern for notifications
- **Reconnection Strategy**:
  - Detect subprocess exit/crash
  - Auto-restart with exponential backoff (1s, 2s, 4s, max 30s)
  - Notify webview of connection state changes
  - Clear session state on reconnect (or attempt recovery)

### [NEW] `src/panels/MistralSidebarProvider.ts`

- Implements `vscode.WebviewViewProvider`
- Manages RPC client lifecycle
- Message bridge between webview and RPC:
  - `webview.onDidReceiveMessage` → RPC method calls
  - RPC events → `webview.postMessage`
- **File Watcher**: Monitor context files for changes, notify webview

---

## Phase 3: Webview UI (React)

### [NEW] `src/webview/App.tsx`

**Chat Interface:**
- Message list with User/AI distinction (different background colors)
- Markdown rendering with `react-markdown` + `remark-gfm`
- Auto-scroll to bottom on new messages

**Code Blocks (`CodeBlock.tsx`):**
- Syntax highlighting with `prism-react-renderer`
- Action buttons:
  - **Copy** - Copy to clipboard
  - **Apply to Editor** - Send to extension, use `workspace.applyEdit`
  - **Insert at Cursor** - Insert at current cursor position

**Input Area (`InputArea.tsx`):**
- Auto-growing `<textarea>` (CSS `field-sizing: content` or JS resize)
- File attachment button (opens file picker, adds to context)
- Submit on Enter (Shift+Enter for newline)
- Keyboard shortcut hints

**Context Panel (`ContextPanel.tsx`):**
- Collapsible section showing active files
- Token usage bar with color gradient:
  - Green (0-50%) → Yellow (50-80%) → Red (80-100%)
- Token source: `token.usage` events from server
- Remove file button (X) per item
- "Changed on disk" indicator when file watcher detects modifications

**Agent Mode (`ToolConfirmation.tsx`):**
- Visual "Thought Process" (collapsible accordion):
  - "Thinking..." with spinner
  - "Running `ls src/`..." with command preview
  - "Reading `config.py`..." with file icon
- **Confirmation Card**:
  - Tool name and arguments displayed
  - Risk indicator (yellow for writes, red for shell commands)
  - [Allow] [Deny] buttons
  - "Always allow this tool" checkbox (session-scoped)

---

## Phase 4: Integration & Polish

### "Apply to Editor" Flow

1. User clicks "Apply" on code block in webview
2. Webview sends `{ type: 'applyCode', code, language }` to extension
3. Extension determines target:
   - If selection exists → replace selection
   - If active editor → insert at cursor
   - Otherwise → create new untitled file
4. Use `vscode.workspace.applyEdit()` for undo support

### Settings UI

Accessible via `mistral.settings` command or gear icon in sidebar:
- **Model Selection**: Dropdown (mistral-small, mistral-large, codestral)
- **Auto-confirm Safe Tools**: Toggle (read-only tools like `read_file`, `list_files`)
- **API Key**: Secure input (stored in VS Code SecretStorage)
- **Working Directory**: Override for agent operations

### Error Handling

| Scenario | Behavior |
|----------|----------|
| CLI not found | Show error + install instructions |
| Subprocess crash | Auto-restart, show "Reconnecting..." |
| API error (401) | Prompt to check API key |
| API error (429) | Show rate limit message, suggest retry |
| Tool execution error | Display in chat with retry option |

---

## Verification Plan

### Automated Tests

| Test Type | Tool | Coverage |
|-----------|------|----------|
| Extension unit tests | `@vscode/test-electron` | Sidebar loads, commands register |
| RPC serialization | Jest | JSON-RPC message format |
| Python server | pytest | Method handlers, event emission |
| React components | Vitest + React Testing Library | UI rendering, interactions |

### Manual Verification

1. **Setup**:
   - Run `pip install -e .` in `mistral-cli`
   - Run `npm install && npm run build` in `mistral-vscode`
   - Launch VS Code Extension Host (`F5`)

2. **Dependency Check**:
   - Temporarily rename `mistral` CLI
   - Verify error notification appears with install guidance

3. **Chat Flow**:
   - Open "Mistral" in Activity Bar
   - Type "Hello". Verify streaming response appears token-by-token
   - Verify token usage bar updates

4. **Context Management**:
   - Open a file in editor
   - Click "Add to Context" or use command palette
   - Verify file appears in Context Panel
   - Modify file on disk → verify "changed" indicator

5. **Agent Action**:
   - Type "List all TypeScript files in src"
   - Verify "Thinking..." step appears
   - Verify tool confirmation card shows `list_files` call
   - Click "Allow" → verify results displayed

6. **Code Application**:
   - Ask "Write a hello world function"
   - Click "Apply to Editor" on code block
   - Verify code inserted with undo support

7. **Crash Recovery**:
   - Kill `mistral server` process manually
   - Verify "Reconnecting..." indicator
   - Verify auto-restart and continued operation

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CLI not in PATH | Activation check + clear install guidance |
| Large context = slow | Token counting + visual warning at 80% |
| Subprocess crashes | Auto-restart with backoff + user notification |
| Windows path issues | Use `shell: true` in spawn, normalize paths |
| Streaming backpressure | Buffer events, batch UI updates (requestAnimationFrame) |

---

## Implementation Order

```
Phase 1 (Python)          Phase 2 (Extension)        Phase 3 (Webview)
─────────────────         ──────────────────         ─────────────────
1. server.py         ──►  4. package.json       ──►  7. Vite setup
2. cli.py update          5. extension.ts            8. Components
3. Agent callbacks        6. SidebarProvider         9. Agent UI
                              │
                              ▼
                          Phase 4 (Polish)
                          ────────────────
                          10. Wire together
                          11. Apply to Editor
                          12. Settings UI
```

**Critical Path**: Phase 1 must complete before Phase 2-3 can be tested end-to-end.
