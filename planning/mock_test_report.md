# Mock Server Test Run Analysis
**Date:** 2026-01-19
**Scope:** `src/mock/tests/`
**Status:** ❌ FAILED (6/159 tests failed)

## Executive Summary
The comprehensive mock server test suite was executed, resulting in a **96.2% pass rate** (153/159). However, 6 critical failures were identified, primarily focusing on **filename extraction for specific extensions (.tsx)** and **RPC error handling robustness**.

## detailed Failure Analysis

### 1. Filename & Language Extraction (3 Failures)
This category had the highest failure rate. The regex-based extraction logic seems to struggle with specific extensions and contexts.

- **[FN-003] create app.tsx → extracts app.tsx**
  - **Expected:** `app.tsx`
  - **Actual:** `app.ts`
  - **Root Cause:** The extraction regex likely prioritizes `.ts` or captures it greedily before checking for the trailing `x`.

- **[FN-006] named component.tsx → extracts component.tsx**
  - **Expected:** `component.tsx`
  - **Actual:** `component.ts`
  - **Root Cause:** Same as above. `tsx` support seems missing or shadowed by `ts`.

- **[FN-004] make a file helper.js → extracts helper.js**
  - **Expected:** `helper.js`
  - **Actual:** `null`
  - **Root Cause:** The pattern "make a file [name]" might not be covered by the extraction regex, which might rely on specific phrasing (e.g., "called [name]" or code blocks).

### 2. Intent Detection (1 Failure)
- **[INT-040] create a script to run npm → create**
  - **Expected:** `create`
  - **Actual:** `command`
  - **Root Cause:** The presence of "run npm" likely triggered the command-detection heuristic (looking for "npm", "run", etc.) which overrode the explicit "create a script" user intent. This suggests a priority conflict in keyword matching.

### 3. RPC & Error Handling (2 Failures)
- **[RPC-014] Invalid JSON returns parse error -32700**
  - **Effect:** The server crashed or returned nothing instead of a structured JSON-RPC error.
  - **Root Cause:** Malformed JSON handling in the server's data buffer loop might be silent instead of emitting an error response.

- **[ERR-003] string instead of object returns invalid request**
  - **Effect:** Sending a raw string (not JSON) did not trigger an invalid request error.
  - **Root Cause:** Similar to above, non-JSON input is likely discarded rather than processed as an error case.

## Recommendations

1.  **Fix Regex needed for TSX:** Update `extractFilename` regex to ensure `.tsx` and `.jsx` are captured correctly. Order of matching matters (check longer extensions first).
2.  **Refine Intent Heuristics:** The "create" intent keywords (create, make, generate) should have higher precedence than command keywords when both are present.
3.  **Harden JSON Parsing:** The `_parseBuffer` or server input handler needs an `else` or `catch` block that specifically sends back a JSON-RPC Parse Error (-32700) when `JSON.parse` fails on a complete line (or what is assumed to be a message).
