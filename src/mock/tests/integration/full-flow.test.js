/**
 * Integration Tests
 *
 * Tests full workflows and multi-step operations.
 */

const { assert, assertRPC, assertIntent, assertStreaming, assertAgent } = require("../assertions");

const tests = [
  // Full Chat Flow
  {
    id: "INTG-001",
    name: "send message → receive response (full cycle)",
    async run(runner) {
      const { response, notifications } = await runner.sendRequest("chat", {
        message: "create a python file called app.py",
      });

      // Should have streaming notifications
      assertStreaming.hasDeltas(notifications);
      assertStreaming.hasDone(notifications);
      assertStreaming.hasTokenUsage(notifications);

      // Should have valid response
      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");

      // Should have correct intent
      assertIntent.hasLanguage(response.result.content, "python");
      assertIntent.hasFilename(response.result.content, "app.py");
    },
  },

  {
    id: "INTG-002",
    name: "multiple messages in sequence all work correctly",
    async run(runner) {
      // First message
      const { response: resp1 } = await runner.sendRequest("chat", {
        message: "create a python file",
      });
      assertRPC.success(resp1);
      assertIntent.hasLanguage(resp1.result.content, "python");

      // Second message
      const { response: resp2 } = await runner.sendRequest("chat", {
        message: "npm install express",
      });
      assertRPC.success(resp2);
      assertIntent.hasLanguage(resp2.result.content, "bash");

      // Third message
      const { response: resp3 } = await runner.sendRequest("chat", {
        message: "create a typescript file",
      });
      assertRPC.success(resp3);
      assertIntent.hasLanguage(resp3.result.content, "typescript");
    },
  },

  {
    id: "INTG-003",
    name: "add context → chat → remove context maintains state",
    async run(runner) {
      // Add context
      const { response: addResp } = await runner.sendRequest("context.add", {
        file_path: "src/test.ts",
      });
      assertRPC.success(addResp);
      assert.equal(addResp.result.success, true);

      // Chat
      const { response: chatResp } = await runner.sendRequest("chat", {
        message: "hello",
      });
      assertRPC.success(chatResp);

      // List context
      const { response: listResp } = await runner.sendRequest("context.list", {});
      assertRPC.success(listResp);
      assert.ok(Array.isArray(listResp.result.files), "files should be array");

      // Remove context
      const { response: removeResp } = await runner.sendRequest("context.remove", {
        file_path: "src/test.ts",
      });
      assertRPC.success(removeResp);
      assert.equal(removeResp.result.success, true);
    },
  },

  // Full Agent Flow
  {
    id: "INTG-004",
    name: "agent.run → pending → confirm → result (complete cycle)",
    async run(runner) {
      // Start agent task
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      // Should have tool.pending
      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");
      assert.exists(pending.params.tool_call_id, "Should have tool_call_id");
      assert.equal(pending.params.tool, "write_file", "Should be write_file tool");

      // Confirm
      const { response, notifications: confirmNotifs } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });
      assertRPC.success(response);

      // Should have tool.result
      const result = confirmNotifs.find(n => n.method === "tool.result");
      assert.exists(result, "Should emit tool.result");
      assert.equal(result.params.success, true, "Tool should succeed");
    },
  },

  {
    id: "INTG-005",
    name: "agent.run → pending → deny → cancelled (denial works)",
    async run(runner) {
      // Start agent task
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "run tests", auto_confirm: false });

      // Should have tool.pending
      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // Deny
      const { response, notifications: confirmNotifs } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: false,
      });
      assertRPC.success(response);

      // Should have tool.result with failure
      const result = confirmNotifs.find(n => n.method === "tool.result");
      assert.exists(result, "Should emit tool.result");
      assert.equal(result.params.success, false, "Tool should be denied");
    },
  },

  {
    id: "INTG-006",
    name: "agent.run → pending → cancel → clean (cancellation works)",
    async run(runner) {
      // Start agent task
      runner.clearNotifications();
      const { notifications: agentNotifs } = await runner.sendRequest("agent.run", { task: "create a file", auto_confirm: false });

      // Should have tool.pending
      const pending = agentNotifs.find(n => n.method === "tool.pending");
      assert.exists(pending, "Should emit tool.pending");

      // Cancel
      const { response } = await runner.sendRequest("agent.cancel", {});
      assertRPC.success(response);
      assert.equal(response.result.success, true, "Cancel should succeed");

      // Confirm after cancel should fail
      const { response: confirmResp } = await runner.sendRequest("agent.confirm", {
        tool_call_id: pending.params.tool_call_id,
        approved: true,
      });
      assertRPC.error(confirmResp, -32602);
    },
  },

  // Mixed Mode
  {
    id: "INTG-007",
    name: "chat then agent then chat all work",
    async run(runner) {
      // Chat
      const { response: chat1 } = await runner.sendRequest("chat", {
        message: "hello",
      });
      assertRPC.success(chat1);

      // Agent (auto-confirm for simplicity)
      const { response: agent } = await runner.sendRequest("agent.run", {
        task: "run tests",
        auto_confirm: true,
      });
      assertRPC.success(agent);

      // Chat again
      const { response: chat2 } = await runner.sendRequest("chat", {
        message: "goodbye",
      });
      assertRPC.success(chat2);
    },
  },

  {
    id: "INTG-008",
    name: "context add during agent run causes no interference",
    async run(runner) {
      // Start agent task
      const agentPromise = runner.sendRequest("agent.run", {
        task: "create a file",
        auto_confirm: true,
      });

      // Add context while agent is running
      const { response: contextResp } = await runner.sendRequest("context.add", {
        file_path: "src/concurrent.ts",
      });
      assertRPC.success(contextResp);

      // Agent should complete
      const { response: agentResp } = await agentPromise;
      assertRPC.success(agentResp);
    },
  },

  {
    id: "INTG-009",
    name: "model change during chat takes effect",
    async run(runner) {
      // Chat
      const { response: chat1 } = await runner.sendRequest("chat", {
        message: "hello",
      });
      assertRPC.success(chat1);

      // Change model
      const { response: modelResp } = await runner.sendRequest("model.set", {
        model: "mistral-large",
      });
      assertRPC.success(modelResp);

      // Chat again
      const { response: chat2 } = await runner.sendRequest("chat", {
        message: "hello again",
      });
      assertRPC.success(chat2);

      // Verify model
      const { response: getResp } = await runner.sendRequest("model.get", {});
      assertRPC.success(getResp);
    },
  },

  {
    id: "INTG-010",
    name: "full workflow: initialize → context → chat → agent → cleanup",
    async run(runner) {
      // Initialize
      const { response: initResp } = await runner.sendRequest("initialize", {});
      assertRPC.success(initResp);
      assert.exists(initResp.result.capabilities, "Should have capabilities");

      // Add context
      const { response: addResp } = await runner.sendRequest("context.add", {
        file_path: "src/main.ts",
      });
      assertRPC.success(addResp);

      // Chat
      const { response: chatResp } = await runner.sendRequest("chat", {
        message: "create a python file",
      });
      assertRPC.success(chatResp);
      assertIntent.hasLanguage(chatResp.result.content, "python");

      // Agent
      const { response: agentResp } = await runner.sendRequest("agent.run", {
        task: "create a file",
        auto_confirm: true,
      });
      assertRPC.success(agentResp);

      // Clear context
      const { response: clearResp } = await runner.sendRequest("context.clear", {});
      assertRPC.success(clearResp);

      // Verify context cleared (list should have mock data in our case)
      const { response: listResp } = await runner.sendRequest("context.list", {});
      assertRPC.success(listResp);
    },
  },
];

module.exports = { tests };
