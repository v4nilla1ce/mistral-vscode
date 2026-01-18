/**
 * Mistral VS Code Extension
 *
 * Main entry point for the extension. Handles activation, command registration,
 * and lifecycle management.
 */

import * as vscode from "vscode";
import { MistralSidebarProvider } from "./panels/MistralSidebarProvider";

let sidebarProvider: MistralSidebarProvider | undefined;

/**
 * Activates the extension.
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log("Mistral AI extension is activating...");

  // Check for CLI availability
  const cliAvailable = await checkCliAvailability();
  if (!cliAvailable) {
    const action = await vscode.window.showErrorMessage(
      "Mistral CLI not found. The extension requires mistral-cli to be installed.",
      "Install Instructions",
      "Configure Path"
    );

    if (action === "Install Instructions") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://github.com/mistral-ai/mistral-cli#installation")
      );
    } else if (action === "Configure Path") {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "mistral.cliPath"
      );
    }
    // Continue activation anyway - user might configure later
  }

  // Create sidebar provider
  sidebarProvider = new MistralSidebarProvider(context.extensionUri, context);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MistralSidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("mistral.newChat", () => {
      sidebarProvider?.newChat();
    }),

    vscode.commands.registerCommand("mistral.addContext", async (uri?: vscode.Uri) => {
      let filePath: string | undefined;

      if (uri) {
        // Called from context menu with URI
        filePath = uri.fsPath;
      } else {
        // Called from command palette - use active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          filePath = activeEditor.document.uri.fsPath;
        } else {
          // Prompt user to select a file
          const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Add to Context",
          });
          if (files && files.length > 0) {
            filePath = files[0].fsPath;
          }
        }
      }

      if (filePath) {
        sidebarProvider?.addFileToContext(filePath);
      }
    }),

    vscode.commands.registerCommand("mistral.clearContext", () => {
      sidebarProvider?.clearContext();
    }),

    vscode.commands.registerCommand("mistral.settings", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:mistral-ai.mistral-vscode"
      );
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("mistral")) {
        sidebarProvider?.onConfigurationChanged();
      }
    })
  );

  console.log("Mistral AI extension activated successfully");
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
  sidebarProvider?.dispose();
  sidebarProvider = undefined;
  console.log("Mistral AI extension deactivated");
}

/**
 * Check if the Mistral CLI is available.
 */
async function checkCliAvailability(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("mistral");
  const configuredPath = config.get<string>("cliPath");

  const command = configuredPath || "mistral";

  return new Promise((resolve) => {
    const { exec } = require("child_process");
    exec(`${command} --version`, (error: Error | null) => {
      resolve(!error);
    });
  });
}
