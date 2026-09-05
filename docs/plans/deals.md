# FlowDesk — Deals Implementation Plan

## 1. Objective

Implement the Deals feature per `docs/features/deals.md` on top of the
existing Authentication, Workspace, and Customers implementations:

- Workspace members can view, create, and update deals, and change a deal's
  pipeline stage.
- OWNER and MANAGER can delete deals; MEMBER cannot (enforced server-side).
- Every deal belongs to exactly one workspace and may optionally reference a
  customer of the **same** workspace.
- Workspace isolation is mandatory for every query and mutation — a deal is
  never queried or mutated "by id only".

## 2. Scope

### In Scope

- Deal listing (`/deals`), creation (`/deals/new`), detail/view + edit
  (`/deals/[id]`), deletion (role-gated).
- Pipeline stage: stored, validated, and changeable (AC-DEAL-003).
- Optional Deal → Customer association with same-workspace enforcement.
- Workspace isolation, server-side authorization (existing boundary), Zod
  validation, loading/empty/error states, tests, verification gates.

### Out of Scope

- Deal monetary value/amount, expected-close date, owner/assignee, notes,
  custom fields, tags — the Deals spec names no such fields and the task
  forbids inventing product requirements.
- Stage-ordering / pipeline configuration UI, automation, reporting,
  analytics, notifications.
- Activities, Team, Customers changes, workspace switching, unrelated
  refactoring.

## 3. Existing Repository Analysis

- **Auth/session** (`src/auth.ts`, `src/features/auth/session.ts`):
  Auth.js JWT session; `requireUser()` (unauthenticated → `/login`),
  `getWorkspaceContext(userId)` resolves the member's workspace server-side.
- **Workspace boundary** (`src/features/workspace/`): `requireWorkspaceAccess`,
  `requireSessionWorkspace()` — resolves session user + primary workspace and
  returns `{ user, workspace: { workspaceId, workspaceName, role } }`;
  404 for authenticated non-members; redirect to `/login` when unauthenticated.
- **Customers** (`src/features/customers/`) — the established pattern to
  mirror: `schemas.ts` (Zod) → `service.ts` (workspace-scoped Prisma data
  access returning typed `{ ok, code | value }` results) → `actions.ts`
  (`"use server"` actions parsing FormData, mapping errors to messages) →
  thin client form components (`useActionState`) + Server Component pages.
- **Schema** (`prisma/schema.prisma`): `User`, `Workspace`, `Membership`,
  `Role`, `Customer` (workspaceId FK, `@@unique([workspaceId, email])`).
  No `Deal` model yet — it must be added.
- **Middleware** (`src/middleware.ts`): `/deals` is already a protected prefix
  (unauthenticated → `/login?callbackUrl=…`), inherited from Authentication.
- **Routing**: dashboard shell `(dashboard)/layout.tsx` guards via
  `requireSessionWorkspace`; `Sidebar.tsx` lists Dashboard / Customers /
  Settings — a Deals link must be added.
- **Testing**: Vitest; dedicated test DB (`TEST_DATABASE_URL`) provisioned and
  migrated by `tests/global-setup.ts` (truncates via `TRUNCATE … CASCADE`, so
  new FK tables are covered automatically). Service tests seed users with the
  real `registerUser` service; action tests mock
  `requireSessionWorkspace`/service modules.

## 4. Requirements Mapping

| Requirement | Where implemented |
| --- | --- |
| REQ-DEAL-001 / US-DEAL-001 (view own-workspace deals) | `listDeals` + `/deals` page under `requireSessionWorkspace` |
| REQ-DEAL-002 / US-DEAL-002 (create deal) | `createDealAction` + `/deals/new` |
| REQ-DEAL-003 / US-DEAL-003 (update deal info) | `updateDealAction` + detail edit form |
| REQ-DEAL-004 (pipeline stage) | `DealStage` enum + stage field validated/changed via update |
| REQ-DEAL-005 / US-DEAL-004 (delete when role allows) | `deleteDealAction` — OWNER/MANAGER only |
| BR-DEAL-001 (deal → one workspace) | `workspaceId` on Deal, set server-side only |
| BR-DEAL-002 (may associate a customer) | optional `customerId`, same-workspace verified |
| BR-DEAL-003 (every deal has a stage) | required `stage`, default `NEW` |
| BR-DEAL-004/005 + roles-permissions (delete = OWNER/MANAGER) | action rejects MEMBER before data access; UI hides delete for MEMBER |
| BR-DEAL-006 (cross-workspace denial) | every query/mutation scoped by server-resolved `workspaceId` |
| AC-DEAL-001..005 | covered by service/action tests listed in §9 |

