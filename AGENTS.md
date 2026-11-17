# AGENTS.md - rules for the coding agent

Read this file fully at the start of every session.

## Project

FocusPods (codename) is a focus app where friends study or work together in "pods" (small groups).
Order of work: backend first, Android native app later. The public app name is NOT decided, so never
hardcode a brand name in code, strings, or package names. Use the codename "focuspods".

- What we are building: `docs/PRODUCT.md`
- What to do next: `docs/BACKEND_TASKS.md`

## How to work (follow exactly)

1. Open `docs/BACKEND_TASKS.md`. Take the first unchecked task, in order. Do only that task.
2. Make the smallest change that meets the task's acceptance criteria (AC).
   Do not add endpoints, features, or dependencies that the task does not ask for.
3. Write or update tests for the task. Integration tests run against a real Postgres (Docker), not mocks,
   except for external services (Google token verification, FCM, Play billing), which are mocked.
4. Run from `/backend`: `npm run lint && npm run typecheck && npm test`. All three must pass.
5. Tick the task checkbox in `docs/BACKEND_TASKS.md`, commit (rules below), then STOP.
   Reply in 3-5 lines: what you did, how you verified it, and the next task ID.
6. If a task is ambiguous or conflicts with `docs/PRODUCT.md`, stop and ask. Do not guess.
7. If a test fails twice for the same reason, stop and report the failure. Do not rewrite unrelated code.
8. Do not refactor code outside the task. Prefer boring, explicit code over clever code.

## Git rules

- Branch per phase: `phase/B0-foundation`, `phase/B1-auth`, and so on. Never commit directly to `main`.
- One commit per task. Message format: `type(scope): summary [B2.3]`
  Types: feat, fix, test, chore, docs, refactor.
- Never commit `.env`, secrets, `node_modules`, or build output. Keep `.env.example` current.
- Do not rewrite history (no force push, no rebase of shared branches).
- When a phase is complete and CI is green, open a PR to `main` and stop for review.

## Stack (fixed, do not swap)

- Node.js LTS (check the current LTS at start), TypeScript strict mode, ESM
- Fastify, `fastify-type-provider-zod`, Zod for every input and output schema
- PostgreSQL 16, Prisma ORM and Prisma Migrate
- Auth: `google-auth-library` to verify Google ID tokens, JWT access tokens (`jose`), rotating refresh tokens
- Vitest for tests, Fastify `inject` for HTTP tests
- pino logging, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger`
- ESLint and Prettier, npm as the package manager
- Use the latest stable version of each package, then pin exact versions. Run `npm audit` and fix highs.
- Do not add a new dependency unless the task needs it. If you add one, say why in the commit body.

## Repo layout

```
focuspods/
  AGENTS.md
  docs/PRODUCT.md
  docs/BACKEND_TASKS.md
  docs/RUNBOOK.md            (created in B8)
  backend/
    src/
      app.ts                 buildApp() factory, no listen() here
      server.ts              process entry, calls listen()
      config.ts              zod-validated env
      db.ts                  Prisma client
      plugins/               auth, security, errors, idempotency
      modules/<feature>/     routes.ts, service.ts, schema.ts, *.test.ts
      lib/                   ids, time, pagination, crypto helpers
      jobs/                  scheduled jobs
    prisma/                  schema.prisma, migrations/
    test/                    test helpers and fixtures
  android/                   later, not now
```

## Code conventions

- Routes are thin: parse input, call a service, return output. Business rules live in services or in
  pure functions with unit tests (for example `resolveBreak`, `getEntitlements`).
- All IDs are UUIDs. All timestamps are UTC, stored as `timestamptz`, returned as ISO 8601 strings.
- Money is an integer in minor units plus a currency code. Never use floats for money.
- Every list endpoint uses cursor pagination (`limit`, `cursor`), default limit 20, max 100.
- API prefix is `/v1`. Never break an existing `/v1` response shape. Add fields, do not remove or rename.
- Error body is always `{ "error": { "code": "SOME_CODE", "message": "human readable" } }`.
- Multi-step writes use a database transaction.
- Every query is scoped by the authenticated user or by verified pod membership. No exceptions.
- Database migrations follow expand then contract: add columns and tables first, backfill, switch reads,
  and only drop old things in a later release. Never drop or rename a column in the same release it is replaced.
- Write small functions. Name things clearly. Comment the why, not the what.

## Security rules (non-negotiable)

- Never log tokens, ID tokens, refresh tokens, invite tokens, or emails at info level.
- Store only hashes of refresh tokens and invite tokens (SHA-256 of a random 32-byte value). Show the raw value once.
- Pod routes must return 404 (not 403) when the caller is not a member, so pod existence does not leak.
- Rate-limit auth, invite-join, and vote endpoints more strictly than the default.
- Validate break events on the server. The client can lie. Treat them as honor-system evidence.
- The app never holds or moves money, and never stores UPI IDs, card data, or bank details.
- No secrets in the repo. All secrets come from environment variables.
- Users must be able to delete their account (`DELETE /v1/me`).

## Out of scope for the initial phase

Strict mode, MCP server, calendar sync, Slack or Teams sync, real payments, the Android app, any UI.
Do not build these unless a task explicitly says so.
