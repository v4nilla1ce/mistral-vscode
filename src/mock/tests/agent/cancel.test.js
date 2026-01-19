/**
 * Agent Cancellation Tests
 *
 * Tests the agent.cancel functionality.
 */

const { assert, assertRPC } = require("../assertions");

const tests = [
  {
    id: "AGT-018",
    name: "cancel during pending clears pending tools",
    async run(runner) {
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // Cancel
      const { response, notifications: cancelNotifs } = await runner.sendRequest("agent.cancel", {});

      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success");

      // Verify content.done notification was sent
      const done = cancelNotifs.find(n => n.method === "content.done");
      assert.exists(done, "Should emit content.done");
    },
  },

  {
    id: "AGT-019",
    name: "cancel with no pending returns success (idempotent)",
    async run(runner) {
      // Cancel without any pending tools
      const { response } = await runner.sendRequest("agent.cancel", {});

      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success");
    },
  },

  {
    id: "AGT-020",
    name: "confirm after cancel returns error (tool not found)",
    async run(runner) {
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // Cancel
      await runner.sendRequest("agent.cancel", {});

      // Try to confirm the cancelled tool
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });

      assertRPC.error(response, -32602);
    },
  },

  {
    id: "AGT-021",
    name: "multiple pending tools are all cleared on cancel",
    async run(runner) {
      // Create two pending tools
      runner.clearNotifications();
      const { notifications: notifs1 } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });
      const pending1 = notifs1.find(n => n.method === "tool.pending");

      const { notifications: notifs2 } = await runner.sendRequest("agent.run", { task: "run tests", auto_confirm: false });
      const pending2 = notifs2.find(n => n.method === "tool.pending");

      // Cancel all
      await runner.sendRequest("agent.cancel", {});

      // Both should now be invalid
      const { response: resp1 } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending1.params.tool_call_id,
        approved: true,
      });

      assertRPC.error(resp1, -32602);

      if (pending2) {
        const { response: resp2 } = await runner.sendRequest("agent.confirm", {
          tool_call_id: pending2.params.tool_call_id,
          approved: true,
        });
        assertRPC.error(resp2, -32602);
      }
    },
  },
];

module.exports = { tests };
