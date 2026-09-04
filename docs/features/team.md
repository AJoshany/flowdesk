# FlowDesk — Team Feature Specification

## 1. Goal

Allow authorized workspace users to manage members, invitations, and
roles.

---

## 2. Actors

- OWNER
- MANAGER
- MEMBER

---

## 3. User Stories

### US-TEAM-001 — View Members

As a workspace member,
I want to view workspace members,
so that I know who belongs to my team.

### US-TEAM-002 — Invite Member

As an authorized user,
I want to invite a new member,
so that they can join the workspace.

### US-TEAM-003 — Assign Role

As an authorized user,
I want to assign a workspace role,
so that members have appropriate access.

### US-TEAM-004 — Remove Member

As an OWNER,
I want to remove a member,
so that workspace access can be revoked.

---

## 4. Business Rules

### BR-TEAM-001

Every member belongs to a workspace.

### BR-TEAM-002

Every member has exactly one role within a workspace.

### BR-TEAM-003

Supported roles are:

- OWNER
- MANAGER
- MEMBER

### BR-TEAM-004

OWNER can manage workspace membership.

### BR-TEAM-005

MANAGER may invite members.

### BR-TEAM-006

MEMBER cannot invite members.

### BR-TEAM-007

MEMBER cannot assign roles.

### BR-TEAM-008

MEMBER cannot remove members.

### BR-TEAM-009

OWNER cannot be removed through normal member management.

### BR-TEAM-010

Users cannot manage members of another workspace.

---

## 5. Functional Requirements

### Member List

Authorized users can view workspace members.

### Invitation

Users with the required permission can invite a member.

### Role Assignment

Users with the required permission can assign supported roles.

### Member Removal

OWNER can remove members from the workspace.

---

## 6. Role Assignment Rules

Role assignment must respect the following boundaries:

- MEMBER cannot assign roles.
- MEMBER cannot promote themselves.
- MEMBER cannot modify another member's role.
- OWNER retains ownership authority.
- OWNER cannot be removed through normal member management.

Detailed rules for MANAGER role assignment must be finalized before
implementation.

---

## 7. Validation

Team operations must validate:

- Target user/member.
- Workspace membership.
- Requested role.
- Current user's authorization.
- Invitation state where applicable.

---

## 8. Error Cases

- Unauthorized role assignment.
- Unauthorized invitation.
- Unauthorized member removal.
- Invalid role.
- Member does not exist.
- Member belongs to another workspace.
- Duplicate membership.
- Attempt to remove OWNER.

---

## 9. Acceptance Criteria

### AC-TEAM-001

Given an authorized workspace member,
when they request the team list,
then only members of their workspace are returned.

### AC-TEAM-002

Given an OWNER or MANAGER,
when they invite a valid user,
then an invitation is created.

### AC-TEAM-003

Given a MEMBER,
when they attempt to invite a user,
then the operation is rejected.

### AC-TEAM-004

Given an authorized role manager,
when they assign a valid role,
then the member's role is updated.

### AC-TEAM-005

Given a MEMBER,
when they attempt to assign a role,
then the operation is rejected.

### AC-TEAM-006

Given an OWNER,
when they remove an eligible member,
then the member loses workspace access.

### AC-TEAM-007

Given the workspace OWNER,
when any normal member removal operation targets the OWNER,
then the operation is rejected.

---

## 10. Edge Cases

- User is invited twice.
- User is already a member.
- Invalid role supplied.
- User attempts to modify their own role.
- User attempts to remove the OWNER.
- Invitation expires.
- Invitation is accepted after membership already exists.

---

## 11. Definition of Done

- Member listing works.
- Invitations work.
- Role assignment works.
- Member removal works.
- Authorization is enforced server-side.
- Workspace isolation is enforced.
- Critical permission boundaries are tested.
- Typecheck passes.
- Lint passes.