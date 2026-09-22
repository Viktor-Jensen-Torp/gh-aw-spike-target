cat > /tmp/gh-aw/review_body.md <<'EOF'
**REQUEST_CHANGES** — PR contains unresolved critical bugs from prior review passes.

This PR adds `median()` and `mean()` helpers with tests, but the implementation has three blocking issues that were identified in previous review passes:

### Critical Issues (blocking merge)

1. **Data mutation bug** (line 18): `median()` mutates the caller's input array via `Array.sort()`. Fix: use `[...numbers].sort((a, b) => a - b)` to create a copy and use numeric sort.

2. **Wrong sort semantics** (line 18): `Array.sort()` without a comparator uses lexicographic order, not numeric. Multi-digit numbers [1, 2, 10, 20] will sort as [1, 10, 2, 20], producing wrong medians. Fix: add numeric comparator `(a, b) => a - b`.

3. **Insufficient test coverage**: Tests use only single-digit numbers (1–6), which pass despite the sort bug. Must add test cases with multi-digit numbers to expose the lexicographic sort defect.

Nine existing inline comments on lines 18 and 27 provide detailed reasoning and fixes for each issue. The PR has not been updated since these comments were posted.
EOF
jq -Rs '{body: .}' /tmp/gh-aw/review_body.md | safeoutputs submit_pull_request_review .
