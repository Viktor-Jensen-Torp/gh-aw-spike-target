# Tempo

A task app, built by the agent pipeline in `.github/`: people plan the work as
issues, agents implement, review and merge it into `develop`, and people release
it to `main`.

- `npm install`, then `npm run dev`: the web app on http://127.0.0.1:5173, the
  API behind it on `/api`.
- `bash .github/scripts/verify.sh`: every check CI runs.
- How the code is organised: `docs/architecture.md`. How it is written:
  `.github/conventions/index.md`. The design: `design/tempo.pen`.
