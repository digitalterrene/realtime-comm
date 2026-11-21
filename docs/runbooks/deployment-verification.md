# Deployment Verification Runbook

*Tier 4 Operational Runbook* — Step-by-step smoke tests and verification procedures after starting or deploying `server.js`.

---

## 1. Pre-Flight Checklist

- [ ] Node.js version satisfies `>= 18.0.0` (`node -v`).
- [ ] Dependencies installed cleanly (`npm ci` in CI/production, or `npm install` locally).
- [ ] Target port (`PORT`, default `4000`) is free and reachable.
- [ ] For production deployments, all items in [Security & RBAC Hardening](../architecture/security-and-rbac.md#4-threat-model--production-hardening-checklist) are implemented.

---

## 2. Post-Deployment Smoke Tests

### Step 1: Verify Syntax & Process Startup
```bash
node --check server.js
npm run start-server
```
Expected log output:
```text
Server listening on port 4000
```

### Step 2: Verify HTTP Health Endpoint
```bash
curl -fsS http://localhost:4000/health
```
Expected response (`HTTP 200 OK`):
```json
{"status":"healthy","users":0,"admins":0}
```

### Step 3: Verify CORS Headers for Allowed Origins
```bash
curl -i -s -X OPTIONS http://localhost:4000/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
```
Verify the response includes:
```text
Access-Control-Allow-Origin: http://localhost:3000
```
Repeat with `Origin: http://localhost:8080` for the Vite client.

### Step 4: Verify Socket.IO Engine Polling Handshake
```bash
curl -fsS "http://localhost:4000/socket.io/?EIO=4&transport=polling"
```
Expected output begins with `0{"sid":"...","upgrades":["websocket"],...}`.

### Step 5: Verify End-to-End Messaging Flows (Manual / Staging)
1. Open the Next.js Admin Dashboard (`http://localhost:3000`) — confirm status dot turns **green** (`Connected`) and `GET /health` reports `"users":1,"admins":1`.
2. Open the Vite User Client (`http://localhost:8080`) with an authenticated user — confirm status turns **green** (`Connected to support`), admin dropdown adds `User <id>`, and `GET /health` reports `"users":2,"admins":1`.
3. Send a message from User Client — confirm it appears in Admin Dashboard with timestamp.
4. Send a broadcast (`All Users`) from Admin Dashboard — confirm it appears in both Admin Dashboard and User Client.
5. Select the specific user in Admin Dashboard and send a private message — confirm it renders with the purple `Private message` indicator on both sides.
6. Close User Client tab — confirm admin user count decrements and `GET /health` returns `"users":1,"admins":1`.

---

## 3. Rollback Criteria

Trigger an immediate rollback to the previous known-good release if any of the following occur within 15 minutes of deployment:
- `GET /health` returns non-200 or times out across 3 consecutive probes.
- Socket.IO handshake error rate (`Authentication error` or CORS rejections for valid origins) spikes unexpectedly.
- Uncaught exceptions cause process crash loops (`pm2` / container restart count > 3).
- Memory RSS grows monotonically without plateauing after active connections disconnect.
