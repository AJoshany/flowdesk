# FlowDesk — Authentication Architecture

## 1. Purpose

This document defines the authentication architecture for FlowDesk.

Authentication establishes the identity of a user.

Authorization determines what the authenticated user is allowed to do
and is defined separately.

---

## 2. Authentication Provider

FlowDesk uses Auth.js for authentication.

Authentication implementation details must follow the current Auth.js
integration supported by the project's Next.js architecture.

---

## 3. Authentication States

The application must distinguish between:

### Unauthenticated

The user has no valid authenticated session.

Protected application areas must reject access.

### Authenticated

The user has a valid authenticated session.

The application may resolve the user's workspace membership and
permissions.

---

## 4. Registration

The registration flow must:

1. Validate the submitted input.
2. Create the user account.
3. Create or establish the user's initial workspace.
4. Create the appropriate workspace membership.
5. Assign the initial user the OWNER role.
6. Authenticate the user.
7. Redirect the user to the appropriate protected application area.

Exact behavior will be defined in the Authentication feature
specification.

---

## 5. Login

The login flow must:

1. Validate credentials.
2. Authenticate the user.
3. Establish a valid session.
4. Redirect the user to the appropriate application area.

Invalid credentials must not reveal unnecessary information about
whether a specific account exists.

---

## 6. Logout

Authenticated users must be able to terminate their session.

After logout, protected application routes must no longer be accessible
through the invalidated session.

---

## 7. Protected Routes

Protected application routes must require authentication.

Examples include:

- `/dashboard`
- `/customers`
- `/deals`
- `/activities`
- `/team`
- `/settings`

The exact route protection mechanism is an implementation detail and
must comply with the project's Next.js architecture.

---

## 8. Session Data

Session data should contain only the information required for
authentication and application context.

Sensitive information must not be unnecessarily exposed to the client.

Workspace-specific authorization data should be resolved through the
appropriate server-side authorization layer.

---

## 9. Authorization Boundary

Authentication does not grant access to every operation.

After identifying the user, the application must determine:

1. Which workspace the operation concerns.
2. Whether the user belongs to that workspace.
3. Which role the user has.
4. Whether that role has permission to perform the requested operation.

---

## 10. Security Requirements

The authentication system must:

- Never trust client-provided user identity.
- Never trust client-provided role information.
- Validate authentication input.
- Protect credentials and secrets.
- Avoid exposing sensitive authentication errors.
- Enforce protected routes server-side.

---

## 11. Authentication and Workspace Context

A valid authenticated session does not by itself determine authorization
for arbitrary workspace resources.

Workspace membership must be checked whenever access to workspace-owned
data is required.

---

## 12. Future Authentication Features

The following features are outside the initial authentication scope
unless explicitly added later:

- OAuth providers
- Two-factor authentication
- Password reset
- Email verification
- Single Sign-On
- Session management UI

These may be introduced through separate approved feature
specifications.