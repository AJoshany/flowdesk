# FlowDesk — Roles & Permissions

## 1. Purpose

This document defines the roles and high-level permissions within a
FlowDesk workspace.

Authorization rules defined here are product-level rules.

Implementation details belong to the architecture and feature
specifications.

---

## 2. Roles

FlowDesk MVP supports three workspace roles:

- OWNER
- MANAGER
- MEMBER

---

## 3. OWNER

The OWNER has full control over the workspace.

### Permissions

- View dashboard
- View customers
- Create customers
- Update customers
- Delete customers
- View deals
- Create deals
- Update deals
- Delete deals
- View activities
- Create activities
- View team members
- Invite team members
- Assign roles
- Remove team members
- Manage workspace access

The OWNER cannot be removed from the workspace through normal member
management operations.

---

## 4. MANAGER

The MANAGER can manage CRM data and team-related operations allowed by
the product.

### Permissions

- View dashboard
- View customers
- Create customers
- Update customers
- Delete customers
- View deals
- Create deals
- Update deals
- Delete deals
- View activities
- Create activities
- View team members
- Invite team members
- Manage member roles where explicitly permitted

A MANAGER must not be able to perform OWNER-only operations.

---

## 5. MEMBER

The MEMBER has access to normal CRM operations required for day-to-day
work.

### Permissions

- View dashboard
- View customers
- Create customers
- Update customers
- View deals
- Create deals
- Update deals
- View activities
- Create activities
- View team members

A MEMBER cannot:

- Delete customers
- Delete deals
- Assign roles
- Remove team members
- Manage workspace access

---

## 6. Permission Matrix

| Capability | OWNER | MANAGER | MEMBER |
|---|---:|---:|---:|
| View Dashboard | ✓ | ✓ | ✓ |
| View Customers | ✓ | ✓ | ✓ |
| Create Customer | ✓ | ✓ | ✓ |
| Update Customer | ✓ | ✓ | ✓ |
| Delete Customer | ✓ | ✓ | — |
| View Deals | ✓ | ✓ | ✓ |
| Create Deal | ✓ | ✓ | ✓ |
| Update Deal | ✓ | ✓ | ✓ |
| Delete Deal | ✓ | ✓ | — |
| View Activities | ✓ | ✓ | ✓ |
| Create Activity | ✓ | ✓ | ✓ |
| View Team | ✓ | ✓ | ✓ |
| Invite Members | ✓ | ✓ | — |
| Assign Roles | ✓ | ✓* | — |
| Remove Members | ✓ | — | — |
| Manage Workspace Access | ✓ | — | — |

`*` Manager role-management capabilities are subject to the detailed
authorization rules defined in the Team feature specification.

---

## 7. Authorization Principles

### Principle 1 — Server Enforcement

Permissions must always be enforced server-side.

### Principle 2 — UI Is Not Security

Hiding a button or navigation item must never be considered sufficient
authorization.

### Principle 3 — Workspace Isolation

A user must never access resources belonging to another workspace unless
explicitly authorized.

### Principle 4 — Least Privilege

Users should receive only the permissions required for their role.

### Principle 5 — Explicit Permissions

New permissions must be explicitly defined before being implemented.

---

## 8. Future Roles

Additional roles may be introduced in the future.

Adding a new role requires:

1. Product requirement
2. Permission definition
3. Authorization rules
4. Feature specification updates
5. Implementation
6. Tests