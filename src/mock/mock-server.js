#!/usr/bin/env node
/**
 * Mock Mistral CLI Server
 *
 * Implements JSON-RPC protocol for UI testing without a real AI backend.
 * Reads requests from stdin, writes responses to stdout.
 *
 * Usage:
 *   node mock-server.js server
 *
 * Set in VS Code settings:
 *   "mistral.cliPath": "node d:/Projects/mistral-ai/mistral-vscode/src/mock/mock-server.js"
 */

const readline = require("readline");

// Request ID counter for notifications
let notificationId = 0;

// Pending tool confirmations
const pendingTools = new Map();

/**
 * Send JSON-RPC response to stdout.
 */
function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: "2.0",
    id,
  };

  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  console.log(JSON.stringify(response));
}

/**
 * Send JSON-RPC notification to stdout.
 */
function sendNotification(method, params) {
  const notification = {
    jsonrpc: "2.0",
    method,
    params,
  };
  console.log(JSON.stringify(notification));
}

/**
 * Simulate streaming response with delays.
 */
async function streamResponse(text, delayMs = 50) {
  const words = text.split(" ");
  let accumulated = "";

  for (const word of words) {
    accumulated += (accumulated ? " " : "") + word;
    sendNotification("content.delta", { text: word + " " });
    await sleep(delayMs);
  }

  sendNotification("content.done", { full_text: accumulated });
  return accumulated;
}

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate mock response based on message content.
 */
