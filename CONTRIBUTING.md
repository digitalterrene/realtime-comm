# Contributing to Realtime Communication System

Thank you for your interest in contributing to **Realtime Communication System** (`digitalterrene/realtime-comm`). Maintaining a clean, predictable, and well-documented repository ensures that both engineers and AI agents can onboard and ship safely.

---

## 1. Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors regardless of experience level, background, or identity. Please treat everyone with respect and professional empathy.

---

## 2. Engineering Non-Negotiables

Before opening a Pull Request, read and follow our [Git Engineering Standards](./docs/git-standards.md).

**Key Rules:**
1. **Branch Naming**: Branch from `main` using `feat/<scope>-<desc>`, `fix/<scope>-<desc>`, `refactor/<scope>-<desc>`, `docs/<scope>-<desc>`, or `chore/<scope>-<desc>`.
2. **Conventional Commits**: Every commit must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification (e.g., `feat(server): add rate limiting to send-message`).
3. **Chain-of-Thought (CoT)**: For non-trivial changes or agent-assisted work, document the root cause, alternatives considered, and verification steps in the commit body.
4. **Zero Secrets in VCS**: Never stage `.env`, private keys, tokens, or diagnostic logs.
5. **Documentation Sync**: Any change to Socket.IO events, payloads, HTTP endpoints, or auth rules must update the corresponding Tier 2 blueprint in `docs/architecture/`.

---

## 3. Local Development Workflow

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`

### Setup & Iteration
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/digitalterrene/realtime-comm.git
   cd realtime-comm
   ```
2. Create an isolated branch:
   ```bash
   git checkout -b feat/server-add-jwt-auth
   ```
3. Install dependencies and configure local overrides (optional):
   ```bash
   cp .env.example .env
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev-server
   ```
5. Verify your changes locally:
   ```bash
   # Verify server syntax
   node --check server.js

   # Verify health endpoint responds HTTP 200
   curl -f http://localhost:4000/health

   # Run repository hygiene audit
   node .agents/skills/senior-repo-standards/scripts/audit-hygiene.js
   ```

---

## 4. Architectural Modifications & ADRs

If your contribution alters system boundaries, introduces external infrastructure (e.g., Redis adapter, database persistence), or changes the Socket.IO authentication/routing protocol:
1. Review the existing [Architecture Blueprints](./docs/architecture/).
2. Draft a new **Architecture Decision Record (ADR)** in [`docs/adr/`](./docs/adr/) copied from [`ADR-000-template.md`](./docs/adr/ADR-000-template.md) and register it in [`docs/adr/README.md`](./docs/adr/README.md).

---

## 5. Submitting a Pull Request

1. Rebase your branch against the latest `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```
2. Push your branch and open a PR using the [Pull Request Template](./.github/PULL_REQUEST_TEMPLATE.md).
3. Include **Verification Evidence** (curl output, server logs, or screenshots of client/admin chat flows).
4. Address review feedback with clean, atomic commits.
