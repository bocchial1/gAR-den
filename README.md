# gAR-den

Initial root-level Next.js scaffold for gAR-den v1.

## Getting started

1. Install dependencies:
   `npm install`
2. Copy the example environment file:
   `cp .env.example .env`
3. Create the initial SQLite schema and Prisma client:
   `npx prisma migrate dev --name init`
4. Start the app:
   `npm run dev`
5. Run the smoke test:
   `npm test`