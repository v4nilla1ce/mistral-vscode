/**
 * Smart Apply Service
 *
 * Central orchestrator for context-aware code application.
 * Routes code to the appropriate handler based on detected intent.
 */

import * as vscode from "vscode";
import * as path from "path";
import { IntentDetector, DetectedIntent } from "./IntentDetector";
import { SymbolResolver, ResolvedPosition } from "./SymbolResolver";
import { DiffPreviewService, PreviewResult } from "./DiffPreviewService";

/**
 * Payload for applying code from the webview.
 */
export interface ApplyPayload {
  code: string;
  language: string;
  intent: "create" | "edit" | "command";
  target?: string; // Filename or path hint
  anchor?: string; // Function/class name or context line
}

/**
 * Result of applying code.
 */
export interface ApplyResult {
  success: boolean;
  action:
    | "created"
    | "edited"
    | "sent_to_terminal"
    | "preview_shown"
    | "cancelled"
    | "error";
  message?: string;
  changeId?: string;
}

/**
 * Configuration options for SmartApplyService.
 */
export interface SmartApplyConfig {
  previewMode: "always" | "edits_only" | "never";
  autoDetectIntent: boolean;
  createFileLocation: "workspace_root" | "current_folder" | "ask";
  showFallbackWarnings: boolean;
}

/**
 * SmartApplyService handles intelligent code application.
 */
