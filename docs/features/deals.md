# FlowDesk — Deals Feature Specification

## 1. Goal

Allow workspace members to manage sales opportunities and track their
progress through a sales pipeline.

---

## 2. Actors

- OWNER
- MANAGER
- MEMBER

---

## 3. User Stories

### US-DEAL-001 — View Deals

As a workspace member,
I want to view deals,
so that I can understand active sales opportunities.

### US-DEAL-002 — Create Deal

As a workspace member,
I want to create a deal,
so that a sales opportunity can be tracked.

### US-DEAL-003 — Update Deal

As a workspace member,
I want to update a deal,
so that its information and progress remain accurate.

### US-DEAL-004 — Delete Deal

As an authorized user,
I want to delete a deal,
so that obsolete opportunities can be removed.

---

## 4. Business Rules

### BR-DEAL-001

Every deal belongs to exactly one workspace.

### BR-DEAL-002

A deal may be associated with a customer.

### BR-DEAL-003

Every deal has a pipeline stage.

### BR-DEAL-004

OWNER and MANAGER can delete deals.

### BR-DEAL-005

MEMBER cannot delete deals.

### BR-DEAL-006

Users cannot access deals belonging to another workspace.

---

## 5. Functional Requirements

Authorized users can:

- View deals.
- Create deals.
- Update deals.
- Change deal stage.
- Delete deals when authorized.

---

## 6. Pipeline

The MVP must support a pipeline stage for every deal.

The exact set of stages will be defined as part of the implementation
specification.

---

## 7. Validation

Deal input must be validated before persistence.

Invalid customer references must be rejected.

Invalid pipeline stages must be rejected.

---

## 8. Error Cases

- Invalid deal data.
- Deal not found.
- Unauthorized operation.
- Deal belongs to another workspace.
- Invalid customer reference.
- Invalid pipeline stage.

---

## 9. Acceptance Criteria

### AC-DEAL-001

Given an authorized workspace member,
when they request deals,
then only deals belonging to their workspace are returned.

### AC-DEAL-002

Given valid deal data,
when an authorized user creates a deal,
then the deal is associated with the correct workspace.

### AC-DEAL-003

Given an existing deal,
when an authorized user changes its stage,
then the new stage is persisted.

### AC-DEAL-004

Given a MANAGER or OWNER,
when they delete a deal,
then the deal is removed.

### AC-DEAL-005

Given a MEMBER,
when they attempt to delete a deal,
then the operation is rejected.

---

## 10. Definition of Done

- Deal CRUD works.
- Deal stages work.
- Customer relationship works where applicable.
- Workspace isolation is enforced.
- Role permissions are enforced.
- Validation exists.
- Critical operations are tested.
- Typecheck passes.
- Lint passes.