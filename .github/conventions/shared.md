---
type: Convention
title: Shared contract
description: How the Zod schemas that define the API contract are written and named. Read when touching packages/shared.
tags: [shared, zod, contract]
resource: ../../packages/shared
---

# Shared contract

`packages/shared` is the contract between the web app and the API, and nothing
else: schemas, the types derived from them, and constants both sides need (such
as the password rule). No I/O, no framework code.

- One file per feature (`auth.ts`, `tasks.ts`), matching the feature folders.
- Names say direction: `CreateTaskRequest`, `TaskResponse`, `ListTasksQuery`.
  Types come from the schemas (`type TaskResponse = z.infer<typeof TaskResponse>`),
  never written by hand.
- Validation messages are the design's words ("Task name can't be empty"), so
  both sides show the same message.
- Changing a schema changes both sides in the same pull request; the type
  checker finds every place that has to follow. **Checked by** typecheck.
