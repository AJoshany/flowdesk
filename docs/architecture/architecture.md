# FlowDesk — Architecture

## 1. Purpose

This document defines the high-level technical architecture of FlowDesk.

The architecture should provide a clear separation between presentation,
application logic, authorization, data access, and persistence.

---

## 2. Technology Stack

### Application

- Next.js
- React
- TypeScript

### Styling

- Tailwind CSS

### Database

- PostgreSQL

### ORM

- Prisma

### Authentication

- Auth.js

### Validation

- Zod

### Package Manager

- pnpm

---

## 3. Application Architecture

FlowDesk uses the Next.js App Router.

The application should follow this general architecture:

Browser
  ↓
Next.js UI
  ↓
Server Components / Server Actions / Route Handlers
  ↓
Application Logic
  ↓
Authorization
  ↓
Data Access Layer
  ↓
Prisma
  ↓
PostgreSQL

---

## 4. Server Components

Server Components should be the default choice.

Use Server Components when:

- Data can be fetched on the server
- No browser-only API is required
- No local interactive state is required
- No client-side event handling is required

Client Components should only be introduced when client-side
interactivity requires them.

Examples include:

- Interactive forms
- Dropdowns requiring client state
- Modals
- Tabs with local state
- Client-side interactions
- Browser APIs

Avoid converting entire pages into Client Components when only a small
part of the page requires client-side behavior.

---

## 5. Business Logic

Business logic must not be tightly coupled to UI components.

Components should be responsible primarily for:

- Rendering UI
- Collecting user input
- Displaying application state

Business logic should live in appropriate server-side application
boundaries.

Examples:

- Creating a customer
- Updating a deal
- Assigning a role
- Inviting a member
- Checking authorization

These operations must not depend on a specific UI component.

---

## 6. Data Access

Prisma is the primary database access layer.

Application code should not access PostgreSQL directly.

Database access should be centralized through server-side code.

Client Components must never directly access Prisma or the database.

---

## 7. Authorization

Authentication and authorization are separate concerns.

Authentication answers:

> Who is the user?

Authorization answers:

> Is this user allowed to perform this operation?

Authorization must be enforced server-side.

UI-level permission checks may be used to improve the user experience,
but they must never be considered a security boundary.

---

## 8. Validation

All external user input must be validated before being processed.

Zod should be used for application-level input validation.

Validation should occur at the server boundary.

Client-side validation may be added for better UX, but server-side
validation is mandatory.

---

## 9. Error Handling

Expected application errors should be handled explicitly.

Examples include:

- Invalid input
- Unauthorized access
- Resource not found
- Duplicate records
- Authentication failures
- Database constraint violations

Errors should not expose sensitive implementation details.

---

## 10. Data Ownership

CRM resources are workspace-scoped.

Examples:

- Customers
- Deals
- Activities
- Team memberships

Every workspace-owned resource must be associated with a workspace
directly or indirectly.

Server-side queries must ensure that users cannot access resources from
another workspace.

---

## 11. Routing

Application routes should follow the product structure.

Initial protected application areas may include:

- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/deals`
- `/activities`
- `/team`
- `/settings`

Public routes may include:

- `/login`
- `/register`

Exact routing may evolve as feature specifications are defined.

---

## 12. Feature Organization

Code organization should support clear feature boundaries.

Feature-specific logic should remain close to the feature it belongs to
where practical.

Avoid creating large global utility modules containing unrelated
business logic.

Shared code should only be extracted when there is a genuine reuse
requirement.

---

## 13. API and Server Actions

Server Actions may be used for mutations when they provide a suitable
boundary for the operation.

Route Handlers should be used when an HTTP API endpoint is required.

The choice between Server Actions and Route Handlers must be based on
the feature requirements rather than personal preference.

---

## 14. Security Principles

The application must follow these principles:

- Never trust client-provided authorization information.
- Never expose database credentials to the client.
- Validate external input.
- Enforce workspace isolation server-side.
- Enforce role permissions server-side.
- Avoid exposing sensitive error information.
- Do not store secrets in source control.

---

## 15. Architecture Constraints

The following constraints apply unless explicitly changed by an approved
architecture decision:

1. PostgreSQL is the primary database.
2. Prisma is the database access layer.
3. TypeScript strict mode must remain enabled.
4. Server Components are preferred by default.
5. Client Components require a concrete reason.
6. Authorization must be enforced server-side.
7. Workspace isolation is mandatory.
8. External input must be validated.
9. Business logic must not be implemented inside presentation-only
   components.
10. Database schema changes require Prisma migrations.