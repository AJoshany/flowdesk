# Code Review Skill

## Purpose

Review an implementation against its specification, architecture, security
requirements, and code quality expectations.

---

## Inputs

Read:

1. `AGENTS.md`
2. Relevant product requirements
3. Relevant architecture documentation
4. Relevant feature specification
5. Approved implementation plan
6. Changed files
7. Relevant tests

---

## Review Areas

### 1. Requirements

Verify that the implementation satisfies the acceptance criteria.

Check for:

- Missing functionality
- Incorrect behavior
- Unexpected behavior
- Scope expansion

---

### 2. Architecture

Verify:

- Correct server/client boundaries
- Appropriate data access
- Separation of business logic
- Appropriate use of shared code
- Compliance with architecture decisions

---

### 3. Security

Pay special attention to:

- Authentication
- Authorization
- Workspace isolation
- Input validation
- Sensitive information
- Client/server trust boundaries

---

### 4. Database

Check:

- Correct relationships
- Data ownership
- Constraints
- Migration safety
- Workspace isolation
- Unnecessary queries

---

### 5. Code Quality

Check:

- TypeScript correctness
- Readability
- Naming
- Duplication
- Unnecessary abstractions
- Error handling
- Maintainability

---

### 6. Testing

Verify that important behaviors and security boundaries are covered.

---

## Severity Levels

### CRITICAL

Security vulnerability, data isolation failure, data corruption, or
fundamental architectural violation.

Must be fixed before approval.

### HIGH

Incorrect core functionality or significant requirement violation.

Must be fixed before approval.

### MEDIUM

Maintainability, test coverage, or non-critical implementation issue.

Should normally be fixed before completion.

### LOW

Minor improvement that does not affect correctness.

May be deferred if explicitly documented.

---

## Output

Return:

### Summary

Overall assessment.

### Findings

For each finding:

- Severity
- File
- Problem
- Why it matters
- Recommended fix

### Requirements Check

List acceptance criteria and whether each is satisfied.

### Security Check

List relevant security requirements and their status.

### Test Check

Report relevant test coverage and results.

### Final Verdict

One of:

- `APPROVED`
- `CHANGES_REQUIRED`
- `BLOCKED`

---

## Rules

- Review the actual implementation.
- Do not approve based only on the developer's description.
- Do not ignore security issues.
- Do not introduce unrelated refactoring.
- Do not change requirements during review.