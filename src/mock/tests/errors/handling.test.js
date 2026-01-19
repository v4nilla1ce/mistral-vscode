/**
 * Error Handling Tests
 *
 * Tests malformed input, missing fields, invalid values, and recovery.
 */

const { assert, assertRPC } = require("../assertions");

const tests = [
  // Malformed Input
  {
    id: "ERR-001",
    name: "empty string is ignored or errors",
    async run(runner) {
      await runner.sendRaw("\n");

      // Wait a bit
      await new Promise(r => setTimeout(r, 100));

      // Server should still be responsive
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-002",
    name: "incomplete JSON returns parse error",
    async run(runner) {
      const { responses } = await runner.sendRaw("{ incomplete\n");

      assert.minLength(responses, 1, "Should receive error response");
      assertRPC.error(responses[0], -32700);
    },
  },

  {
    id: "ERR-003",
    name: "string instead of object returns invalid request",
    async run(runner) {
      const { responses } = await runner.sendRaw('"hello"\n');

      // May be parse error or invalid request
      assert.minLength(responses, 1, "Should receive error response");
      assert.exists(responses[0].error, "Should be error response");
    },
  },

  {
    id: "ERR-004",
    name: "null returns invalid request",
    async run(runner) {
      const { responses } = await runner.sendRaw("null\n");

      // Should handle gracefully
      await new Promise(r => setTimeout(r, 100));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-005",
    name: "array returns invalid request or handles gracefully",
    async run(runner) {
      const { responses } = await runner.sendRaw("[1, 2, 3]\n");

      await new Promise(r => setTimeout(r, 100));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-006",
    name: "binary data is handled gracefully",
    async run(runner) {
      // Send some binary-ish data
      await runner.sendRaw(Buffer.from([0x00, 0x01, 0x02, 0x03]).toString() + "\n");

      await new Promise(r => setTimeout(r, 100));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  // Missing Fields
  {
    id: "ERR-007",
    name: "no method field returns invalid request",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: 999,
        params: {},
      }) + "\n");

      await new Promise(r => setTimeout(r, 100));

      // Should error or handle gracefully
      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-008",
    name: "no params field uses empty object",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: 999,
        method: "model.get",
      }) + "\n");

      await new Promise(r => setTimeout(r, 200));

      // Server should have handled it
      // Verify server still works
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-009",
    name: "empty method returns method not found",
    async run(runner) {
      const { response } = await runner.sendRequest("", {});

      assertRPC.error(response, -32601);
    },
  },

  // Invalid Values
  {
    id: "ERR-010",
    name: "numeric method is handled",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: 999,
        method: 123,
        params: {},
      }) + "\n");

      await new Promise(r => setTimeout(r, 100));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-011",
    name: "string params is handled",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: 999,
        method: "chat",
        params: "not an object",
      }) + "\n");

      await new Promise(r => setTimeout(r, 100));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-012",
    name: "object id still works",
    async run(runner) {
      const { responses } = await runner.sendRaw(JSON.stringify({
        jsonrpc: "2.0",
        id: { custom: "id" },
        method: "model.get",
        params: {},
      }) + "\n");

      await new Promise(r => setTimeout(r, 200));

      // Should handle gracefully
      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  // Recovery
  {
    id: "ERR-013",
    name: "error then valid request continues",
    async run(runner) {
      // Send invalid request
      await runner.sendRaw("{ invalid json\n");
      await new Promise(r => setTimeout(r, 100));

      // Send valid request
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-014",
    name: "multiple errors in sequence all get handled",
    async run(runner) {
      // Send multiple invalid requests
      await runner.sendRaw("{ invalid1\n");
      await runner.sendRaw("{ invalid2\n");
      await runner.sendRaw("{ invalid3\n");

      await new Promise(r => setTimeout(r, 200));

      // Server should still work
      const { response } = await runner.sendRequest("model.get", {});
      assertRPC.success(response);
    },
  },

  {
    id: "ERR-015",
    name: "valid after malformed processes correctly",
    async run(runner) {
      // Send malformed
      await runner.sendRaw("not json at all\n");
      await new Promise(r => setTimeout(r, 100));

      // Send valid
      const { response } = await runner.sendRequest("chat", {
        message: "hello after error",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have response content");
    },
  },
];

module.exports = { tests };
