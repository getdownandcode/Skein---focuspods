# focuspods backend

Node 24, npm, and Docker required.

1. `cp .env.example .env` and fill in the values.
2. `npm install`
3. `npm run db:up` (Postgres 16: `focuspods` and `focuspods_test` on `localhost:5432`)
4. `npm run db:migrate` then `npm run dev`
5. `npm test`, then `npm run db:down` to stop the database.