## 5. Implementation Tasks

### Task 1 — Database

Add to `prisma/schema.prisma` (additive only):

```prisma
enum DealStage {
  NEW
  QUALIFIED
  PROPOSAL
  WON
  LOST
}

model Deal {
  id          String     @id @default(cuid())
  title       String
  stage       DealStage  @default(NEW)
  customerId  String?
  customer    Customer?  @relation(fields: [customerId], references: [id], onDelete: SetNull)
  workspaceId String
  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([workspaceId])
  @@index([customerId])
}
```

`Customer` gains `deals Deal[]`. Create the migration
(`pnpm exec prisma migrate dev --name add_deal`), inspect the SQL to confirm
it is purely additive, and run `pnpm exec prisma generate`.

Delegated decisions (documented, no product change):
- **Stage set**: `NEW, QUALIFIED, PROPOSAL, WON, LOST` — spec §6 leaves the
  exact set to the implementation specification. `NEW` is the default so
  every deal has a stage (BR-DEAL-003) even when the form omits it.
- **Fields**: `title` (required, 1–200 chars) is the minimum deal identity;
  the optional customer link is the only association the spec names. No
  amount/value or other invented fields.
- **FK semantics**: `Customer.onDelete: SetNull` — deleting a customer (a
  role-gated OWNER/MANAGER operation) unlinks its deals rather than
  destroying opportunities; deleting a workspace still cascades to deals.

### Task 2 — Feature module (`src/features/deals/`)

- `schemas.ts` — Zod schemas mirroring `customers/schemas.ts`:
  - `title`: trimmed, required, ≤ 200 chars.
  - `stage`: `z.enum([...DealStageValues])`, default `NEW`.
  - `customerId`: optional hidden field — empty/missing/`null` → `null`;
    otherwise an id string validated by the same id-shape rules as customers.
  - `dealFieldsSchema` (shared create/update), `createDealSchema`,
    `updateDealSchema` (stage selectable on update → AC-DEAL-003),
    `dealIdSchema`, `expectedUpdatedAtSchema`.
  - Export `DEAL_STAGES` (ordered array), `DEAL_STAGE_LABELS`, and
    `dealStageSchema`.
- `messages.ts` — user-facing messages: not found, conflict, unauthorized
  delete, invalid customer reference, generic error, validation prompt.
- `service.ts` — server-only, workspace-scoped data access (never by id
  alone), mirroring `customers/service.ts`:
  - `listDeals(workspaceId)` — newest first, includes the linked customer's
    name for display.
  - `getDealById(workspaceId, dealId)` — `findFirst({ where: { id, workspaceId } })`;
    foreign/missing indistinguishable (`null`).
  - `createDeal(workspaceId, input)` — when `customerId` is present, verify a
    customer with that id exists **in `workspaceId`** before creating; reject
    otherwise with `invalid_customer` (no cross-workspace association).
  - `updateDeal(workspaceId, dealId, input, expectedUpdatedAt)` — scoped read
    first (`not_found`), optimistic concurrency (`conflict`), re-validate the
    customer reference against the same workspace, scoped
    `updateMany({ where: { id, workspaceId } })`.
  - `deleteDeal(workspaceId, dealId)` — scoped `deleteMany`; role check lives
    in the action layer.
  - Result type mirrors customers: `{ ok: true, value } |
    { ok: false, code: "invalid_input" | "invalid_customer" | "not_found" |
    "conflict" }`.
- `actions.ts` — `"use server"` actions mirroring `customers/actions.ts`:
  - Every action starts from `requireSessionWorkspace()` — the authenticated
    user and their workspace are resolved server-side; client-supplied
    workspace/user/role fields are ignored by construction (never read).
  - `createDealAction` → redirect `/deals/{id}`.
  - `updateDealAction` → hidden `dealId` + `expectedUpdatedAt`; redirect
    `/deals/{id}`.
  - `deleteDealAction` → hidden `dealId`; **MEMBER is rejected with the
    unauthorized message before any data access** (BR-DEAL-005); OWNER/MANAGER
    proceed; missing/foreign deal → idempotent redirect to `/deals`.

### Task 3 — UI

- `src/app/(dashboard)/deals/page.tsx` — list (title, stage badge, customer)
  under `requireSessionWorkspace`; empty state.
- `src/app/(dashboard)/deals/new/page.tsx` — create form; loads the
  workspace's customers as the association options.
