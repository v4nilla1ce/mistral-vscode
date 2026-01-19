# Mistral VS Code Extension

A Visual Studio Code extension that provides a rich graphical interface for [mistral-cli](https://github.com/v4nilla1ce/mistral-cli), bringing AI-powered coding assistance directly into your editor.

## Features

- **Chat Interface**: Conversational AI assistant in your sidebar
- **Agent Mode**: Autonomous task execution with tool confirmation
- **Context Management**: Add files to context with token usage tracking
- **Streaming Responses**: Real-time token streaming with markdown rendering
- **Code Actions**: Copy or apply code blocks directly to your editor
- **Tool Confirmation**: Review and approve/deny tool calls before execution
- **Auto-Reconnection**: Resilient connection handling with automatic recovery

## Requirements

- **VS Code** 1.85.0 or higher
- **mistral-cli** 0.9.0 or higher (with `server` command)
- **Mistral API key** configured in mistral-cli

## Installation

### 1. Install mistral-cli

```bash
# Option A: Install from source (recommended for development)
git clone https://github.com/v4nilla1ce/mistral-cli.git
cd mistral-cli
pip install -e .

# Option B: Install with pipx
pipx install git+https://github.com/v4nilla1ce/mistral-cli.git
```

### 2. Configure API Key

```bash
mistral config setup
```

### 3. Install Extension

**From VSIX (local build):**
```bash
cd mistral-vscode
npm install
npm run build
# Then install the generated .vsix file in VS Code
```

**From Marketplace:** *(coming soon)*

## Usage

1. Click the **Mistral AI** icon in the Activity Bar (left sidebar)
2. Type a message and press **Send** or hit Enter
3. Toggle between **Chat** and **Agent** mode:
   - **Chat**: Simple conversation, no tool execution
   - **Agent**: Can read/write files and run commands

### Adding Context

- **Command Palette**: `Mistral: Add File to Context`
- **Right-click** a file in Explorer → `Add File to Context`
- Files appear in the collapsible Context Panel with token counts

### Tool Confirmation

When in Agent mode, dangerous operations (file writes, shell commands) require confirmation:
- Click **Allow** to proceed
- Click **Deny** to cancel the operation

### Code Blocks

AI responses with code blocks include action buttons:
- **Copy**: Copy code to clipboard
- **Apply**: Insert code at cursor or replace selection

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mistral.model` | `mistral-small` | Model to use for completions |
| `mistral.cliPath` | `""` | Path to mistral CLI (leave empty for PATH) |
| `mistral.autoConfirmSafe` | `true` | Auto-confirm read-only operations |

## Commands

| Command | Description |
|---------|-------------|
| `Mistral: New Chat` | Clear chat and start fresh |
| `Mistral: Add File to Context` | Add active file to context |
| `Mistral: Clear Context` | Remove all context files |
| `Mistral: Settings` | Open extension settings |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ extension.ts│  │ rpc.ts       │  │ Sidebar       │  │
│  │ (entry)     │  │ (JSON-RPC)   │  │ Provider      │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                │                  │           │
│         └────────────────┼──────────────────┘           │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │  Webview  │                        │
│                    │  (React)  │                        │
│                    └─────┬─────┘                        │
└──────────────────────────┼──────────────────────────────┘
                           │ stdio (JSON-RPC)
                    ┌──────▼──────┐
                    │ mistral     │
                    │ server      │
                    │ (Python)    │
                    └─────────────┘
```

## Development

```bash
# Install dependencies
npm install
cd src/webview && npm install && cd ../..

# Build extension
npm run build

# Watch mode (development)
npm run watch

# Launch Extension Development Host
# Press F5 in VS Code
```

### Mock Server for UI Testing

A mock CLI server is included for testing the extension UI without a real Mistral backend:

```bash
# Run the mock server test suite
node src/mock/test-mock-server.js
```

**To use the mock server:**

1. Set the CLI path in VS Code settings:
   ```json
   {
     "mistral.cliPath": "node /path/to/mistral-vscode/src/mock/mock-server.js"
   }
   ```

2. Reload VS Code and open the Mistral sidebar

3. Test various messages:
   | Message | Expected Result |
   |---------|-----------------|
   | `create a python file called main.py` | Python code with "Create File" button |
   | `npm install express` | Bash command with "Run in Terminal" button |
   | `refactor this function` | TypeScript snippet with "Preview & Apply" button |
   | `create a new typescript file` | TypeScript code with "Create File" button |

The mock server supports:
- Chat mode with intent-based responses
- Agent mode with tool confirmation flow
- Streaming responses
- All RPC methods (`chat`, `agent.run`, `agent.confirm`, `context.*`, `model.*`)
- **100% Compliance** with the [Mock Server Protocol Test Suite](src/mock/tests/index.js) (including intent detection and error handling)

### Project Structure

```
mistral-vscode/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── client/
│   │   └── rpc.ts            # JSON-RPC client
│   ├── panels/
│   │   └── MistralSidebarProvider.ts
│   ├── services/             # Smart Apply services
│   │   ├── IntentDetector.ts     # Code block intent classification
│   │   ├── SymbolResolver.ts     # LSP symbol lookup
│   │   ├── DiffPreviewService.ts # Diff preview management
│   │   └── SmartApplyService.ts  # Central apply orchestrator
│   ├── mock/                 # Testing utilities
│   │   ├── mock-server.js        # Mock CLI for UI testing
│   │   └── test-mock-server.js   # Automated test suite
│   └── webview/              # React app
│       ├── src/
│       │   ├── App.tsx
│       │   └── components/
│       │       ├── ChatMessage.tsx
│       │       ├── CodeBlock.tsx
│       │       ├── InputArea.tsx
│       │       ├── ContextPanel.tsx
│       │       └── ToolConfirmation.tsx
│       ├── package.json
│       └── vite.config.ts
├── package.json              # Extension manifest
└── tsconfig.json
```

## Troubleshooting

### "Mistral CLI not found"

Ensure `mistral` is in your PATH:
```bash
mistral --version
# Should show 0.9.0 or higher
```

Or configure the full path in settings:
```json
{
  "mistral.cliPath": "C:\\Users\\...\\Scripts\\mistral.exe"
}
```

### "No such command 'server'"

Update mistral-cli to v0.9.0+:
```bash
cd /path/to/mistral-cli
git pull
pip install -e .
```

### Connection keeps failing

Check the Debug Console (View → Debug Console) for error messages. Common issues:
- Multiple mistral installations (use `where mistral` / `which mistral`)
- Missing API key (run `mistral config setup`)

## License

MIT

## Related

- [mistral-cli](https://github.com/v4nilla1ce/mistral-cli) - The CLI backend
- [Mistral AI](https://mistral.ai/) - AI models powering the assistant
