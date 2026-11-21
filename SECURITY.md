# Security Policy & Vulnerability Reporting

The security and privacy of our systems and users are paramount. We appreciate the responsible disclosure of security issues and commit to working with researchers to investigate and resolve valid reports promptly.

---

## 1. Supported Versions

We actively maintain and provide security patches for the following versions:

| Version | Supported | Status |
|---|---|---|
| `1.x` (`main`) | :white_check_mark: | Actively supported |
| `< 1.0.0` | :x: | Unsupported; please upgrade to the latest release |

---

## 2. Boilerplate Security Notice

> [!CAUTION]
> **Realtime Communication System** ships as a learning and starter boilerplate. Out of the box, `server.js` trusts client-supplied `userId` and `role` values in `socket.handshake.auth` without cryptographic verification.
>
> Before deploying to production, you **must** implement the hardening controls documented in [docs/architecture/security-and-rbac.md](./docs/architecture/security-and-rbac.md) (JWT/session verification, TLS/WSS, rate limiting, input validation, and environment-driven CORS allowlists).

---

## 3. Reporting a Vulnerability

**DO NOT file public GitHub issues for security vulnerabilities.**

To report a vulnerability, please email:
📧 **`security@larrykingstone.com`** (or `hello@larrykingstone.com`)

Please include the following information in your report:
- **Component**: The affected file or endpoint (`server.js`, `admin/index.js`, `client/index.js`, or dependency).
- **Vulnerability Type**: e.g., Broken Access Control, Privilege Escalation, XSS, DoS, CORS Misconfiguration.
- **Proof of Concept**: Minimal steps, `curl` commands, or Socket.IO snippet to reproduce safely.
- **Impact Assessment**: Potential blast radius if exploited in a deployed environment.

---

## 4. Vulnerability Response SLA

| Severity | Initial Response | Assessment & Triage | Resolution Target |
|---|---|---|---|
| **Critical** | Within 12 hours | Within 24 hours | 48–72 hours |
| **High** | Within 24 hours | Within 48 hours | 7 business days |
| **Medium / Low** | Within 72 hours | Within 5 business days | Next release cycle |

---

## 5. Responsible Disclosure Guidelines

- Do not attempt to access, modify, or destroy user data.
- Do not perform Denial of Service testing against live deployments.
- Give the maintainers reasonable time to remediate the vulnerability before public disclosure.
- Contributors who report valid vulnerabilities will be acknowledged in release notes if desired.
