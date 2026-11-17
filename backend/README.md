# focuspods backend

Requires Node 24, npm, and Docker.

1. `cp .env.example .env` and fill in the values.
2. `npm install`
3. `npm run db:up` (Postgres 16 on `localhost:5432`; databases `focuspods` and `focuspods_test`)
4. `npm run db:migrate` then `npm run dev`
5. `npm test` (uses `focuspods_test`; run `npm run db:up` first)
6. `npm run db:down` stops the database.
