---
name: decompose
description: Turn a source (a design file, an ADR, a spec) into an epic and its sub-issues, grilling the person on the logic first.
disable-model-invocation: true
---

# Decompose

You and a person turn a source into an **epic** and its **sub-issues** in this
repository's GitHub issues. The person decides; you find the facts, draft, and
write.

The shapes are fixed: the epic follows `.github/ISSUE_TEMPLATE/epic.md`, every
sub-issue follows `.github/ISSUE_TEMPLATE/work-item.md`. A sub-issue is one pull
request's worth, reviewable in one sitting.

## 1. Read

Read the source in full, both templates, `.github/conventions/`, `src/` and
`test/`, and the open issues:

```bash
gh issue list --state open --limit 200 --json number,title,body,labels
```

Done when you can list every behaviour the source asks for, and mark each one
as already built, already an issue (by number), or new.

## 2. Grill the logic

The source settles screens and wording. The logic is yours to pin down with the
person: rules, states, what happens at zero, at the maximum, on bad input, and
what is out of scope. Grill them with the `grilling` skill; without it, ask in
rounds of numbered questions, each with your recommended answer. Look facts up
yourself and put only decisions to the person. Ask which pieces matter most:
priority is theirs to set, High, Medium or Low, or unset.

Done when every new behaviour from step 1 has its boundaries decided by the
person, so no case you will write is your own guess.

## 3. Draft the plan

Slice **vertically**: each sub-issue delivers one behaviour a user or a test can
see, end to end. Add a foundation piece (a store, a data model) only when two or
more slices need it first. Every "Done when" case comes from a decision in
step 2. What the source leaves out goes under the epic's "Out of scope". The
epic's "Sources" lists the source paths, so a change to them sends its
sub-issues back to refinement.

Record a dependency only where one piece cannot finish without the other, with
a one-line why. Type each piece `Feature` (new behaviour), `Bug` or `Task`.

Write the plan as JSON to a temporary file outside the repository, in the
format `bash .claude/skills/decompose/create-issues.sh --help` prints. To add to
an existing epic, give its number instead of a title and body.

Done when every new behaviour from step 1 sits in exactly one sub-issue or in
"Out of scope".

## 4. Show, then create

Show the person the tree from
`bash .claude/skills/decompose/create-issues.sh --dry-run <plan>`, and change the
plan until they approve it. Then create it:

```bash
bash .claude/skills/decompose/create-issues.sh <plan>
```

The script sets types, priorities, sub-issue links and "blocked by" links, and
writes each dependency as a `Depends on #N — why` line. It leaves `ready` and
the sprint alone: the refiner judges ready overnight, and sprints are decided at
planning.

Done when the script has printed a number for the epic and for every sub-issue,
you have given the person the epic's link, and you have passed on any warning
it printed.
