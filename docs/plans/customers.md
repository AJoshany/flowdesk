# Implementation Plan: Customers

## 1. Objective

Implement the Customers feature defined in `docs/features/customers.md` on top
of the already-implemented Authentication and Workspace features:

- Workspace-scoped customer CRUD: list, create, view, update, delete.
- Server-side authorization: the authenticated user → workspace membership →
  workspace-scoped role → customer access chain, using the existing Workspace
  authorization boundary (`requireWorkspaceAccess` / `requireSessionWorkspace`).
- Role enforcement: OWNER and MANAGER may delete; MEMBER may not (BR-CUST-003/004).
- Workspace isolation: a customer is never accessible outside its workspace
  (BR-CUST-001/005, AC-CUST-006).
- Zod validation at the server boundary; proper loading/empty/error states in
  the UI; automated tests for the acceptance criteria.

## 2. Scope

### In Scope

- `Customer` Prisma model (workspace-owned) + additive migration.
- Customer server actions + service with the authorization boundary.
- Pages: list (`/customers`), create (`/customers/new`), detail+edit
  (`/customers/[id]`), delete (on detail), loading state.
- Role-aware UI (MEMBER sees no delete control) with independent server
  enforcement.
- Tests: CRUD authorization matrix, isolation, role rules, validation,
  concurrent-update conflict, invalid ids, edge cases.

### Out of Scope

- Deals, Activities, Team, Dashboard analytics.
- Advanced search/filtering and pagination (not required by the spec).
- Customer import/export, tags, notes, custom fields, CRM automation.
- Workspace switching, multi-workspace UX.
- Redesign of Authentication/Workspace or unrelated refactoring.

## 3. Existing Repository Analysis

- `prisma/schema.prisma`: `User`, `Workspace`, `Membership`, `Role` (from
  Authentication). `Workspace` has no owned-resource model yet. Prisma 7 CLI +
  `@prisma/client` 7.10.0, config datasource in `prisma.config.ts`,
  migrations under `prisma/migrations/` (additive `init_authentication`).
- `src/features/workspace/`: `requireWorkspaceAccess(userId, workspaceId)`
  (boundary → `notFound()` on denial), `service.ts` (scoped membership data),
  `session-workspace.ts` (`requireSessionWorkspace()` →
  `{ user, workspace: { workspaceId, workspaceName, role } }`).
- `src/features/auth/session.ts`: session helpers (`requireUser`,
  `getWorkspaceContext`).
- UI: `(dashboard)` shell (Sidebar w/ session data + logout), auth form
  conventions (design tokens, `useActionState`, inline errors), placeholder
  pages at `/customers`, `/settings`.
- Tests: Vitest + dedicated test DB (`tests/global-setup.ts`); DB integration
  tests in `src/features/**/*.test.ts`; `next-auth` aliased to a test shim in
  `vitest.config.ts`; HTTP e2e in `tests/`.

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| REQ-CUST-001 (view customers, own workspace) | list page + `listCustomers(workspaceId)` | AC-CUST-001 integration test |
| REQ-CUST-002 (create) | `createCustomer` + create page/action | AC-CUST-002 test |
| REQ-CUST-003 (view details) | `[id]` page + `getCustomerById(workspaceId, id)` | Detail render test |
| REQ-CUST-004 (update) | `updateCustomer` + edit form/action | AC-CUST-003 test |
| REQ-CUST-005 / BR-CUST-003/004 (delete by role) | `deleteCustomer` + role check in action; UI hides for MEMBER | AC-CUST-004/005 tests |
| REQ-CUST-006 / BR-CUST-005 (isolation) | All queries scoped by `(workspaceId, id)`; boundary via `requireSessionWorkspace` | AC-CUST-006 + cross-workspace tests |
| BR-CUST-001 (customer in exactly one workspace) | `Customer.workspaceId` required FK | Schema/migration review + test |
| BR-CUST-002 (membership required) | `requireSessionWorkspace` in pages/actions | Unauthenticated/non-member tests |
| Validation §6 | Zod schemas (`name`, `email`, `phone`, `company`) at server boundary | Validation tests |
| Error cases §7 (invalid data, not found, foreign workspace, unauthorized delete, duplicate) | Typed service results → action error states; `P2002` → duplicate; scoped queries → not_found | Negative tests |
| Edge cases §9 (empty list, invalid id, concurrent update, delete missing/foreign) | Empty-state UI; id schema; `expectedUpdatedAt` conflict; scoped deletes | Edge-case tests |

