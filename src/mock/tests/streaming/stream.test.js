/**
 * Streaming Tests
 *
 * Tests content streaming, delta notifications, and token usage.
 */

const { assert, assertRPC, assertStreaming } = require("../assertions");

const tests = [
  // Content Delta Notifications
  {
    id: "STR-001",
    name: "chat sends content.delta notifications",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const deltas = notifications.filter(n => n.method === "content.delta");
      assert.minLength(deltas, 1, "Should have at least one content.delta");
    },
  },

  {
    id: "STR-002",
    name: "delta text has text field",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const deltas = notifications.filter(n => n.method === "content.delta");
      assert.minLength(deltas, 1, "Should have at least one content.delta");

      for (const delta of deltas) {
        assert.exists(delta.params, "Delta should have params");
        assert.exists(delta.params.text, "Delta should have text");
      }
    },
  },

  {
    id: "STR-003",
    name: "content.done notification is sent",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const done = notifications.find(n => n.method === "content.done");
      assert.exists(done, "Should have content.done notification");
    },
  },

  {
    id: "STR-004",
    name: "content.done has full_text field",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const done = notifications.find(n => n.method === "content.done");
      assert.exists(done, "Should have content.done notification");
      assert.exists(done.params.full_text, "content.done should have full_text");
    },
  },

  // Token Usage
  {
    id: "STR-005",
    name: "token.usage notification has required fields",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const usage = notifications.find(n => n.method === "token.usage");
      assert.exists(usage, "Should have token.usage notification");
      assert.exists(usage.params, "token.usage should have params");
      assert.type(usage.params.prompt, "number", "prompt should be number");
      assert.type(usage.params.completion, "number", "completion should be number");
      assert.type(usage.params.total, "number", "total should be number");
    },
  },

  {
    id: "STR-006",
    name: "token counts are positive",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const usage = notifications.find(n => n.method === "token.usage");
      assert.exists(usage, "Should have token.usage notification");
      assert.greaterThan(usage.params.prompt, 0, "prompt should be > 0");
      assert.greaterThan(usage.params.completion, 0, "completion should be > 0");
      assert.greaterThan(usage.params.total, 0, "total should be > 0");
    },
  },

  {
    id: "STR-007",
    name: "total equals prompt + completion",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const usage = notifications.find(n => n.method === "token.usage");
      assert.exists(usage, "Should have token.usage notification");
      assert.equal(
        usage.params.total,
        usage.params.prompt + usage.params.completion,
        "total should equal prompt + completion"
      );
    },
  },

  // Streaming Order
  {
    id: "STR-008",
    name: "content.done comes after all deltas",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      const doneIndex = notifications.findIndex(n => n.method === "content.done");
      assert.ok(doneIndex >= 0, "Should have content.done");

      // All deltas should come before done
      for (let i = doneIndex + 1; i < notifications.length; i++) {
        assert.ok(
          notifications[i].method !== "content.delta",
          "No deltas should come after content.done"
        );
      }
    },
  },

  {
    id: "STR-009",
    name: "no deltas after content.done",
    async run(runner) {
      const { notifications } = await runner.sendRequest("chat", {
        message: "test streaming order",
      });

      const doneIndex = notifications.findIndex(n => n.method === "content.done");
      assert.ok(doneIndex >= 0, "Should have content.done");

      const deltasAfterDone = notifications.slice(doneIndex + 1).filter(
        n => n.method === "content.delta"
      );

      assert.length(deltasAfterDone, 0, "No deltas should come after content.done");
    },
  },

  {
    id: "STR-010",
    name: "response sent after all streaming completes",
    async run(runner) {
      const { response, notifications } = await runner.sendRequest("chat", {
        message: "hello",
      });

      // Response should exist
      assertRPC.success(response);

      // All notifications should have been received before response was parsed
      assert.minLength(notifications, 1, "Should have notifications before response");
    },
  },
];

module.exports = { tests };
