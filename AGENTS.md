# Repository Guidelines

## Project Structure & Module Organization
- `apps/dashboard-api` and `apps/agent-api` host the NestJS services; matching `*-e2e` folders wrap black-box Jest suites that spin up the built service before hitting HTTP flows.
- `apps/agent-gateway` and `apps/device-adapter-platform` provide integration layers for hardware agents and device messaging.
- Domain logic lives in `libs/shared` and top-level `shared/`, where `shared/database/prisma` contains the schema, migrations, and seeds reused by every service.
- Build artifacts land in `dist/`; avoid editing anything there because Nx and Webpack regenerate those files.

## Build, Test, and Development Commands
- `pnpm setup` provisions dependencies, generates Prisma clients, runs migrations, and seeds baseline data.
- `pnpm dev` starts the dashboard and agent APIs with live reload; use `pnpm dev:all` when you also need the gateway.
- `pnpm build` runs `nx run-many --target=build` to produce distributable bundles for every app.
- `pnpm lint` and `pnpm format:check` gate stylistic consistency; add `:fix` or `format` to auto-apply Prettier formatting.
- Database helpers such as `pnpm db:migrate` and `pnpm db:seed` operate on `shared/database/prisma/schema.prisma`; regenerate clients with `pnpm db:generate` after schema changes.

## Coding Style & Naming Conventions
- TypeScript is the source-of-truth; keep files in PascalCase for Nest providers (`UserService.ts`) and kebab-case for directories (`user-controller`).
- Indent with 2 spaces, prefer single quotes, and keep imports sorted (ESLint enforces `sort-imports`); run `pnpm format` before opening a PR.
- Avoid `any`; if required, prefix intentionally unused parameters with `_` to satisfy `@typescript-eslint/no-unused-vars`.

## Testing Guidelines
- Unit tests belong beside implementation as `*.spec.ts`; focus on service methods and guards. Generate coverage reports with `pnpm test:coverage`.
- E2E suites live under `apps/*-e2e/src` and depend on a built service; run `pnpm test:e2e` after `pnpm build` or while `pnpm dev` is active.
- Add fixtures under `shared/testing` when multiple apps share mocks; keep tests deterministic by seeding via `pnpm db:seed`.

## Commit & Pull Request Guidelines
- Match the existing `type: summary` convention (`fix: update restart script`, `add: agent gateway`). Use the imperative mood and keep subjects under 72 characters.
- Squash or rebase before opening a PR, reference issue IDs in the description, and attach screenshots or curl snippets for API-touching changes.
- Confirm `pnpm lint`, `pnpm test`, and relevant database scripts succeed locally; include notable configuration updates in the PR checklist.

## Security & Configuration Tips
- Never commit `.env` files; share example settings in `docs/` or inline within PRs. Each app expects its own `.env` with `DATABASE_URL` and JWT secrets.
- Post-migration, verify `prisma migrate diff` output before applying to shared environments, and rotate secrets whenever seeding introduces privileged accounts.
