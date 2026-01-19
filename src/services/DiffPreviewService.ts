/**
 * Diff Preview Service
 *
 * Manages preview of code changes before applying them.
 * Shows diff views and handles accept/reject flow.
 */

import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";

/**
 * Pending change waiting for user confirmation.
 */
interface PendingChange {
  id: string;
  originalUri: vscode.Uri;
  position: vscode.Position;
  range?: vscode.Range;
  newCode: string;
  proposedContent: string;
  createdAt: number;
}

/**
 * Result of showing a preview.
 */
export interface PreviewResult {
  success: boolean;
  action: "preview_shown" | "applied_directly" | "error";
  changeId?: string;
  error?: string;
}

/**
 * DiffPreviewService manages code change previews and confirmations.
 */
export class DiffPreviewService implements vscode.Disposable {
  private pendingChanges = new Map<string, PendingChange>();
  private previewScheme = "mistral-preview";
  private contentProvider: vscode.TextDocumentContentProvider;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Register content provider for preview documents
    this.contentProvider = {
      provideTextDocumentContent: (uri: vscode.Uri) => {
        const changeId = uri.query;
        const change = this.pendingChanges.get(changeId);
        return change?.proposedContent || "";
      },
    };

    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider(
        this.previewScheme,
        this.contentProvider
      )
    );

    // Clean up old pending changes periodically (older than 10 minutes)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      for (const [id, change] of this.pendingChanges) {
        if (now - change.createdAt > maxAge) {
          this.pendingChanges.delete(id);
        }
      }
    }, 60 * 1000);

    this.disposables.push({ dispose: () => clearInterval(cleanupInterval) });
  }

  /**
   * Show a diff preview for proposed changes.
   */
  public async showPreview(
    editor: vscode.TextEditor,
    position: vscode.Position,
    newCode: string,
    range?: vscode.Range
  ): Promise<PreviewResult> {
    try {
      const document = editor.document;
      const originalUri = document.uri;

      // Generate proposed content
      const proposedContent = this.generateProposedContent(
        document.getText(),
        position,
        newCode,
        range
      );

      // Create change record
      const changeId = crypto.randomUUID();
      const pendingChange: PendingChange = {
        id: changeId,
        originalUri,
        position,
        range,
        newCode,
        proposedContent,
        createdAt: Date.now(),
      };

      this.pendingChanges.set(changeId, pendingChange);

      // Create preview URI
      const previewUri = vscode.Uri.parse(
        `${this.previewScheme}:${path.basename(originalUri.fsPath)}?${changeId}`
      );

      // Show diff view
      await vscode.commands.executeCommand(
        "vscode.diff",
        originalUri,
        previewUri,
        `Preview Changes: ${path.basename(originalUri.fsPath)}`,
        { preview: true }
      );

      return {
        success: true,
        action: "preview_shown",
        changeId,
      };
    } catch (error) {
      return {
        success: false,
        action: "error",
        error: String(error),
      };
    }
  }

  /**
   * Show inline ghost text preview for small changes.
   */
  public async showGhostText(
    editor: vscode.TextEditor,
    position: vscode.Position,
    code: string
  ): Promise<{ changeId: string; decoration: vscode.TextEditorDecorationType }> {
    const changeId = crypto.randomUUID();

    // Store pending change
    this.pendingChanges.set(changeId, {
      id: changeId,
      originalUri: editor.document.uri,
      position,
      newCode: code,
      proposedContent: "", // Not needed for ghost text
      createdAt: Date.now(),
    });

    // Create ghost text decoration
    const decoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: code.split("\n")[0] + (code.includes("\n") ? "..." : ""),
        color: new vscode.ThemeColor("editorGhostText.foreground"),
        fontStyle: "italic",
        margin: "0 0 0 1em",
      },
    });

    // Apply decoration
    editor.setDecorations(decoration, [new vscode.Range(position, position)]);

    return { changeId, decoration };
  }

  /**
   * Accept a pending change and apply it.
   */
  public async acceptChange(changeId: string): Promise<boolean> {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      vscode.window.showWarningMessage("Change not found or expired.");
      return false;
    }

    try {
      // Find the editor for this document
      let editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === change.originalUri.toString()
      );

      // If not visible, open it
      if (!editor) {
        const document = await vscode.workspace.openTextDocument(change.originalUri);
        editor = await vscode.window.showTextDocument(document);
      }

      // Apply the change with undo support
      const success = await this.applyChange(editor, change);

      if (success) {
        this.pendingChanges.delete(changeId);
        // Close the diff view
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        vscode.window.showInformationMessage("Changes applied successfully.");
      }

      return success;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
      return false;
    }
  }

  /**
   * Reject a pending change.
   */
  public async rejectChange(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId);
    if (change) {
      this.pendingChanges.delete(changeId);
      // Close the diff view
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      vscode.window.showInformationMessage("Changes rejected.");
    }
  }

  /**
   * Get a pending change by ID.
   */
  public getPendingChange(changeId: string): PendingChange | undefined {
    return this.pendingChanges.get(changeId);
  }

  /**
   * Check if there are any pending changes.
   */
  public hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  /**
   * Clear all pending changes.
   */
  public clearPendingChanges(): void {
    this.pendingChanges.clear();
  }

  /**
   * Generate the proposed content with changes applied.
   */
  private generateProposedContent(
    originalText: string,
    position: vscode.Position,
    newCode: string,
    range?: vscode.Range
  ): string {
    const lines = originalText.split("\n");

    if (range) {
      // Replace the range
      const beforeLines = lines.slice(0, range.start.line);
      const afterLines = lines.slice(range.end.line + 1);

      // Handle partial line replacements
      const startLinePrefix = lines[range.start.line].substring(0, range.start.character);
      const endLineSuffix = lines[range.end.line].substring(range.end.character);

      const newLines = newCode.split("\n");
      if (newLines.length === 1) {
        // Single line replacement
        return [
          ...beforeLines,
          startLinePrefix + newCode + endLineSuffix,
          ...afterLines,
        ].join("\n");
      } else {
        // Multi-line replacement
        newLines[0] = startLinePrefix + newLines[0];
        newLines[newLines.length - 1] = newLines[newLines.length - 1] + endLineSuffix;
        return [...beforeLines, ...newLines, ...afterLines].join("\n");
      }
    } else {
      // Insert at position
      const line = position.line;
      const char = position.character;

      if (line >= lines.length) {
        // Append to end
        return originalText + "\n" + newCode;
      }

      const currentLine = lines[line];
      const beforeChar = currentLine.substring(0, char);
      const afterChar = currentLine.substring(char);

      lines[line] = beforeChar + newCode + afterChar;
      return lines.join("\n");
    }
  }

  /**
   * Apply the change to the editor with undo support.
   */
  private async applyChange(
    editor: vscode.TextEditor,
    change: PendingChange
  ): Promise<boolean> {
    return editor.edit(
      (editBuilder) => {
        if (change.range) {
          editBuilder.replace(change.range, change.newCode);
        } else {
          editBuilder.insert(change.position, change.newCode);
        }
      },
      {
        undoStopBefore: true,
        undoStopAfter: true,
      }
    );
  }

  /**
   * Dispose of resources.
   */
  public dispose(): void {
    this.pendingChanges.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
