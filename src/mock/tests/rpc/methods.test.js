/**
 * RPC Method Availability Tests
 *
 * Tests that all required RPC methods are implemented and respond correctly.
 */

const { assert, assertRPC } = require("../assertions");

const tests = [
  // RPC-001: initialize
  {
    id: "RPC-001",
    name: "initialize returns capabilities and version",
    async run(runner) {
      const { response } = await runner.sendRequest("initialize", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.exists(response.result.capabilities, "Should have capabilities");
      assert.exists(response.result.version, "Should have version");
      assert.type(response.result.capabilities.streaming, "boolean", "streaming capability");
      assert.type(response.result.capabilities.tools, "boolean", "tools capability");
    },
  },

  // RPC-002: chat
  {
    id: "RPC-002",
    name: "chat returns content response",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", { message: "hello" });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.exists(response.result.content, "Should have content");
      assert.type(response.result.content, "string", "Content should be string");
    },
  },

  // RPC-003: agent.run emits tool.pending
  {
    id: "RPC-003",
    name: "agent.run emits tool.pending notification",
    async run(runner) {
      const { response, notifications } = await runner.sendRequest("agent.run", {
        task: "test task",
        auto_confirm: true,
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      // Should have tool.pending notification
      const pending = notifications.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
    },
  },

  // RPC-004: agent.confirm with approved=true
  {
    id: "RPC-004",
    name: "agent.confirm approved=true returns success",
    async run(runner) {
      // First trigger a pending tool
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      // Get the tool_call_id from notifications
      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should have pending tool");

      // Confirm it
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success: true");
    },
  },

  // RPC-005: agent.confirm with approved=false
  {
    id: "RPC-005",
    name: "agent.confirm approved=false returns success",
    async run(runner) {
      // First trigger a pending tool
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "run something", auto_confirm: false });

      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should have pending tool");

      // Deny it
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: false,
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success: true");
    },
  },

  // RPC-006: agent.cancel
  {
    id: "RPC-006",
    name: "agent.cancel returns success",
    async run(runner) {
      const { response } = await runner.sendRequest("agent.cancel", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success: true");
    },
  },

  // RPC-007: context.add
  {
    id: "RPC-007",
    name: "context.add returns success with message",
    async run(runner) {
      const { response } = await runner.sendRequest("context.add", {
        file_path: "test.ts",
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.equal(response.result.success, true, "Should return success: true");
      assert.exists(response.result.message, "Should have message");
    },
  },

  // RPC-008: context.remove
  {
    id: "RPC-008",
    name: "context.remove returns success with message",
    async run(runner) {
      const { response } = await runner.sendRequest("context.remove", {
        file_path: "test.ts",
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.equal(response.result.success, true, "Should return success: true");
      assert.exists(response.result.message, "Should have message");
    },
  },

  // RPC-009: context.list
  {
    id: "RPC-009",
    name: "context.list returns files and total_tokens",
    async run(runner) {
      const { response } = await runner.sendRequest("context.list", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.ok(Array.isArray(response.result.files), "files should be array");
      assert.type(response.result.total_tokens, "number", "total_tokens should be number");
    },
  },

  // RPC-010: context.clear
  {
    id: "RPC-010",
    name: "context.clear returns empty object",
    async run(runner) {
      const { response } = await runner.sendRequest("context.clear", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);
    },
  },

  // RPC-011: model.set
  {
    id: "RPC-011",
    name: "model.set returns empty object",
    async run(runner) {
      const { response } = await runner.sendRequest("model.set", {
        model: "mistral-large",
      });

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);
    },
  },

  // RPC-012: model.get
  {
    id: "RPC-012",
    name: "model.get returns model name",
    async run(runner) {
      const { response } = await runner.sendRequest("model.get", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.success(response);

      assert.exists(response.result.model, "Should have model");
      assert.type(response.result.model, "string", "model should be string");
    },
  },
];

module.exports = { tests };
