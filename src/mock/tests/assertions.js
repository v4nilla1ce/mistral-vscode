/**
 * Custom Assertions for Mock Server Tests
 *
 * Provides domain-specific assertions for testing RPC, intent detection, etc.
 */

class AssertionError extends Error {
  constructor(message, expected, actual) {
    super(message);
    this.name = "AssertionError";
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Basic assertions.
 */
const assert = {
  /**
   * Assert that a value is truthy.
   */
  ok(value, message = "Expected value to be truthy") {
    if (!value) {
      throw new AssertionError(message, "truthy", value);
    }
  },

  /**
   * Assert strict equality.
   */
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        expected,
        actual
      );
    }
  },

  /**
   * Assert deep equality.
   */
  deepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr !== expectedStr) {
      throw new AssertionError(
        message || `Deep equality failed`,
        expected,
        actual
      );
    }
  },

  /**
   * Assert that a value is not undefined/null.
   */
  exists(value, message = "Expected value to exist") {
    if (value === undefined || value === null) {
      throw new AssertionError(message, "defined value", value);
    }
  },

  /**
   * Assert that a string contains a substring.
   */
  contains(str, substring, message) {
    if (typeof str !== "string" || !str.includes(substring)) {
      throw new AssertionError(
        message || `Expected string to contain "${substring}"`,
        `string containing "${substring}"`,
        str
      );
    }
  },

  /**
   * Assert that a string matches a regex.
   */
  matches(str, regex, message) {
    if (typeof str !== "string" || !regex.test(str)) {
      throw new AssertionError(
        message || `Expected string to match ${regex}`,
        `string matching ${regex}`,
        str
      );
    }
  },

  /**
   * Assert that value is of expected type.
   */
  type(value, expectedType, message) {
    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new AssertionError(
        message || `Expected type ${expectedType}, got ${actualType}`,
        expectedType,
        actualType
      );
    }
  },

  /**
   * Assert that array has expected length.
   */
  length(arr, expectedLength, message) {
    if (!Array.isArray(arr) || arr.length !== expectedLength) {
      throw new AssertionError(
        message || `Expected length ${expectedLength}, got ${arr?.length}`,
        expectedLength,
        arr?.length
      );
    }
  },

  /**
   * Assert that array has at least expected length.
   */
  minLength(arr, minLength, message) {
    if (!Array.isArray(arr) || arr.length < minLength) {
      throw new AssertionError(
        message || `Expected at least ${minLength} items, got ${arr?.length}`,
        `>= ${minLength}`,
        arr?.length
      );
    }
  },

  /**
   * Assert that a value is greater than expected.
   */
  greaterThan(actual, expected, message) {
    if (!(actual > expected)) {
      throw new AssertionError(
        message || `Expected ${actual} > ${expected}`,
        `> ${expected}`,
        actual
      );
    }
  },

  /**
   * Assert that a promise rejects.
   */
  async rejects(promise, message = "Expected promise to reject") {
    try {
      await promise;
      throw new AssertionError(message, "rejection", "resolution");
    } catch (e) {
      if (e instanceof AssertionError) throw e;
      // Expected error - pass
    }
  },

  /**
   * Assert that a callback throws.
   */
  throws(fn, message = "Expected function to throw") {
    try {
      fn();
      throw new AssertionError(message, "exception", "no exception");
    } catch (e) {
      if (e instanceof AssertionError) throw e;
      // Expected error - pass
    }
  },
};

/**
 * RPC-specific assertions.
 */
const assertRPC = {
  /**
   * Assert valid JSON-RPC response structure.
   */
  validResponse(response, requestId) {
    assert.exists(response, "Response should exist");
    assert.equal(response.jsonrpc, "2.0", "jsonrpc should be 2.0");
    assert.equal(response.id, requestId, "Response id should match request");
    assert.ok(
      response.result !== undefined || response.error !== undefined,
      "Response must have result or error"
    );
  },

  /**
   * Assert response has result (success).
   */
  success(response) {
    assert.exists(response.result, "Response should have result");
    assert.ok(response.error === undefined, "Response should not have error");
  },

  /**
   * Assert response has error.
   */
  error(response, expectedCode) {
    assert.exists(response.error, "Response should have error");
    assert.exists(response.error.code, "Error should have code");
    assert.exists(response.error.message, "Error should have message");

    if (expectedCode !== undefined) {
      assert.equal(response.error.code, expectedCode, `Error code should be ${expectedCode}`);
    }
  },

  /**
   * Assert notification structure.
   */
  notification(notif, expectedMethod) {
    assert.exists(notif, "Notification should exist");
    assert.equal(notif.jsonrpc, "2.0", "jsonrpc should be 2.0");
    assert.ok(notif.id === undefined, "Notification should not have id");
    assert.exists(notif.method, "Notification should have method");

    if (expectedMethod) {
      assert.equal(notif.method, expectedMethod, `Method should be ${expectedMethod}`);
    }
  },
};

/**
 * Intent detection assertions.
 */
