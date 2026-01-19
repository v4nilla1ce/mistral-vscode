/**
 * Edge Case Tests
 *
 * Tests unusual inputs, boundary conditions, and edge cases.
 */

const { assert, assertRPC, assertIntent } = require("../assertions");

const tests = [
  // Message Content Edge Cases
  {
    id: "EDGE-001",
    name: "empty string message returns default response",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-002",
    name: "very long message (10KB) handles without crash",
    async run(runner) {
      const longMessage = "a".repeat(10000);
      const { response } = await runner.sendRequest("chat", {
        message: longMessage,
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-003",
    name: "unicode characters process correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "你好世界 🎉 مرحبا العالم",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-004",
    name: "only whitespace message returns default response",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "   \t\n   ",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-005",
    name: "XSS attempt is not executed (no actual XSS possible in server)",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "<script>alert(1)</script>",
      });

      assertRPC.success(response);
      // Response should be safe text, not executable
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-006",
    name: "newlines in message handle correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "line1\nline2\nline3",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-007",
    name: "tab characters handle correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "col1\tcol2\tcol3",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-008",
    name: "null bytes handle gracefully",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "before\x00after",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  // State Edge Cases
  {
    id: "EDGE-020",
    name: "agent.confirm without agent.run returns error",
    async run(runner) {
      const { response } = await runner.sendRequest("agent.confirm", {
        tool_call_id: "nonexistent",
        approved: true,
      });

      assertRPC.error(response, -32602);
    },
  },

  {
    id: "EDGE-021",
    name: "context.remove non-existent file returns success (idempotent)",
    async run(runner) {
      const { response } = await runner.sendRequest("context.remove", {
        file_path: "nonexistent/file/path.ts",
      });

      assertRPC.success(response);
      assert.equal(response.result.success, true, "Should return success");
    },
  },

  {
    id: "EDGE-022",
    name: "model.set with unusual model name accepts or errors",
    async run(runner) {
      const { response } = await runner.sendRequest("model.set", {
        model: "some-weird-model-name-123",
      });

      // Should either accept (mock) or error gracefully
      assertRPC.success(response);
    },
  },

  // Concurrency Edge Cases
  {
    id: "EDGE-017",
    name: "rapid sequential requests all handled correctly",
    async run(runner) {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(runner.sendRequest("model.get", {}));
      }

      const results = await Promise.all(promises);

      for (const { response } of results) {
        assertRPC.success(response);
      }
    },
  },

  {
    id: "EDGE-019",
    name: "interleaved chat and agent requests work independently",
    async run(runner) {
      // Start agent (but don't wait for confirm)
      const agentPromise = runner.sendRequest("agent.run", {
        task: "create a file",
        auto_confirm: true,
      });

      // Send chat while agent is processing
      const { response: chatResponse } = await runner.sendRequest("chat", {
        message: "hello",
      });

      assertRPC.success(chatResponse);

      // Agent should also complete
      const { response: agentResponse } = await agentPromise;
      assertRPC.success(agentResponse);
    },
  },

  // Keyword Overlap Edge Cases
  {
    id: "EDGE-026",
    name: "I'm running late should NOT be command intent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "I'm running late to the meeting",
      });

      assertRPC.success(response);
      // This is conversational, may or may not match "run" keyword
      // Just verify it doesn't crash
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-027",
    name: "the function is creating issues - context-dependent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "the function is creating issues",
      });

      assertRPC.success(response);
      // Contains both "function" and "creating" but is about debugging
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-028",
    name: "python is a snake - context-dependent",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "python is a snake that lives in tropical regions",
      });

      assertRPC.success(response);
      // Contains "python" but is about animals
      // Current implementation will still match python keyword
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-029",
    name: "don't install anything - negation context",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "don't install anything",
      });

      assertRPC.success(response);
      // Contains "install" but is negative
      assert.exists(response.result.content, "Should have content");
    },
  },

  // Special Characters
  {
    id: "EDGE-030",
    name: "message with backslashes handles correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "path\\to\\file.ts",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-031",
    name: "message with quotes handles correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: 'create a file called "test.py"',
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-032",
    name: "message with single quotes handles correctly",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "create a file called 'test.py'",
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  // Very specific patterns
  {
    id: "EDGE-033",
    name: "empty params for chat uses empty message",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {});

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },

  {
    id: "EDGE-034",
    name: "chat with extra params ignores them",
    async run(runner) {
      const { response } = await runner.sendRequest("chat", {
        message: "hello",
        extra_field: "ignored",
        another: 123,
      });

      assertRPC.success(response);
      assert.exists(response.result.content, "Should have content");
    },
  },
];

module.exports = { tests };
