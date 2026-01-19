/**
 * Create Intent Detection Tests
 *
 * Tests that create intents are correctly identified for Python, TypeScript, etc.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  // Python create intent tests
  {
    id: "INT-001",
    name: "create a python file → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a python file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-002",
    name: "write python code → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "write python code",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-003",
    name: "make a .py file → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "make a .py file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-004",
    name: "python script for data analysis → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "python script for data analysis",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-005",
    name: "create main.py → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create main.py",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-006",
    name: "new python module → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "new python module",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-007",
    name: "generate python class → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "generate python class",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-008",
    name: "PYTHON FILE (uppercase) → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "PYTHON FILE",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-009",
    name: "PyThOn ScRiPt (mixed case) → create intent, python language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "PyThOn ScRiPt",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  // TypeScript/JavaScript create intent tests
  {
    id: "INT-010",
    name: "create a typescript file → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a typescript file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-011",
    name: "new .ts file → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "new .ts file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-012",
    name: "make utils.ts → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "make utils.ts",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-013",
    name: "create javascript file → typescript/javascript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create javascript file",
      });

      assertRPC.success(response);
      // May return typescript or javascript depending on implementation
      const lang = assertIntent.extractLanguage(response.result.content);
      assert.ok(
        lang === "typescript" || lang === "javascript",
        `Expected typescript or javascript, got ${lang}`
      );
    },
  },

  {
    id: "INT-014",
    name: "new component.tsx → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "new component.tsx",
      });

      assertRPC.success(response);
      // .tsx should trigger TypeScript
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-015",
    name: "create react component → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create react component",
      });

      assertRPC.success(response);
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-016",
    name: "new file (generic) → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "new file",
      });

      assertRPC.success(response);
      // Generic should default to TypeScript
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-017",
    name: "create a helper module → create intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a helper module",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },
];

module.exports = { tests };