- `src/app/(dashboard)/deals/[id]/page.tsx` — detail: title, stage, linked
  customer, dates; edit form (title/stage/customer) with optimistic
  concurrency; delete section rendered only for OWNER/MANAGER
  (`workspace.role !== "MEMBER"` — UI hint only; the action enforces it).
- `src/app/(dashboard)/deals/loading.tsx` — skeleton, mirroring customers.
- `src/features/deals/components/DealForm.tsx` — thin client form
  (`useActionState`) with title input, stage `<select>`, optional customer
  `<select>`, inline `FieldErrors`, pending states.
- `src/features/deals/components/DeleteDealForm.tsx` — thin client form.
- `src/app/components/layout/Sidebar.tsx` — add the Deals link between
  Customers and Settings (same styling).

### Task 4 — Tests

See §9. Tests live next to the module (`src/features/deals/*.test.ts`),
using the established test-DB + mock conventions.

## 6. Database Changes

One additive migration (`add_deal`): new `DealStage` enum + `Deal` table
(`workspaceId` FK → Workspace `onDelete: Cascade`, `customerId` nullable FK →
Customer `onDelete: SetNull`, indexes on `workspaceId` and `customerId`), and
the back-relation `Customer.deals`. No destructive change; existing tables
untouched.

## 7. Authorization & Security

- Identity: Auth.js session only (`requireSessionWorkspace`).
- Workspace: membership resolved server-side; the single-user workspace model
  means the session workspace is the only reachable workspace today, and the
  boundary still rejects non-members with a 404.
- Deal queries: every read carries `{ id, workspaceId }` in the WHERE clause;
  cross-workspace ids behave as missing rows (no disclosure).
- Customer association: `customerId` from the client is validated **inside
  the session workspace** before linking; a customer of another workspace is
  rejected (`invalid_customer`).
- Role: delete requires OWNER/MANAGER — role comes from the server-resolved
  membership, never from the client; MEMBER is rejected before data access.
- No client-provided `userId`, `workspaceId`, or `role` is ever read.

## 8. Validation

Zod at every server boundary: title (required/length), stage (enum — invalid
stages rejected), customer id shape + optionality, deal id shape, timestamp
parse, duplicate/empty handling. Client-side validation is convenience only.

## 9. Testing Plan

- **schemas.test.ts** — title required/blank/too long; invalid stage rejected
  (including empty string and arbitrary text); stage default; optional
  customerId (`""`/missing → null, valid id accepted, malformed id rejected);
  deal id schema.
- **service.test.ts** (integration, test DB, seed via `registerUser`):
  create under workspace + row check (AC-DEAL-002); list isolation
  (AC-DEAL-001); empty list; scoped single read (cross-workspace → null);
  invalid id → null; stage change persisted (AC-DEAL-003); invalid stage →
  `invalid_input`; update conflict (stale timestamp) → nothing written;
  cross-workspace update → `not_found` and no write; cross-workspace delete →
  `not_found`, row survives; own delete removes the row; delete missing →
  `not_found`; deal-customer association works within a workspace; deal
  referencing another workspace's customer → `invalid_customer`, nothing
  created; customer deletion unlinks the deal (SetNull) without deleting it.
- **actions.test.ts** (mocked `requireSessionWorkspace` + service + redirect):
  create uses the server-resolved workspace; client-supplied `workspaceId`
  /`role`/`userId` ignored (never read); MEMBER delete rejected before the
  service is called (BR-DEAL-005, AC-DEAL-005); OWNER and MANAGER delete
  (AC-DEAL-004); invalid input/stage → field errors, service not called;
  `invalid_customer`/`not_found`/`conflict` mapping; unauthenticated →
  login redirect and non-member → notFound propagate from the boundary;
  redirect targets `/deals/{id}` and `/deals`.

## 10. Verification Checklist

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## 11. Risks & Open Questions

- **Delegated**: the exact deal field set and pipeline stage set were left to
  implementation by the specs (no product decision changed). If CRM
  requirements later define amounts/currency or a richer stage model, a
  follow-up migration will extend the enum/table additively.
- Deal "stage ordering" is display-only (ordered label list); no workflow
  engine restricts transitions — the spec does not require one.
- Multi-workspace UX is still out of scope; membership resolution continues to
  use the primary-workspace context from Authentication.

## 12. Scope Confirmation

Only the Deals feature. No changes to Authentication/Workspace/Customers
behavior; one additive migration; Deals nav link added to the existing shell.
No Activities, Team, analytics, or unrelated refactoring.
