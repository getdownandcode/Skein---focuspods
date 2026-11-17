# PRODUCT.md - what we are building (source of truth)

App name: not decided (working names: Skein, Skeinr). Codename: focuspods.
Platform order: Android native first (Kotlin, Compose), backend first, iOS maybe later.

## Concept

A focus app where friends study or work together in **pods**. If a member breaks focus during a
pod session, the pod can apply a penalty the pod chose (money between friends, chai, charity).
Solo users also get a planner, tracker, and (later) strict mode. Everyone gets full Pro free for 30 days.

Differentiator: peer pods with stakes. Not a stricter app lock.

## Personas (presets, not separate products)

`users.persona` is an enum: STUDENT, DEVELOPER, FOUNDER, ACCOUNTS, CREATOR, GENERAL (default GENERAL).
A persona only changes defaults and copy. It never changes permissions or price. It can be changed anytime.
Presets live in code (`backend/src/personas.ts`) and are served by `GET /v1/personas`.

```json
{
  "STUDENT":   { "sessionPresets": [[25,5],[50,10],[90,15]], "allowlist": ["phone","sms","contacts","upi","maps","clock","calculator"], "stakeStyle": "SMALL_MONEY", "podTemplate": "STUDY_POD" },
  "DEVELOPER": { "sessionPresets": [[50,10],[90,15],[120,15]], "allowlist": ["phone","slack","authenticator","oncall"], "stakeStyle": "CHARITY_OR_PEER", "podTemplate": "BUILD_POD" },
  "FOUNDER":   { "sessionPresets": [[90,15],[120,20]], "allowlist": ["phone","calendar","vip_contacts","whatsapp"], "stakeStyle": "PUBLIC_COMMITMENT_OR_CHARITY", "podTemplate": "FOUNDER_CIRCLE" },
  "ACCOUNTS":  { "sessionPresets": [[25,5],[50,10]], "allowlist": ["phone","calculator","banking","authenticator"], "stakeStyle": "LIGHT_OR_NONE", "podTemplate": "DEADLINE_POD" },
  "CREATOR":   { "sessionPresets": [[60,10],[90,15],[120,20]], "allowlist": ["phone","music"], "stakeStyle": "PEER", "podTemplate": "COWORKING_POD" },
  "GENERAL":   { "sessionPresets": [[25,5],[50,10]], "allowlist": ["phone","maps"], "stakeStyle": "NONE", "podTemplate": "ANY_POD" }
}
```

## Pods

- A pod has members with roles: ADMIN or MEMBER. Types: PRIVATE (invite only) or OPEN (anyone can join).
- OPEN pods are penalty-free. The penalty rule must be NONE (enforce on server).
- Invites: random token, expires (default 7 days), optional max uses, admin can revoke.
- Free limits (constants in `src/limits.ts`, enforced through entitlements): 2 pods per user, 5 members per pod.
  Pro raises these. On downgrade nothing is deleted. Over-limit pods become read-only (flag in response).
- Pods can have scheduled sessions (title, start time, duration, optional recurrence) and live group sessions.
- Pod streak, weekly summary, and leaderboard (weekly reset) come after the core flows.

## Sessions and breaks

- The phone runs the timer locally and syncs later. The server never needs to run a timer.
- A session has: client-generated UUID, subject tag (optional), mode SOFT or STRICT, planned seconds,
  start and end times, status ACTIVE, COMPLETED, or ABANDONED, and up to 3 mini tasks.
- Soft mode: leaving the app for more than a short grace period (about 10-15 seconds, set by the client)
  creates a break event. The client sends it. The server validates it.
- Break kinds: BACKGROUND, EMERGENCY_EXIT.
- Solo session break: status AUTO_RESOLVED (no vote, no penalty).
- Pod session break: the member gives a reason category (EMERGENCY, FAMILY, OTHER) and optional text.
  The other pod members vote VALID or INVALID within 24 hours.
  Resolution: majority VALID, or a tie, means VALID (no penalty). Majority INVALID means INVALID (penalty applies).
  The breaker cannot vote. The break resolves early when all eligible voters have voted.
- Emergency reason category can be claimed at most 2 times per calendar month per user (user timezone).
  Further attempts return a 422 and the user must pick another category.
- Laptop distraction cannot be detected. Do not try. The app measures phone focus only.

## Penalties and ledger

- Pod rule: penaltyType NONE, MONEY, CUSTOM, or CHARITY. Receiver: OTHERS, CHARITY, or SPLIT.
- The backend records a **ledger only**. It never holds or moves money. Friends settle by UPI or cash.
- LedgerEntry status: OPEN, SETTLED, WAIVED. The receiver can mark SETTLED. A pod admin can WAIVE.
- Never store UPI IDs, card numbers, or bank details.

## Plans and entitlements (backend only models them for now, no real payments yet)

- Everyone gets 30 days of full Pro features from account creation (trial).
- Plans: FREE, PRO, PRO_PLUS, PRO_WORK. One Play subscription group, three products.
- Entitlement follows the product purchased, never the persona.
- Proposed prices (not enforced by the backend, set later in Play Console):

| Plan | India month/year | Global month/year |
|---|---|---|
| PRO | INR 50 / 500 | USD 2.99 / 19.99 |
| PRO_PLUS | INR 99 / 999 | USD 4.99 / 39.99 |
| PRO_WORK | INR 149 / 1499 | USD 6.99 / 59.99 |

- PRO covers everything in v1. PRO_PLUS adds VIP breakthrough, on-call allowlist, deep-work analytics.
  PRO_WORK adds Slack and Teams status sync, weekly priorities review, aggregate-only team workspace.
- Free keeps: solo sessions, soft mode, pods up to the free limits, votes and ledger, streaks,
  30 days of history, basic tracker.

## Streaks and stats

- User streak: consecutive local days (user timezone) with at least 1 COMPLETED session.
- Stats endpoints return daily focus seconds and a summary (total seconds, sessions, current and longest streak).
- User timezone is an IANA string, default `Asia/Kolkata`.

## Sync model (offline-first clients)

- Clients create records with their own UUIDs and send an `Idempotency-Key` header on writes.
- `GET /v1/sync?since=<cursor>` returns everything changed for this user since the cursor, with tombstones for deletions.
- The server must tolerate retries, duplicates, and out-of-order events.

## Scale and operations targets

- Stage targets: 500 users first, then 10,000 and more. Design for a stateless API (any instance can serve any request).
- Watch the evening spike when many pods start at once. Add jitter to notifications and reconnects.
- Keep `/v1` alive for months. Provide an app-config endpoint with minimum supported app version.
- Migrations use expand then contract. Rehearse on a copy of production data.
- Backups must be restore-tested.

## Non-goals right now

Strict mode enforcement, MCP server, calendar and Slack integrations, real payments, UI, iOS.
(MCP comes in v1.5 as a separate module on this backend: read-only by default, writes need approval.)
