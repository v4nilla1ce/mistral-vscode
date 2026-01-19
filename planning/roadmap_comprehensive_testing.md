# Roadmap: Comprehensive Test Suite for Mistral VS Code Extension

## Goal

Create an exhaustive automated test suite that validates every aspect of the mock server, Smart Apply features, intent detection, and UI behaviors. The tests should catch regressions and ensure reliability across all edge cases.

---

## Test Categories Overview

| Category | Test Count (Est.) | Priority |
|----------|-------------------|----------|
| 1. RPC Protocol | 25+ | Critical |
| 2. Intent Detection | 40+ | Critical |
| 3. Filename Extraction | 20+ | High |
| 4. Language Detection | 15+ | High |
| 5. Agent Mode | 20+ | Critical |
| 6. Streaming | 10+ | Medium |
| 7. Error Handling | 15+ | High |
| 8. Edge Cases | 30+ | High |
| 9. Integration | 10+ | Medium |

**Total Estimated Tests: 185+**

---

## Category 1: RPC Protocol Tests

### 1.1 Method Availability
Test that all required RPC methods are implemented and respond correctly.

| Test ID | Method | Input | Expected Output |
|---------|--------|-------|-----------------|
| RPC-001 | `initialize` | `{}` | `{ capabilities: {...}, version: "..." }` |
| RPC-002 | `chat` | `{ message: "hello" }` | `{ content: "..." }` |
| RPC-003 | `agent.run` | `{ task: "test" }` | Emits `tool.pending`, then response |
| RPC-004 | `agent.confirm` | `{ tool_call_id: "...", approved: true }` | `{ success: true }` |
| RPC-005 | `agent.confirm` | `{ tool_call_id: "...", approved: false }` | `{ success: true }` |
| RPC-006 | `agent.cancel` | `{}` | `{ success: true }` |
| RPC-007 | `context.add` | `{ file_path: "test.ts" }` | `{ success: true, message: "..." }` |
| RPC-008 | `context.remove` | `{ file_path: "test.ts" }` | `{ success: true, message: "..." }` |
| RPC-009 | `context.list` | `{}` | `{ files: [...], total_tokens: N }` |
| RPC-010 | `context.clear` | `{}` | `{}` |
| RPC-011 | `model.set` | `{ model: "mistral-large" }` | `{}` |
| RPC-012 | `model.get` | `{}` | `{ model: "..." }` |

### 1.2 Error Handling
| Test ID | Scenario | Expected |
|---------|----------|----------|
| RPC-013 | Unknown method | Error code -32601 "Method not found" |
| RPC-014 | Invalid JSON | Error code -32700 "Parse error" |
| RPC-015 | Missing jsonrpc field | Error code -32600 "Invalid Request" |
| RPC-016 | Wrong jsonrpc version | Error code -32600 "Invalid Request" |
| RPC-017 | Missing id field | Should still process (notification) |
| RPC-018 | Null params | Should use empty object default |

### 1.3 JSON-RPC Compliance
| Test ID | Scenario | Expected |
|---------|----------|----------|
| RPC-019 | Response has correct id | id matches request |
| RPC-020 | Response has jsonrpc "2.0" | Field present and correct |
| RPC-021 | Notification has no id | id field absent |
| RPC-022 | Batch requests | Not required, but should not crash |

---

## Category 2: Intent Detection Tests

### 2.1 Create Intent - Python
| Test ID | Message | Expected Intent | Expected Language |
|---------|---------|-----------------|-------------------|
| INT-001 | "create a python file" | create | python |
| INT-002 | "write python code" | create | python |
| INT-003 | "make a .py file" | create | python |
| INT-004 | "python script for data analysis" | create | python |
| INT-005 | "create main.py" | create | python |
| INT-006 | "new python module" | create | python |
| INT-007 | "generate python class" | create | python |
| INT-008 | "PYTHON FILE" (uppercase) | create | python |
| INT-009 | "PyThOn ScRiPt" (mixed case) | create | python |

