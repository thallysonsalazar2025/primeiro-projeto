# ADR 0001 - V2 runtime architecture baseline

- Status: Accepted
- Date: 2026-09-04
- Owners: A1 Architecture, reviewed by A9 QA and A10 DevOps/Security

## Context

The original V2 backlog proposed Next.js + TypeScript for the frontend, FastAPI/Python for the backend, PostgreSQL, a separate worker and Docker Compose. During implementation, the product evolved into a working Next.js modular application whose server-side route handlers expose the application API, backed by PostgreSQL/Prisma, with a separate TypeScript ingestion worker. The legacy DATAPREV simulator remains mounted read-only and is covered by regression validation in CI.

Replacing the mature server-side application layer with FastAPI now would duplicate contracts, authentication, simulation, catalogue and estimator logic, introduce a second runtime without a proven product need, and materially increase regression risk.

## Decision

The approved V2 baseline is:

1. **Web + application API:** Next.js + TypeScript in `concurso-intelligence`, using server-side route handlers as the application API/BFF.
2. **Database:** PostgreSQL as the system of record, accessed through Prisma migrations and typed repositories/services.
3. **Ingestion worker:** separate TypeScript worker process/container, sharing the same database schema and explicit ingestion contracts.
4. **Runtime:** Docker Compose remains the local-first orchestration mechanism. PostgreSQL, app and worker are independently runnable services. Tunnel and backup remain optional profiles.
5. **Authentication:** the current first-party session/authentication implementation backed by PostgreSQL is the accepted baseline. Supabase Auth is not a mandatory dependency for V2 unless a future ADR introduces it for a concrete requirement.
6. **FastAPI:** deferred. A Python/FastAPI service may be introduced later only for a bounded capability with a clear reason, such as Python-specific analytics/ML or an integration that benefits from that ecosystem. It must not duplicate existing domain contracts merely to satisfy the initial stack sketch.
7. **Legacy preservation:** the root DATAPREV simulator and question files remain read-only inputs to the V2 regression/import path. Changes to V2 must not rewrite or remove them.
8. **Compatibility:** external API contracts, persisted data and simulation behaviour must remain backwards compatible unless changed by a dedicated ADR/migration.

## Consequences

### Positive

- Avoids a high-risk backend rewrite with no demonstrated user value.
- Keeps one primary application language/runtime while retaining service separation where it has operational value.
- Preserves the already-merged auth, catalogue, question bank, simulation, dashboard, ingestion and estimator work.
- Keeps local development and deployment inexpensive and reproducible.

### Trade-offs

- The application API and frontend share the Next.js deployment unit, so they cannot be scaled independently today.
- Teams needing a Python ecosystem must introduce it through a bounded service rather than moving the whole backend.
- Supabase-specific features are not available unless separately adopted.

## Guardrails

- Domain logic should stay outside route handlers whenever practical and live in reusable modules/services.
- New ingestion/analytics processes must use explicit database/service contracts and be independently testable.
- CI should continue to validate typecheck/build, Prisma, Docker/Compose, E2E and the preserved DATAPREV legacy dataset.
- Secrets must stay out of the repository; public exposure remains opt-in through the secure tunnel profile.
- Any proposal to split the application API into FastAPI or another backend must include migration scope, contract ownership, rollback plan and regression evidence.

## Supersedes

This ADR supersedes the initial backlog wording that treated **FastAPI/Python** and **Supabase Auth** as mandatory implementation choices. Their architectural intent remains valid as optional future components, but the merged V2 baseline described above is the source of truth until another ADR replaces this decision.