## 5. Implementation Tasks

Tasks are ordered by dependency.

### Task 1: Customer model + migration

**Purpose**

Add the workspace-owned `Customer` model per `docs/features/customers.md` §6
and `docs/architecture/database.md` (workspace ownership, constraints,
additive migration).

**Files**

- `prisma/schema.prisma` (modified)
- `prisma/migrations/<timestamp>_add_customer/` (generated)

**Changes**

- `Customer`:
  - `id String @id @default(cuid())`
  - `name String` (required)
  - `email String` (required; `@@unique([workspaceId, email])` for the
    duplicate-customer rule)
  - `phone String?`, `company String?` (optional)
  - `workspaceId String` → `Workspace` (`onDelete: Cascade`), `@@index([workspaceId])`
  - `createdAt`, `updatedAt`
- Add the back-relation `customers Customer[]` to `Workspace` (schema only; no
  column change).
- Generate the migration (`prisma migrate dev --name add_customer`), review the
  SQL (new table + indexes + FK + composite unique — purely additive), and
  regenerate the client.

**Dependencies**

- Existing Authentication/Workspace schema.

**Verification**

- Migration SQL is additive; `prisma validate`/`generate` pass.

### Task 2: Validation schemas

**Purpose**

Server-boundary Zod validation for all customer input.

**Files**

- `src/features/customers/schemas.ts` (new)

**Changes**

- `name`: required, trimmed, ≤ 200 chars.
- `email`: trimmed/lowercased, valid email, ≤ 254 chars.
- `phone`, `company`: optional, trimmed, ≤ 50/200 chars, empty → null.
- `customerIdSchema`: string, 1–64 chars, `[a-z0-9]` (invalid-id rejection).
- `expectedUpdatedAtSchema`: `z.coerce.date()` (concurrency check).
- `createCustomerSchema` / `updateCustomerSchema` (full-record update).

**Dependencies**

- None.

**Verification**

- Schema unit tests (valid/invalid/missing/over-length input).

### Task 3: Customer service (data access with the authorization boundary)

**Purpose**

All customer data access, scoped by the authorized workspace id (which is
resolved server-side from the session — never accepted from the client).

**Files**

- `src/features/customers/service.ts` (new)

**Changes**

- `listCustomers(workspaceId)` — `findMany({ where: { workspaceId } })`.
- `getCustomerById(workspaceId, customerId)` — `findFirst({ where: { id,
  workspaceId } })`; **never** `findUnique({ where: { id } })` alone
  (database.md §10 anti-pattern).
- `createCustomer(workspaceId, input)` — validates with the schema, creates,
  maps `P2002` → duplicate result.
- `updateCustomer(workspaceId, customerId, input, expectedUpdatedAt)` —
  scoped read first (not_found / conflict on `updatedAt` mismatch), then
  `updateMany({ where: { id, workspaceId } })` so the boundary is in the write;
  maps `P2002` → duplicate.
- `deleteCustomer(workspaceId, customerId)` — `deleteMany({ where: { id,
  workspaceId } })`; count 0 → not_found (uniform for missing/foreign).
- Typed results (`{ ok: true } | { ok: false, code }`), no `next/navigation`
  imports (pages/actions map codes to behavior).

**Dependencies**

- Task 1 (client), Task 2 (schemas).

**Verification**

- Integration tests incl. isolation, cross-workspace rejection, duplicates.

### Task 4: Server actions

**Purpose**

Mutations with server-side authorization: resolve the session workspace
server-side, then act. Never trust client workspaceId/role.

**Files**

- `src/features/customers/messages.ts` (new)
- `src/features/customers/actions.ts` (new, `"use server"`)

