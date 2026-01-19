# Roadmap: Precise Code Orientation & Context-Aware Application

## Problem Analysis

The current "Orientation Problem" stems from a **Blind Application Strategy** in `MistralSidebarProvider.ts:388-409`.

- **Logic**: `_applyCodeToEditor` checks `activeTextEditor`. If present, it inserts at cursor. If not, it creates a new file.
- **Failure Mode 1 (Wrong File)**: If you ask to "create a file" but have `extension.ts` focused, code is dumped into `extension.ts`.
- **Failure Mode 2 (Random Location)**: If you ask to "refactor this function" but your cursor moved, code is appended context-free.

---

## Solution: Context-Aware Intent Resolution

Move from **"Text Pasting"** to **"Semantic Application"** matching industry standards (Cursor "Composer", GitHub Copilot "Workspace").

### Core Concepts

1. **Intent Classification**: Each code block is an *Operation* (Create, Edit, Command)
2. **Smart Anchoring**: LSP symbols + fuzzy matching to find *where* code belongs
3. **Preview-First UX**: Show diff preview before modifying buffers
4. **Graceful Fallbacks**: Never fail silently; degrade with user notification

---

## Protocol Change Notice

> **Breaking Change**: Updates message parsing in Webview (React) to send rich objects to Extension Host.
> **UX Change**: "Apply" triggers diff preview by default for edits.

---

## Implementation

### Phase 1: Protocol Upgrade

**Files**: `src/webview/src/App.tsx`, `src/panels/MistralSidebarProvider.ts`

Deprecate simple `applyCode` in favor of structured `applyUpdate`:

```typescript
// Old (deprecated)
{ type: "applyCode", code: "...", language: "python" }

// New
interface ApplyPayload {
  code: string;
  language: string;
  intent: "create" | "edit" | "command";
  target?: string;      // Filename or path hint
  anchor?: string;      // Function/class name or context line
}

interface ApplyRequest {
  type: "applyUpdate";
  payload: ApplyPayload | ApplyPayload[];  // Support multi-file operations
}
```

**Multi-file support**: LLMs often generate multiple files (component + test + types). The array format handles this natively.

---

### Phase 2: Intent Detection Engine

**File**: `src/services/IntentDetector.ts`

Lightweight classifier run *before* user clicks "Apply":

```typescript
interface DetectedIntent {
  intent: "create" | "edit" | "command";
  confidence: number;  // 0-1
  target?: string;
  anchor?: string;
}

class IntentDetector {
  detect(code: string, language: string, activeFile?: string): DetectedIntent;
}
```

**Detection Heuristics**:

| Pattern | Intent | Example |
|---------|--------|---------|
| Top-line file comment | `create` | `// src/utils/helper.ts`, `# app/models.py` |
| Shell prompt prefix | `command` | `$ npm install`, `> pip install`, `% brew install` |
| Markdown file header | `create` | `### filename.py`, ` ```python:src/main.py ` |
| Small block + symbol match | `edit` | <50 lines matching function in active file |
| Import/require statement only | `edit` | Single import line |

**Workspace Context Enhancement**:
```typescript
// Detect project type for smarter classification
private detectProjectType(): "node" | "python" | "rust" | "unknown" {
  if (fs.existsSync("package.json")) return "node";
  if (fs.existsSync("pyproject.toml") || fs.existsSync("requirements.txt")) return "python";
  if (fs.existsSync("Cargo.toml")) return "rust";
  return "unknown";
}
```

---

### Phase 3: SmartApplyService

**File**: `src/services/SmartApplyService.ts`

Central orchestrator for all code application:

```typescript
class SmartApplyService {
  constructor(
    private intentDetector: IntentDetector,
    private symbolResolver: SymbolResolver
  ) {}

  async apply(payload: ApplyPayload | ApplyPayload[]): Promise<ApplyResult>;

