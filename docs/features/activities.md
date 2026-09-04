# FlowDesk — Activities Feature Specification

## 1. Goal

Allow workspace members to record and review CRM-related activities.

---

## 2. Actors

- OWNER
- MANAGER
- MEMBER

---

## 3. User Stories

### US-ACT-001 — Create Activity

As a workspace member,
I want to record an activity,
so that customer and sales interactions can be tracked.

### US-ACT-002 — View Activities

As a workspace member,
I want to view relevant activities,
so that I can understand recent CRM activity.

---

## 4. Business Rules

### BR-ACT-001

Every activity belongs to exactly one workspace.

### BR-ACT-002

An activity may be associated with a customer.

### BR-ACT-003

An activity may be associated with a deal.

### BR-ACT-004

An activity may be associated with both a customer and a deal.

### BR-ACT-005

Users cannot access activities belonging to another workspace.

---

## 5. Functional Requirements

Authorized workspace members can:

- Create activities.
- View activities.
- Associate activities with CRM resources where applicable.

---

## 6. Validation

Activity input must be validated before persistence.

Referenced customers and deals must belong to the same workspace.

---

## 7. Error Cases

- Invalid activity data.
- Invalid customer reference.
- Invalid deal reference.
- Cross-workspace association.
- Unauthorized access.

---

## 8. Acceptance Criteria

### AC-ACT-001

Given an authorized workspace member,
when they create a valid activity,
then the activity is persisted under their workspace.

### AC-ACT-002

Given an activity associated with a customer,
when the customer is viewed,
then the relevant activity can be retrieved.

### AC-ACT-003

Given an activity associated with a deal,
when the deal is viewed,
then the relevant activity can be retrieved.

### AC-ACT-004

Given a user from another workspace,
when they request an activity,
then access is denied.

---

## 9. Definition of Done

- Activity creation works.
- Activity retrieval works.
- Customer association works.
- Deal association works.
- Workspace isolation is enforced.
- Validation exists.
- Critical operations are tested.
- Typecheck passes.
- Lint passes.