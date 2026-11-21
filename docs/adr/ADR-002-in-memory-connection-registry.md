# ADR-002: Use In-Memory `Map` and `Set` Connection Registry for Single-Node Boilerplate

- **Status**: Accepted
- **Date**: 2026-11-22
- **Authors**: Core Engineering Team
- **Deciders**: Larry Kingstone
- **Technical Story**: Connection state and presence management in `server.js`

---

## 1. Context & Problem Statement

The server must track active socket identities (`userId`, `role`), distinguish admin sockets from end-user sockets for fan-out notifications, and resolve target sockets for private messaging. As a zero-infrastructure learning and starter boilerplate, developers should be able to clone the repository and run `npm install && npm run dev-server` without provisioning Redis or a database.

---

## 2. Decision

We will maintain connection state in two process-local JavaScript collections inside `server.js`:
- `users = new Map()` mapping `socket.id -> { userId, role }` for `O(1)` lookup on every message and disconnect event.
- `adminSockets = new Set()` storing active admin `socket.id` values for `O(A)` fan-out of user messages and presence updates without scanning all connected users.

---

## 3. Consequences

### Positive Impacts
- **Zero External Dependencies**: Instant local startup with Node.js alone.
- **Low Latency**: Sub-millisecond in-memory lookups and mutations.
- **Simple Mental Model**: Easy to inspect, debug, and extend for learning and prototyping.

### Negative Impacts & Operational Costs
- **Single-Node Ceiling**: State is not shared across multiple Node.js processes or containers; horizontal scaling will split presence and break cross-node private messaging.
- **Ephemeral State**: Process restarts drop all active connections and clear presence state (no persisted chat history).
- **Linear Private-Message Lookup**: `send-private-message` performs an `O(N)` iteration over `users` to locate `targetUserId` and stops at the first matching socket.

### Risks and Mitigations
- **Risk**: Memory growth if disconnect cleanup is ever bypassed.
- **Mitigation**: All cleanup occurs deterministically inside the `disconnect` handler, removing the socket from both `adminSockets` and `users`.
- **Migration Trigger**: Once concurrent connections exceed a single node's capacity or high-availability multi-replica deployment is required, supersede this ADR by adopting `@socket.io/redis-adapter` and Socket.IO Rooms (`room:admins`, `room:user:<userId>`).

---

## 4. Alternatives Considered & Disqualification Rationale

### Option A: Redis Adapter from Day One
- *Pros*: Horizontally scalable out of the box, supports multi-tab delivery via rooms.
- *Cons*: Adds mandatory Docker/Redis setup friction to a minimal boilerplate whose primary goal is zero-config local onboarding.

### Option B: Database-Backed Presence Table
- *Pros*: Durable audit trail.
- *Cons*: High write amplification on connect/disconnect churn and stale rows after ungraceful process crashes.
