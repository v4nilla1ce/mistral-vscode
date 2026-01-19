/**
 * Test Runner Framework
 *
 * Provides test execution, reporting, and server management for the mock server tests.
 */

const { spawn } = require("child_process");
const path = require("path");

class TestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      timeout: options.timeout || 5000,
      streamingDelay: options.streamingDelay || 5,
      ...options,
    };

    this.serverProcess = null;
    this.responses = new Map();
    this.notifications = [];
    this.buffer = "";
    this.requestId = 0;
    this.results = [];
    this.currentCategory = null;
  }

  /**
   * Start the mock server process.
   */
  async startServer() {
    const mockServerPath = path.resolve(__dirname, "..", "mock-server.js");

    this.serverProcess = spawn("node", [mockServerPath, "server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.serverProcess.stdout.on("data", (data) => {
      this.buffer += data.toString();
      this._parseBuffer();
    });

    // Wait for server ready signal
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 5000);

      this.serverProcess.stderr.on("data", (data) => {
        if (data.toString().includes("[Mock Server] Ready")) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Stop the mock server process.
   */
  stopServer() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  /**
   * Parse incoming buffer for JSON-RPC messages.
   */
  _parseBuffer() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);

        // Response (has id)
        if (parsed.id !== undefined && (parsed.result !== undefined || parsed.error !== undefined)) {
          this.responses.set(parsed.id, parsed);
        }
        // Notification (no id, has method)
        else if (parsed.method) {
          this.notifications.push(parsed);
        }
      } catch (e) {
        // Ignore parse errors for incomplete data
      }
    }
  }

  /**
   * Clear notifications buffer.
   */
  clearNotifications() {
    this.notifications = [];
  }

  /**
   * Send a JSON-RPC request and wait for response.
   * @param {string} method - RPC method name
   * @param {object} params - Request parameters
   * @param {object} options - Options { preserveNotifications: boolean }
   */
  async sendRequest(method, params = {}, options = {}) {
    const id = ++this.requestId;

    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    // Clear notifications for this request (unless explicitly preserved)
    if (!options.preserveNotifications) {
      this.notifications = [];
    }

    this.serverProcess.stdin.write(JSON.stringify(request) + "\n");

    // Wait for response
    const startTime = Date.now();
    while (!this.responses.has(id)) {
      if (Date.now() - startTime > this.options.timeout) {
        throw new Error(`Timeout waiting for response to ${method}`);
      }
      await this._sleep(10);
    }

    const response = this.responses.get(id);
    this.responses.delete(id);

    return {
      response,
      notifications: [...this.notifications],
    };
  }

  /**
   * Send raw data to the server (for testing malformed input).
   */
  async sendRaw(data) {
    this.notifications = [];
    this.responses.clear();
    this.serverProcess.stdin.write(data);
    await this._sleep(100);

    // Check for any responses
    const responses = [];
    for (const [id, resp] of this.responses) {
      responses.push(resp);
      this.responses.delete(id);
    }

    return {
      responses,
      notifications: [...this.notifications],
    };
  }

  /**
   * Sleep helper.
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Run a single test case.
   */
  async runTest(testCase) {
    const { id, name, run, skip } = testCase;

    if (skip) {
      return {
        id,
        name,
        status: "skipped",
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      await run(this);
      return {
        id,
        name,
        status: "passed",
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id,
        name,
        status: "failed",
        duration: Date.now() - startTime,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Run a category of tests.
   */
  async runCategory(categoryName, tests) {
    this.currentCategory = categoryName;
    const categoryResults = [];

    for (const test of tests) {
      const result = await this.runTest(test);
      categoryResults.push(result);
      this.results.push({ ...result, category: categoryName });

      // Print progress
      const statusSymbol = result.status === "passed" ? "\x1b[32m✓\x1b[0m" :
        result.status === "failed" ? "\x1b[31m✗\x1b[0m" :
          "\x1b[33m○\x1b[0m";

      process.stdout.write(`  ${statusSymbol} [${result.id}] ${result.name}`);

      if (this.options.verbose && result.status === "failed") {
        process.stdout.write(` - ${result.error}`);
      }

      process.stdout.write("\n");
    }

    return categoryResults;
  }

  /**
   * Print summary report.
   */
  printSummary() {
    const passed = this.results.filter(r => r.status === "passed").length;
    const failed = this.results.filter(r => r.status === "failed").length;
    const skipped = this.results.filter(r => r.status === "skipped").length;
    const total = this.results.length;
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log("\n" + "=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total:   ${total}`);
    console.log(`Passed:  \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed:  \x1b[31m${failed}\x1b[0m`);
    console.log(`Skipped: \x1b[33m${skipped}\x1b[0m`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

    // Print failed tests detail
    const failedTests = this.results.filter(r => r.status === "failed");
    if (failedTests.length > 0) {
      console.log("\n" + "-".repeat(60));
      console.log("FAILED TESTS:");
      console.log("-".repeat(60));

      for (const test of failedTests) {
        console.log(`\n  \x1b[31m✗\x1b[0m [${test.id}] ${test.name}`);
        console.log(`    Category: ${test.category}`);
        console.log(`    Error: ${test.error}`);
        if (this.options.verbose && test.stack) {
          console.log(`    Stack: ${test.stack.split("\n").slice(1, 3).join("\n           ")}`);
        }
      }
    }

    console.log("\n");

    return { passed, failed, skipped, total, duration };
  }

  /**
   * Export results as JSON.
   */
  exportJSON() {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.filter(r => r.status === "passed").length,
        failed: this.results.filter(r => r.status === "failed").length,
        skipped: this.results.filter(r => r.status === "skipped").length,
        total: this.results.length,
      },
      results: this.results,
    }, null, 2);
  }
}

module.exports = { TestRunner };
