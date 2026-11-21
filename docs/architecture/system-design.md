# System Design & Component Topology

*Status*: Living Architecture Specification  
*Scope*: `server.js`, `admin/index.js`, `client/index.js`

---

## 1. Overview

The **Realtime Communication System** implements a hub-and-spoke, role-segmented messaging topology over **Socket.IO v4** and **Express 4**. A single Node.js process terminates both HTTP requests (health checks) and bidirectional Socket.IO connections from two distinct client roles:

1. **End Users (`role: "user"`)**: Connect from a Vite/React client (`http://localhost:8080`) using `client/index.js`. Users send support messages to admins and receive admin broadcasts or private replies.
2. **Administrators (`role: "admin"`)**: Connect from a Next.js dashboard (`http://localhost:3000`) using `admin/index.js`. Admins observe live user presence, receive all user messages, broadcast to all connected clients, and send private messages to individual users.

---

## 2. Component & Network Topology

```mermaid
flowchart TB
    subgraph UserBrowser["Vite User Client (localhost:8080)"]
        UC["UserChatBox\n(client/index.js)"]
        UCTX["UserContext\nuseUser()"]
        USOCK["socket.io-client\nauth: { userId, role: user }"]
        UCTX --> UC
        UC <--> USOCK
    end

    subgraph AdminBrowser["Next.js Admin Dashboard (localhost:3000)"]
        AC["AdminChatBox\n(admin/index.js)"]
        ASOCK["socket.io-client\nauth: { userId, role: admin }"]
        AC <--> ASOCK
    end

    subgraph RealtimeServer["Node.js Server (server.js — localhost:4000)"]
        direction TB
        HTTP["http.Server + Express App\nCORS: 8080, 3000"]
        HEALTH["GET /health\n200 JSON Status"]
        IO["Socket.IO Server v4\nCORS: 8080, 3000"]
        AUTH["Handshake Middleware\nio.use()"]
        ROUTER["Socket Event Handlers\nconnection / send-message /\nsend-private-message / disconnect"]
        REG[("In-Memory Registry\nusers: Map\nadminSockets: Set")]

        HTTP --> HEALTH
        HTTP --> IO
        IO --> AUTH
        AUTH -->|"Valid userId + role"| ROUTER
        ROUTER <--> REG
        HEALTH -.->|"Reads sizes"| REG
    end

    USOCK <-->|"WS / HTTP Long-Polling"| IO
    ASOCK <-->|"WS / HTTP Long-Polling"| IO
```

---

## 3. Core Communication Flows

### 3.1 Connection, Handshake Authentication & Presence Sync

```mermaid
sequenceDiagram
    autonumber
    participant User as User Client (Vite)
    participant Server as Socket.IO Server (server.js)
    participant Admin as Admin Dashboard (Next.js)

    Note over Admin,Server: Admin connects first
    Admin->>Server: Handshake { auth: { userId: "admin-xxx", role: "admin" } }
    Server->>Server: io.use() validates userId & role
    Server->>Server: users.set(socket.id, { userId, role: "admin" })
    Server->>Server: adminSockets.add(socket.id)
    Server-->>Admin: emit("user-list", [...onlineUserIds])

    Note over User,Server: User connects
    User->>Server: Handshake { auth: { userId: "usr-123", role: "user" } }
    Server->>Server: io.use() validates userId & role
    Server->>Server: users.set(socket.id, { userId: "usr-123", role: "user" })
    Server-->>Admin: io.to(adminId).emit("user-connected", "usr-123")
```

### 3.2 Messaging Flows (User → Admin, Admin Broadcast, Admin Private)

```mermaid
sequenceDiagram
    autonumber
    participant UserA as User A (usr-1)
    participant UserB as User B (usr-2)
    participant Server as Socket.IO Server
    participant Admin as Admin (admin-1)

    rect rgb(235, 245, 255)
        Note over UserA,Admin: Flow 1 — User-to-Admin Support Message
        UserA->>Server: emit("send-message", { text: "Need help" })
        Server->>Server: Build messageData { text, userId: "usr-1", timestamp, private: false }
        Server-->>Admin: io.to(adminId).emit("receive-message", messageData)
        Note right of UserB: User B does NOT receive User A's message
    end

    rect rgb(240, 255, 240)
        Note over UserA,Admin: Flow 2 — Admin Broadcast (selectedUser === "all")
        Admin->>Server: emit("send-message", { text: "Maintenance at 02:00 UTC" })
        Server->>Server: Build broadcast { ...messageData, from: "admin" }
        Server-->>UserA: io.emit("receive-message", broadcast)
        Server-->>UserB: io.emit("receive-message", broadcast)
        Server-->>Admin: io.emit("receive-message", broadcast)
    end

    rect rgb(248, 240, 255)
        Note over UserA,Admin: Flow 3 — Admin Private Message (selectedUser === "usr-1")
        Admin->>Server: emit("send-private-message", { targetUserId: "usr-1", text: "Checking now" })
        Server->>Server: Verify senderData.role === "admin"
        Server->>Server: Scan users Map for userId === "usr-1" & role === "user"
        Server-->>UserA: io.to(userASocketId).emit("receive-message", privateMsg)
        Server-->>Admin: socket.emit("receive-message", privateMsg)
        Note right of UserB: User B does NOT receive the private message
    end
```

