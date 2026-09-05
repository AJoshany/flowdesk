# Implementation Plan: Team

## 1. Objective

Implement the Team feature defined in `docs/features/team.md` on top of the
existing Authentication, Workspace, Customers, Deals, and Activities
implementations:

- Workspace-scoped member listing (`/team`) — US-TEAM-001 / REQ-TEAM-001.
- Member invitation (membership creation) — US-TEAM-002 / REQ-TEAM-002,
  gated to OWNER and MANAGER (BR-TEAM-004/005/006, AC-TEAM-002/003).
- Role assignment — US-TEAM-003 / REQ-TEAM-003, with the role boundaries from
  `docs/features/team.md` §6 (finalized below) and server-side validation.
- Member removal — US-TEAM-004 / REQ-TEAM-004, OWNER only, with OWNER
  protection (BR-TEAM-009, AC-TEAM-007) and last-OWNER safety (BR-WS-002).
- Server-side authorization and workspace isolation on every operation;
  Zod validation at the server boundary; tests for the permission matrix and
  the security-critical rejection paths.

## 2. Scope

### In Scope

- `/team` page: workspace member list, role badges, role-change and removal
  controls, "Invite member" entry point.
- `/team/invite` page + invite form (email + role) for OWNER/MANAGER.
- Server actions + service: `inviteMember`, `changeMemberRole`,
  `removeMember`, `listTeamMembers`.