**Changes**

- All actions call `requireSessionWorkspace()` (from the Workspace feature) →
  `{ user, workspace }`; the workspace id for every service call comes from
  that server-resolved context, never from form data.
- `createCustomerAction(prev, formData)` — validate → require session
  workspace → create → redirect `/customers/<id>`; duplicate/invalid/generic
  error states.
- `updateCustomerAction(prev, formData)` — validate (fields + hidden
  `customerId` + `expectedUpdatedAt`) → require session workspace → update →
  redirect to detail; not_found / conflict / duplicate / generic error states.
- `deleteCustomerAction(formData)` — validate id → require session workspace →
  **deny when `role === "MEMBER"` before touching the service** (BR-CUST-004) →
  scoped delete → redirect to `/customers`; unauthorized error state.
- Messages module for user-facing strings (mirrors auth convention).

**Dependencies**

- Task 3; existing Workspace `session-workspace.ts`.

**Verification**

- Action tests: success paths, validation, duplicate, not_found, conflict,
  MEMBER-delete rejection (service not called), role from server context only.

### Task 5: Customers UI

**Purpose**

List/create/detail(+edit)/delete screens in the existing shell using design
tokens, with loading/empty/error states and role-aware controls.

**Files**

- `src/app/(dashboard)/customers/page.tsx` (rewrite) — list + empty state +
  "New customer" link
- `src/app/(dashboard)/customers/new/page.tsx` (new)
- `src/app/(dashboard)/customers/[id]/page.tsx` (new) — detail + edit form +
  delete control (only for OWNER/MANAGER)
- `src/app/(dashboard)/customers/loading.tsx` (new) — loading state
- `src/features/customers/components/CustomerForm.tsx` (new, client) —
  create/edit fields via `useActionState`
- `src/features/customers/components/DeleteCustomerForm.tsx` (new, client)

**Changes**

- Pages resolve `requireSessionWorkspace()` and read customers through
  `getCustomerById` (scoped); missing → `notFound()`.
- Forms: design tokens (reuse login-form field/button patterns), inline
  validation errors, pending states, hidden `customerId`/`expectedUpdatedAt`
  for edit, success → redirect.
- MEMBER UI hides the delete control; the server action still rejects.
- No new navigation or shell redesign.

**Dependencies**

- Tasks 3–4; existing shell.

**Verification**

- `pnpm typecheck`/`lint`; manual smoke of list/create/edit/delete.

### Task 6: Tests

**Purpose**

Cover acceptance criteria, role rules, isolation, validation, and edge cases.

**Files**

- `src/features/customers/schemas.test.ts` (new)
- `src/features/customers/service.test.ts` (new, DB integration)
- `src/features/customers/actions.test.ts` (new, mocked session/workspace)

**Changes**

- Service: create under own workspace (AC-CUST-002); list returns only own
  workspace (AC-CUST-001); scoped detail (AC-CUST-003 read); update + conflict;
  delete by OWNER/MANAGER (AC-CUST-004); cross-workspace read/update/delete all
  rejected (AC-CUST-006); duplicate email within workspace + allowed across
  workspaces; invalid ids → null/not_found; empty list.
- Actions: create/update/delete success redirects; validation fieldErrors;
  duplicate/not_found/conflict messages; MEMBER delete rejected without calling
  the service (AC-CUST-005); client-supplied workspaceId/role in form data are
  ignored (server resolves context); unauthenticated/non-member handled by
  `requireSessionWorkspace`.
- Schemas: valid/invalid/missing/over-length input, empty→null optionals.

**Dependencies**

- Tasks 1–5.

**Verification**

- `pnpm test` passes.

### Task 7: Verification

**Purpose**

Run the full verification checklist.

**Files**

- None (verification only).

**Changes**

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — fix failures in
  Customers scope and re-run.

**Dependencies**

- All prior tasks.

**Verification**

- Checklist (section 9) satisfied.

## 6. Database Changes

Additive only — one new table:

