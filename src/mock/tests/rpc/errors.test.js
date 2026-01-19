/**
 * RPC Error Handling Tests
 *
 * Tests error responses and JSON-RPC compliance.
 */

const { assert, assertRPC } = require("../assertions");

const tests = [
  // RPC-013: Unknown method
  {
    id: "RPC-013",
    name: "Unknown method returns error -32601",
    async run(runner) {
      const { response } = await runner.sendRequest("unknown.method", {});

      assertRPC.validResponse(response, runner.requestId);
      assertRPC.error(response, -32601);
      assert.contains(response.error.message, "not found", "Error message should mention not found");
    },
  },

  // RPC-014: Invalid JSON
  {
    id: "RPC-014",
    name: "Invalid JSON returns parse error -32700",
    async run(runner) {
      const { responses } = await runner.sendRaw("{ invalid json }\n");

      assert.minLength(responses, 1, "Should receive error response");
      const response = responses[0];

      assertRPC.error(response, -32700);
    },
  },

  // RPC-015: Missing jsonrpc field
  {
    id: "RPC-015",
    name: "Missing jsonrpc field returns invalid request -32600",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        id: 999,
        method: "chat",
        params: { message: "test" },
      }) + "\n");

      assert.minLength(responses, 1, "Should receive error response");
      const response = responses[0];

      assertRPC.error(response, -32600);
    },
  },


  // RPC-016: Wrong jsonrpc version
  {
    id: "RPC-016",
    name: "Wrong jsonrpc version returns invalid request -32600",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "1.0",
        id: 999,
        method: "chat",
        params: { message: "test" },
      }) + "\n");

      assert.minLength(responses, 1, "Should receive error response");
      const response = responses[0];

      assertRPC.error(response, -32600);
    },
  },

  // RPC-017: Missing id field (notification)
  {
    id: "RPC-017",
    name: "Missing id field is treated as notification",
    async run(runner) {
      // Notifications don't get responses, so we just verify no crash
      await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        method: "chat",
        params: { message: "test" },
      }) + "\n");

      // Wait a bit for any processing
      await new Promise(r => setTimeout(r, 100));

      // Server should still be responsive
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  // RPC-018: Null params
  {
    id: "RPC-018",
    name: "Null params defaults to empty object",
    async run(runner) {
      // Send chat with null params - should use default empty params
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: 998,
        method: "chat",
        params: null,
      }) + "\n");

      // Wait for response
      await new Promise(r => setTimeout(r, 200));

      // Verify server didn't crash
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  // RPC-019: Response has correct id
  {
    id: "RPC-019",
    name: "Response id matches request id",
    async run(runner) {
      const { response } = await runner.sendRequest("model.get", {});

      assert.equal(response.id, runner.requestId, "Response id should match request");
    },
  },

  // RPC-020: Response has jsonrpc "2.0"
  {
    id: "RPC-020",
    name: "Response has jsonrpc 2.0",
    async run(runner) {
      const { response } = await runner.sendRequest("model.get", {});

      assert.equal(response.jsonrpc, "2.0", "jsonrpc should be 2.0");
    },
  },

  // RPC-021: Notification has no id
  {
    id: "RPC-021",
    name: "Notifications have no id field",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", { message: "hello" });

      for (const notif of notifications) {
        assert.ok(notif.id === undefined, "Notification should not have id");
        assert.equal(notif.jsonrpc, "2.0", "Notification should have jsonrpc 2.0");
      }
    },
  },

  // RPC-022: Batch requests
  {
    id: "RPC-022",
    name: "Batch requests do not crash server",
    async run(runner) {
      // Send batch (array) - may not be supported but shouldn't crash
      await runner.sendRaw(JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "model.get", params: {} },
        { jsonrpc: "2.0", id: 2, method: "model.get", params: {} },
      ]) + "\n");

      await new Promise(r => setTimeout(r, 100));

      // Verify server still works
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },
];

module.exports = { tests };