export class SmartApplyService implements vscode.Disposable {
  private intentDetector: IntentDetector;
  private symbolResolver: SymbolResolver;
  private diffPreview: DiffPreviewService;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.intentDetector = new IntentDetector();
    this.symbolResolver = new SymbolResolver();
    this.diffPreview = new DiffPreviewService();
  }

  /**
   * Get current configuration.
   */
  private getConfig(): SmartApplyConfig {
    const config = vscode.workspace.getConfiguration("mistral.apply");
    return {
      previewMode: config.get<"always" | "edits_only" | "never">("previewMode", "edits_only"),
      autoDetectIntent: config.get<boolean>("autoDetectIntent", true),
      createFileLocation: config.get<"workspace_root" | "current_folder" | "ask">(
        "createFileLocation",
        "ask"
      ),
      showFallbackWarnings: config.get<boolean>("showFallbackWarnings", true),
    };
  }

  /**
   * Main entry point: apply code with the given payload.
   * Supports both single and multi-file operations.
   */
  public async apply(payload: ApplyPayload | ApplyPayload[]): Promise<ApplyResult> {
    // Handle array of payloads (multi-file)
    if (Array.isArray(payload)) {
      for (const p of payload) {
        const result = await this.applySingle(p);
        if (!result.success) {
          return result;
        }
      }
      return { success: true, action: "created", message: `Applied ${payload.length} files` };
    }

    return this.applySingle(payload);
  }

  /**
   * Apply a single code payload.
   */
  private async applySingle(payload: ApplyPayload): Promise<ApplyResult> {
    const config = this.getConfig();

    // Auto-detect intent if enabled and not explicitly set
    let intent = payload.intent;
    if (config.autoDetectIntent) {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      const detected = this.intentDetector.detect(payload.code, payload.language, activeFile);

      // Use detected values if confidence is high enough
      if (detected.confidence > 0.6) {
        intent = detected.intent;
        if (detected.target && !payload.target) {
          payload.target = detected.target;
        }
        if (detected.anchor && !payload.anchor) {
          payload.anchor = detected.anchor;
        }
      }
    }

    // Route to appropriate handler
    switch (intent) {
      case "create":
        return this.handleCreate(payload);
      case "command":
        return this.handleCommand(payload);
      case "edit":
        return this.handleEdit(payload, config);
      default:
        return this.handleEdit(payload, config);
    }
  }

  /**
   * Handle file creation intent.
   * Always creates a new file, ignoring the active editor.
   */
  private async handleCreate(payload: ApplyPayload): Promise<ApplyResult> {
    const config = this.getConfig();
    const { code, language, target } = payload;

    // Clean the code (remove file header if present)
    const cleanedCode = this.cleanCodeForFile(code);

    if (target && vscode.workspace.workspaceFolders) {
      // Create at specified path
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;

      // Determine the base path
      let basePath: vscode.Uri;
      if (config.createFileLocation === "current_folder") {
        const activeFile = vscode.window.activeTextEditor?.document.uri;
        basePath = activeFile
          ? vscode.Uri.joinPath(activeFile, "..")
          : workspaceRoot;
      } else if (config.createFileLocation === "ask") {
        const choice = await vscode.window.showQuickPick(
          [
            { label: "Workspace Root", value: "workspace" },
            { label: "Current Folder", value: "current" },
            { label: "Choose Location...", value: "choose" },
          ],
          { placeHolder: `Where to create ${target}?` }
        );

        if (!choice) {
          return { success: false, action: "cancelled" };
        }

        if (choice.value === "current") {
          const activeFile = vscode.window.activeTextEditor?.document.uri;
          basePath = activeFile
            ? vscode.Uri.joinPath(activeFile, "..")
            : workspaceRoot;
        } else if (choice.value === "choose") {
          const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: workspaceRoot,
            openLabel: "Select Folder",
          });
          if (!folders || folders.length === 0) {
            return { success: false, action: "cancelled" };
          }
          basePath = folders[0];
        } else {
          basePath = workspaceRoot;
        }
      } else {
        basePath = workspaceRoot;
      }

      const targetUri = vscode.Uri.joinPath(basePath, target);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(targetUri);
        const overwrite = await vscode.window.showWarningMessage(
          `File "${target}" already exists. Overwrite?`,
          "Overwrite",
          "Cancel"
        );
        if (overwrite !== "Overwrite") {
          return { success: false, action: "cancelled" };
        }
      } catch {
        // File doesn't exist, good to create
      }

      // Create parent directories if needed
      const parentDir = vscode.Uri.joinPath(targetUri, "..");
      try {
        await vscode.workspace.fs.createDirectory(parentDir);
      } catch {
        // Directory might already exist
      }

      // Write the file
      await vscode.workspace.fs.writeFile(targetUri, Buffer.from(cleanedCode));
      const doc = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(doc);

      return {
        success: true,
        action: "created",
        message: `Created ${target}`,
      };
    } else {
      // Create untitled with language hint
      const doc = await vscode.workspace.openTextDocument({
        content: cleanedCode,
        language: this.normalizeLanguage(language),
      });
      await vscode.window.showTextDocument(doc);

      return {
        success: true,
        action: "created",
        message: "Created new file",
      };
    }
  }

  /**
   * Handle shell command intent.
   * Sends the command to the terminal.
   */
  private async handleCommand(payload: ApplyPayload): Promise<ApplyResult> {
    // Clean the command (remove prompt characters)
    const cleanedCommand = payload.code
      .trim()
      .replace(/^[$>%]\s*/, "")
      .trim();

    // Get or create terminal
    const terminal =
      vscode.window.activeTerminal || vscode.window.createTerminal("Mistral");

    terminal.show();
    terminal.sendText(cleanedCommand, false); // Don't auto-execute

    return {
      success: true,
      action: "sent_to_terminal",
      message: "Command sent to terminal (press Enter to run)",
    };
  }

  /**
   * Handle edit intent.
   * Validates target, finds anchor, and applies changes.
   */
  private async handleEdit(
    payload: ApplyPayload,
    config: SmartApplyConfig
  ): Promise<ApplyResult> {
    const editor = vscode.window.activeTextEditor;

    // No editor - fall back to create
    if (!editor) {
      return this.handleCreate(payload);
    }

    // Validate target file matches (if specified)
    if (payload.target) {
      const activeFileName = path.basename(editor.document.uri.fsPath);
      const targetFileName = path.basename(payload.target);

      if (activeFileName !== targetFileName) {
        const action = await vscode.window.showWarningMessage(
          `Target file "${payload.target}" doesn't match active file "${activeFileName}". Apply anyway?`,
          "Apply Here",
          "Create New File",
          "Cancel"
        );

        if (action === "Create New File") {
          return this.handleCreate(payload);
        }
        if (action === "Cancel" || !action) {
          return { success: false, action: "cancelled" };
        }
        // "Apply Here" - continue with current editor
      }
    }

    // Find insertion position
    const resolved = await this.symbolResolver.resolveAnchor(
      editor.document,
      payload.anchor,
      editor.selection.active
    );

    // Show warning if using fallback
    if (config.showFallbackWarnings && resolved.method === "cursor_fallback" && payload.anchor) {
      vscode.window.showWarningMessage(
        `Could not find "${payload.anchor}". Inserting at cursor position.`
      );
    } else if (resolved.method === "fuzzy_symbol" && resolved.symbolName) {
      vscode.window.showInformationMessage(
        `Matched to "${resolved.symbolName}" (fuzzy match)`
      );
    }

    // Determine if we should show preview
    const shouldPreview =
      config.previewMode === "always" ||
      (config.previewMode === "edits_only" && payload.intent === "edit");

    if (shouldPreview) {
      // Show diff preview
      const previewResult = await this.diffPreview.showPreview(
        editor,
        resolved.position,
        payload.code,
        resolved.range
      );

      if (previewResult.success) {
        return {
          success: true,
          action: "preview_shown",
          changeId: previewResult.changeId,
        };
      } else {
        return {
          success: false,
          action: "error",
          message: previewResult.error,
        };
      }
    } else {
      // Apply directly
      const success = await editor.edit(
        (editBuilder) => {
          if (resolved.range) {
            editBuilder.replace(resolved.range, payload.code);
          } else {
            editBuilder.insert(resolved.position, payload.code);
          }
        },
        {
          undoStopBefore: true,
          undoStopAfter: true,
        }
      );

      return {
        success,
        action: success ? "edited" : "error",
        message: success ? "Code applied" : "Failed to apply code",
      };
    }
  }

  /**
   * Accept a pending preview change.
   */
  public async acceptChange(changeId: string): Promise<boolean> {
    return this.diffPreview.acceptChange(changeId);
  }

  /**
   * Reject a pending preview change.
   */
  public async rejectChange(changeId: string): Promise<void> {
    return this.diffPreview.rejectChange(changeId);
  }

  /**
   * Detect intent for a code block (for pre-classification in webview).
   */
  public detectIntent(
    code: string,
    language: string,
    activeFile?: string
  ): DetectedIntent {
    return this.intentDetector.detect(code, language, activeFile);
  }

  /**
   * Clean code by removing file path headers.
   */
  private cleanCodeForFile(code: string): string {
    const lines = code.split("\n");
    const firstLine = lines[0];

    // Remove file path comments at the top
    const fileHeaderPatterns = [
      /^\/\/\s*[^\s]+\.\w+\s*$/,           // // path/file.ext
      /^#\s*[^\s]+\.\w+\s*$/,              // # path/file.ext
      /^\/\*\s*[^\s]+\.\w+\s*\*\/\s*$/,    // /* path/file.ext */
      /^<!--\s*[^\s]+\.\w+\s*-->\s*$/,     // <!-- path/file.html -->
      /^#{1,3}\s+[^\s]+\.\w+\s*$/,         // ### filename.py
    ];

    for (const pattern of fileHeaderPatterns) {
      if (pattern.test(firstLine)) {
        return lines.slice(1).join("\n").trimStart();
      }
    }

    return code;
  }

  /**
   * Normalize language string for VS Code.
   */
  private normalizeLanguage(language: string): string {
    // Handle language:path format
    const langOnly = language.split(":")[0];

    // Map common variations
    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      rb: "ruby",
      rs: "rust",
      sh: "shellscript",
      bash: "shellscript",
      zsh: "shellscript",
      yml: "yaml",
      md: "markdown",
    };

    return languageMap[langOnly.toLowerCase()] || langOnly || "plaintext";
  }

  /**
   * Dispose of resources.
   */
  public dispose(): void {
    this.diffPreview.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
