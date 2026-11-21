# ADR-003: Enforce Connection-Time Handshake Auth Middleware (`io.use`) with Role-Based Routing

- **Status**: Accepted
- **Date**: 2026-11-22
- **Authors**: Core Engineering Team
- **Deciders**: Larry Kingstone
- **Technical Story**: Evolution from post-connection `authenticate` event to `io.use()` handshake validation

---

## 1. Context & Problem Statement

An earlier iteration of the system accepted unauthenticated sockets first and relied on clients emitting a post-connection `authenticate` event (`{ userId, role }`). That design created race conditions where clients could emit `sendMessage` before authentication completed, allowed unauthenticated sockets to linger in memory, and required clients to re-send `userId` inside message payloads.

---

## 2. Decision

We will validate client identity and role during the Socket.IO connection handshake using **`io.use()` middleware** reading `socket.handshake.auth`:

Implementation Details:
- Reject any handshake missing a truthy `userId` or a `role` outside `['admin', 'user']` via `next(new Error('Authentication error'))`.
- Derive `userId` and `role` exclusively from server-side `users.get(socket.id)` on every subsequent `send-message` and `send-private-message` event rather than trusting client-supplied sender IDs in message payloads.
- Guard `send-private-message` strictly to `senderData.role === 'admin'`.

---

## 3. Consequences

### Positive Impacts
- **Fail-Fast Rejection**: Unauthenticated clients never enter the `connection` handler or consume `users` Map entries.
- **Eliminates Auth Race Conditions**: Identity is guaranteed to exist before any event listener fires.
- **Server-Authoritative Sender Context**: Prevents undefined `userId` bugs and simplifies client `send-message` payloads to `{ text }`.

### Negative Impacts & Operational Costs
- **Boilerplate Trust Boundary**: Passing raw `{ userId, role }` in `socket.handshake.auth` is suitable for local development/tutorials only; production deployments must replace this with cryptographic token verification (e.g., JWT in `auth.token`) inside the same `io.use()` hook.

### Risks and Mitigations
- **Risk**: In production, a malicious client could self-assign `role: "admin"` if raw handshake fields are left unverified.
- **Mitigation**: Explicitly documented as a Critical production requirement in `SECURITY.md` and `docs/architecture/security-and-rbac.md`. The `io.use()` middleware boundary is already positioned cleanly for drop-in JWT verification.

---

## 4. Alternatives Considered & Disqualification Rationale

### Option A: Post-Connection `authenticate` Event
- *Pros*: Allows anonymous browsing before upgrading to an authenticated session on the same socket.
- *Cons*: Introduces unauthenticated socket limbo, timeout management overhead, and race conditions between `connect` and `send-message`.

### Option B: Query-String Auth Parameters (`?userId=...&role=...`)
- *Pros*: Supported in older Socket.IO v2 clients.
- *Cons*: Leaks credentials/tokens into reverse-proxy access logs, browser history, and server logs. `socket.handshake.auth` is the Socket.IO v4 recommended mechanism.
