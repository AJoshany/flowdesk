# Plan Generation Skill

## Purpose

Generate a concrete implementation plan from approved product, architecture, feature, and decision specifications.

The plan must translate requirements into implementation steps without inventing product or architectural decisions.

---

## Inputs

Before generating a plan, read:

1. `AGENTS.md`
2. Relevant product specifications under `docs/product/`
3. Relevant architecture specifications under `docs/architecture/`
4. Relevant feature specification under `docs/features/`
5. Relevant ADRs under `docs/decisions/`
6. Existing repository structure and relevant source files

---

## Preconditions

A plan may only be generated when:

- The feature specification exists.
- The specification has been reviewed.
- The review result is `READY_FOR_PLAN`.
- No unresolved blocking ambiguity exists.
- Existing architecture decisions are understood.

If these conditions are not satisfied, do not generate an implementation plan.

Report what is blocking plan generation.

---

## Responsibilities

The plan must:

- Define the implementation scope.
- Break the feature into logical implementation tasks.
- Identify affected files and directories.
- Identify database/schema changes.
- Identify server-side logic.
- Identify authorization requirements.
- Identify validation requirements.
- Identify UI requirements.
- Identify testing requirements.
- Identify dependencies between tasks.
- Identify verification steps.

The plan must be specific enough that another coding agent can execute it without making major architectural decisions.

---

## Plan Rules

### 1. Do not invent requirements

Only implement requirements supported by:

- Product specifications
- Architecture specifications
- Feature specifications
- Accepted ADRs

If a useful requirement is discovered but not specified, report it as an ambiguity or scope question.

Do not silently add it to the plan.

### 2. Respect architecture

Follow the architecture defined in `docs/architecture/`.

Do not introduce:

- New frameworks
- New infrastructure
- New authentication systems
- Alternative database technologies
- Unapproved architectural patterns

unless explicitly required by an accepted specification or ADR.

### 3. Inspect the repository

Before creating the plan:

- Inspect existing directories.
- Inspect existing relevant files.
- Identify existing conventions.
- Identify reusable components/utilities.
- Identify current dependencies.
- Identify existing database/authentication setup.

Do not assume the repository is empty.

### 4. Security

For features involving authentication, authorization, users, workspace data, or sensitive information, explicitly include:

- Authentication checks
- Authorization checks
- Workspace isolation
- Server-side enforcement
- Input validation
- Relevant negative tests

### 5. Database changes

For database-related changes, explicitly describe:

- Models affected
- Fields
- Relations
- Constraints
- Indexes where required
- Migration requirements
- Data integrity considerations

Do not create destructive migration steps without explicit approval.

### 6. Testing

Every acceptance criterion should map to at least one verification or test task.

Include:

- Unit tests where appropriate
- Integration tests where appropriate
- Authorization tests
- Validation tests
- Workspace isolation tests
- Important edge cases

### 7. Scope control

The plan must not include unrelated refactoring or improvements.

If implementation requires an out-of-scope change:

1. Identify it.
2. Explain why it is required.
3. Stop planning beyond that dependency.
4. Request approval.

---

## Required Output

Create the implementation plan under:

`docs/plans/<feature-name>.md`

The plan must contain:

# Implementation Plan: <Feature>

## 1. Objective

What this implementation will achieve.

## 2. Scope

### In Scope

- ...

### Out of Scope

- ...

## 3. Existing Repository Analysis

Relevant existing:

- Files
- Components
- Services
- Utilities
- Database models
- Authentication infrastructure

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| ... | ... | ... |

## 5. Implementation Tasks

Each task must include:

### Task N: <Title>

**Purpose**

...

**Files**

- `path/to/file`

**Changes**

- ...

**Dependencies**

- ...

**Verification**

- ...

Tasks must be ordered according to their dependencies.

## 6. Database Changes

Describe required Prisma/schema/migration changes.

If none:

`No database changes required.`

## 7. Authorization & Security

Explicitly describe:

- Authentication requirements
- Authorization requirements
- Workspace isolation
- Validation
- Security-sensitive failure cases

## 8. Testing Plan

Describe tests derived from acceptance criteria and business rules.

## 9. Verification Checklist

- [ ] TypeScript passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Acceptance criteria verified
- [ ] Authorization verified
- [ ] Workspace isolation verified
- [ ] No unrelated files changed

## 10. Risks & Open Questions

Only include real risks or unresolved questions.

## 11. Scope Confirmation

State whether the plan can be executed without additional product or architecture decisions.

Allowed values:

`READY_FOR_IMPLEMENTATION`

`NEEDS_APPROVAL`

`BLOCKED`