function generateMockResponse(message) {
  const lower = message.toLowerCase();

  // Try to extract filename from message - multiple patterns
  let requestedFilename = null;

  // Pattern 1: "called X.ext" or "named X.ext" or "file X.ext"
  const pattern1 = message.match(/(?:called|named|file)\s+['"]?(\S+\.(?:tsx|jsx|py|ts|js))['"]?/i);
  if (pattern1) requestedFilename = pattern1[1];

  // Pattern 2: Direct filename mention like "create app.tsx" or "make utils.ts"
  if (!requestedFilename) {
    const pattern2 = message.match(/\b([a-zA-Z0-9_\-]+\.(?:tsx|jsx|py|ts|js))\b/i);
    if (pattern2) requestedFilename = pattern2[1];
  }

  // Check for command keywords FIRST (highest priority for install/npm/yarn/etc)
  // This catches "install python dependencies", "npm install", "yarn add", etc.
  const hasCommandKeyword = lower.includes("install") || lower.includes("npm") || lower.includes("yarn") || lower.includes("terminal") || lower.includes("pip ");
  const hasExplicitPyFile = /\.\s*py\b/.test(lower); // explicit .py extension
  const isCreateIntent = lower.includes("create") || lower.includes("make") || lower.includes("generate");

  // Command intent - check first unless there's an explicit .py file or a create intent
  if (hasCommandKeyword && !hasExplicitPyFile && !isCreateIntent) {
    return `To install the dependencies, run:

\`\`\`bash
npm install express typescript @types/node
\`\`\`

This will add Express and TypeScript to your project. Click "Run in Terminal" to execute.`;
  }

  // Python - check for explicit .py file or "python" word (but not "install python")
  if (hasExplicitPyFile || (lower.includes("python") && !hasCommandKeyword)) {
    const filename = requestedFilename || "main.py";
    return `Here's your Python file:

\`\`\`python
# ${filename}
from typing import List, Dict

def analyze_data(items: List[str]) -> Dict[str, int]:
    """Analyze frequency of items."""
    result = {}
    for item in items:
        result[item] = result.get(item, 0) + 1
    return result

def main():
    data = ["apple", "banana", "apple", "cherry"]
    print(analyze_data(data))

if __name__ == "__main__":
    main()
\`\`\`

Click "Create File" to save this as \`${filename}\`.`;
  }

  // Command intent (run, but not with "create" taking priority)
  if (lower.includes("run") && !lower.includes("create")) {
    return `To install the dependencies, run:

\`\`\`bash
npm install express typescript @types/node
\`\`\`

This will add Express and TypeScript to your project. Click "Run in Terminal" to execute.`;
  }

  // Edit intent (small snippet) - check before general create
  if (lower.includes("refactor") || (lower.includes("update") && lower.includes("function"))) {
    return `Here's the updated function:

\`\`\`typescript
function processData(input: string[]): Record<string, number> {
  return input.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
\`\`\`

Click "Preview & Apply" to see the changes before applying.`;
  }

  // Create TypeScript file intent (general) - acts as default create handler
  if (lower.includes("create") || lower.includes("new file") || lower.includes("typescript") || lower.includes(".ts") || lower.includes("make") || lower.includes("generate") || lower.includes(".js")) {
    const filename = requestedFilename || "src/utils/helper.ts";
    return `Here's a new TypeScript utility file:

\`\`\`typescript
// ${filename}
/**
 * Helper utilities for the application.
 */

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}
\`\`\`

This file includes common utility functions. Click "Create File" to save it as \`${filename}\`.`;
  }

  // Add function intent
  if (lower.includes("function") || lower.includes("add")) {
    return `Here's the function:

\`\`\`typescript
function processData(input: string[]): Record<string, number> {
  return input.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
\`\`\`

Click "Preview & Apply" to see the changes before applying.`;
  }

  // Default response
  return `I understand you're asking about: "${message}"

Here's a code example:

\`\`\`javascript
// Example code
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

You can apply this code using the buttons above the code block.`;
}

/**
 * Handle RPC method calls.
 */
async function handleMethod(id, method, params) {
  switch (method) {
    case "initialize":
      sendResponse(id, {
        capabilities: {
          streaming: true,
          tools: true,
          context: true,
        },
        version: "1.0.0-mock",
      });
      break;

    case "chat":
      const chatMessage = params.message || "";
      const response = generateMockResponse(chatMessage);

      // Simulate streaming
      await streamResponse(response, 5); // Fast for testing

      // Send final response
      sendResponse(id, { content: response });

      // Send token usage
      sendNotification("token.usage", {
        prompt: chatMessage.length * 2,
        completion: response.length,
        total: chatMessage.length * 2 + response.length,
      });
      break;

    case "agent.run":
      const task = params.task || "";
      const autoConfirm = params.auto_confirm || false;

      // First, stream some thinking
      await streamResponse("Analyzing your request...", 50);
      await sleep(200);

      // Simulate a tool call
      const toolCallId = `tool_${Date.now()}`;

      if (task.toLowerCase().includes("file")) {
        // File operation tool
        pendingTools.set(toolCallId, {
          tool: "write_file",
          arguments: {
            path: "src/example.ts",
            content: "// New file content\nexport const value = 42;",
          },
        });

        sendNotification("tool.pending", {
          tool_call_id: toolCallId,
          tool: "write_file",
          arguments: {
            path: "src/example.ts",
            content: "// New file content\nexport const value = 42;",
          },
        });

        if (autoConfirm) {
          await sleep(100);
          await handleToolConfirm(toolCallId, true);
          sendResponse(id, { content: "File created successfully." });
        }
        // Otherwise wait for agent.confirm
      } else {
        // Shell command tool
        pendingTools.set(toolCallId, {
          tool: "run_command",
          arguments: {
            command: "npm test",
          },
        });

        sendNotification("tool.pending", {
          tool_call_id: toolCallId,
          tool: "run_command",
          arguments: {
            command: "npm test",
          },
        });

        if (autoConfirm) {
          await sleep(100);
          await handleToolConfirm(toolCallId, true);
          sendResponse(id, { content: "Command executed successfully." });
        }
      }

      // If not auto-confirm, send immediate response indicating tool is pending
      if (!autoConfirm) {
        // Store the request ID for tracking, and send immediate acknowledgment
        pendingTools.get(toolCallId).requestId = id;
        // Send immediate response so the test doesn't hang
        sendResponse(id, { content: "Tool pending confirmation.", pending: true, tool_call_id: toolCallId });
      }
      break;

    case "agent.confirm":
      const confirmToolId = params.tool_call_id;
      const approved = params.approved;

      if (pendingTools.has(confirmToolId)) {
        const toolInfo = pendingTools.get(confirmToolId);
        const originalRequestId = toolInfo.requestId;

        await handleToolConfirm(confirmToolId, approved);

        // Respond to the original agent.run request
        if (originalRequestId) {
          if (approved) {
            sendResponse(originalRequestId, {
              content: `Tool "${toolInfo.tool}" executed successfully.`
            });
          } else {
            sendResponse(originalRequestId, {
              content: "Tool execution was denied by user."
            });
          }
        }

        // Respond to the confirm request
        sendResponse(id, { success: true });
      } else {
        sendResponse(id, null, {
          code: -32602,
          message: `Unknown tool call: ${confirmToolId}`,
        });
      }
      break;

    case "agent.cancel":
      // Cancel all pending tools
      pendingTools.clear();
      sendNotification("content.done", { full_text: "Operation cancelled." });
      sendResponse(id, { success: true });
      break;

    case "context.add":
      sendResponse(id, {
        success: true,
        message: `Added ${params.file_path} to context`,
      });
      break;

    case "context.remove":
      sendResponse(id, {
        success: true,
        message: `Removed ${params.file_path} from context`,
      });
      break;

    case "context.list":
      sendResponse(id, {
        files: [
          { path: "src/index.ts", tokens: 150 },
          { path: "package.json", tokens: 80 },
        ],
        total_tokens: 230,
      });
      break;

    case "context.clear":
      sendResponse(id, {});
      break;

    case "model.set":
      sendResponse(id, {});
      break;

    case "model.get":
      sendResponse(id, { model: "mistral-mock-v1" });
      break;

    default:
      sendResponse(id, null, {
        code: -32601,
        message: `Method not found: ${method}`,
      });
  }
}

/**
 * Handle tool confirmation result.
 */
async function handleToolConfirm(toolCallId, approved) {
  const toolInfo = pendingTools.get(toolCallId);
  if (!toolInfo) return;

  if (approved) {
    // Simulate tool execution
    await sleep(200);
    sendNotification("tool.result", {
      tool_call_id: toolCallId,
      success: true,
      output: `Executed ${toolInfo.tool} successfully`,
    });

    // Continue with response
    await sleep(100);
    await streamResponse("The operation completed successfully.", 30);
  } else {
    sendNotification("tool.result", {
      tool_call_id: toolCallId,
      success: false,
      output: "User denied the operation",
    });
  }

  pendingTools.delete(toolCallId);
}

/**
 * Main entry point.
 */
function main() {
  const args = process.argv.slice(2);

  // Handle --version flag for CLI availability check
  if (args[0] === "--version" || args[0] === "-v") {
    console.log("mistral-mock 1.0.0");
    process.exit(0);
  }

  if (args[0] !== "server") {
    console.error("Usage: mock-server.js server");
    console.error("       mock-server.js --version");
    process.exit(1);
  }

  // Set up stdin readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);

      if (request.jsonrpc !== "2.0") {
        sendResponse(request.id, null, {
          code: -32600,
          message: "Invalid Request: not JSON-RPC 2.0",
        });
        return;
      }

      await handleMethod(request.id, request.method, request.params || {});
    } catch (error) {
      // console.error("Parse error:", error.message); // Silenced for test clarity
      sendResponse(null, null, {
        code: -32700,
        message: "Parse error",
      });
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });

  // Signal ready
  process.stderr.write("[Mock Server] Ready\n");
}

main();