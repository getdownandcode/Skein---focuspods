# BACKEND_TASKS.md - ordered task list for the agent

Rules: take the first unchecked task, do only that task, meet its AC, run lint + typecheck + test, tick the box,
commit as `type(scope): summary [ID]`, then stop. See AGENTS.md. Details of behavior are in PRODUCT.md.

Milestones
- M1 = B0 + B1: a running, secured API with Google login
- M2 = B2: sessions, tasks, stats, sync
- M3 = B3 + B4: pods, breaks, votes, ledger
- M4 = B5 to B8: summaries, notifications, entitlements, hardening, deploy

---

## B0 Foundation (branch: phase/B0-foundation)

- [ ] **B0.1 Project skeleton.** Create `/backend` with TypeScript strict, ESM, Fastify `buildApp()` in `app.ts`,
  `server.ts` entry, scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`. Add ESLint, Prettier, Vitest.
  `GET /healthz` returns `{ "status": "ok" }`.
  AC: `npm test` passes with a healthz test using Fastify `inject`.
- [ ] **B0.2 Config.** `src/config.ts` validates env with Zod (NODE_ENV, PORT, DATABASE_URL, JWT_SECRET,
  GOOGLE_CLIENT_IDS comma list, CORS_ORIGINS). Fail fast with a clear message. Add `.env.example`.
  AC: app refuses to start with a missing var. Unit test covers valid and invalid env.
- [ ] **B0.3 Local database.** `docker-compose.yml` with Postgres 16 for dev and a separate test database.
  npm scripts `db:up`, `db:down`. Document in a short `backend/README.md`.
  AC: `npm run db:up` starts Postgres. README explains setup in under 10 lines.
- [ ] **B0.4 Prisma and readiness.** Add Prisma, `src/db.ts`, an initial migration, and `GET /readyz` that runs a
  trivial query. Test helper that resets the test DB between test files.
  AC: `/readyz` returns 200 when DB is up and 503 when it is not (test both).
- [ ] **B0.5 Errors and logging.** pino logger with a request id per request. One central error handler that returns
  `{ "error": { "code", "message" } }`. Custom 404 handler. No stack traces in production responses.
  AC: tests for 404, a validation error (400), and an unexpected error (500) all match the error shape.
- [ ] **B0.6 Security baseline.** Register helmet, CORS (allowlist from env), and a global rate limit.
  AC: test shows a blocked origin and a 429 after exceeding the limit on a test route.
- [ ] **B0.7 CI.** GitHub Actions: install, lint, typecheck, test with a Postgres service container.
  AC: workflow file exists and runs the same three commands as local.
- [ ] **B0.8 API docs.** `@fastify/swagger` with the Zod type provider. Serve `/docs` only when NODE_ENV is not production.
  AC: `/docs` works in dev and returns 404 in production (test both).

## B1 Auth and users (branch: phase/B1-auth)

- [ ] **B1.1 User schema.** Model `User`: id, googleSub (unique), email, name, persona enum
  (STUDENT, DEVELOPER, FOUNDER, ACCOUNTS, CREATOR, GENERAL, default GENERAL), timezone (default `Asia/Kolkata`),
  createdAt, updatedAt, deletedAt (nullable). Migration included.
  AC: migration applies cleanly on an empty DB.
- [ ] **B1.2 Google login.** `POST /v1/auth/google` with `{ idToken }`. Verify with `google-auth-library` against
  GOOGLE_CLIENT_IDS. Upsert the user. Return `{ accessToken, refreshToken, user }`. Access token is a 15 minute JWT.
  AC: tests with a mocked verifier cover new user, returning user, invalid token (401), and wrong audience (401).
- [ ] **B1.3 Refresh tokens.** Model `RefreshToken` (id, userId, tokenHash, expiresAt, revokedAt, replacedById).
  `POST /v1/auth/refresh` rotates the token. Reusing a revoked token revokes the whole chain. `POST /v1/auth/logout` revokes.
  AC: tests for rotation, reuse detection, expiry, and logout.
- [ ] **B1.4 Auth plugin.** `requireAuth` preHandler that sets `request.user` from the JWT, 401 otherwise.
  AC: test route returns 401 without a token and 200 with a valid one.
- [ ] **B1.5 Me endpoints.** `GET /v1/me`, `PATCH /v1/me` (name, persona, timezone validated as an IANA zone).
  AC: tests for update, invalid persona (400), invalid timezone (400).
- [ ] **B1.6 Account deletion.** `DELETE /v1/me` soft deletes (sets deletedAt), revokes all refresh tokens, and
  blocks login for that account. A job (later, B4.9) hard-deletes after 30 days.
  AC: after deletion, the old access token is rejected on the next call and login returns 403.
- [ ] **B1.7 Personas.** `src/personas.ts` with the presets from PRODUCT.md and `GET /v1/personas`.
  AC: test checks all 6 personas are returned with the fields in PRODUCT.md.

## B2 Sessions, tasks, stats, sync (branch: phase/B2-sessions)

- [ ] **B2.1 Session schema.** Model `Session`: id (client-supplied UUID), userId, podId (nullable, no FK yet),
  subject (nullable), mode (SOFT, STRICT), plannedSeconds, startedAt, endedAt (nullable), status
  (ACTIVE, COMPLETED, ABANDONED), actualSeconds, createdAt, updatedAt. Index on (userId, startedAt).
  AC: migration applies; model matches PRODUCT.md.
- [ ] **B2.2 Idempotency.** Plugin for the `Idempotency-Key` header on POST and PATCH. Table
  `IdempotencyKey` (userId, key, requestHash, statusCode, responseBody, createdAt) unique on (userId, key).
  Replay returns the stored response. Same key with a different body returns 422.
  AC: tests for first call, replay, and mismatch.
- [ ] **B2.3 Session endpoints.** `POST /v1/sessions` (client id, idempotent), `PATCH /v1/sessions/:id`
  (end it: status, endedAt, actualSeconds), `GET /v1/sessions?from&to&cursor&limit`. Users only see their own.
  AC: tests including another user's session returning 404 and cursor pagination across 3 pages.
- [ ] **B2.4 Tasks.** Model `Task` (id, sessionId, userId, title max 120 chars, done). Max 3 per session, enforced.
  Endpoints: create, update, delete, list nested under `/v1/sessions/:id/tasks`.
  AC: the fourth task returns 422.
- [ ] **B2.5 Stats.** `GET /v1/stats/daily?from&to` (focus seconds per local day in user timezone) and
  `GET /v1/stats/summary` (total seconds, completed sessions, current streak, longest streak).
  Streak logic is a pure function with unit tests including timezone edge cases around midnight.
  AC: tests for streak continuing, breaking, and a session near local midnight.
- [ ] **B2.6 Sync.** `GET /v1/sync?since=<cursor>` returns sessions and tasks changed since the cursor with tombstones
  for deletions and a new cursor. Cursor must be opaque and stable.
  AC: tests for the first sync, an incremental sync, a deletion, and a repeated call with the same cursor.

## B3 Pods (branch: phase/B3-pods)

- [ ] **B3.1 Pod schema.** Models `Pod` (id, name, type PRIVATE or OPEN, template, createdBy, createdAt, deletedAt),
  `PodMember` (podId, userId, role ADMIN or MEMBER, joinedAt, leftAt; unique on podId+userId),
  `Invite` (id, podId, tokenHash, createdBy, expiresAt, maxUses nullable, uses, revokedAt).
  Add the FK from `Session.podId` to `Pod`.
  AC: migration applies on a DB that already has sessions.
- [ ] **B3.2 Membership guard.** Helper `assertPodMember(podId, userId, minRole?)`. A non-member gets 404.
  AC: a test per pod route later must prove cross-pod access returns 404. Add the helper tests now.
- [ ] **B3.3 Pod CRUD.** `POST /v1/pods`, `GET /v1/pods` (mine), `GET /v1/pods/:id`, `PATCH` (admin), `DELETE` (admin, soft).
  Creator becomes ADMIN.
  AC: tests for each route and for non-member access.
- [ ] **B3.4 Members.** List members, change role (admin), remove member (admin), leave (member).
  The last admin cannot leave without promoting someone. Limits come from `src/limits.ts`
  (free: 2 pods per user, 5 members per pod).
  AC: tests for the last-admin rule and for the limits.
- [ ] **B3.5 Invites and open pods.** `POST /v1/pods/:id/invites` (admin) returns the raw token once; store only the hash.
  `POST /v1/invites/:token/join`, `DELETE` to revoke. `GET /v1/pods/open?q&cursor` and
  `POST /v1/pods/:id/join` for OPEN pods. Strict rate limit on joins.
  AC: tests for expired, revoked, max-uses, already-member, and joining a PRIVATE pod without an invite (404).
- [ ] **B3.6 Scheduled pod sessions.** Model `PodSchedule` (id, podId, title, startsAt, durationMinutes,
  recurrence NONE, DAILY, or WEEKLY with weekdays, createdBy) with admin CRUD, plus a member "commit" endpoint
  that records who will attend.
  AC: tests for CRUD and commit.
- [ ] **B3.7 Live pod sessions.** `POST /v1/pods/:id/live-sessions` starts a group session
  (plannedSeconds, startedAt). Members join with `POST .../join`, which creates their own `Session` linked to it.
  `GET /v1/pods/:id/live` returns each member's state: LOCKED_IN, BROKEN, FINISHED, or NOT_JOINED.
  AC: tests for 3 members with one break and one finish.

## B4 Breaks, votes, penalties, ledger (branch: phase/B4-breaks)

- [ ] **B4.1 Break schema.** Model `BreakEvent` (id client UUID, sessionId, userId, podId nullable, occurredAt,
  durationSeconds, kind BACKGROUND or EMERGENCY_EXIT, reasonCategory EMERGENCY, FAMILY, or OTHER (nullable),
  reasonText (nullable, max 280), status PENDING, VALID, INVALID, or AUTO_RESOLVED, resolvedAt).
  AC: migration applies.
- [ ] **B4.2 Report a break.** `POST /v1/sessions/:id/breaks` (idempotent). Validate: caller owns the session,
  `occurredAt` is inside the session window with a small clock-skew tolerance, and no duplicate id.
  Solo session: status AUTO_RESOLVED. Pod session: status PENDING.
  AC: tests for each validation and for both solo and pod paths.
- [ ] **B4.3 Reasons and emergency cap.** `PATCH /v1/breaks/:id` sets reasonCategory and reasonText (owner only, while PENDING).
  EMERGENCY can be used at most 2 times per calendar month per user (user timezone). The third returns 422.
  AC: tests around the month boundary in a non-UTC timezone.
- [ ] **B4.4 Votes.** Model `Vote` (breakId, voterId, value VALID or INVALID, createdAt) unique on (breakId, voterId).
  `POST /v1/breaks/:id/votes`: voter must be a pod member and not the breaker.
  AC: tests for self-vote (403), non-member (404), duplicate vote (409).
- [ ] **B4.5 Resolution.** Pure function `resolveBreak(votes, eligibleCount, now, deadline)`. Majority VALID or tie means
  VALID. Majority INVALID means INVALID. Resolve early when everyone eligible has voted. At the 24 hour deadline, resolve
  with the votes cast; with zero votes, resolve VALID.
  AC: unit tests for every branch, including ties, zero votes, and early resolution.
- [ ] **B4.6 Pod rules.** Model `PodRule` (podId, penaltyType NONE, MONEY, CUSTOM, or CHARITY, amountMinor, currency,
  customText, receiver OTHERS, CHARITY, or SPLIT). Admin sets it. OPEN pods must be NONE (server enforced).
  AC: tests for setting a money rule on a PRIVATE pod (ok) and an OPEN pod (422).
- [ ] **B4.7 Ledger.** Model `LedgerEntry` (id, podId, breakId, fromUserId, toUserId nullable, amountMinor nullable,
  currency, note, status OPEN, SETTLED, or WAIVED, createdAt, settledAt). Create entries when a break resolves INVALID
  and the pod has a penalty. `GET /v1/pods/:id/ledger`, `POST /v1/ledger/:id/settle` (receiver only),
  `POST /v1/ledger/:id/waive` (admin only). No money is moved by the backend.
  AC: tests for OTHERS, SPLIT, and CHARITY receivers and for permission checks.
- [ ] **B4.8 Scheduler.** In-process scheduler (node-cron) with a Postgres advisory lock so two instances never double-run.
  Jobs: resolve votes past the 24 hour deadline, expire old invites, delete idempotency keys older than 24 hours,
  hard-delete accounts soft-deleted more than 30 days ago.
  AC: tests call each job function directly; a test shows the lock prevents a second concurrent run.

## B5 Pod summaries (branch: phase/B5-summaries)

- [ ] **B5.1 Pod weekly summary.** `GET /v1/pods/:id/summary?week=YYYY-Www`: per member focus seconds, completed
  sessions, breaks, and completion rate. Weeks start Monday.
  AC: tests with 3 members and sessions across a week boundary.
- [ ] **B5.2 Pod streak.** A pod day counts when every member active that day completed at least 1 session.
  Pure function with unit tests. Expose in the summary response.
  AC: tests for a member joining mid-streak and a member leaving.

## B6 Notifications (branch: phase/B6-notify)

- [ ] **B6.1 Devices.** Model `DeviceToken`, endpoints `POST /v1/devices` and `DELETE /v1/devices/:id`.
  AC: tests for register, replace on re-register, and delete.
- [ ] **B6.2 Notification outbox.** Model `Notification` (id, userId, type, payload, sendAfter, sentAt).
  A `Notifier` interface with a log-only implementation for dev and test and an FCM implementation behind an env flag.
  Types: POD_SESSION_STARTING, VOTE_NEEDED, VOTE_RESOLVED. Add random jitter to `sendAfter` for bulk sends.
  AC: tests prove events create outbox rows and that the sender job marks them sent.

## B7 Entitlements (branch: phase/B7-entitlements)

- [ ] **B7.1 Subscription model.** `Subscription` (userId, plan PRO, PRO_PLUS, or PRO_WORK, source PLAY, productId,
  purchaseToken unique, status, expiresAt, region, createdAt).
  AC: migration applies.
- [ ] **B7.2 Entitlements function.** Pure `getEntitlements(user, subscription, now)` returns `{ plan, features, limits }`.
  30 day trial from `createdAt` gives PRO features. Expired subscription falls back to FREE. Nothing is ever deleted.
  Over-limit pods are flagged read-only in responses. Wire `limits.ts` to this function.
  AC: unit tests for the trial boundary (day 29, 30, 31), active, expired, and over-limit cases.
- [ ] **B7.3 Billing stub.** `POST /v1/billing/play/verify` using a `PlayVerifier` interface with a fake implementation
  for now. Real Google Play verification comes later.
  AC: tests with the fake verifier create or update the subscription idempotently.

## B8 Hardening and deploy (branch: phase/B8-hardening)

- [ ] **B8.1 App config.** `GET /v1/app-config` returns `{ minSupportedVersionCode, latestVersionCode, maintenanceMode, message }` from env.
- [ ] **B8.2 Live updates.** WebSocket (or SSE) for pod live status behind a `Hub` interface with an in-memory
  implementation, so Redis pub/sub can replace it later.
- [ ] **B8.3 Query review.** Add indexes for hot queries, run EXPLAIN on them, confirm every list is paginated.
  Record findings in `docs/RUNBOOK.md`.
- [ ] **B8.4 Observability.** `/metrics` with prom-client (request latency histogram, active sessions gauge,
  DB pool stats). Optional Sentry hook behind an env flag.
- [ ] **B8.5 Load test.** A k6 script for session create and sync. Document results in `docs/RUNBOOK.md`.
- [ ] **B8.6 Runbook.** `docs/RUNBOOK.md`: backup and tested restore steps, expand-then-contract migration policy,
  scale-up triggers (p95 latency over 500 ms for 15 minutes, CPU over 70%, DB connections over 70%, error rate over 1%).
- [ ] **B8.7 Container.** Multi-stage Dockerfile, non-root user, health check, and a production compose example.