### 2.2 Create Intent - TypeScript/JavaScript
| Test ID | Message | Expected Intent | Expected Language |
|---------|---------|-----------------|-------------------|
| INT-010 | "create a typescript file" | create | typescript |
| INT-011 | "new .ts file" | create | typescript |
| INT-012 | "make utils.ts" | create | typescript |
| INT-013 | "create javascript file" | create | typescript/javascript |
| INT-014 | "new component.tsx" | create | typescript |
| INT-015 | "create react component" | create | typescript |
| INT-016 | "new file" (generic) | create | typescript |
| INT-017 | "create a helper module" | create | typescript |

### 2.3 Command Intent
| Test ID | Message | Expected Intent | Expected Language |
|---------|---------|-----------------|-------------------|
| INT-018 | "npm install express" | command | bash |
| INT-019 | "run npm test" | command | bash |
| INT-020 | "install dependencies" | command | bash |
| INT-021 | "execute in terminal" | command | bash |
| INT-022 | "pip install pandas" | command | bash |
| INT-023 | "yarn add lodash" | command | bash |
| INT-024 | "run this command" | command | bash |
| INT-025 | "terminal command for..." | command | bash |
| INT-026 | "brew install node" | command | bash |
| INT-027 | "apt-get install git" | command | bash |

### 2.4 Edit Intent
| Test ID | Message | Expected Intent | Expected Language |
|---------|---------|-----------------|-------------------|
| INT-028 | "refactor this function" | edit | typescript |
| INT-029 | "update the code" | edit | typescript |
| INT-030 | "modify this method" | edit | typescript |
| INT-031 | "fix the bug in..." | edit | typescript |
| INT-032 | "improve this implementation" | edit | typescript |
| INT-033 | "change the function to..." | edit | typescript |
| INT-034 | "optimize this code" | edit | typescript |
| INT-035 | "add error handling" | edit | typescript |

### 2.5 Ambiguous Intent (Priority Testing)
| Test ID | Message | Contains | Should Match |
|---------|---------|----------|--------------|
| INT-036 | "create a python script and run it" | create, python, run | create (python first) |
| INT-037 | "install python dependencies" | install, python | command (install first) |
| INT-038 | "add a new python function" | add, new, python, function | create (python) |
| INT-039 | "run the typescript compiler" | run, typescript | command (run first) |
| INT-040 | "create a script to run npm" | create, run, npm | create (create first) |

---

## Category 3: Filename Extraction Tests

### 3.1 Explicit Filename Patterns
| Test ID | Message | Expected Filename |
|---------|---------|-------------------|
| FN-001 | "create a file called main.py" | main.py |
| FN-002 | "file named utils.ts" | utils.ts |
| FN-003 | "create app.tsx" | app.tsx |
| FN-004 | "make a file helper.js" | helper.js |
| FN-005 | "called test.py" | test.py |
| FN-006 | "named component.tsx" | component.tsx |

### 3.2 Path Extraction
| Test ID | Message | Expected Filename |
|---------|---------|-------------------|
| FN-007 | "create src/utils/helper.ts" | src/utils/helper.ts |
| FN-008 | "file called app/main.py" | app/main.py |
| FN-009 | "create ./components/Button.tsx" | ./components/Button.tsx |
| FN-010 | "make lib/utils.js" | lib/utils.js |

### 3.3 No Filename (Defaults)
| Test ID | Message | Expected Default |
|---------|---------|------------------|
| FN-011 | "create a python file" | main.py |
| FN-012 | "new typescript file" | src/utils/helper.ts |
| FN-013 | "make a js file" | (appropriate default) |

### 3.4 Edge Cases
| Test ID | Message | Expected Behavior |
|---------|---------|-------------------|
| FN-014 | "file called .env" | Should NOT extract (not code file) |
| FN-015 | "create test" (no extension) | Use default |
| FN-016 | "file named my file.py" (space) | Handle gracefully |
| FN-017 | "create a.b.c.py" (multiple dots) | a.b.c.py |
| FN-018 | "file: main.py" (colon separator) | main.py |
| FN-019 | "create 'main.py'" (quotes) | main.py |
| FN-020 | 'create "utils.ts"' (double quotes) | utils.ts |

