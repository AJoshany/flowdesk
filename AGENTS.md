# FlowDesk - Agent Instructions

## Project

FlowDesk is a portfolio-quality CRM/CMS dashboard application.

The goal is to build a realistic CRM product with clean architecture,
maintainable code, strong UX, and production-oriented engineering practices.

The application is based on a Figma CRM Dashboard design system.

---

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- PostgreSQL
- Prisma
- Auth.js

Use the existing project dependencies and configuration unless
the current task explicitly requires a change.

Do not introduce new libraries without a clear reason.

---

## Architecture

- Use Next.js App Router.
- Use Server Components by default.
- Use Client Components only when client-side interactivity is required.
- Keep business logic separate from UI components.
- Prefer small, focused components.
- Avoid unnecessary abstractions.
- Avoid premature optimization.
- Keep related functionality close together.

---

## UI / Design System

The UI must follow the existing Figma design system.

Use the project's design tokens for:

- colors
- typography
- spacing
- borders
- backgrounds
- semantic states

Do not hardcode design-system values inside components when
an existing token is available.

Do not introduce arbitrary colors or typography values without
a clear design requirement.

The UI should remain visually consistent across the application.

---

## Typography

The primary application font is Poppins.

Use the typography tokens defined by the project.

Prefer semantic typography utilities such as:

- headings
- body regular
- body medium
- links

Do not repeatedly define font-size, font-weight, and line-height
manually when an existing typography token can be used.

---

## Database

PostgreSQL is the primary database.

Prisma is the database access layer.

Database schema changes must be made through Prisma migrations.

Never modify the production database schema manually.

Before changing an existing model, inspect the current schema
and understand its relationships.

---

## Authentication & Authorization

Authentication and authorization are separate concerns.

Authentication determines who the user is.

Authorization determines what the user is allowed to do.

Authorization must be enforced server-side.

Never rely only on hiding UI elements to enforce permissions.

The application uses these roles:

- OWNER
- MANAGER
- MEMBER

Role and permission rules must follow the project's
authorization specification.

---

## Code Quality

- Use TypeScript strictly.
- Avoid `any` unless there is a strong technical reason.
- Prefer explicit types for important domain objects.
- Keep functions small and focused.
- Avoid duplicated business logic.
- Reuse existing utilities and components when appropriate.
- Do not create abstractions only for the sake of abstraction.

---

## Scope Rule

Do not implement functionality that is not explicitly required
by the current feature specification.

If you discover a potentially necessary change outside the current
scope:

1. Stop.
2. Explain why the change may be required.
3. Report it to the developer.
4. Wait for approval.

Do not silently expand the scope of the task.

---

## Before Implementation

Before modifying code:

1. Read this file.
2. Read the relevant product specification.
3. Read the relevant feature specification.
4. Inspect the existing implementation.
5. Identify affected files.
6. Create an implementation plan.

Do not immediately start coding when the task is ambiguous.

---

## Implementation

When implementing an approved plan:

1. Make the smallest reasonable set of changes.
2. Follow existing project conventions.
3. Reuse existing components and utilities where appropriate.
4. Keep business logic out of presentation components.
5. Do not modify unrelated files.
6. Do not introduce unrelated refactors.

---

## Validation

After implementation, run the appropriate checks.

At minimum, when applicable:

- TypeScript type checking
- ESLint
- Tests
- Production build

Report the result of each validation step.

Do not claim a task is complete if required checks are failing.

---

## Definition of Done

A feature is considered complete only when:

- The feature specification is satisfied.
- Acceptance criteria are satisfied.
- Required tests pass.
- Type checking passes.
- Linting passes.
- No unrelated functionality was introduced.
- No unnecessary dependencies were added.
- The implementation follows the architecture and design system.
- The final diff has been reviewed.
- Any known limitations are explicitly reported.

---

## Agent Workflow

Follow this workflow:

Specification
→ Implementation Plan
→ Developer Approval
→ Implementation
→ Validation
→ Review
→ Done

The agent must not skip the planning and approval stages
for non-trivial features.