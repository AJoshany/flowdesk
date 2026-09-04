# FlowDesk — Customers Feature Specification

## 1. Goal

Allow workspace members to manage customer records.

---

## 2. Actors

- OWNER
- MANAGER
- MEMBER

---

## 3. User Stories

### US-CUST-001 — View Customers

As a workspace member,
I want to view customers,
so that I can manage customer relationships.

### US-CUST-002 — Create Customer

As a workspace member,
I want to create a customer,
so that customer information is stored in the CRM.

### US-CUST-003 — Update Customer

As a workspace member,
I want to update customer information,
so that records remain accurate.

### US-CUST-004 — Delete Customer

As an authorized user,
I want to delete a customer,
so that obsolete records can be removed.

---

## 4. Business Rules

### BR-CUST-001

Every customer belongs to exactly one workspace.

### BR-CUST-002

A user must have workspace membership to access customers.

### BR-CUST-003

OWNER and MANAGER can delete customers.

### BR-CUST-004

MEMBER cannot delete customers.

### BR-CUST-005

A customer from another workspace must never be accessible.

---

## 5. Functional Requirements

Users with appropriate workspace access can:

- View customer lists.
- View customer details.
- Create customers.
- Update customers.
- Delete customers when authorized.

---

## 6. Validation

Customer input must be validated before persistence.

Required customer fields must not accept invalid or empty values.

Exact fields will be defined during the data-model implementation phase.

---

## 7. Error Cases

- Invalid customer data.
- Customer not found.
- Customer belongs to another workspace.
- Unauthorized deletion.
- Duplicate customer data where uniqueness rules apply.

---

## 8. Acceptance Criteria

### AC-CUST-001

Given an authorized workspace member,
when they request the customer list,
then only customers belonging to their workspace are returned.

### AC-CUST-002

Given valid customer information,
when an authorized user creates a customer,
then the customer is persisted under the user's workspace.

### AC-CUST-003

Given an existing customer,
when an authorized user updates it,
then the updated information is persisted.

### AC-CUST-004

Given a MANAGER or OWNER,
when they delete an existing customer,
then the customer is removed.

### AC-CUST-005

Given a MEMBER,
when they attempt to delete a customer,
then the operation is rejected.

### AC-CUST-006

Given a customer belonging to another workspace,
when a user attempts to access it,
then the operation is rejected.

---

## 9. Edge Cases

- Empty customer list.
- Invalid customer ID.
- Concurrent update.
- Delete request for a nonexistent customer.
- Delete request for a customer belonging to another workspace.

---

## 10. Definition of Done

- Customer CRUD operations work.
- Workspace isolation is enforced.
- Role permissions are enforced.
- Validation exists.
- Error states are handled.
- Critical operations are tested.
- Typecheck passes.
- Lint passes.