| Model | Fields | Constraints / Relations |
|---|---|---|
| `Customer` | `id`, `name`, `email`, `phone?`, `company?`, `workspaceId`, `createdAt`, `updatedAt` | `@@unique([workspaceId, email])` (duplicate rule); `@@index([workspaceId])`; FK → `Workspace` `onDelete: Cascade`; every customer belongs to exactly one workspace (BR-CUST-001) |

No existing table is altered. `User`, `Workspace`, `Membership` are preserved.

## 7. Authorization & Security

### Authentication requirements

- Identity always from the Auth.js session (`requireUser`); unauthenticated
  requests to customer pages are redirected to `/login` by middleware + layout.

### Authorization requirements

- Every customer page/action resolves the session workspace server-side via
  `requireSessionWorkspace()` (Workspace feature): authenticated user →
  membership → workspace-scoped role → customer access.
- The `workspaceId` used in every customer query comes from that server-resolved
  context. Client-provided `userId`, `workspaceId`, `role`, and `membership`
  are never accepted (BR-AUTH-005 / BR-WS-004).
- Delete requires `role` ∈ {OWNER, MANAGER} and is enforced in the server
  action independently of the UI (BR-CUST-003/004).

### Workspace isolation

- All customer reads/writes/deletes are keyed by `(workspaceId, id)`; the
  database.md §10 anti-pattern (`findUnique({ where: { id } })`) is never used.
- Cross-workspace access, update, and delete are rejected uniformly with
  "not found"-style results (no existence disclosure).

### Validation

- Zod at the server boundary for all customer input (schemas), and id/date
  validation for hidden fields. Client-side validation is UX-only.

### Security-sensitive failure cases

- Invalid input → field errors. Duplicate email → safe duplicate message.
- Missing/foreign customer → not_found (404 on page, error state in actions).
- MEMBER delete → unauthorized message; no data touched.
- Unexpected failures → generic error, no internals exposed.

## 8. Testing Plan

| Criterion | Test |
|---|---|
| AC-CUST-001 (list scoped to workspace) | Service + integration: only own-workspace customers returned |
| AC-CUST-002 (create persists under user's workspace) | Service/action integration |
| AC-CUST-003 (update persists) | Service/action integration + conflict case |
| AC-CUST-004 (OWNER/MANAGER delete) | Service + action tests |
| AC-CUST-005 (MEMBER delete rejected) | Action test: rejected, service untouched |
| AC-CUST-006 (foreign workspace rejected) | Cross-workspace read/update/delete tests |
| Validation §6 | Schema tests (missing/empty/invalid/over-length) |
| Error cases §7 | Duplicate, not_found, invalid id, unauthorized delete |
| Edge cases §9 | Empty list, invalid id, concurrent update conflict, delete missing/foreign |
| Client-trust rules | Actions ignore client workspaceId/role; role from server context |

## 9. Verification Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new customers tests + full suite)
- [ ] `pnpm build` passes
- [ ] AC-CUST-001..006 verified
- [ ] Workspace isolation verified (read/update/delete)
- [ ] Role enforcement verified (MEMBER cannot delete)
- [ ] Validation verified (server-side Zod)
- [ ] No unrelated files changed

## 10. Risks & Open Questions

1. **Customer fields.** The spec delegates field definition to implementation.
   This plan uses name/email (required) + phone/company (optional) with a
   per-workspace unique email — a minimal, spec-compatible CRM record. No
   product decision is implied.
2. **Concurrent update.** Handled with an optimistic `expectedUpdatedAt` check
   (conflict → user error) rather than locking; adequate for this MVP.
3. **Email uniqueness scope.** Unique per workspace (spec: "duplicate customer
   data where uniqueness rules apply"); the same email may exist in different
   workspaces.

## 11. Scope Confirmation

`READY_FOR_IMPLEMENTATION`

No new product or architecture decisions are required: the feature reuses the
Workspace authorization boundary and Authentication session infrastructure,
adds one additive Prisma model, and restricts scope to workspace-scoped CRUD +
role rules + validation + tests. The plan is treated as approved for this task
and implemented in the same session.