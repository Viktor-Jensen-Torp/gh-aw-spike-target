---
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    toolsets: [repos, pull_requests]

safe-outputs:
  create-pull-request-review-comment:
    max: 5
  submit-pull-request-review:
    max: 1
    allowed-events: [COMMENT, REQUEST_CHANGES]
    supersede-older-reviews: true
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001

timeout-minutes: 15
---

# Pull request reviewer

Review pull request #${{ github.event.pull_request.number }} in
${{ github.repository }}.

1. Read the pull request's title, description and full diff.
2. For each concrete problem you find (a bug, a missing check, unclear code),
   leave a line comment on the exact changed line with
   `create_pull_request_review_comment`. Leave at least one line comment: if
   you find no problem, comment on the most important changed line saying what
   it does and why it looks right.
3. Submit one review with `submit_pull_request_review`. Use `REQUEST_CHANGES`
   if any comment points out a real problem, otherwise `COMMENT`. The review
   body is a short summary of what the change does and what you found.

Do not try to change any files.
