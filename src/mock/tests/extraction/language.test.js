/**
 * Language Detection Tests
 *
 * Tests language tag extraction from code blocks.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  {
    id: "LANG-001",
    name: "python code block has python language tag",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a python file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "python");
    },
  },

  {
    id: "LANG-002",
    name: "typescript code block has typescript language tag",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a typescript file",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
    },
  },

  {
    id: "LANG-003",
    name: "javascript file request returns javascript/typescript",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create javascript code",
      });

      assertRPC.success(response);
      const lang = assertIntent.extractLanguage(response.result.content);
      assert.ok(
        lang === "javascript" || lang === "typescript",
        `Expected javascript or typescript, got ${lang}`
      );
    },
  },

  {
    id: "LANG-004",
    name: "bash code block has bash language tag",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "npm install express",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
    },
  },

  {
    id: "LANG-005",
    name: "terminal command returns bash language tag",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "run in terminal",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
    },
  },

  {
    id: "LANG-006",
    name: ".tsx file request returns typescript",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called app.tsx",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
    },
  },

  {
    id: "LANG-007",
    name: ".jsx file request returns javascript/typescript",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called app.jsx",
      });

      assertRPC.success(response);
      const lang = assertIntent.extractLanguage(response.result.content);
      assert.ok(
        lang === "javascript" || lang === "typescript",
        `Expected javascript or typescript, got ${lang}`
      );
    },
  },

  {
    id: "LANG-008",
    name: "refactor returns typescript by default",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "refactor this function",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "typescript");
    },
  },

  {
    id: "LANG-009",
    name: "code block language tag is lowercase",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create PYTHON code",
      });

      assertRPC.success(response);
      const lang = assertIntent.extractLanguage(response.result.content);
      assert.equal(lang, lang.toLowerCase(), "Language tag should be lowercase");
    },
  },

  {
    id: "LANG-010",
    name: "default response has javascript language tag",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "what is the meaning of life",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "javascript");
    },
  },
];

module.exports = { tests };
