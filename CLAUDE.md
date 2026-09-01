# Taloni

Interactive TUI dashboard for managing Finnish log houses and properties.
All user-facing text is in Finnish.

## Tech Stack

- TypeScript + React + Ink (React for terminal UI)
- Commander for CLI subcommands
- Node.js native SQLite (`node:sqlite`) — requires Node >= 22.5.0
- tsup for bundling, tsx for dev mode
- Node.js built-in test runner (`node:test`)

## Commands

- `npm run dev` — start TUI in dev mode
- `npm run build` — bundle to dist/
- `npm start` — run compiled CLI
- `npm test` — run all tests (19 tests: validation, db layer, migrations, reports)

## Architecture

- `src/cli.ts` — entry point, Commander setup, TUI launch, CLI subcommands
- `src/db.ts` — SQLite schema, migrations, seed data, all CRUD operations
- `src/report.ts` — annual reports, rental income reports, CSV export
- `src/validate.ts` — input validation (pure functions)
- `src/ui/Dashboard.tsx` — main Ink TUI component (9 tabs)
- `test/` — tests using `node:test` + `node:assert/strict`

## Database

- Stored at `~/.taloni/taloni.db`
- Migrations run via `PRAGMA user_version` — add new migrations to the `migrations[]` array in db.ts
- Seed data runs only on fresh databases (empty properties table)
- Foreign keys enabled with `PRAGMA foreign_keys = ON` and `ON DELETE CASCADE`

## Key Domain Concepts

- Properties have Finnish `kiinteistotunnus` (e.g. 405-412-1-23)
- Tasks support recurrence (monthly/quarterly/yearly/every_3_years) — completing a recurring task auto-creates the next occurrence
- Wastewater compliance assessment follows Finnish regulation (VNa 157/2017)
- Composting notification follows waste act (jätelaki 646/2011)
- Fireplaces require annual sweeping (lakisääteinen nuohous)

## Conventions

- All UI strings, comments, and user messages in Finnish
- Dates in ISO format (YYYY-MM-DD)
- Currency in EUR
- Use `db.prepare()` for parameterized queries (never string interpolation for user data)
- New schema changes: add migration function to `migrations[]` array, never modify existing migrations
