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
sub-issue follows `.github/ISSUE_TEMPLATE/work-item.md`. How to fill them in is
`.github/conventions/chain/issues.md`, the same rules the refiner follows, so
an issue from here and one from the refiner read alike. A sub-issue is one pull
request's worth, reviewable in one sitting.

## 1. Read

Read the source in full, both templates, `.github/conventions/`, `src/` and
`test/`, and the open issues:

```bash
gh issue list --state open --limit 200 --json number,title,body,labels
```

For a design file, the ids decide what is new, not your reading:
`bash .github/scripts/design-claims.sh <path/to/file.pen>` lists every frame
with the issues whose claim covers it. `UNCLAIMED` frames are the new work;
claimed ones are already an issue, open or built. After a design change,
`bash .github/scripts/design-diff.sh <old.pen> <new.pen>` (the old version from
`git show <rev>:<path>`) lists exactly which parts changed. A change inside a
built issue's claims already has a draft follow-up, titled "Design changed: …"
and saying "Follows #N" (`back-to-refinement.yml`). Read those too: they are
that change's issue, so do not create a second one for it. How a pen file is
built: `.github/conventions/chain/design.md`. Issues claim parts and do not
copy their values (`issues.md`, "Design claims").

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

Write each piece as `issues.md` says: its "Done when", design claims,
dependencies (in the plan's `depends_on`, which the script turns into the
`Depends on #N — why` lines), type and effort. Together the pieces claim every
new frame from the claims list.

Give every piece an "Out of scope" that names the nearby work its siblings do,
by the sibling's key: `The sign-in route: #{sign-in}.` The script turns each
key into the sibling's number. Look hardest where one piece builds something
another relies on (an API before its screens, a component before the screen
that uses it). Name what the later piece adds, so the earlier one does not
build it to make its own test pass. A piece with no neighbours says "Nothing
nearby."

Write the plan as JSON to a temporary file outside the repository, in the
format `bash .claude/skills/decompose/create-issues.sh --help` prints. To add to
an existing epic, give its number instead of a title and body.

Done when every new behaviour from step 1 sits in exactly one sub-issue or in
"Out of scope".

## 4. Show, then create

Show the person the tree from
`bash .claude/skills/decompose/create-issues.sh --dry-run <plan>`, and change the
plan until they approve it. The dry run also checks every body against its
template.

Then ask the person the stage of each issue, and put it in the plan as `stage`:

- `ready`: they have read it and it can start as it is. Its body must pass the
  template check, or the script refuses the plan.
- `needs-refinement` (the default): the refiner shapes it overnight and marks it
  `refined`; they set `ready` after.
- `draft`: no stage label; nothing touches it until they add one.

Then create it:

```bash
bash .claude/skills/decompose/create-issues.sh <plan>
```

The script sets types, priorities, sub-issue links and "blocked by" links,
writes each dependency as a `Depends on #N — why` line, and renders every
claimed design part into an image attached under its claim. Images need the
pen.dev CLI logged in (`pen status`) and gh 2.99 or later; without them the
issues are created without images, and the script warns. Each issue gets the
stage label the person chose. Sprints are decided at planning.

Done when the script has printed a number for the epic and for every sub-issue,
you have given the person the epic's link, and you have passed on any warning
it printed.
