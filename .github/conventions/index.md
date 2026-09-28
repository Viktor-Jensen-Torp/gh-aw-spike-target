---
okf_version: "0.2"
type: Knowledge Bundle
title: Conventions
description: How code is written in this repository. Every agent that writes or reviews code starts here, then reads only the documents for the paths it touches.
tags: [conventions, agents]
references:
  - { title: "Harness engineering: leveraging Codex in an agent-first world", author: Ryan Lopopolo, url: "https://openai.com/index/harness-engineering/", published: 2026-02-11, retrieved: 2026-09-27 }
  - { title: "AGENTS.md", url: "https://agents.md/", retrieved: 2026-09-27 }
  - { title: "How Claude remembers your project", url: "https://code.claude.com/docs/en/memory", retrieved: 2026-09-27 }
---

# Conventions

This is the map. Read the documents under **Always**, then only those that match
the paths you will touch.

## Always

| Read | For |
|---|---|
| [chain/principles.md](chain/principles.md) | How these documents work, and the one check that decides |
| [chain/structure.md](chain/structure.md) | How code is grouped, modules, imports |
| [chain/testing.md](chain/testing.md) | Which test proves which acceptance case |
| [docs/architecture.md](../../docs/architecture.md) | This project: workspaces, features, tools, how a request flows |

## By path

| You touch | Read |
|---|---|
| `apps/web/**` | [web.md](web.md), and [chain/design.md](chain/design.md) when the issue claims design parts |
| `apps/web/src/components/**` | [components.md](components.md) |
| `apps/api/**` | [api.md](api.md) |
| `packages/shared/**` | [shared.md](shared.md) |

## Writing issues

| Read | For |
|---|---|
| [chain/issues.md](chain/issues.md) | How an issue is filled in: Done when, boundaries, design claims, dependencies, type, effort, priority. Read by the refiner and `/decompose` |

`chain/` is the same in every project that uses this pipeline and is updated with
it; the other documents are this project's own.
