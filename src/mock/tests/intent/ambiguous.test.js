/**
 * Ambiguous Intent Detection Tests
 *
 * Tests priority handling when messages contain multiple intent keywords.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  {
    id: "INT-036",
    name: "create a python script and run it → create (python priority)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a python script and run it",
      });

      assertRPC.success(response);
      // Python should take priority over "run"
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-037",
    name: "install python dependencies → command (install priority)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "install python dependencies",
      });

      assertRPC.success(response);
      // "install" should take priority - command intent
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-038",
    name: "add a new python function → create (python priority)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "add a new python function",
      });

      assertRPC.success(response);
      // Python should take priority
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasIntent(response.result.content, "create");
    },
  },

  {
    id: "INT-039",
    name: "run the typescript compiler → command (run priority)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "run the typescript compiler",
      });

      assertRPC.success(response);
      // "run" should trigger command intent
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-040",
    name: "create a script to run npm → create (create priority)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a script to run npm",
      });

      assertRPC.success(response);
      // "create" should take priority over "run" and "npm"
      // Should get a create intent with typescript
      assertIntent.hasIntent(response.result.content, "create");
    },
  },
];

module.exports = { tests };