  private async handleCreate(payload: ApplyPayload): Promise<ApplyResult>;
  private async handleEdit(payload: ApplyPayload): Promise<ApplyResult>;
  private async handleCommand(payload: ApplyPayload): Promise<ApplyResult>;
}
```

#### 3.1 `handleCreate()`

**Always creates new file**, ignoring active editor:

```typescript
private async handleCreate(payload: ApplyPayload): Promise<ApplyResult> {
  const { code, language, target } = payload;

  if (target && vscode.workspace.workspaceFolders) {
    // Create at specified path
    const uri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders[0].uri,
      target
    );
    await vscode.workspace.fs.writeFile(uri, Buffer.from(code));
    await vscode.window.showTextDocument(uri);
  } else {
    // Create untitled with language hint
    const doc = await vscode.workspace.openTextDocument({
      content: code,
      language: language || "plaintext"
    });
    await vscode.window.showTextDocument(doc);
  }

  return { success: true, action: "created" };
}
```

#### 3.2 `handleCommand()`

**Sends to terminal**:

```typescript
private async handleCommand(payload: ApplyPayload): Promise<ApplyResult> {
  const terminal = vscode.window.activeTerminal
    || vscode.window.createTerminal("Mistral");

  terminal.show();
  terminal.sendText(payload.code.replace(/^[$>%]\s*/, ""), false);

  return { success: true, action: "sent_to_terminal" };
}
```

#### 3.3 `handleEdit()` with Fallback Chain

**Smart anchoring with graceful degradation**:

```typescript
private async handleEdit(payload: ApplyPayload): Promise<ApplyResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return this.handleCreate(payload); // Fallback to create
  }

  // Step 1: Validate target file matches (if specified)
  if (payload.target && !editor.document.uri.path.endsWith(payload.target)) {
    const action = await vscode.window.showWarningMessage(
      `Target file "${payload.target}" doesn't match active file. Apply anyway?`,
      "Apply Here", "Create New File", "Cancel"
    );
    if (action === "Create New File") return this.handleCreate(payload);
    if (action === "Cancel") return { success: false, action: "cancelled" };
  }

  // Step 2: Find insertion point via fallback chain
  const insertPosition = await this.resolveInsertPosition(
    editor.document,
    payload.anchor,
    editor.selection.active
  );

  // Step 3: Show diff preview
  return this.showDiffPreview(editor, insertPosition, payload.code);
}

private async resolveInsertPosition(
  document: vscode.TextDocument,
  anchor: string | undefined,
  cursorPosition: vscode.Position
): Promise<{ position: vscode.Position; method: string }> {

  if (anchor) {
    // Try 1: Exact LSP symbol match
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    );
    const exactMatch = this.findSymbol(symbols, anchor, "exact");
    if (exactMatch) {
      return { position: exactMatch.range.start, method: "exact_symbol" };
    }

    // Try 2: Fuzzy symbol match
    const fuzzyMatch = this.findSymbol(symbols, anchor, "fuzzy");
    if (fuzzyMatch) {
      vscode.window.showInformationMessage(
        `Matched "${anchor}" to "${fuzzyMatch.name}" (fuzzy)`
      );
      return { position: fuzzyMatch.range.start, method: "fuzzy_symbol" };
    }

    // Try 3: Text search for anchor string
    const textMatch = this.findTextMatch(document, anchor);
    if (textMatch) {
      return { position: textMatch, method: "text_search" };
    }

    // Fallback: Cursor position with warning
    vscode.window.showWarningMessage(
      `Could not find "${anchor}". Inserting at cursor position.`
    );
  }

  return { position: cursorPosition, method: "cursor_fallback" };
}
```

---

### Phase 4: Diff Preview System

**File**: `src/services/DiffPreviewService.ts`

Never modify buffers directly for edits. Show preview first:

```typescript
class DiffPreviewService {
  private pendingChanges: Map<string, PendingChange> = new Map();

  async showPreview(
    editor: vscode.TextEditor,
    position: vscode.Position,
    newCode: string
  ): Promise<ApplyResult> {
    const document = editor.document;
    const originalUri = document.uri;

    // Create virtual document with proposed changes
    const proposedContent = this.applyChange(document.getText(), position, newCode);
    const proposedUri = originalUri.with({ scheme: "mistral-preview" });

    // Store for accept/reject
    const changeId = crypto.randomUUID();
    this.pendingChanges.set(changeId, {
      originalUri,
      position,
      newCode,
      proposedContent
    });

    // Show diff view
    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUri,
      proposedUri,
      `Preview: ${path.basename(originalUri.fsPath)}`,
      { preview: true }
    );

