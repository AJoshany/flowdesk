# Spec Review Skill

## Purpose

Review a feature specification before implementation begins.

The goal is to identify ambiguity, contradictions, missing requirements,
security concerns, and implementation blockers before code is written.

---

## When to Use

Use this skill before creating an implementation plan for a feature.

Do not modify application code while performing a specification review.

---

## Inputs

Read the following sources when available:

1. `AGENTS.md`
2. Relevant product documentation
3. Relevant architecture documentation
4. Relevant feature specification
5. Relevant ADRs

---

## Review Process

### Step 1 — Understand Scope

Identify:

- What is being built?
- What is explicitly included?
- What is explicitly excluded?
- Who are the actors?
- What user actions are supported?

---

### Step 2 — Check Requirements

Verify that the specification defines:

- Functional requirements
- Business rules
- Permissions
- Validation rules
- Error cases
- Edge cases
- Acceptance criteria
- Definition of Done

---

### Step 3 — Check Consistency

Look for contradictions between:

- Product requirements
- Architecture
- Roles and permissions
- Feature specifications
- Existing ADRs

Do not silently resolve contradictions.

---

### Step 4 — Check Security

For features involving authentication, authorization, or workspace data,
verify:

- Authentication requirements
- Authorization requirements
- Workspace isolation
- Server-side enforcement
- Input validation
- Sensitive data handling

---

### Step 5 — Check Testability

Every important requirement should be expressible as a testable behavior.

If an acceptance criterion cannot reasonably be tested, report it.

---

## Output

Return a structured review:

### Scope

Summary of what the feature includes.

### Valid Requirements

Requirements that are sufficiently clear.

### Ambiguities

Requirements that need clarification.

### Conflicts

Contradictions with existing specifications or architecture.

### Risks

Security, data, architectural, or maintainability risks.

### Missing Requirements

Important behavior that appears to be missing.

### Recommendation

One of:

- `READY_FOR_PLAN`
- `NEEDS_SPEC_UPDATE`
- `BLOCKED`

---

## Rules

- Do not implement code.
- Do not modify the specification automatically.
- Do not invent product requirements.
- Do not silently make architectural decisions.
- Prefer reporting ambiguity over guessing.
- Keep the review focused on the requested feature.