---

## Category 4: Language Detection Tests

### 4.1 Code Block Language Tag
| Test ID | Code Block | Expected Language |
|---------|------------|-------------------|
| LANG-001 | ` ```python ` | python |
| LANG-002 | ` ```typescript ` | typescript |
| LANG-003 | ` ```javascript ` | javascript |
| LANG-004 | ` ```bash ` | bash |
| LANG-005 | ` ```sh ` | sh |
| LANG-006 | ` ```tsx ` | tsx |
| LANG-007 | ` ```jsx ` | jsx |
| LANG-008 | ` ```json ` | json |
| LANG-009 | ` ```css ` | css |
| LANG-010 | ` ```html ` | html |

### 4.2 Language Aliases
| Test ID | Tag | Should Map To |
|---------|-----|---------------|
| LANG-011 | `py` | python |
| LANG-012 | `ts` | typescript |
| LANG-013 | `js` | javascript |
| LANG-014 | `shell` | bash |
| LANG-015 | `zsh` | bash |

---

## Category 5: Agent Mode Tests

### 5.1 Tool Pending Flow
| Test ID | Scenario | Expected |
|---------|----------|----------|
| AGT-001 | Send agent.run | Receives tool.pending notification |
| AGT-002 | tool.pending has tool_call_id | ID is string, non-empty |
| AGT-003 | tool.pending has tool name | "write_file" or "run_command" |
| AGT-004 | tool.pending has arguments | Object with expected fields |

### 5.2 Tool Confirmation
| Test ID | Scenario | Expected |
|---------|----------|----------|
| AGT-005 | Confirm with approved=true | tool.result with success=true |
| AGT-006 | Confirm with approved=false | tool.result with success=false |
| AGT-007 | Confirm unknown tool_call_id | Error response |
| AGT-008 | Double confirm same tool | Should handle gracefully |

### 5.3 Auto-Confirm Mode
| Test ID | Scenario | Expected |
|---------|----------|----------|
| AGT-009 | agent.run with auto_confirm=true | No tool.pending, direct response |
| AGT-010 | agent.run with auto_confirm=false | Waits for confirmation |

### 5.4 Tool Types
| Test ID | Task Message | Expected Tool |
|---------|--------------|---------------|
| AGT-011 | "create a file" | write_file |
| AGT-012 | "write to disk" | write_file |
| AGT-013 | "run tests" | run_command |
| AGT-014 | "execute command" | run_command |
| AGT-015 | "file operation" | write_file |

### 5.5 Cancellation
| Test ID | Scenario | Expected |
|---------|----------|----------|
| AGT-016 | Cancel during pending | Clears pending, returns success |
| AGT-017 | Cancel with no pending | Returns success (idempotent) |
| AGT-018 | Confirm after cancel | Error (tool not found) |

### 5.6 Multiple Pending Tools
| Test ID | Scenario | Expected |
|---------|----------|----------|
| AGT-019 | Two agent.run before confirm | Both tracked separately |
| AGT-020 | Confirm first, then second | Both handled correctly |

---

## Category 6: Streaming Tests

### 6.1 Content Delta Notifications
| Test ID | Scenario | Expected |
|---------|----------|----------|
| STR-001 | Chat sends content.delta | Multiple notifications received |
| STR-002 | Delta text accumulates | Final equals full response |
| STR-003 | content.done notification | Sent after all deltas |
| STR-004 | content.done has full_text | Matches accumulated deltas |

### 6.2 Token Usage
| Test ID | Scenario | Expected |
|---------|----------|----------|
| STR-005 | token.usage notification | Has prompt, completion, total |
| STR-006 | Token counts are positive | All > 0 |
| STR-007 | total = prompt + completion | Math is correct |

### 6.3 Streaming Order
| Test ID | Scenario | Expected |
|---------|----------|----------|
| STR-008 | Order of notifications | deltas → done → response → usage |
| STR-009 | No deltas after done | content.done is terminal |
| STR-010 | Response after streaming | Final response sent last |

---

## Category 7: Error Handling Tests