    // Notify webview to show accept/reject buttons
    return {
      success: true,
      action: "preview_shown",
      changeId
    };
  }

  async acceptChange(changeId: string): Promise<void>;
  async rejectChange(changeId: string): Promise<void>;
}
```

**Alternative: Inline Ghost Text** (lighter weight for small insertions):

```typescript
private async showGhostText(
  editor: vscode.TextEditor,
  position: vscode.Position,
  code: string
): Promise<void> {
  const decoration = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: code,
      color: new vscode.ThemeColor("editorGhostText.foreground"),
      fontStyle: "italic"
    }
  });

  editor.setDecorations(decoration, [new vscode.Range(position, position)]);
  // Show accept/reject inline buttons via CodeLens
}
```

---

### Phase 5: UI Enhancements (Webview)

**Files**: `src/webview/src/components/CodeBlock.tsx`, `ChatMessage.tsx`

#### 5.1 Header Parsing

Extract file metadata from LLM output:

```typescript
function parseCodeBlockMeta(code: string, language: string): CodeBlockMeta {
  // Pattern: ```python:src/main.py or ### src/main.py
  const fileMatch = code.match(/^(?:###?\s*)?([^\s]+\.\w+)\n/)
    || language.match(/:(.+)$/);

  // Pattern: $ command or > command
  const isCommand = /^[$>%]\s/.test(code.trim());

  return {
    targetFile: fileMatch?.[1],
    isCommand,
    cleanCode: code.replace(/^(?:###?\s*)?[^\s]+\.\w+\n/, "")
  };
}
```

#### 5.2 Dynamic Button Labels

```tsx
function CodeBlock({ code, language, intent, onApply }: CodeBlockProps) {
  const buttonLabel = useMemo(() => {
    switch (intent) {
      case "create": return "Create File";
      case "command": return "Run in Terminal";
      case "edit": return "Preview & Merge";
      default: return "Apply";
    }
  }, [intent]);

  const buttonIcon = useMemo(() => {
    switch (intent) {
      case "create": return <FilePlus />;
      case "command": return <Terminal />;
      case "edit": return <GitMerge />;
      default: return <Play />;
    }
  }, [intent]);

  return (
    <div className="code-block">
      <div className="code-block-header">
        {targetFile && <span className="target-file">{targetFile}</span>}
        <span className="language-badge">{language}</span>
      </div>
      <pre><code>{code}</code></pre>
      <div className="code-block-actions">
        <Button onClick={onApply} icon={buttonIcon}>
          {buttonLabel}
        </Button>
        <Button onClick={onCopy} variant="secondary">Copy</Button>
      </div>
    </div>
  );
}
```

#### 5.3 Accept/Reject UI for Previews

```tsx
function DiffPreviewActions({ changeId, onAccept, onReject }: Props) {
  return (
    <div className="diff-actions">
      <Button onClick={() => onAccept(changeId)} variant="primary">
        Accept Changes
      </Button>
      <Button onClick={() => onReject(changeId)} variant="danger">
        Reject
      </Button>
    </div>
  );
}
```

---

### Phase 6: Configuration

**File**: `package.json` (contributes.configuration)

```json
{
  "mistral.apply.previewMode": {
    "type": "string",
    "enum": ["always", "edits_only", "never"],
    "default": "edits_only",
    "description": "When to show diff preview before applying code"
  },
  "mistral.apply.autoDetectIntent": {
    "type": "boolean",
    "default": true,
    "description": "Automatically classify code blocks as create/edit/command"
  },
  "mistral.apply.createFileLocation": {
    "type": "string",
    "enum": ["workspace_root", "current_folder", "ask"],
    "default": "ask",
    "description": "Where to create new files"
  },
  "mistral.apply.showFallbackWarnings": {
    "type": "boolean",
    "default": true,
    "description": "Show warnings when using cursor position as fallback"
  }
}
```

---

### Phase 7: Undo Integration

Wrap all operations for clean undo:

```typescript
async function applyWithUndo(
  editor: vscode.TextEditor,
  editCallback: (builder: vscode.TextEditorEdit) => void
): Promise<boolean> {
  return editor.edit(editCallback, {
    undoStopBefore: true,
    undoStopAfter: true
  });
}
```

---

## Verification Plan

### Automated Tests

| Test Suite | Coverage |
|------------|----------|
| `IntentDetector.test.ts` | All heuristics against 50+ LLM output samples |
| `SmartApplyService.test.ts` | Each handler with mock editors |
| `DiffPreviewService.test.ts` | Preview creation, accept, reject flows |
| `SymbolResolver.test.ts` | Exact match, fuzzy match, fallback chain |

### Manual Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| A: "Create a Python script for pi" | Opens new untitled file (ignores active editor) |
| B: "How do I install pandas?" | Shows "Run in Terminal" button, sends to terminal |
| C: "Add logging import" with cursor at bottom | Inserts at import section (LSP) or shows warning |
| D: "Refactor this function" | Shows diff preview, waits for accept/reject |
| E: Multi-file component generation | Creates all files in sequence |

### Integration Test

Full flow: webview button click → intent detection → service routing → preview → accept → applied code verified.

---

## Implementation Order

1. **IntentDetector** - Can test in isolation
2. **SmartApplyService** - Core routing logic
3. **Protocol upgrade** - Wire webview to new service
4. **DiffPreviewService** - Safety layer
5. **UI enhancements** - Button variants, preview actions
6. **Configuration** - User preferences
7. **Undo integration** - Polish

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/IntentDetector.ts` | CREATE |
| `src/services/SmartApplyService.ts` | CREATE |
| `src/services/DiffPreviewService.ts` | CREATE |
| `src/services/SymbolResolver.ts` | CREATE |
| `src/panels/MistralSidebarProvider.ts` | MODIFY (message handler) |
| `src/webview/src/App.tsx` | MODIFY (new message format) |
| `src/webview/src/components/CodeBlock.tsx` | MODIFY (dynamic buttons) |
| `src/webview/src/components/ChatMessage.tsx` | MODIFY (header parsing) |
| `package.json` | MODIFY (configuration schema) |
