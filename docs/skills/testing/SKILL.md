# Testing Skill

## Purpose

Define and execute tests that verify feature behavior and prevent
regressions.

---

## When to Use

Use this skill:

- During feature implementation
- After implementation
- Before a feature is considered complete
- During bug fixes

---

## Test Strategy

Tests should be derived from:

1. Acceptance criteria
2. Business rules
3. Authorization rules
4. Validation rules
5. Important edge cases

---

## Priority

Prioritize tests in this order:

1. Security-critical behavior
2. Business-critical behavior
3. Authorization boundaries
4. Data integrity
5. Important user flows
6. Edge cases
7. UI behavior

---

## Authorization Testing

For protected operations, test at minimum:

- Authorized user succeeds.
- Unauthorized user is rejected.
- User from another workspace is rejected.

Where applicable, test every relevant role boundary.

---

## Validation Testing

Test:

- Valid input
- Invalid input
- Missing required input
- Boundary conditions
- Malformed identifiers
- Invalid relationships

---

## Workspace Isolation

For workspace-owned resources, verify that:

- Workspace A can access its own data.
- Workspace A cannot access Workspace B data.
- IDs from another workspace cannot bypass authorization.

---

## Test Quality

Tests should verify observable behavior rather than implementation
details whenever possible.

Avoid tests that are tightly coupled to internal implementation unless
testing the implementation itself is necessary.

---

## Failure Handling

If tests fail:

1. Identify the failing requirement.
2. Determine whether the problem is in implementation or test setup.
3. Fix the appropriate issue.
4. Re-run the relevant tests.

Never simply remove or weaken a failing test to make the suite pass.

---

## Completion Criteria

A feature is not considered complete when critical tests fail.

The final report must include:

- Tests executed
- Tests passed
- Tests failed
- Known limitations