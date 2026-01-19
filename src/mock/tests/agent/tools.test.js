/**
 * Agent Tool Type Tests
 *
 * Tests that the correct tool types are triggered based on task content.
 */

const { assert, assertAgent } = require("../assertions");

const tests = [
  {
    id: "AGT-011",
    name: "create a file → triggers write_file tool",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.equal(pending.params.tool, "write_file", "Should use write_file tool");
    },
  },

  {
    id: "AGT-012",
    name: "write to disk → triggers write_file tool",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "write file to disk", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.equal(pending.params.tool, "write_file", "Should use write_file tool");
    },
  },

  {
    id: "AGT-013",
    name: "run tests → triggers run_command tool",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "run tests", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.equal(pending.params.tool, "run_command", "Should use run_command tool");
    },
  },

  {
    id: "AGT-014",
    name: "execute command → triggers run_command tool",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "execute command", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.equal(pending.params.tool, "run_command", "Should use run_command tool");
    },
  },

  {
    id: "AGT-015",
    name: "file operation → triggers write_file tool",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "file operation", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.equal(pending.params.tool, "write_file", "Should use write_file tool");
    },
  },

  {
    id: "AGT-016",
    name: "write_file tool has path and content arguments",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.exists(pending.params.arguments.path, "Should have path argument");
      assert.exists(pending.params.arguments.content, "Should have content argument");
    },
  },

  {
    id: "AGT-017",
    name: "run_command tool has command argument",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "run tests", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.exists(pending.params.arguments.command, "Should have command argument");
    },
  },
];

module.exports = { tests };
