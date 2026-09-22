cat > /tmp/gh-aw/check_summary.md <<'EOF'
## Blocking Issues

1. **Data mutation bug** (line 18, src/index.js): `median()` mutates input array via `Array.sort()`. Fix: use `[...numbers].sort((a, b) => a - b)`.

2. **Wrong sort semantics** (line 18, src/index.js): Lexicographic sort instead of numeric. Multi-digit numbers sort incorrectly. Fix: add numeric comparator `(a, b) => a - b`.

3. **Insufficient test coverage** (test/index.test.js): Only single-digit test cases; tests fail to expose the sort bug. Add test cases with multi-digit numbers.

Nine existing inline comments provide detailed reasoning and fixes.
EOF
jq -Rs --arg conclusion failure --arg title "REQUEST_CHANGES — 3 blocking issues" '{conclusion: $conclusion, title: $title, summary: .}' /tmp/gh-aw/check_summary.md | safeoutputs create_check_run .