### 7.1 Malformed Input
| Test ID | Input | Expected |
|---------|-------|----------|
| ERR-001 | Empty string | Parse error or ignore |
| ERR-002 | `{` (incomplete JSON) | Parse error |
| ERR-003 | `"hello"` (not object) | Invalid request |
| ERR-004 | `null` | Invalid request |
| ERR-005 | `[]` (array) | Invalid request |
| ERR-006 | Binary data | Parse error |

### 7.2 Missing Fields
| Test ID | Missing | Expected |
|---------|---------|----------|
| ERR-007 | No method field | Invalid request |
| ERR-008 | No params field | Use empty object |
| ERR-009 | Empty method | Method not found |

### 7.3 Invalid Values
| Test ID | Field | Value | Expected |
|---------|-------|-------|----------|
| ERR-010 | method | 123 (number) | Invalid request |
| ERR-011 | params | "string" | Invalid request |
| ERR-012 | id | {} (object) | Should still work |

### 7.4 Recovery
| Test ID | Scenario | Expected |
|---------|----------|----------|
| ERR-013 | Error then valid request | Server continues |
| ERR-014 | Multiple errors in sequence | All get responses |
| ERR-015 | Valid after malformed | Processes correctly |

---

## Category 8: Edge Cases

### 8.1 Message Content Edge Cases
| Test ID | Message | Expected Behavior |
|---------|---------|-------------------|
| EDGE-001 | Empty string "" | Default response |
| EDGE-002 | Very long message (10KB) | Handles without crash |
| EDGE-003 | Unicode characters "你好 🎉" | Processes correctly |
| EDGE-004 | Only whitespace "   " | Default response |
| EDGE-005 | Special chars "<script>alert(1)</script>" | No XSS in response |
| EDGE-006 | Newlines in message | Handles correctly |
| EDGE-007 | Tab characters | Handles correctly |
| EDGE-008 | Null bytes "\0" | Handles gracefully |

