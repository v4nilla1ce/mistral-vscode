#!/usr/bin/env node
/**
 * Comprehensive Test Suite for Mock Mistral CLI Server
 *
 * Runs all test categories and generates a detailed report.
 *
 * Usage:
 *   node src/mock/tests/index.js              # Run all tests
 *   node src/mock/tests/index.js --verbose    # Show detailed output
 *   node src/mock/tests/index.js --category=rpc  # Run specific category
 *   node src/mock/tests/index.js --output=results.json  # Export JSON report
 */

const { TestRunner } = require("./runner");
const fs = require("fs");
const path = require("path");

// Import all test modules
const rpcMethods = require("./rpc/methods.test");
const rpcErrors = require("./rpc/errors.test");
const intentCreate = require("./intent/create.test");
const intentCommand = require("./intent/command.test");
const intentEdit = require("./intent/edit.test");
const intentAmbiguous = require("./intent/ambiguous.test");
const extractionFilename = require("./extraction/filename.test");
const extractionLanguage = require("./extraction/language.test");
const agentFlow = require("./agent/flow.test");
const agentTools = require("./agent/tools.test");
const agentCancel = require("./agent/cancel.test");
const streaming = require("./streaming/stream.test");
const errors = require("./errors/handling.test");
const edgeCases = require("./edge/edge-cases.test");
const integration = require("./integration/full-flow.test");

// Define test categories
const categories = {
  rpc: {
    name: "RPC Protocol",
    tests: [...rpcMethods.tests, ...rpcErrors.tests],
  },
  intent: {
    name: "Intent Detection",
    tests: [
      ...intentCreate.tests,
      ...intentCommand.tests,
      ...intentEdit.tests,
      ...intentAmbiguous.tests,
    ],
  },
  extraction: {
    name: "Filename/Language Extraction",
    tests: [...extractionFilename.tests, ...extractionLanguage.tests],
  },
  agent: {
    name: "Agent Mode",
    tests: [...agentFlow.tests, ...agentTools.tests, ...agentCancel.tests],
  },
  streaming: {
    name: "Streaming",
    tests: streaming.tests,
  },
  errors: {
    name: "Error Handling",
    tests: errors.tests,
  },
  edge: {
    name: "Edge Cases",
    tests: edgeCases.tests,
  },
  integration: {
    name: "Integration",
    tests: integration.tests,
  },
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    verbose: false,
    category: null,
    output: null,
    failedOnly: false,
  };

  for (const arg of args) {
    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg.startsWith("--category=")) {
      options.category = arg.split("=")[1];
    } else if (arg.startsWith("--output=")) {
      options.output = arg.split("=")[1];
    } else if (arg === "--failed-only") {
      options.failedOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Comprehensive Test Suite for Mock Mistral CLI Server

Usage:
  node src/mock/tests/index.js [options]

Options:
  --verbose, -v       Show detailed output including error stacks
  --category=NAME     Run only tests in specified category
  --output=FILE       Export results to JSON file
  --failed-only       Only run tests that failed in previous run
  --help, -h          Show this help message

Categories:
  rpc          RPC Protocol tests (methods, errors, compliance)
  intent       Intent Detection tests (create, command, edit, ambiguous)
  extraction   Filename and Language Extraction tests
  agent        Agent Mode tests (flow, tools, cancellation)
  streaming    Streaming tests (deltas, done, token usage)
  errors       Error Handling tests (malformed input, recovery)
  edge         Edge Case tests (unicode, special chars, boundaries)
  integration  Integration tests (full workflows)

Examples:
  node src/mock/tests/index.js
  node src/mock/tests/index.js --verbose
  node src/mock/tests/index.js --category=intent
  node src/mock/tests/index.js --output=results.json
`);
}

// Main entry point
async function main() {
  const options = parseArgs();

  console.log("=".repeat(60));
  console.log("Comprehensive Mock Server Test Suite");
  console.log("=".repeat(60));
  console.log();

  // Create test runner
  const runner = new TestRunner({
    verbose: options.verbose,
    timeout: 5000,
  });

  try {
    // Start server
    console.log("Starting mock server...");
    await runner.startServer();
    console.log("Mock server started\n");

    // Determine which categories to run
    const categoriesToRun = options.category
      ? { [options.category]: categories[options.category] }
      : categories;

    if (options.category && !categories[options.category]) {
      console.error(`Unknown category: ${options.category}`);
      console.error(`Available categories: ${Object.keys(categories).join(", ")}`);
      process.exit(1);
    }

    // Run each category
    for (const [key, category] of Object.entries(categoriesToRun)) {
      console.log("-".repeat(60));
      console.log(`Category: ${category.name} (${category.tests.length} tests)`);
      console.log("-".repeat(60));

      await runner.runCategory(category.name, category.tests);
      console.log();
    }

    // Print summary
    const summary = runner.printSummary();

    // Export JSON if requested
    if (options.output) {
      const json = runner.exportJSON();
      fs.writeFileSync(options.output, json);
      console.log(`Results exported to: ${options.output}`);
    }

    // Exit with error code if any tests failed
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Test runner error:", error);
    process.exit(1);
  } finally {
    runner.stopServer();
  }
}

main();
