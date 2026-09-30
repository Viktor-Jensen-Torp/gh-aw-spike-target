---
type: Architecture
title: Tempo architecture
description: What this project is made of: its workspaces, its features and where they live, its tools, and how a request flows from screen to database. Kept current by every change that adds, moves or removes a feature.
tags: [architecture, tempo]
resource: ../apps ../packages
---

# Tempo architecture

Tempo is a task app: people sign in and manage their own tasks, by list and by
project. The design is `design/tempo.pen`.

## Workspaces

| Path | Package | Holds |
|---|---|---|
| `apps/web/` | `@tempo/web` | The React app (Vite, TypeScript, Tailwind, React Router) |
| `apps/api/` | `@tempo/api` | The HTTP API (Fastify, TypeScript, Drizzle over Node's `node:sqlite`) |
| `packages/shared/` | `@tempo/shared` | The contract: Zod schemas and the types derived from them |

## Features

| Feature | Web | API | Shared |
|---|---|---|---|
| home | `apps/web/src/features/home/`: the start page, until sign-in replaces it | `apps/api/src/features/health/`: GET /api/health | `packages/shared/src/health.ts`: HealthResponse |
| errors | none | `apps/api/src/lib/errors.ts`: the one error shape | `packages/shared/src/errors.ts` |
| auth | `apps/web/src/features/auth/`: sign-up screen | `apps/api/src/features/auth/`: sign-up, sign-in, GET /api/me | `packages/shared/src/auth.ts`: sign-up, sign-in, me schemas, password rule |

Add a row when a feature folder is added, and change it when one moves or goes.

## How a request flows

```
screen (features/<f>/*.tsx)
  → hook (features/<f>/use-*.ts)
  → api client (src/lib/api-client.ts, parses with @tempo/shared)
  → route (apps/api/src/features/<f>/routes.ts, validates with @tempo/shared)
  → service (…/service.ts: the rules)
  → repository (…/repository.ts: Drizzle, scoped to the signed-in account)
  → SQLite
```

## Tools

| Kind of test | Tool | Runs with |
|---|---|---|
| Unit and API tests | Vitest (API through Fastify `inject`) | `npm test` |
| Component tests | Vitest + Testing Library (jsdom) | `npm test` |
| Shared components | Storybook stories, each run as a test in Chromium with the accessibility check (Vitest's Storybook addon) | `npm test` |
| Browser tests | Playwright (Chromium) against the running app | `npm test` |

`bash .github/scripts/verify.sh` runs typecheck, lint, all tests and the
conventions check. `npm run dev` starts the web app and the API together; the web
app proxies `/api` to the API. `npm run storybook` serves the stories on
<http://127.0.0.1:6006>.

UI libraries: Radix (`radix-ui`) for interactive patterns, `class-variance-authority`
and the `cn` helper (`apps/web/src/lib/utils.ts`) for variants, `lucide-react` for
icons, in the shadcn/ui style (`.github/conventions/components.md`).