### 3.3 Disconnection & Presence Cleanup

```mermaid
sequenceDiagram
    autonumber
    participant Client as Disconnecting Socket
    participant Server as Socket.IO Server
    participant Admins as Active Admin Sockets

    Client->>Server: disconnect
    Server->>Server: Lookup userData = users.get(socket.id)
    alt userData.role === "admin"
        Server->>Server: adminSockets.delete(socket.id)
    else userData.role === "user"
        Server-->>Admins: io.to(adminId).emit("user-disconnected", userData.userId)
    end
    Server->>Server: users.delete(socket.id)
```

---

## 4. Client Connection State Machine

Both `admin/index.js` and `client/index.js` manage connection status through Socket.IO lifecycle events:

```mermaid
stateDiagram-v2
    [*] --> Idle: Component mounted
    Idle --> Connecting: autoConnect true\n(Admin always; User when user.id exists)
    Connecting --> AuthRejected: io.use() rejects\n("Authentication error")
    Connecting --> Connected: "connect" event\n(isConnected = true)
    Connected --> Disconnected: "disconnect" event\n(isConnected = false)
    Disconnected --> Connecting: Socket.IO auto-reconnect
    Connected --> [*]: Component unmount\n(socket.off + socket.disconnect)
    AuthRejected --> [*]
```

---

## 5. Protocol & API Contract

### 5.1 HTTP Endpoints

| Method | Path | Response Status | Response Body | Notes |
|---|---|---|---|---|
| `GET` | `/health` | `200 OK` | `{"status":"healthy","users":<number>,"admins":<number>}` | `users` reports `users.size` (total active sockets, including admins); `admins` reports `adminSockets.size`. |

### 5.2 Socket.IO Handshake Contract

Clients must supply an `auth` object during connection initialization:

```javascript
{
  userId: "string (non-empty)",
  role: "admin" | "user"
}
```

If either `userId` is falsy or `role` is not `"admin"` or `"user"`, `io.use()` rejects the handshake with `Error("Authentication error")`.

### 5.3 Socket.IO Event Reference

#### Client → Server Events

| Event | Allowed Roles | Input Payload | Server Action |
|---|---|---|---|
| `send-message` | `user`, `admin` | `{ text: string }` | If `user`: emits `receive-message` to every socket in `adminSockets`. If `admin`: broadcasts `receive-message` via `io.emit()` with `from: "admin"`. |
| `send-private-message` | `admin` only | `{ targetUserId: string, text: string }` | Silently ignored if sender is not `admin`. Finds first socket in `users` where `userId === targetUserId && role === "user"`. Emits `receive-message` to target socket and echoes back to sender socket. |

#### Server → Client Events

| Event | Recipients | Payload Schema | Trigger |
|---|---|---|---|
| `user-list` | Newly connected `admin` | `string[]` | Immediately upon admin connection. |
| `user-connected` | All `adminSockets` | `string` (`userId`) | When a `user` socket completes connection. |
| `user-disconnected` | All `adminSockets` | `string` (`userId`) | When a `user` socket disconnects. |
| `receive-message` | Target admins / all / target user + sender admin | `{ text: string, userId: string, timestamp: string, private: boolean, from?: "admin", targetUserId?: string }` | Triggered by `send-message` or `send-private-message`. |

---

## 6. Known Reference-Implementation Caveats & Scaling Path

Engineering teams adopting this boilerplate for production should note the following current behaviors:

1. **Client Socket Memoization**: In `admin/index.js` (line 23) and `client/index.js` (line 15), `io(...)` is invoked directly inside the React component body. In React apps with frequent re-renders, move socket initialization into a `useRef` or `useEffect` hook so only one socket connection is created per mounted component lifecycle.
2. **User Self-Echo on `send-message`**: When a `user` emits `send-message`, `server.js` forwards it only to `adminSockets` and does not echo it back to the user's own socket. Either echo back on the server (`socket.emit('receive-message', messageData)`) or append optimistically in `UserChatBox`.
3. **Multi-Tab User Sessions**: `send-private-message` breaks after finding the first matching socket for `targetUserId`. Users open in multiple tabs will only receive private messages on one socket unless routed via Socket.IO Rooms (`socket.join(\`user:${userId}\`)`).
4. **Horizontal Scaling**: Because `users` and `adminSockets` live in Node.js process memory, running multiple server instances behind a load balancer requires replacing in-memory routing with `@socket.io/redis-adapter` and Socket.IO Rooms. See [ADR-002](../adr/ADR-002-in-memory-connection-registry.md).