### 8.2 Code Block Edge Cases
| Test ID | Scenario | Expected |
|---------|----------|----------|
| EDGE-009 | Empty code block | Valid response |
| EDGE-010 | Code with backticks inside | Properly escaped |
| EDGE-011 | Nested code blocks | Handles correctly |
| EDGE-012 | No language tag ` ``` ` | Detects from content |

### 8.3 Filename Edge Cases
| Test ID | Filename | Expected |
|---------|----------|----------|
| EDGE-013 | Very long filename (255 chars) | Truncate or error |
| EDGE-014 | Reserved names (CON, PRN on Windows) | Handle gracefully |
| EDGE-015 | Path traversal "../../../etc/passwd" | Sanitize or reject |
| EDGE-016 | Absolute path "/etc/passwd" | Reject or make relative |

### 8.4 Concurrency Edge Cases
| Test ID | Scenario | Expected |
|---------|----------|----------|
| EDGE-017 | Rapid sequential requests | All handled correctly |
| EDGE-018 | Request during streaming | Queued or parallel |
| EDGE-019 | Interleaved chat and agent | Both work independently |

### 8.5 State Edge Cases
| Test ID | Scenario | Expected |
|---------|----------|----------|
| EDGE-020 | agent.confirm without agent.run | Error gracefully |
| EDGE-021 | context.remove non-existent file | Success (idempotent) |
| EDGE-022 | model.set invalid model name | Accept or error |

### 8.6 Timing Edge Cases
| Test ID | Scenario | Expected |
|---------|----------|----------|
| EDGE-023 | Immediate disconnect after request | Handles gracefully |
| EDGE-024 | Very slow client (delayed reads) | Doesn't block |
| EDGE-025 | stdin closed mid-request | Exits cleanly |

### 8.7 Keyword Overlap Edge Cases
| Test ID | Message | Should NOT Match |
|---------|---------|------------------|
| EDGE-026 | "I'm running late" | Should NOT be command |
| EDGE-027 | "the function is creating issues" | Should NOT be create |
| EDGE-028 | "python is a snake" | Context-dependent |
| EDGE-029 | "don't install anything" | Should NOT be command |
| EDGE-030 | "create" as part of "procreate" | Should NOT be create |

---

## Category 9: Integration Tests

### 9.1 Full Chat Flow
| Test ID | Scenario | Expected |
|---------|----------|----------|
| INTG-001 | Send message → receive response | Full cycle works |
| INTG-002 | Multiple messages in sequence | All work correctly |
| INTG-003 | Add context → chat → remove context | State maintained |

### 9.2 Full Agent Flow
| Test ID | Scenario | Expected |
|---------|----------|----------|
| INTG-004 | agent.run → pending → confirm → result | Complete cycle |
| INTG-005 | agent.run → pending → deny → cancelled | Denial works |
| INTG-006 | agent.run → pending → cancel → clean | Cancellation works |

### 9.3 Mixed Mode
| Test ID | Scenario | Expected |
|---------|----------|----------|
| INTG-007 | Chat then agent then chat | Both modes work |
| INTG-008 | Context add during agent run | No interference |
| INTG-009 | Model change during chat | Takes effect |
| INTG-010 | Multiple clients (if applicable) | Isolation maintained |

---

## Implementation Plan

### Phase 1: Test Infrastructure
1. Create test runner framework with:
   - Test case definition schema
   - Assertion helpers
   - Reporting (pass/fail/skip)
   - Timing measurements
   - JSON output for CI

### Phase 2: Core Tests
1. Implement RPC protocol tests (Category 1)
2. Implement intent detection tests (Category 2)
3. Implement filename extraction tests (Category 3)

### Phase 3: Advanced Tests
1. Implement agent mode tests (Category 5)
2. Implement streaming tests (Category 6)
3. Implement error handling tests (Category 7)

### Phase 4: Edge Cases
1. Implement all edge case tests (Category 8)
2. Add fuzzing tests for robustness

### Phase 5: Integration
1. Implement integration tests (Category 9)
2. Add performance benchmarks

---

## Test File Structure

```
src/mock/
├── mock-server.js              # Mock CLI server
├── test-mock-server.js         # Current basic tests
└── tests/
    ├── index.js                # Test runner entry
    ├── runner.js               # Test execution engine
    ├── assertions.js           # Custom assertions
    ├── fixtures/               # Test data
    │   ├── messages.json       # Test messages
    │   └── responses.json      # Expected responses
    ├── rpc/
    │   ├── methods.test.js     # RPC method tests
    │   └── errors.test.js      # RPC error tests
    ├── intent/
    │   ├── create.test.js      # Create intent tests
    │   ├── command.test.js     # Command intent tests
    │   ├── edit.test.js        # Edit intent tests
    │   └── ambiguous.test.js   # Priority tests
    ├── extraction/
    │   ├── filename.test.js    # Filename extraction
    │   └── language.test.js    # Language detection
    ├── agent/
    │   ├── flow.test.js        # Agent workflow tests
    │   ├── tools.test.js       # Tool type tests
    │   └── cancel.test.js      # Cancellation tests
    ├── streaming/
    │   └── stream.test.js      # Streaming tests
    ├── errors/
    │   └── handling.test.js    # Error handling tests
    ├── edge/
    │   └── edge-cases.test.js  # Edge case tests
    └── integration/
        └── full-flow.test.js   # Integration tests
```

---

## Success Criteria

1. **Coverage**: All 185+ test cases pass
2. **Performance**: Full suite runs in < 30 seconds
3. **Stability**: Tests are deterministic (no flaky tests)
4. **CI Ready**: Can run in automated pipeline
5. **Reporting**: Clear pass/fail output with details

---

## Commands

```bash
# Run all tests
node src/mock/tests/index.js

# Run specific category
node src/mock/tests/index.js --category=intent

# Run with verbose output
node src/mock/tests/index.js --verbose

# Generate JSON report
node src/mock/tests/index.js --output=results.json

# Run only failing tests from last run
node src/mock/tests/index.js --failed-only
```

---

## Notes

- Tests should be independent (no shared state between tests)
- Each test should clean up after itself
- Use descriptive test names for easy debugging
- Consider adding property-based testing for edge cases
- Mock server should not need modification for tests (test the actual implementation)
