cat <<'EOF' > /tmp/gh-aw/review-body.md
**REQUEST_CHANGES — 3 blocking issues remain unfixed from prior review.**

The PR adds `mean()` and `median()` functions. The `mean()` function is correct, but `median()` has two critical bugs that have been identified in prior review comments and remain unaddressed.

### Critical Issues

**1. Data mutation bug (line 18):** `const sorted = numbers.sort()` mutates the caller's input array. Use `const sorted = [...numbers].sort((a, b) => a - b)` instead.

**2. Wrong sort semantics (line 18):** `Array.sort()` without a numeric comparator uses lexicographic (string) order, not numeric order. Multi-digit numbers like `[100, 5, 50]` will sort incorrectly.

**3. Insufficient test coverage:** Test cases use only single-digit numbers, which happen to sort identically in both lexicographic and numeric order, masking the sort bug. Add a test with multi-digit numbers like `median([100, 5, 50])` to expose the issue.

See the 9 existing inline comments on this PR for detailed explanation of each bug and recommended fixes.
EOF
safeoutputs submit_pull_request_review . <<'PAYLOAD'
{"pull_request_number": 8, "event": "REQUEST_CHANGES", "body": "**REQUEST_CHANGES — 3 blocking issues remain unfixed from prior review.**\n\nThe PR adds `mean()` and `median()` functions. The `mean()` function is correct, but `median()` has two critical bugs that have been identified in prior review comments and remain unaddressed.\n\n### Critical Issues\n\n**1. Data mutation bug (line 18):** `const sorted = numbers.sort()` mutates the caller's input array. Use `const sorted = [...numbers].sort((a, b) => a - b)` instead.\n\n**2. Wrong sort semantics (line 18):** `Array.sort()` without a numeric comparator uses lexicographic (string) order, not numeric order. Multi-digit numbers like `[100, 5, 50]` will sort incorrectly.\n\n**3. Insufficient test coverage:** Test cases use only single-digit numbers, which happen to sort identically in both lexicographic and numeric order, masking the sort bug. Add a test with multi-digit numbers like `median([100, 5, 50])` to expose the issue.\n\nSee the 9 existing inline comments on this PR for detailed explanation of each bug and recommended fixes."}
PAYLOAD
