/**
 * Filename Extraction Tests
 *
 * Tests filename extraction from user messages and code headers.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  // Explicit filename patterns
  {
    id: "FN-001",
    name: "create a file called main.py → extracts main.py",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called main.py",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "main.py");
    },
  },

  {
    id: "FN-002",
    name: "file named utils.ts → extracts utils.ts",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "file named utils.ts",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "utils.ts");
    },
  },

  {
    id: "FN-003",
    name: "create app.tsx → extracts app.tsx",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called app.tsx",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "app.tsx");
    },
  },

  {
    id: "FN-004",
    name: "make a file helper.js → extracts helper.js",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "make a file helper.js",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "helper.js");
    },
  },

  {
    id: "FN-005",
    name: "called test.py → extracts test.py",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a python file called test.py",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "test.py");
    },
  },

  {
    id: "FN-006",
    name: "named component.tsx → extracts component.tsx",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "file named component.tsx",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "component.tsx");
    },
  },

  // No filename (defaults)
  {
    id: "FN-011",
    name: "create a python file (no name) → defaults to main.py",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a python file",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "main.py");
    },
  },

  {
    id: "FN-012",
    name: "new typescript file (no name) → defaults to src/utils/helper.ts",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "new typescript file",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "src/utils/helper.ts");
    },
  },

  // Edge cases
  {
    id: "FN-017",
    name: "create a.b.c.py (multiple dots) → extracts a.b.c.py",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called a.b.c.py",
      });

      assertRPC.success(response);
      assertIntent.hasFilename(response.result.content, "a.b.c.py");
    },
  },
];

module.exports = { tests };
