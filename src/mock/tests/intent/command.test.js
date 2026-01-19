/**
 * Command Intent Detection Tests
 *
 * Tests that command/terminal intents are correctly identified.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  {
    id: "INT-018",
    name: "npm install express → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "npm install express",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-019",
    name: "run npm test → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "run npm test",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-020",
    name: "install dependencies → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "install dependencies",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-021",
    name: "execute in terminal → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "execute in terminal",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-022",
    name: "pip install pandas → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "pip install pandas",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-023",
    name: "yarn add lodash → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "yarn add lodash",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-024",
    name: "run this command → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "run this command",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-025",
    name: "terminal command for installing node → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "terminal command for installing node",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-026",
    name: "brew install node → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "brew install node",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },

  {
    id: "INT-027",
    name: "apt-get install git → command intent, bash language",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "apt-get install git",
      });

      assertRPC.success(response);
      assertIntent.hasLanguage(response.result.content, "bash");
      assertIntent.hasIntent(response.result.content, "command");
    },
  },
];

module.exports = { tests };
