---
emoji: "🚢"
description: Reads a release pull request (develop → main) for the person who will merge it.
intent: Give a developer the one thing per-change review cannot give them — what a day's agent work does together — without taking the decision away from them.

on:
  pull_request:
    types: [opened, synchronize, reopened]
    # The release pull request only. review.md is scoped to `develop` and takes
    # the individual agent pull requests.
    branches: [main]
  # The release pull request is opened by release.yml as the reviewer App.
  bots: [gh-aw-spike-reviewer]

permissions:
  contents: read
  pull-requests: read
  # The read names the issues its changes close, so it may look one up.
  issues: read

engine:
  id: pi
  model: anthropic/claude-haiku-4-5-20251001
  env:
    PI_ROLE: release

pre-agent-steps:
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      echo "installed: $(wc -c < /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js) bytes, role=$PI_ROLE"
    env:
      PI_ROLE: release

  # The one thing per-change review is blind to by construction: two changes
  # that are each correct against the branch they were cut from, and wrong
  # together. Which files more than one change touched is a fact, not a
  # judgement, so it is computed here and handed to the agent — the agent must
  # never be the thing that counts.
  - name: Pre-fetch what this release contains
    env:
      GH_TOKEN: ${{ github.token }}
      REPO: ${{ github.repository }}
      BASE: ${{ github.event.pull_request.base.ref }}
      HEAD: ${{ github.event.pull_request.head.ref }}
      MAX_COMMITS: "50"
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/agent
      CMP=$(gh api "repos/$REPO/compare/$BASE...$HEAD" --jq \
        "{ahead: .ahead_by, commits: [.commits[] | {sha: .sha, subject: (.commit.message | split(\"\n\")[0])}] }")
      echo "$CMP" | jq --argjson m "$MAX_COMMITS" '.commits |= .[-$m:]' > /tmp/gh-aw/agent/release-compare.json

      # Per-commit file lists, then the files more than one commit touched.
      : > /tmp/gh-aw/agent/release-files.jsonl
      for SHA in $(jq -r '.commits[].sha' /tmp/gh-aw/agent/release-compare.json); do
        gh api "repos/$REPO/commits/$SHA" \
          --jq "{sha: \"$SHA\", files: [.files[].filename]}" \
          >> /tmp/gh-aw/agent/release-files.jsonl
      done
      jq -s '
        [ .[] as $c | $c.files[] | {file: ., sha: $c.sha} ]
        | group_by(.file)
        | map(select(length > 1) | {file: .[0].file, commits: [.[].sha[0:8]]})
      ' /tmp/gh-aw/agent/release-files.jsonl > /tmp/gh-aw/agent/release-overlap.json

      gh api "repos/$REPO/compare/$BASE...$HEAD" \
        --jq '[.files[] | "\(.filename) +\(.additions) -\(.deletions)"] | join("\n")' \
        > /tmp/gh-aw/agent/release-diffstat.txt || true

      echo "release: $(jq -r '.ahead // 0' /tmp/gh-aw/agent/release-compare.json) commits, $(jq 'length' /tmp/gh-aw/agent/release-overlap.json) shared file(s)"

tools:
  cli-proxy: true
  github:
    mode: gh-proxy
    min-integrity: approved
    toolsets: [pull_requests, repos, issues]
  bash: ["*"]
  timeout: 300

safe-outputs:
  github-app:
    client-id: ${{ vars.REVIEWER_CLIENT_ID }}
    private-key: ${{ secrets.REVIEWER_APP_PRIVATE_KEY }}
  submit-pull-request-review:
    max: 1
    # COMMENT only, deliberately. This role advises the person who merges; it
    # holds no authority over the release and REQUEST_CHANGES would claim some.
    # `main` is merged by a human with this read in front of them.
    allowed-events: [COMMENT]
    supersede-older-reviews: true
  noop:
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    continue-on-error: false
    retries: 2

timeout-minutes: 15
---

# Release read

You are writing the note a developer reads before merging today's release of
`${{ github.repository }}` from `develop` into `main`. They decide; you inform.

Each change in this release was already reviewed on its own, and merged only
because that review passed. **Do not review the changes again.** Your job is the
part no per-change review could do: say what this release does *as a whole*, and
where its parts touch each other.

## Step 1: Read the pre-fetched facts

- `/tmp/gh-aw/agent/release-compare.json` — the commits shipping, newest last.
  Each squashed subject ends with the pull request number, `(#n)`.
- `/tmp/gh-aw/agent/release-overlap.json` — **files more than one commit
  touched**, already computed. This is the important one.
- `/tmp/gh-aw/agent/release-diffstat.txt` — per-file additions and deletions.

Use `gh` to read an issue or pull request when a subject line is not enough.
Do not re-read every diff; you have a budget and the detail is not the job.

## Step 2: Write the read

Submit one review with `submit_pull_request_review`, event `COMMENT`, shaped:

1. **One line on the release**: how many changes, and what they add up to.
2. **What is shipping** — one line per change, in the order they merged:
   `#n — what it does`. Plain language; a developer scanning this should be able
   to tell which of their issues is in here.
3. **Where changes meet** — for every entry in the overlap file, name the file,
   the changes that touched it, and whether they look independent or whether one
   assumes something the other changed. If the overlap file is empty, say so in
   one line: no two changes in this release touched the same file.
4. **Worth a closer look** — at most three items, each naming the change and why.
   If nothing qualifies, say that plainly rather than inventing something.

## Step 3: Say what the options are

End with the three ways this release can go, and which you would pick:

- **Ship it.**
- **Ship it and file a follow-up** — name the issue you would open.
- **Revert one change and ship the rest** — name the `#n`. Each change is a
  single squashed commit on `develop`, so reverting one is one click; a
  developer merges the revert with their admin override, since the agent
  reviewer cannot usefully judge a change whose purpose is removal.

Never recommend holding the whole release without naming what would have to
change for it to go out. A gate whose only answer is "stop" stops being used.

You cannot approve or request changes, and you are not a gate: `main` is merged
by a person. If there is genuinely nothing to say — an empty release — call
`noop` with a one-line reason instead of submitting an empty review.
