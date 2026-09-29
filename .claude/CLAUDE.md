# gh-aw-spike-target

For Claude Code sessions that investigate this repository's workflow runs.

It lives in `.claude/`, not at the root, on purpose: the pipeline's agents (Pi,
under GitHub Agentic Workflows) load a root `CLAUDE.md` or `AGENTS.md` as their
own instructions, and Pi looks only in the working directory and above it
(Pi 0.84.3, `dist/core/resource-loader.js`). Claude Code reads it from here.

## What is here

- An app (Tempo: `apps/web`, `apps/api`, `packages/shared`) built by a chain of
  agentic workflows: refine → implement → review → rework → merge queue.
- The workflows are `.github/workflows/*.md` (the source) and `*.lock.yml`
  (what actually runs; where the two disagree, the lock decides). Shared parts
  are in `.github/workflows/shared/`.
- The checks every change must pass: `.github/scripts/verify.sh`. The rules
  agents follow: `.github/conventions/index.md`. The app's map:
  `docs/architecture.md`.

## Investigating a run

The job is to find the root cause, with evidence, not to fix anything.

- **Read the whole log, not grep.** Grepping finds the first match and misses
  what explains it. Download it once, split it per job, and read each relevant
  job in full:

  ```bash
  gh run view <run-id> --log > run.log
  cut -f1 run.log | uniq -c          # the jobs, in order
  grep -P '^agent\t' run.log | cut -f3- > agent.log
  ```

- **Write findings to a file as you read**, then review the file before
  concluding. Every finding cites the run id, the job and the line.
- **Where things are in a gh-aw run:**
  - `activation`: the prompt the agent got.
  - `agent`: the pre-agent steps (issue, requirements, design files) and the
    agent's own session as JSON lines in the `Execute Pi CLI` step.
  - `detection`: the threat scan of the agent's output.
  - `safe_outputs`: what the agent actually handed in ("Processing message …"),
    including `report_incomplete` and its reason.
  - `conclusion`: gh-aw's failure handling, and for Review the routing step
    ("Route on the posted verdict").
- **Establish, don't assume**: a claim says how it was established (the run,
  the lock, the API).
- **What an agent was given**: `bash .github/scripts/agent-inputs.sh <role>`
  maps its prompt sections, the files prepared for it, the guard's refusals and
  nudges. A run's `aw-prompts/prompt.txt` is the full prompt it actually got.

## Working here

- Report findings; do not change code, labels, issues or pull requests unless
  asked.
- In a cloud session, GitHub's GraphQL API is limited to pull-request
  operations. Use REST through `gh api repos/Viktor-Jensen-Torp/gh-aw-spike-target/...`
  when a `gh` command is refused. The `gh aw` extension is not installed; plain
  `gh run view` and `gh api` read everything a run left behind.
