#!/usr/bin/env node
/**
 * Automated Test Suite for Mock Mistral CLI Server
 *
 * Tests various scenarios to verify Smart Apply features work correctly.
 *
 * Usage:
 *   node test-mock-server.js
 */

const { spawn } = require("child_process");
const path = require("path");

// Test cases
const testCases = [
  // Python file creation
  {
    name: "Python file with explicit filename",
    message: "create a python script called main.py",
    expectedIntent: "create",
    expectedLanguage: "python",
    expectedFilename: "main.py",
  },
  {
    name: "Python file without filename",
    message: "write me a python script",
    expectedIntent: "create",
    expectedLanguage: "python",
  },
  {
    name: "Python file with .py in message",
    message: "create app.py for me",
    expectedIntent: "create",
    expectedLanguage: "python",
  },

  // TypeScript file creation
  {
    name: "TypeScript file creation",
    message: "create a new typescript file",
    expectedIntent: "create",
    expectedLanguage: "typescript",
  },
  {
    name: "TypeScript file with filename",
    message: "create a file called utils.ts",
    expectedIntent: "create",
    expectedLanguage: "typescript",
    expectedFilename: "utils.ts",
  },

  // Command/Terminal intent
  {
    name: "npm install command",
    message: "npm install express",
    expectedIntent: "command",
    expectedLanguage: "bash",
  },
  {
    name: "Install dependencies",
    message: "install the dependencies",
    expectedIntent: "command",
    expectedLanguage: "bash",
  },
  {
    name: "Run in terminal",
    message: "run this in terminal",
    expectedIntent: "command",
    expectedLanguage: "bash",
  },

  // Edit/Refactor intent
  {
    name: "Refactor function",
    message: "refactor this function",
    expectedIntent: "edit",
    expectedLanguage: "typescript",
  },
  {
    name: "Update function",
    message: "update the function to handle errors",
    expectedIntent: "edit",
    expectedLanguage: "typescript",
  },

  // Add function intent
  {
    name: "Add a function",
    message: "add a helper function",
    expectedIntent: "edit",
    expectedLanguage: "typescript",
  },

  // Default/fallback
  {
    name: "Generic question",
    message: "what is the meaning of life",
    expectedIntent: "edit",
    expectedLanguage: "javascript",
  },
];

// Intent detection based on code block content
function detectIntent(content) {
  // Check for file header comments indicating create intent
  if (content.match(/^#\s+\S+\.\w+/m) || content.match(/^\/\/\s+\S+\.\w+/m)) {
    return "create";
  }
  // Check for shell commands
  if (content.match(/^(npm|pip|yarn|brew|apt|cargo)\s/m) ||
      content.match(/^[$>%]\s/m)) {
    return "command";
  }
  // Default to edit
  return "edit";
}

// Extract language from markdown code block
function extractLanguage(response) {
  const match = response.match(/```(\w+)/);
  return match ? match[1] : null;
}

// Extract code content from markdown
function extractCode(response) {
  const match = response.match(/```\w+\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

// Extract filename from code header
function extractFilename(code) {
  // Match Python style: # filename.py
  const pythonMatch = code.match(/^#\s+(\S+\.\w+)/m);
  if (pythonMatch) return pythonMatch[1];

  // Match JS/TS style: // filename.ts
  const jsMatch = code.match(/^\/\/\s+(\S+\.\w+)/m);
  if (jsMatch) return jsMatch[1];

  return null;
}

// Main test runner
async function main() {
  console.log("=".repeat(60));
  console.log("Mock Server Test Suite");
  console.log("=".repeat(60));
  console.log();

  // Start mock server
  const mockServerPath = path.join(__dirname, "mock-server.js");
  const serverProcess = spawn("node", [mockServerPath, "server"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  const responses = new Map();

  // Collect all stdout data
  serverProcess.stdout.on("data", (data) => {
    buffer += data.toString();

    // Try to parse complete JSON lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.id !== undefined && parsed.result) {
          responses.set(parsed.id, parsed.result);
        }
      } catch (e) {
        // Ignore parse errors for incomplete data
      }
    }
  });

  // Wait for server ready
  await new Promise((resolve) => {
    serverProcess.stderr.on("data", (data) => {
      if (data.toString().includes("[Mock Server] Ready")) {
        resolve();
      }
    });
  });

  console.log("Mock server started\n");

  const results = [];
  let passed = 0;
  let failed = 0;

  // Run all tests sequentially
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const requestId = i + 1;

    process.stdout.write(`[${requestId}/${testCases.length}] ${testCase.name}... `);

    // Send request
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method: "chat",
      params: { message: testCase.message },
    };
    serverProcess.stdin.write(JSON.stringify(request) + "\n");

    // Wait for response (with timeout)
    let attempts = 0;
    while (!responses.has(requestId) && attempts < 20) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    const finalResponse = responses.get(requestId);

    if (!finalResponse) {
      console.log("\x1b[31mFAILED\x1b[0m");
      console.log(`    Error: No response received after ${attempts * 100}ms`);
      results.push({
        name: testCase.name,
        message: testCase.message,
        passed: false,
        error: "No response received",
      });
      failed++;
      continue;
    }

    const content = finalResponse.content;
    const language = extractLanguage(content);
    const code = extractCode(content);
    const filename = code ? extractFilename(code) : null;
    const intent = code ? detectIntent(code) : null;

    const result = {
      name: testCase.name,
      message: testCase.message,
      passed: true,
      checks: [],
    };

    // Check language
    if (testCase.expectedLanguage) {
      const langMatch = language === testCase.expectedLanguage;
      result.checks.push({
        check: "language",
        expected: testCase.expectedLanguage,
        actual: language,
        passed: langMatch,
      });
      if (!langMatch) result.passed = false;
    }

    // Check intent
    if (testCase.expectedIntent) {
      const intentMatch = intent === testCase.expectedIntent;
      result.checks.push({
        check: "intent",
        expected: testCase.expectedIntent,
        actual: intent,
        passed: intentMatch,
      });
      if (!intentMatch) result.passed = false;
    }

    // Check filename (if specified)
    if (testCase.expectedFilename) {
      const fnMatch = filename === testCase.expectedFilename;
      result.checks.push({
        check: "filename",
        expected: testCase.expectedFilename,
        actual: filename,
        passed: fnMatch,
      });
      if (!fnMatch) result.passed = false;
    }

    results.push(result);

    if (result.passed) {
      console.log("\x1b[32mPASSED\x1b[0m");
      passed++;
    } else {
      console.log("\x1b[31mFAILED\x1b[0m");
      failed++;

      // Show failure details
      for (const check of result.checks) {
        if (!check.passed) {
          console.log(`    ${check.check}: expected "${check.expected}", got "${check.actual}"`);
        }
      }
    }
  }

  // Kill server
  serverProcess.kill();

  // Summary
  console.log();
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total:  ${testCases.length}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${failed}\x1b[0m`);
  console.log();

  // Detailed failure report
  if (failed > 0) {
    console.log("FAILED TESTS:");
    console.log("-".repeat(40));
    for (const result of results) {
      if (!result.passed) {
        console.log(`\n  ${result.name}`);
        console.log(`  Message: "${result.message}"`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        for (const check of result.checks || []) {
          const status = check.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
          console.log(`    ${status} ${check.check}: expected "${check.expected}", got "${check.actual}"`);
        }
      }
    }
  }

  console.log();

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
