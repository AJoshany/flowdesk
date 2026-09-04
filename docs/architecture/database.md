# FlowDesk — Database Architecture

## 1. Database

FlowDesk uses PostgreSQL as its primary relational database.

Prisma is used as the ORM and database access layer.

---

## 2. Core Entities

The initial MVP contains the following core entities:

- User
- Workspace
- Membership
- Customer
- Deal
- Activity

Additional supporting entities may be introduced when required by a
feature.

---

## 3. User

A User represents an individual account in FlowDesk.

A user may belong to one or more workspaces through memberships.

User authentication data must be separated conceptually from
workspace-specific authorization data.

---

## 4. Workspace

A Workspace represents a team or organization using FlowDesk.

Workspace-owned CRM data must belong to a workspace.

Examples:

- Customers
- Deals
- Activities
- Memberships

---

## 5. Membership

A Membership represents a user's relationship with a workspace.

It must contain enough information to determine:

- Which user belongs to the workspace
- Which workspace the user belongs to
- Which role the user has in that workspace

The role is workspace-specific.

A user's role in one workspace must not implicitly determine their role
in another workspace.

---

## 6. Customer

A Customer represents a CRM customer belonging to a workspace.

Customers must be workspace-scoped.

The exact customer fields will be defined in the Customer feature
specification.

---

## 7. Deal

A Deal represents a sales opportunity belonging to a workspace.

A deal should be associated with a customer where the product rules
require it.

Deals must support a pipeline stage.

The exact deal fields and stage model will be defined in the Deal feature
specification.

---

## 8. Activity

An Activity represents an interaction or event related to CRM data.

An activity may be associated with:

- A customer
- A deal
- Both
- Neither, when the activity is workspace-level

The exact activity types and relationships will be defined in the
Activity feature specification.

---

## 9. Relationships

The initial conceptual relationship model is:

User
  │
  └── Membership ── Workspace
                       │
                       ├── Customer
                       │
                       ├── Deal
                       │
                       ├── Activity
                       │
                       └── Membership

Customer
   │
   └── Deal

Customer
   │
   └── Activity

Deal
   │
   └── Activity

---

## 10. Workspace Isolation

Workspace isolation is a mandatory security requirement.

Every workspace-owned query must be scoped to the authorized workspace.

The following pattern must never be allowed:

1. Receive a resource ID from the client.
2. Query the resource only by ID.
3. Return the resource without verifying workspace ownership.

Resource access must include the appropriate workspace authorization
boundary.

---

## 11. IDs

Database entities should use stable unique identifiers.

IDs should not expose assumptions about database implementation.

The exact ID strategy will be defined during implementation of the
database schema.

---

## 12. Timestamps

Relevant entities should maintain creation and update timestamps.

At minimum, entities that represent mutable business data should
support:

- `createdAt`
- `updatedAt`

---

## 13. Database Constraints

Database constraints should be used to enforce invariants whenever
appropriate.

Examples:

- Required relationships
- Unique membership relationships
- Unique identifiers
- Valid references
- Referential integrity

Application-level validation must not replace database constraints when
the invariant belongs at the database level.

---

## 14. Migrations

All schema changes must be performed through Prisma migrations.

Direct production database schema modification is not part of the normal
development workflow.

Every schema change must be reviewed before being applied.

---

## 15. Schema Evolution

Database schema changes must consider existing data.

Destructive migrations must not be introduced casually.

Any migration that can cause data loss requires explicit review.