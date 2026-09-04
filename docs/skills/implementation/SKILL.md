# Implementation Skill

## Purpose

Implement an approved feature according to its specification and
implementation plan.

The implementation must satisfy the approved requirements without
introducing unnecessary scope.

---

## Preconditions

Implementation must not begin unless:

1. The relevant feature specification exists.
2. The specification has been reviewed.
3. An implementation plan exists.
4. The implementation plan has been approved by the human.
5. The repository instructions in `AGENTS.md` have been read.

---

## Required Inputs

Read:

1. `AGENTS.md`
2. Relevant product specifications
3. Relevant architecture specifications
4. Relevant feature specification
5. Relevant ADRs
6. Approved implementation plan

---

## Implementation Process

### Step 1 — Inspect the Repository

Before modifying code:

- Inspect the existing project structure.
- Identify relevant existing components.
- Identify existing utilities.
- Identify existing patterns.
- Identify existing database access patterns.
- Identify existing testing patterns.

Do not recreate functionality that already exists.

---

### Step 2 — Follow the Approved Plan

Implement the feature according to the approved plan.

Do not skip planned steps without reporting why.

---

### Step 3 — Respect Architecture

Follow the architecture defined in the project documentation.

In particular:

- Prefer Server Components by default.
- Use Client Components only when required.
- Keep business logic out of presentation-only components.
- Keep database access server-side.
- Enforce authorization server-side.
- Validate external input.
- Respect workspace isolation.

---

### Step 4 — Reuse Existing Patterns

Prefer existing project patterns over introducing new patterns.

Do not introduce a new library or architectural pattern unless:

1. The requirement needs it.
2. Existing architecture does not support the requirement.
3. The change is explicitly reported for review.

---

### Step 5 — Handle Errors

Implement expected error states defined by the specification.

Do not expose:

- Database internals
- Secrets
- Stack traces
- Sensitive authentication information

---

### Step 6 — Keep Scope Controlled

Only implement behavior required by:

- The feature specification
- The approved implementation plan
- Existing architectural requirements

Do not add unrelated features.

---

## Scope Change Rule

If implementation reveals a requirement outside the approved scope:

1. Stop the unrelated implementation.
2. Report the discovered dependency.
3. Explain why it may be required.
4. Ask for approval before expanding scope.

---

## Database Changes

When database changes are required:

- Update the Prisma schema.
- Create the appropriate migration.
- Preserve existing data where possible.
- Avoid destructive migrations without explicit approval.

---

## Completion Checks

Before reporting completion:

- Run typecheck.
- Run lint.
- Run relevant tests.
- Verify the feature behavior.
- Review changed files.
- Check for accidental scope expansion.

---

## Output

At completion report:

### Implemented

What was implemented.

### Changed Files

Files modified or created.

### Tests

Tests added or modified.

### Verification

Results of:

- Typecheck
- Lint
- Tests
- Other relevant checks

### Known Issues

Anything unresolved.

### Scope Changes

Any deviation from the approved plan.

---

## Rules

- Do not invent requirements.
- Do not silently expand scope.
- Do not bypass authorization.
- Do not modify unrelated files without justification.
- Do not report success when required checks fail.