- Role rules finalization (spec §6: "Detailed rules for MANAGER role
  assignment must be finalized before implementation") — see
  "Authorization & Security" and "Risks & Open Questions".
- OWNER protection: OWNERs cannot be removed through member management
  (BR-TEAM-009 / AC-TEAM-007) and no operation may leave a workspace without
  at least one OWNER (BR-WS-002).
- Workspace isolation on every read/mutation (BR-TEAM-010, AC-TEAM-001).
- Loading state (`/team/loading.tsx`), empty state where reachable,
  validation feedback, mutation feedback, role-aware UI.
- Tests: schemas, service (DB integration), actions (mocked boundary), the
  full role matrix, isolation, owner protection, invitation behavior.

### Out of Scope

- Dashboard, workspace switching, billing/subscriptions, notifications,
  SSO, advanced organization management.
- Real email invitation infrastructure: no email provider, no pending
  invitation entity, no acceptance/expiry lifecycle (see "Invitation
  design" below — the spec's invitation behavior is implemented as
  membership creation, per the request constraints).
- Leaving a workspace (self-removal), workspace transfer, invitee-side
  workspace switching.
- Unrelated refactoring of Authentication/Workspace/Customers/Deals/
  Activities.

## 3. Existing Repository Analysis

- **Auth/session** (`src/features/auth/session.ts`, `src/auth.ts`): Auth.js
  JWT session; `getCurrentUser`, `requireUser`, `getWorkspaceContext`. The
  session carries only `{ id, email }`; role is never stored in the token.
- **Workspace boundary** (`src/features/workspace/`):
  - `requireSessionWorkspace()` returns `{ user, workspace: { workspaceId,
    workspaceName, role } }` — identity + membership + workspace-scoped role
    resolved server-side (404 for authenticated non-members, `/login`
    redirect when unauthenticated). This is the boundary every Team
    operation goes through; client-provided user/workspace/role are never
    read.
  - `countWorkspaceOwners(workspaceId)` already exists and is documented as
    the check Team mutations must use to protect the last OWNER.
  - `requireWorkspaceAccess(userId, workspaceId)` (explicit pair check).
- **Schema** (`prisma/schema.prisma`): `User` (id, email, passwordHash),
  `Workspace`, `Membership` (userId + workspaceId unique, `role Role` where
  `Role = OWNER | MANAGER | MEMBER`, timestamps), `Customer`, `Deal`,
  `Activity`. **Membership already models everything Team needs: a
  workspace-scoped role per user.** No schema change is required.
- **Feature module pattern** (Customers/Deals/Activities, mirror this
  exactly): `roles-or-stages.ts` (constants) → `schemas.ts` (Zod) →
  `messages.ts` → `service.ts` (workspace-scoped Prisma data access with
  `{ ok, code | value }` results; never query "by id only") → `actions.ts`
  (`"use server"`, FormData + `requireSessionWorkspace`, redirect on
  success, typed error states) → thin client form components
  (`useActionState`) + Server Component pages.
- **Routing/UI**: `/team` is already in `src/middleware.ts` (protected) and
  listed in the architecture routing; the `(dashboard)` layout guards the
  whole group with `requireSessionWorkspace`. `Sidebar.tsx` lists Dashboard /
  Customers / Deals / Activities / Settings — a Team link must be added.
  Design tokens and typography utilities are defined in `src/app/globals.css`
  (`text-h4`, `text-body-medium-14`, `border-border`, `bg-bg`,
  `text-primary-accent`, etc.); `DealStageBadge` provides the badge pattern.
- **Testing**: Vitest + dedicated test DB (`tests/global-setup.ts` migrates
  and truncates `Membership`/`Workspace`/`User` with CASCADE). Service tests
  seed via the real `registerUser` service and direct `prisma` inserts (see
  `src/features/workspace/service.test.ts` helpers). Action tests mock
  `requireSessionWorkspace` + the service module + `next/navigation`
  (`RedirectSignal`/`NotFoundSignal` pattern, see
  `src/features/customers/actions.test.ts`). `next-auth` is aliased to a
  test shim in `vitest.config.ts`.

## 4. Requirements Mapping

| Requirement | Implementation Area | Verification |
|---|---|---|
| REQ-TEAM-001 / US-TEAM-001 (view members) | `/team` page + `listTeamMembers(workspaceId)` | AC-TEAM-001 integration + action/page tests |
| REQ-TEAM-002 / US-TEAM-002 (invite member) | `inviteMember` + `/team/invite` | AC-TEAM-002/003 tests |
| REQ-TEAM-003 / US-TEAM-003 (assign role) | `changeMemberRole` + row form | AC-TEAM-004/005 tests |
| REQ-TEAM-004 / US-TEAM-004 (remove member) | `removeMember` + row form | AC-TEAM-006/007 tests |
| REQ-TEAM-005 (prevent unauthorized role/membership changes) | server-side role gates in service + actions | negative role tests |
| BR-TEAM-001/002/003 (membership, one role, three roles) | existing `Membership` + `Role` enum (unchanged) | schema review |
| BR-TEAM-004/005/006 (OWNER manages, MANAGER invites, MEMBER cannot invite) | invite gates in service/action | invite role tests |
| BR-TEAM-007/008 (MEMBER cannot assign roles/remove) | gates in service/actions | AC-TEAM-005 + removal tests |
| BR-TEAM-009 / AC-TEAM-007 (OWNER cannot be removed) | `removeMember` rejects OWNER targets | removal tests |
| BR-TEAM-010 (no cross-workspace management) | every query keyed by `(workspaceId, membershipId)` | isolation tests |
| BR-WS-002 (always ≥ 1 OWNER) | `countWorkspaceOwners` checks in role change/removal | last-OWNER tests |
| Validation (§7) | Zod schemas for email, role, membership id at the server boundary | schema tests |
| Error cases (§8) | typed service codes → action messages (unauthorized, invalid role, member does not exist, member belongs to another workspace, duplicate membership, attempt to remove OWNER) | negative tests |
| Edge cases (§10) | invited twice / already a member → `already_member`; invalid role → `invalid_input`; self role change → `own_membership`; remove OWNER → `cannot_remove_owner`; invitation expiry/acceptance → N/A (see §11) | edge-case tests |

### Delegated decisions (documented, no product change)

The following decisions are finalizations of explicitly delegated spec
points and are recorded here so the implementation does not invent
requirements silently:

1. **Invitation design — membership creation.** The spec's invitation
   behavior (invite a valid user → "an invitation is created") is
   implemented as: an OWNER/MANAGER invites an **existing registered
   FlowDesk user** (identified by email) and the workspace **membership is
   created immediately** with the requested role. No email delivery, no
   pending invitation record, no expiry/acceptance step — consistent with
   the request constraint "do not invent invitation infrastructure". The
   spec edge cases "Invitation expires" and "Invitation is accepted after
   membership already exists" describe a pending-invitation lifecycle the
   spec never defines (no acceptance story, no UI surface, no expiry
   duration); under this model they are N/A and are reported in §11.
2. **Finalized MANAGER role-assignment rules** (spec §6 says these "must be
   finalized before implementation"; the permission matrix grants MANAGER
   "Assign Roles ✓*" subject to the Team spec): MANAGER may assign the
   MANAGER or MEMBER role, and only to members who currently hold MANAGER or
   MEMBER. MANAGER may never assign the OWNER role and may never change an
   OWNER's role. OWNER may assign any role to any member. Self role changes
   are rejected (edge case "User attempts to modify their own role").
3. **OWNER removal is always rejected**, not only when it would leave zero
   OWNERs: BR-TEAM-009 and AC-TEAM-007 state that any normal member-removal
   operation targeting the OWNER is rejected. This is stronger than the
   last-OWNER invariant; the last-OWNER check remains as defense-in-depth
   for role changes.
4. **Role changes are single-field updates** (no optimistic concurrency on
   the team list): the role `<select>` reflects the latest server render,
   and a role change is a small, idempotent-enough mutation. The spec
   defines no concurrency requirement for Team.

## 5. Implementation Tasks

Tasks are ordered by dependency.

### Task 1: Team role constants + validation schemas

**Purpose**

Server-boundary Zod validation for all Team input, plus the role constants
shared by UI and validation (mirrors `deals/stages.ts`).

**Files**

- `src/features/team/roles.ts` (new)
- `src/features/team/schemas.ts` (new)

**Changes**

- `roles.ts`: `TEAM_ROLES = ["OWNER", "MANAGER", "MEMBER"] as const`,
  `TeamRole` type, `TEAM_ROLE_LABELS` display map.
- `schemas.ts`:
  - `email`: trimmed, lowercased, ≤ 254, valid email (same shape as
    Customers).
  - `role`: `z.enum(TEAM_ROLES)` — invalid roles rejected server-side
    (a client-supplied role value is never authoritative).
  - `inviteMemberSchema` = `{ email, role }`.
  - `changeRoleSchema` = `{ membershipId, role }`.
  - `membershipIdSchema`: required, 1–64 chars, `^[a-z0-9]+$` (invalid
    member IDs rejected).

**Dependencies**

- None.

**Verification**

- Schema unit tests.

### Task 2: Team service (data access + authorization)

**Purpose**

All Team data access and the authorization rules, scoped by the authorized
`workspaceId` and driven by the server-resolved actor role — never by
client input alone (`docs/architecture/database.md` §10).

**Files**

- `src/features/team/service.ts` (new)
- `src/features/workspace/service.ts` (reuse `countWorkspaceOwners` — no
  change)

**Changes**

- `listTeamMembers(workspaceId)` — `Membership.findMany({ where: {
  workspaceId } })` with `user { id, email }`, ordered by `createdAt` asc,
  flattened to `{ id, userId, email, role, createdAt }`. Only members of the
  caller's (server-resolved) workspace are ever returned (AC-TEAM-001).
- `inviteMember(workspaceId, actorRole, input)`:
  1. Validate `{ email, role }` → `invalid_input`.
  2. Gate actor: `actorRole ∈ { OWNER, MANAGER }` else `unauthorized`
     (BR-TEAM-006); `actorRole === "MANAGER" && role === "OWNER"` →
     `cannot_assign_owner` (finalized rule 2).
  3. Resolve the invitee by email — must be a registered user →
     `user_not_found` otherwise.
  4. Existing membership in `workspaceId` → `already_member` (edge cases
     "already a member" / "invited twice"; `P2002` on create maps to the
     same code as defense).
  5. `membership.create({ userId, workspaceId, role })`.
- `changeMemberRole(workspaceId, actorUserId, actorRole, membershipId,
  requestedRole)`:
  1. Validate `{ membershipId, role }` → `invalid_input`.
  2. Load target membership scoped by `(id, workspaceId)` → `not_found`
     (missing and foreign indistinguishable).
  3. `actorRole === "MEMBER"` → `unauthorized` (BR-TEAM-007).
  4. MANAGER rules (finalized rule 2): target holds OWNER →
     `cannot_change_owner`; requested OWNER role → `cannot_assign_owner`.
  5. Last-OWNER protection (BR-WS-002): target holds OWNER, requested role
     is not OWNER, and `countWorkspaceOwners(workspaceId) === 1` →
     `last_owner` (no operation may leave the workspace without an OWNER).
  6. Self-change (edge case "modify their own role"): target's userId ===
     `actorUserId` → `own_membership`.
  7. `updateMany({ where: { id, workspaceId }, data: { role } })`; count 0 →
     `not_found`.
- `removeMember(workspaceId, actorRole, membershipId)`:
  1. Validate `membershipId` → `invalid_input`.
  2. Load target membership scoped by `(id, workspaceId)` → `not_found`.
  3. `actorRole !== "OWNER"` → `unauthorized` (BR-TEAM-008, matrix: Remove
     Members is OWNER-only).
  4. Target holds OWNER → `cannot_remove_owner` (BR-TEAM-009, AC-TEAM-007).
  5. `deleteMany({ where: { id, workspaceId } })`; count 0 → `not_found`
     (AC-TEAM-006).
- Typed results `{ ok: true; value } | { ok: false; code }`; no
  `next/navigation` imports (pages/actions map codes).

**Dependencies**

- Task 1.

**Verification**

- Integration tests incl. the full role matrix, isolation, last-OWNER
  protection.

### Task 3: Server actions

**Purpose**

Mutations with server-side authorization: resolve the session workspace
server-side, then act. Never trust client workspaceId/userId/role.

**Files**

- `src/features/team/messages.ts` (new)
- `src/features/team/actions.ts` (new, `"use server"`)

**Changes**

- All three actions call `requireSessionWorkspace()` → `{ user, workspace }`;
  the workspace id and role used for every service call come from that
  server-resolved context, never from form data.
- `inviteMemberAction(prev, formData)` — parse `{ email, role }` →
  field errors on invalid input → invite → redirect `/team` on success;
  maps `unauthorized` → invite-unauthorized message, `cannot_assign_owner`,
  `user_not_found`, `already_member`, generic.
- `changeMemberRoleAction(prev, formData)` — parse `{ membershipId, role }`
  → field errors on invalid input → call service with
  `(workspace.workspaceId, user.id, workspace.role, …)` → redirect `/team`;
  maps `unauthorized`, `cannot_change_owner`, `cannot_assign_owner`,
  `own_membership`, `last_owner`, `not_found`, generic.
- `removeMemberAction(prev, formData)` — parse `membershipId` (invalid →
  member-not-found message, same convention as customer delete) →
  call service → redirect `/team`; maps `unauthorized`,
  `cannot_remove_owner`, `not_found`, generic.
- Messages module: one user-facing string per code/operation (mirrors
  `customers/messages.ts` conventions).

**Dependencies**

- Task 2; existing Workspace `session-workspace.ts`.

**Verification**

- Action tests: success redirects, validation, role rejection without
  touching the service, client-supplied identity ignored, code→message
  mapping, unauthenticated/non-member propagation.

### Task 4: Team UI

**Purpose**

`/team` list with role-aware management controls and `/team/invite` form,
using the existing shell and design tokens, with loading/error/validation
feedback.

**Files**

- `src/app/(dashboard)/team/page.tsx` (new)
- `src/app/(dashboard)/team/invite/page.tsx` (new)
- `src/app/(dashboard)/team/loading.tsx` (new)
- `src/features/team/components/RoleBadge.tsx` (new)
- `src/features/team/components/MemberRoleForm.tsx` (new, client)
- `src/features/team/components/RemoveMemberForm.tsx` (new, client)
- `src/features/team/components/InviteMemberForm.tsx` (new, client)
- `src/app/components/layout/Sidebar.tsx` (modified — add Team link between
  Activities and Settings)

**Changes**

- `/team` page: `requireSessionWorkspace()` → `listTeamMembers`. Header with
  "Team" title and an "Invite member" link shown only to OWNER/MANAGER
  (UI reflects the role; the action enforces it independently). Member rows:
  email (+ "You" for the current user, from the server-resolved `user.id`),
  `RoleBadge`, and per-row controls:
  - Role change form for OWNER/MANAGER — hidden for the current user's row
    (self-changes are rejected server-side) and hidden on OWNER rows for
    MANAGERs; the MANAGER variant offers only MANAGER/MEMBER options, the
    OWNER variant offers all three (server enforces regardless).
  - Remove form for OWNER only, never on OWNER rows.
  - No empty state is reachable (BR-WS-002 guarantees ≥ 1 OWNER); the list
    renders unconditionally. Loading state via `team/loading.tsx` (skeleton,
    existing pattern).
- `/team/invite` page: `requireSessionWorkspace()`; MEMBERs see an
  unauthorized notice instead of the form (direct navigation is not a
  security boundary — the action still rejects).
- Components follow the CustomerForm/DeleteCustomerForm conventions
  (`useActionState`, inline `FieldErrors`, pending labels, design tokens).
- Sidebar: Team link between Activities and Settings.

**Dependencies**

- Tasks 2–3; existing shell.

**Verification**

- `pnpm typecheck` / `pnpm lint`; manual smoke of list/invite/role/remove.

### Task 5: Tests

**Purpose**

Cover acceptance criteria, the full role matrix, isolation, owner
protection, invitation behavior, validation, and edge cases.

**Files**

- `src/features/team/schemas.test.ts` (new)
- `src/features/team/service.test.ts` (new, DB integration)
- `src/features/team/actions.test.ts` (new, mocked boundary)

**Changes**

- Schemas: valid/invalid/missing input; invalid role; invalid/malformed/
  over-length membership ids; email normalization.
- Service (seed via `registerUser` + `prisma.membership` upserts): listing
  returns only own-workspace members (AC-TEAM-001); invite by OWNER and
  MANAGER (AC-TEAM-002), MEMBER rejected (AC-TEAM-003), MANAGER cannot
  invite as OWNER, unknown email, already-a-member, invited twice, invalid
  role; role change by OWNER (AC-TEAM-004), MEMBER rejected (AC-TEAM-005),
  MANAGER boundaries (target OWNER, request OWNER role), OWNER assigning
  OWNER role, self-change, last-OWNER protection (single-OWNER workspace
  keeps ≥ 1 OWNER after every rejected attempt), cross-workspace target →
  not_found; removal by OWNER (AC-TEAM-006), MANAGER/MEMBER rejected,
  OWNER-target removal rejected (AC-TEAM-007), cross-workspace →
  not_found, malformed ids → invalid_input.
- Actions: success redirects to `/team`; validation field errors without
  calling the service; MEMBER rejections without calling the service;
  client-supplied workspaceId/role/userId ignored (server context used);
  code→message mapping; unauthenticated → login redirect and non-member →
  notFound propagate from `requireSessionWorkspace`.

**Dependencies**

- Tasks 1–4.

**Verification**

- `pnpm test` passes.

### Task 6: Verification

**Purpose**

Run the full verification checklist.

**Files**

- None (verification only).

**Changes**

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` — fix failures
  in Team scope and re-run.

**Dependencies**

- All prior tasks.

**Verification**

- Checklist (section 9) satisfied.

## 6. Database Changes

**No database changes required.** The existing `Membership` model already
provides everything the Team spec requires:

- A member belongs to exactly one workspace per membership row
  (BR-TEAM-001) with `@@unique([userId, workspaceId])`.
- Exactly one workspace-scoped role per membership (BR-TEAM-002) via the
  `Role` enum `OWNER | MANAGER | MEMBER` (BR-TEAM-003).
- Invitation is implemented as membership creation (§4), so no invitation
  table is introduced.

`countWorkspaceOwners` (already present in `src/features/workspace/service.ts`)
is reused for the last-OWNER protection.

## 7. Authorization & Security

### Authentication requirements

- Identity always comes from the Auth.js session via
  `requireSessionWorkspace()`: `userId`, `workspaceId`, membership, and role
  are resolved server-side. Client-provided `userId`, `workspaceId`, `role`,
  and `membership` are never read (BR-AUTH-005, BR-WS-004).
- Unauthenticated requests to `/team*` are redirected to `/login` by
  middleware + layout; authenticated non-members are denied (404) by
  `requireSessionWorkspace`.

### Authorization requirements (finalized role rules)

| Operation | OWNER | MANAGER | MEMBER |
|---|---:|---:|---:|
| View team | ✓ | ✓ | ✓ |
| Invite member (any role) | ✓ | — | — |
| Invite member (MANAGER/MEMBER role) | ✓ | ✓ | — |
| Assign any role | ✓ | — | — |
| Assign MANAGER/MEMBER to non-OWNER members | ✓ | ✓ | — |
| Change own role | — | — | — |
| Remove members | ✓ | — | — |
| Remove an OWNER | — | — | — |

- MEMBER rejection happens before any data access in the service (and the
  action gate for invites), independently of the UI (BR-TEAM-006/007/008).
- MANAGER cannot touch OWNER memberships in any direction
  (`cannot_change_owner`, `cannot_assign_owner`).
- OWNER protection: `removeMember` rejects any OWNER target
  (`cannot_remove_owner` — BR-TEAM-009 / AC-TEAM-007); `changeMemberRole`
  rejects any change that would leave the workspace with zero OWNERs
  (`last_owner`, via `countWorkspaceOwners`); self role changes are rejected
  (`own_membership`).
- The role is never an input to the authorization boundary — it is read from
  the membership row (`requireSessionWorkspace`), and the requested role
  value is validated against the `Role` enum server-side.

### Workspace isolation

- Every read/mutation is keyed by the server-resolved `workspaceId`:
  members are listed only for that workspace, and target memberships are
  loaded/updated/deleted with `workspaceId` in the WHERE clause. A
  membership id from another workspace is indistinguishable from a missing
  one (`not_found`, no disclosure) — BR-TEAM-010.

### Validation

- Zod at the server boundary: invite email (format/normalization), role
  (enum), membership ids (shape). Client-side validation is UX-only.

### Security-sensitive failure cases

- Unauthorized invite/role-change/removal → role-appropriate message; no
  data touched.
- Unknown invitee email → safe "no account" message.
- Already a member / invited twice → duplicate-membership message.
- Missing or foreign member → "member not found".
- Attempt to remove/change an OWNER → owner-protection messages.
- Unexpected failures → generic message, no internals exposed.

## 8. Testing Plan

| Criterion | Test |
|---|---|
| AC-TEAM-001 (list only own workspace) | Service integration: only the session workspace's members returned |
| AC-TEAM-002 (OWNER/MANAGER invite creates membership) | Service + action tests |
| AC-TEAM-003 (MEMBER invite rejected) | Service + action tests (service untouched) |
| AC-TEAM-004 (authorized role change persists) | Service + action tests |
| AC-TEAM-005 (MEMBER role change rejected) | Service + action tests (service untouched) |
| AC-TEAM-006 (OWNER removes eligible member) | Service + action tests |
| AC-TEAM-007 (removal targeting OWNER rejected) | Service + action tests |
| BR-TEAM-009 / BR-WS-002 (OWNER protection, last OWNER) | Last-OWNER + owner-removal tests; invariant asserted after rejected attempts |
| BR-TEAM-010 (no cross-workspace management) | Foreign membershipId → not_found on change/remove |
| Validation (§7) | Schema tests: missing/invalid email, invalid role, malformed ids |
| Edge cases (§10) | invited twice / already a member; invalid role; self role change; remove OWNER; expiry/acceptance → N/A (documented) |
| Client-trust rules | Actions ignore client workspaceId/role/userId; role from server context only |
| Unauthenticated/non-member | Propagated from `requireSessionWorkspace` (redirect/notFound) |

## 9. Verification Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new team tests + full suite)
- [ ] `pnpm build` passes
- [ ] AC-TEAM-001..007 verified
- [ ] Role matrix verified (OWNER/MANAGER/MEMBER boundaries)
- [ ] Workspace isolation verified (listing, role change, removal)
- [ ] OWNER protection verified (no OWNER removal, last-OWNER safety)
- [ ] Validation verified (server-side Zod)
- [ ] No unrelated files changed

## 10. Risks & Open Questions

1. **Invitation model.** The spec's acceptance criteria require that
   inviting a valid user "creates an invitation", while its edge cases
   (expiry, acceptance after membership) imply a pending-invitation
   lifecycle the spec never otherwise defines (no acceptance user story, no
   UI surface, no expiry duration). Per the request constraint "do not
   invent invitation infrastructure", this plan implements invitation as
   **membership creation for an existing registered user**. The two
   lifecycle edge cases are therefore N/A and are reported as a spec gap;
   if a pending-invitation flow is ever wanted, it requires a separate
   feature spec (invitation model, expiry policy, acceptance surface,
   email delivery decision).
2. **MANAGER role-assignment rules.** Spec §6 explicitly defers these
   ("must be finalized before implementation"); the permission matrix
   grants MANAGER "Assign Roles ✓*". Finalized in §7 (MANAGER manages
   MANAGER/MEMBER members only, never OWNERs, never the OWNER role) and
   recorded here as a documented decision, not a product change.
3. **Role change concurrency.** Single-field updates without optimistic
   concurrency; last write wins. Adequate for the MVP; can be revisited if
   the product later requires it.
4. **Invitee cannot see the invited workspace.** The invitee gains a
   membership, but the MVP resolves the user's primary workspace context
   only (multi-workspace UX is out of scope for the MVP, consistent with
   all prior feature plans). The inviter's team list is the observable
   outcome of an invitation.

## 11. Scope Confirmation

`READY_FOR_IMPLEMENTATION`

No new product or architecture decisions are required beyond the documented
finalizations in §4 (invitation as membership creation; MANAGER
role-assignment boundaries; OWNER removal always rejected; no OCC on role
changes), which resolve explicitly deferred points in `docs/features/team.md`
(§6) without contradicting `docs/product/roles-permissions.md` or the
architecture baseline. The plan is treated as approved for this task and
implemented in the same session. The two invitation-lifecycle edge cases
from spec §10 are reported (not silently implemented) as a spec gap.