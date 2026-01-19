/**
 * Agent Mode Flow Tests
 *
 * Tests the agent.run → tool.pending → confirm/cancel → result flow.
 */

const { assert, assertRPC, assertAgent } = require("../assertions");

const tests = [
  // Tool Pending Flow
  {
    id: "AGT-001",
    name: "agent.run emits tool.pending notification",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
    },
  },

  {
    id: "AGT-002",
    name: "tool.pending has non-empty tool_call_id string",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.type(pending.params.tool_call_id, "string", "tool_call_id should be string");
      assert.ok(pending.params.tool_call_id.length > 0, "tool_call_id should not be empty");
    },
  },

  {
    id: "AGT-003",
    name: "tool.pending has tool name",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.type(pending.params.tool, "string", "tool should be string");
      assert.ok(pending.params.tool.length > 0, "tool should not be empty");
    },
  },

  {
    id: "AGT-004",
    name: "tool.pending has arguments object",
    async run(runner) {
      runner.clearNotifications();
      const { notifications } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.type(pending.params.arguments, "object", "arguments should be object");
    },
  },

  // Tool Confirmation
  {
    id: "AGT-005",
    name: "confirm approved=true emits tool.result with success=true",
    async run(runner) {
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      const { notifications: confirmNotifs } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });

      const result = confirmNotifs.find(n => n.method === "tool.result");
      assert.exists(result, "Should emit tool.result");
      assert.equal(result.params.success, true, "success should be true");
    },
  },

  {
    id: "AGT-006",
    name: "confirm approved=false emits tool.result with success=false",
    async run(runner) {
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "run tests", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      const { notifications: confirmNotifs } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: false,
      });

      const result = confirmNotifs.find(n => n.method === "tool.result");
      assert.exists(result, "Should emit tool.result");
      assert.equal(result.params.success, false, "success should be false");
    },
  },

  {
    id: "AGT-007",
    name: "confirm unknown tool_call_id returns error",
    async run(runner) {
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: "nonexistent_id_12345",
        approved: true,
      });

      assertRPC.error(response, -32602);
    },
  },

  {
    id: "AGT-008",
    name: "double confirm same tool handles gracefully",
    async run(runner) {
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // First confirm
      await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });

      // Second confirm (should error or handle gracefully)
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });

      // Should return error since tool is already confirmed
      assertRPC.error(response, -32602);
    },
  },

  // Auto-Confirm Mode
  {
    id: "AGT-009",
    name: "agent.run with auto_confirm=true returns direct response",
    async run(runner) {
      const { response } = await runner.sendRequest("agent.run", {
        task: "create a file",
        auto_confirm: true,
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have response content");
    },
  },

  {
    id: "AGT-010",
    name: "agent.run with auto_confirm=false waits for confirmation",
    async run(runner) {
      runner.clearNotifications();

      // Send agent.run with auto_confirm=false
      const { response, notifications } = await runner.sendRequest("agent.run", {
        task: "create a file",
        auto_confirm: false,
      });

      // Response should indicate pending state
      assertRPC.success(response);
      assert.equal(response.result.pending, true, "Response should indicate pending");

      // Should have tool.pending notification
      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // Now confirm to complete the flow
      await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });
    },
  },
];

module.exports = { tests };