const assertIntent = {
  /**
   * Detect intent from code content.
   */
  detectFromCode(code) {
    // Check for file header comments indicating create intent
    if (code.match(/^#\s+\S+\.\w+/m) || code.match(/^\/\/\s+\S+\.\w+/m)) {
      return "create";
    }
    // Check for shell commands
    if (code.match(/^(npm|pip|yarn|brew|apt|cargo)\s/m) ||
        code.match(/^[$>%]\s/m)) {
      return "command";
    }
    // Default to edit
    return "edit";
  },

  /**
   * Extract language from response content.
   */
  extractLanguage(response) {
    const match = response.match(/```(\w+)/);
    return match ? match[1] : null;
  },

  /**
   * Extract code from markdown code block.
   */
  extractCode(response) {
    const match = response.match(/```\w+\n([\s\S]*?)```/);
    return match ? match[1] : null;
  },

  /**
   * Extract filename from code header.
   */
  extractFilename(code) {
    if (!code) return null;

    // Match Python style: # filename.py
    const pythonMatch = code.match(/^#\s+(\S+\.\w+)/m);
    if (pythonMatch) return pythonMatch[1];

    // Match JS/TS style: // filename.ts
    const jsMatch = code.match(/^\/\/\s+(\S+\.\w+)/m);
    if (jsMatch) return jsMatch[1];

    return null;
  },

  /**
   * Assert intent matches expected.
   */
  hasIntent(response, expectedIntent) {
    const code = this.extractCode(response);
    const actualIntent = code ? this.detectFromCode(code) : null;

    assert.equal(
      actualIntent,
      expectedIntent,
      `Expected intent "${expectedIntent}", got "${actualIntent}"`
    );
  },

  /**
   * Assert language matches expected.
   */
  hasLanguage(response, expectedLanguage) {
    const actualLanguage = this.extractLanguage(response);

    assert.equal(
      actualLanguage,
      expectedLanguage,
      `Expected language "${expectedLanguage}", got "${actualLanguage}"`
    );
  },

  /**
   * Assert filename matches expected.
   */
  hasFilename(response, expectedFilename) {
    const code = this.extractCode(response);
    const actualFilename = this.extractFilename(code);

    assert.equal(
      actualFilename,
      expectedFilename,
      `Expected filename "${expectedFilename}", got "${actualFilename}"`
    );
  },
};

/**
 * Streaming assertions.
 */
const assertStreaming = {
  /**
   * Assert content.delta notifications were received.
   */
  hasDeltas(notifications) {
    const deltas = notifications.filter(n => n.method === "content.delta");
    assert.minLength(deltas, 1, "Should have at least one content.delta notification");
    return deltas;
  },

  /**
   * Assert content.done notification was received.
   */
  hasDone(notifications) {
    const done = notifications.find(n => n.method === "content.done");
    assert.exists(done, "Should have content.done notification");
    assert.exists(done.params?.full_text, "content.done should have full_text");
    return done;
  },

  /**
   * Assert token.usage notification was received.
   */
  hasTokenUsage(notifications) {
    const usage = notifications.find(n => n.method === "token.usage");
    assert.exists(usage, "Should have token.usage notification");
    assert.exists(usage.params, "token.usage should have params");
    assert.type(usage.params.prompt, "number", "prompt should be number");
    assert.type(usage.params.completion, "number", "completion should be number");
    assert.type(usage.params.total, "number", "total should be number");
    return usage;
  },

  /**
   * Assert accumulated deltas match final text.
   */
  deltasMatchFinal(notifications, finalText) {
    const deltas = notifications.filter(n => n.method === "content.delta");
    const accumulated = deltas.map(d => d.params?.text || "").join("");

    // Trim both for comparison (streaming may add/remove whitespace)
    assert.equal(
      accumulated.trim(),
      finalText.trim(),
      "Accumulated deltas should match final text"
    );
  },
};

/**
 * Agent mode assertions.
 */
const assertAgent = {
  /**
   * Assert tool.pending notification was received.
   */
  hasPending(notifications) {
    const pending = notifications.find(n => n.method === "tool.pending");
    assert.exists(pending, "Should have tool.pending notification");
    assert.exists(pending.params?.tool_call_id, "tool.pending should have tool_call_id");
    assert.exists(pending.params?.tool, "tool.pending should have tool name");
    return pending;
  },

  /**
   * Assert tool.result notification was received.
   */
  hasResult(notifications, expectedSuccess) {
    const result = notifications.find(n => n.method === "tool.result");
    assert.exists(result, "Should have tool.result notification");

    if (expectedSuccess !== undefined) {
      assert.equal(
        result.params?.success,
        expectedSuccess,
        `Expected tool success=${expectedSuccess}`
      );
    }

    return result;
  },

  /**
   * Assert tool type matches expected.
   */
  hasTool(pending, expectedTool) {
    assert.equal(
      pending.params?.tool,
      expectedTool,
      `Expected tool "${expectedTool}", got "${pending.params?.tool}"`
    );
  },
};

module.exports = {
  assert,
  assertRPC,
  assertIntent,
  assertStreaming,
  assertAgent,
  AssertionError,
};
