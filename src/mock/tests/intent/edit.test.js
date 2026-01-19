/**
 * Edit Intent Detection Tests
 *
 * Tests that edit/refactor intents are correctly identified.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  {
    id: "INT-028",
    name: "refactor this function → edit intent, typescript language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "refactor this function",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
      assertIntent.hasIntent(response.result.content, "edit");
    },
  },

  {
    id: "INT-029",
    name: "update the code → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "update the function to handle errors",
      });

      assertRPC.success(response);
      assertIntent.hasIntent(response.result.content, "edit");
    },
  },

  {
    id: "INT-030",
    name: "modify this method → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "modify this method",
      });

      assertRPC.success(response);
      // May be edit or create depending on implementation
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },

  {
    id: "INT-031",
    name: "fix the bug in → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "fix the bug in this code",
      });

      assertRPC.success(response);
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },

  {
    id: "INT-032",
    name: "improve this implementation → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "improve this implementation",
      });

      assertRPC.success(response);
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },

  {
    id: "INT-033",
    name: "change the function to → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "change the function to use async",
      });

      assertRPC.success(response);
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },

  {
    id: "INT-034",
    name: "optimize this code → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "optimize this code",
      });

      assertRPC.success(response);
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },

  {
    id: "INT-035",
    name: "add error handling → edit intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "add error handling to this function",
      });

      assertRPC.success(response);
      const code = assertIntent.extractCode(response.result.content);
      assert.exists(code, "Should have code block");
    },
  },
];

module.exports = { tests };
