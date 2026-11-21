# ADR-001: Adopt Socket.IO v4 over Raw WebSockets and SSE

- **Status**: Accepted
- **Date**: 2026-11-22
- **Authors**: Core Engineering Team
- **Deciders**: Larry Kingstone
- **Technical Story**: Core realtime transport selection

---

## 1. Context & Problem Statement

The Realtime Communication System requires bidirectional, low-latency messaging between a Node.js/Express backend, a Next.js admin dashboard, and a Vite user client. We need automatic reconnection, event-based multiplexing (`send-message`, `send-private-message`, `user-connected`, `user-list`), CORS support across distinct dev ports (`3000`, `8080`, `4000`), and a smooth path to horizontal scaling via rooms and adapters.

---

## 2. Decision

We will adopt **Socket.IO v4** (`socket.io@^4.7.2` on the server and `socket.io-client` on frontends) mounted on a shared Node.js `http.Server` alongside Express 4.

Implementation Details:
- Mount Express on `http.createServer(app)` so HTTP endpoints (`/health`) and WebSocket upgrades share a single port (`4000`).
- Use Socket.IO's built-in CORS configuration to allow `http://localhost:8080` and `http://localhost:3000`.
- Leverage named event channels (`send-message`, `send-private-message`, `receive-message`, `user-list`, `user-connected`, `user-disconnected`) instead of manual JSON envelope dispatching.

---

## 3. Consequences

### Positive Impacts
- **Developer Ergonomics**: Built-in reconnection with exponential backoff, heartbeat/ping-pong detection, and automatic fallback to HTTP long-polling behind restrictive corporate proxies.
- **Middleware & Room Primitives**: First-class `io.use()` handshake middleware and drop-in scaling via `@socket.io/redis-adapter`.
- **Clean Event Semantics**: Eliminates custom framing, serialization, and message-type switch boilerplate.

### Negative Impacts & Operational Costs
- **Protocol Coupling**: Clients must use a Socket.IO-compatible client library rather than the browser's native `WebSocket` API.
- **Wire Overhead**: Slight framing overhead compared to raw RFC 6455 WebSocket frames.

### Risks and Mitigations
- **Risk**: Sticky-session requirement when scaling horizontally behind a load balancer while HTTP long-polling fallback is enabled.
- **Mitigation**: Configure sticky sessions at the load balancer or restrict transports to `["websocket"]` once TLS/WSS is verified end-to-end.

---

## 4. Alternatives Considered & Disqualification Rationale

### Option A: Raw WebSockets (`ws`)
- *Pros*: Minimal wire overhead, standard browser `WebSocket` API.
- *Cons*: Requires hand-rolling reconnection, heartbeats, handshake auth ergonomics, room broadcasting, and multi-node Pub/Sub plumbing.

### Option B: Server-Sent Events (SSE) + REST `POST`
- *Pros*: Native HTTP/1.1 & HTTP/2, simple proxy traversal.
- *Cons*: Unidirectional server-to-client push; requires separate REST endpoints and auth middleware for client-to-server messaging, fragmenting connection presence tracking.
