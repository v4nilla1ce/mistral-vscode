# Roadmap: Mock Suite Fixes

**Goal:** Ensure `mistral-vscode` mock server passes 100% of the comprehensive test suite (currently 153/159 passed).

## Current Status
- **Pass Rate:** 96.2%
- **Failures:** 6 (3 Extraction, 1 Intent, 2 RPC/Error)
- **Source File:** `src/mock/mock-server.js`

## Plan of Action

### Phase 1: Fix Filename Extraction (High Priority)
**Problem:** The current regex incorrectly extracts `.ts` from `.tsx` filenames and fails to identify filenames in some natural language contexts ("make a file helper.js").
**Solution:** 
1.  Update the regex comparison to prioritize longer extensions first (greedy matching).
2.  Ensure word boundaries `\b` are correctly applied.
3.  Refine `pattern2` to catch direct filenamementions more robustly.

**Changes:**
```javascript
// Current
const pattern2 = message.match(/\b(\w+\.(?:py|ts|js|tsx|jsx))\b/i);

// Proposed (Sort extensions by length: tsx before ts)
const pattern2 = message.match(/\b([a-zA-Z0-9_\-]+\.(?:tsx|jsx|py|ts|js))\b/i);
```

### Phase 2: Refine Intent Detection Logic
**Problem:** "create a script to run npm" is misclassified as a `command` intent because "run" and "npm" trigger the command detector, overshadowing the "create" intent.
**Solution:** 
1.  Modify the command detection block to explicitly check if "create", "make", or "generate" are present.
2.  If "create" words are found, skip the early command return and allow the Create File logic to handle it.

**Changes:**
```javascript
// Current
if (hasCommandKeyword && !hasExplicitPyFile) { ... }

// Proposed
const isCreateIntent = lower.includes("create") || lower.includes("make") || lower.includes("generate");
if (hasCommandKeyword && !hasExplicitPyFile && !isCreateIntent) { ... }
```

### Phase 3: Harden RPC Error Handling
**Problem:** Invalid JSON inputs are causing the server to fail silently or return responses that tests don't recognize as errors.
**Solution:**
1.  Verify the `catch` block in `rl.on("line")` correctly sends a JSON-RPC 2.0 Error object.
2.  Ensure `sendResponse` handles `null` IDs correctly (allowed for parsing errors).
3.  Ensure no `console.error` leaks into stdout if that's confusing the runner.

### Verification Plan
After applying changes, run the full suite:
```powershell
node src/mock/tests/index.js
```
Expected result: **159/159 passed**.

## Timeline
- **Step 1:** Apply Regex fixes. Run tests.
- **Step 2:** Apply Intent fixes. Run tests.
- **Step 3:** Apply Error handling fixes. Run tests.
- **Step 4:** Final verification and commit.
