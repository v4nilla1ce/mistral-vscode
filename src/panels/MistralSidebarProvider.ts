/**
 * Mistral Sidebar Provider
 *
 * Implements the WebviewViewProvider for the Mistral chat sidebar.
 * Manages the connection to the CLI server and bridges communication
 * between the webview and the RPC client.
 */

import * as vscode from "vscode";
import * as path from "path";
import { ConnectionState, MistralRpcClient, RpcEvents } from "../client/rpc";
import { SmartApplyService, ApplyPayload } from "../services";

/**
 * Messages sent from the webview to the extension.
 */
interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Provider for the Mistral chat sidebar webview.
 */
export class MistralSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mistral.chat";

  private _view?: vscode.WebviewView;
  private _client?: MistralRpcClient;
  private _smartApply: SmartApplyService;
  private _disposables: vscode.Disposable[] = [];
  private _fileWatchers = new Map<string, vscode.FileSystemWatcher>();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    this._smartApply = new SmartApplyService();
  }

  /**
   * Called when the webview is first created.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "dist"),
        vscode.Uri.joinPath(this._extensionUri, "src", "webview", "dist"),
      ],
    };

    // Set HTML content
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    this._disposables.push(
      webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
        this._handleWebviewMessage(message);
      })
    );

    // Handle webview visibility changes
    this._disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this._ensureConnected();
        }
      })
    );

    // Initialize connection
    this._initializeClient();
  }

  /**
   * Clean up resources.
   */
  public dispose(): void {
    this._client?.disconnect();
    this._smartApply.dispose();
    this._fileWatchers.forEach((watcher) => watcher.dispose());
    this._fileWatchers.clear();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  /**
   * Start a new chat session.
   */
  public newChat(): void {
    this._client?.clearContext(true, true);
    this._postMessage({ type: "clearChat" });
  }

  /**
   * Add a file to the context.
   */
  public async addFileToContext(filePath: string): Promise<void> {
    if (!this._client?.isConnected) {
      vscode.window.showWarningMessage("Mistral is not connected");
      return;
    }

    try {
      const result = await this._client.addContext(filePath);
      if (result.success) {
        // Set up file watcher
        this._watchFile(filePath);
        // Notify webview
        await this._updateContextList();
      } else {
        vscode.window.showWarningMessage(result.message);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add file: ${error}`);
    }
  }

  /**
   * Clear all context files.
   */
  public async clearContext(): Promise<void> {
    if (!this._client?.isConnected) {
      return;
    }

    try {
      await this._client.clearContext(true, false);
      this._fileWatchers.forEach((w) => w.dispose());
      this._fileWatchers.clear();
      await this._updateContextList();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear context: ${error}`);
    }
  }

  /**
   * Handle configuration changes.
   */
  public onConfigurationChanged(): void {
    const config = vscode.workspace.getConfiguration("mistral");
    const model = config.get<string>("model", "mistral-small");

    this._client?.setModel(model);
    this._postMessage({ type: "configChanged", model });
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  private async _initializeClient(): Promise<void> {
    const config = vscode.workspace.getConfiguration("mistral");
    const cliPath = config.get<string>("cliPath") || "mistral";

    this._client = new MistralRpcClient({ cliPath });

    // Set up event listeners
    this._setupClientEvents();

    // Connect
    await this._ensureConnected();
  }

  private _setupClientEvents(): void {
    if (!this._client) {
      return;
    }

    // Connection state changes
    this._client.on("stateChange", (state: ConnectionState) => {
      this._postMessage({ type: "connectionState", state });
    });

    this._client.on("reconnecting", (info: { attempt: number; delay: number }) => {
      this._postMessage({
        type: "reconnecting",
        attempt: info.attempt,
        delay: info.delay,
      });
    });

    this._client.on("reconnected", () => {
      this._postMessage({ type: "reconnected" });
      vscode.window.showInformationMessage("Reconnected to Mistral");
    });

    this._client.on("reconnectFailed", () => {
      this._postMessage({ type: "reconnectFailed" });
      vscode.window.showErrorMessage(
        "Failed to reconnect to Mistral. Please restart VS Code."
      );
    });

    // Content streaming
    this._client.on("content.delta", (params: RpcEvents["content.delta"]) => {
      this._postMessage({ type: "contentDelta", text: params.text });
    });

    this._client.on("content.done", (params: RpcEvents["content.done"]) => {
      this._postMessage({ type: "contentDone", fullText: params.full_text });
    });

    // Agent events
    this._client.on("thinking.update", (params: RpcEvents["thinking.update"]) => {
      this._postMessage({ type: "thinkingUpdate", thought: params.thought });
    });

    this._client.on("tool.pending", (params: RpcEvents["tool.pending"]) => {
      this._postMessage({
        type: "toolPending",
        toolCallId: params.tool_call_id,
        tool: params.tool,
        arguments: params.arguments,
      });
    });

    this._client.on("tool.result", (params: RpcEvents["tool.result"]) => {
      this._postMessage({
        type: "toolResult",
        toolCallId: params.tool_call_id,
        success: params.success,
        output: params.output,
      });
    });

    // Token usage
    this._client.on("token.usage", (params: RpcEvents["token.usage"]) => {
      this._postMessage({
        type: "tokenUsage",
        prompt: params.prompt,
        completion: params.completion,
        total: params.total,
      });
    });

    // Errors
    this._client.on("error", (params: RpcEvents["error"]) => {
      this._postMessage({ type: "error", code: params.code, message: params.message });
    });
  }

  private async _ensureConnected(): Promise<void> {
    if (this._client?.isConnected) {
      return;
    }

    try {
      await this._client?.connect();
      this._postMessage({ type: "connected" });

      // Set initial model
      const config = vscode.workspace.getConfiguration("mistral");
      const model = config.get<string>("model", "mistral-small");
      await this._client?.setModel(model);
    } catch (error) {
      console.error("Failed to connect to Mistral:", error);
      this._postMessage({ type: "connectionError", error: String(error) });
    }
  }

  private async _handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this._ensureConnected();
        break;

      case "sendMessage":
        await this._handleSendMessage(message.text as string, message.useAgent as boolean);
        break;

      case "confirmTool":
        await this._client?.agentConfirm(
          message.toolCallId as string,
          message.approved as boolean
        );
        break;

      case "cancelAgent":
        await this._client?.agentCancel();
        break;

      case "addFile":
        await this.addFileToContext(message.filePath as string);
        break;

      case "removeFile":
        await this._removeFileFromContext(message.filePath as string);
        break;

      case "applyCode":
        // Legacy support: convert to new format
        await this._handleApplyUpdate({
          code: message.code as string,
          language: message.language as string || "plaintext",
          intent: "edit", // Default to edit for backward compatibility
        });
        break;

      case "applyUpdate":
        await this._handleApplyUpdate(message.payload as ApplyPayload | ApplyPayload[]);
        break;

      case "acceptChange":
        await this._smartApply.acceptChange(message.changeId as string);
        break;

      case "rejectChange":
        await this._smartApply.rejectChange(message.changeId as string);
        break;

      case "copyCode":
        await vscode.env.clipboard.writeText(message.code as string);
        vscode.window.showInformationMessage("Code copied to clipboard");
        break;

      case "openSettings":
        vscode.commands.executeCommand("mistral.settings");
        break;
    }
  }

  private async _handleSendMessage(text: string, useAgent: boolean): Promise<void> {
    if (!this._client?.isConnected) {
      this._postMessage({ type: "error", message: "Not connected to Mistral" });
      return;
    }

    try {
      // Get context files
      const contextResult = await this._client.listContext();
      const contextFiles = contextResult.files.map((f) => f.path);

      if (useAgent) {
        await this._client.agentRun(text, contextFiles);
      } else {
        await this._client.chat(text, contextFiles);
      }
    } catch (error) {
      this._postMessage({ type: "error", message: String(error) });
    }
  }

  private async _removeFileFromContext(filePath: string): Promise<void> {
    if (!this._client?.isConnected) {
      return;
    }

    try {
      await this._client.removeContext(filePath);

      // Remove file watcher
      const watcher = this._fileWatchers.get(filePath);
      if (watcher) {
        watcher.dispose();
        this._fileWatchers.delete(filePath);
      }

      await this._updateContextList();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to remove file: ${error}`);
    }
  }

  private async _updateContextList(): Promise<void> {
    if (!this._client?.isConnected) {
      return;
    }

    const result = await this._client.listContext();
    this._postMessage({
      type: "contextUpdated",
      files: result.files,
      totalTokens: result.total_tokens,
    });
  }

  private _watchFile(filePath: string): void {
    if (this._fileWatchers.has(filePath)) {
      return;
    }

    const watcher = vscode.workspace.createFileSystemWatcher(filePath);

    watcher.onDidChange(() => {
      this._postMessage({
        type: "fileChanged",
        filePath,
      });
    });

    watcher.onDidDelete(() => {
      this._removeFileFromContext(filePath);
    });

    this._fileWatchers.set(filePath, watcher);
  }

  /**
   * Handle the new applyUpdate message with smart code application.
   */
  private async _handleApplyUpdate(payload: ApplyPayload | ApplyPayload[]): Promise<void> {
    try {
      const result = await this._smartApply.apply(payload);

      // Notify webview of the result
      this._postMessage({
        type: "applyResult",
        success: result.success,
        action: result.action,
        message: result.message,
        changeId: result.changeId,
      });

      // Show appropriate message based on action
      if (result.success) {
        switch (result.action) {
          case "created":
            vscode.window.showInformationMessage(result.message || "File created");
            break;
          case "sent_to_terminal":
            vscode.window.showInformationMessage(result.message || "Command sent to terminal");
            break;
          case "preview_shown":
            // Preview is shown, user will accept/reject
            break;
          case "edited":
            vscode.window.showInformationMessage(result.message || "Code applied");
            break;
        }
      } else if (result.action !== "cancelled") {
        vscode.window.showErrorMessage(result.message || "Failed to apply code");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply code: ${error}`);
      this._postMessage({
        type: "applyResult",
        success: false,
        action: "error",
        message: String(error),
      });
    }
  }

  private _postMessage(message: Record<string, unknown>): void {
    this._view?.webview.postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Check if built webview exists
    const webviewDistPath = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "webview",
      "dist"
    );

    // Try to load built React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDistPath, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDistPath, "assets", "index.css")
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Mistral AI</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/**
 * Generate a nonce for Content Security Policy.
 */
function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
