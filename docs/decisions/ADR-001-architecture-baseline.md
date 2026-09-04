# ADR-001 — Architecture Baseline

## Status

Accepted

## Date

2026-09-04

---

## Context

FlowDesk is a CRM dashboard application that requires authentication,
workspace isolation, role-based authorization, CRM data management, and a
maintainable frontend architecture.

The project will be developed using an agentic development workflow.

Because AI agents may otherwise make inconsistent technical decisions,
the core architecture must be explicitly defined.

---

## Decision

FlowDesk will use the following baseline architecture:

### Application

- Next.js
- React
- TypeScript
- App Router

### Styling

- Tailwind CSS

### Database

- PostgreSQL

### ORM

- Prisma

### Authentication

- Auth.js

### Validation

- Zod

### Package Manager

- pnpm

---

## Architectural Principles

### Server First

Server Components are the default.

Client Components are introduced only when client-side behavior requires
them.

### Server-Side Authorization

Authorization must always be enforced server-side.

### Workspace Isolation

Workspace-owned resources must be isolated by workspace.

### Explicit Specifications

Features must be specified before implementation.

### Controlled Agent Execution

The coding agent must not implement functionality outside the approved
scope.

---

## Alternatives Considered

### MongoDB

Not selected because FlowDesk has relational data involving:

- Users
- Workspaces
- Memberships
- Customers
- Deals
- Activities

PostgreSQL provides a strong relational model for these relationships.

### Client-Heavy Architecture

Not selected because the application benefits from server-side data
access, authorization, and rendering.

### Direct Database Access

Not selected.

Prisma is the defined data access layer.

---

## Consequences

### Positive

- Clear architectural boundaries
- Strong relational data model
- Server-side security boundaries
- Consistent implementation decisions
- Easier agent guidance
- Easier future maintenance

### Negative

- More architectural discipline is required.
- Feature development must follow specifications.
- Some seemingly simple changes require architectural review.

---

## Change Policy

Changing one of the baseline architectural decisions requires:

1. Identifying the reason for the change.
2. Evaluating alternatives.
3. Documenting consequences.
4. Creating a new ADR.
5. Explicit approval.

Existing ADRs must not be silently rewritten to hide architectural
changes.
